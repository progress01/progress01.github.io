'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const Search = require('../../themes/next/source/js/third-party/search/navigation-search');
const { anchorContent, passagesOf } = require('../lib/navigation-anchors');
const record = overrides => ({ id: 'article:/one/', kind: 'article', sources: ['article', 'learning'], title: '有工作的第N+6天',
  text: '中文 JavaScript <script> & 特殊字元 早段拉臂時機', url: '/one/', categories: ['隨筆'], tags: [], date: '2026-09-13',
  surfaces: ['profile', 'memory'],
  events: [{ kind: 'published', date: '2026-09-13' }, { kind: 'learning-added', date: '2026-08-29' }],
  learningItems: [{ id: 'reading-topic-01', title: '排球', note: '早段拉臂時機', addedDate: '2026-08-29' }],
  passages: [{ id: 'nav-one', text: '中文 JavaScript <script> & 特殊字元' }], ...overrides });
const micro = record({ id: 'micro-123', kind: 'microblog', sources: ['microblog'], title: '沒有被使用', text: '完整成果沒有被使用', surfaces: ['memory'],
  url: '/status/', categories: [], learningItems: [], passages: [], events: [{ kind: 'recorded', date: '2026-09-13' }] });

test('literal Chinese, English, + and HTML-sensitive keywords; metadata search; empty and no results', () => {
  const records = [record(), micro];
  assert.equal(Search.search(records, '有工作的第N+6天').length, 1);
  assert.equal(Search.search(records, '中文 JAVASCRIPT <script> &').length, 1);
  assert.equal(Search.search(records, '隨筆').length, 1);
  assert.equal(Search.search(records, '').length, 2);
  assert.equal(Search.search(records, '找不到此句').length, 0);
  assert.equal(Search.search(records, '中文 沒有被使用').length, 0);
});
test('source, category, month intersect, with dates scoped to the selected source', () => {
  for (const source of ['all', 'article', 'learning', 'microblog']) {
    for (const category of ['all', '隨筆', '不存在']) {
      for (const month of ['all', '2026-08', '2026-09', '2026-10']) {
        const records = [record(), micro];
        const expected = records.filter(item => (source === 'all' || item.sources.includes(source)) &&
          (category === 'all' || item.categories.includes(category)) &&
          (month === 'all' || item.events.some(event => event.date.startsWith(month) &&
            (source === 'all' || event.kind === { article: 'published', learning: 'learning-added', microblog: 'recorded' }[source]))));
        assert.deepEqual(Search.search(records, '', { source, category, month }).map(hit => hit.record.id).sort(), expected.map(item => item.id).sort());
      }
    }
  }
});
test('surface scope intersects existing source, category, month and query filters', () => {
  const profile = record({ id: 'profile', surfaces: ['profile'], title: '唯一 profile', categories: ['隨筆'] });
  const memory = record({ id: 'memory', surfaces: ['memory'], title: '唯一 memory', categories: ['隨筆'] });
  const dual = record({ id: 'dual', surfaces: ['profile', 'memory'], title: '雙面 dual', categories: ['工作'] });
  assert.deepEqual(Search.search([profile, memory, dual], '', { surface: 'profile' }).map(hit => hit.record.id), ['dual', 'profile']);
  assert.deepEqual(Search.search([profile, memory, dual], '唯一', { surface: 'memory', category: '隨筆' }).map(hit => hit.record.id), ['memory']);
  assert.deepEqual(Search.search([profile, memory, dual], '', { surface: 'profile', source: 'article', category: '隨筆', month: '2026-09' }).map(hit => hit.record.id), ['profile']);
});
test('search de-duplicates stable record IDs without merging distinct records that share a URL', () => {
  const first = record({ id: 'stable-one', url: '/shared/' });
  const duplicate = { ...first, title: 'duplicate copy' };
  const second = record({ id: 'stable-two', kind: 'microblog', sources: ['microblog'], url: '/shared/', title: 'different record', surfaces: ['memory'], learningItems: [], passages: [] });
  const result = Search.search([first, duplicate, second], '', { surface: 'all' });
  assert.deepEqual(result.map(item => item.record.id).sort(), ['stable-one', 'stable-two']);
  assert.equal(result.filter(item => item.record.url === '/shared/').length, 2);
});
test('result labels describe actual surfaces and remain independent of the active scope', () => {
  const profile = record({ id: 'profile-only', surfaces: ['profile'] });
  const memory = record({ id: 'memory-only', surfaces: ['memory'] });
  const dual = record({ id: 'dual-surface', surfaces: ['profile', 'memory'] });
  for (const [item, expected] of [[profile, '工作與學習'], [memory, '個人記憶庫'], [dual, '工作與學習・個人記憶庫']]) {
    const html = Search.render(Search.search([item], '', { surface: 'all' })[0], '');
    assert.match(html, new RegExp(`收錄於：${expected}`));
    assert.match(html, /class="search-result-surfaces"/);
  }
  assert.deepEqual(Search.search([dual], '', { surface: 'profile' }).map(hit => hit.record.surfaces), [['profile', 'memory']]);
  assert.deepEqual(Search.search([dual], '', { surface: 'memory' }).map(hit => hit.record.surfaces), [['profile', 'memory']]);
});
test('scope defaults, clear behavior, same-URL view restore and complete recent selection', () => {
  assert.equal(Search.defaultSurface('/', false), 'profile');
  assert.equal(Search.defaultSurface('/profile/', false), 'profile');
  assert.equal(Search.defaultSurface('/profile/articles/', false), 'profile');
  assert.equal(Search.defaultSurface('/work/example/', true), 'all');
  for (const path of ['/memory/', '/archives/', '/categories/', '/status/', '/reading/', '/photos/', '/calendar/']) {
    assert.equal(Search.defaultSurface(path, false), 'memory');
  }
  assert.deepEqual(Search.resetFilters('profile'), { surface: 'profile', source: 'all', category: 'all', month: 'all' });
  const state = { url: '/profile/?x=1', surface: 'all' };
  assert.equal(Search.canRestoreViewState(state, '/profile/?x=1', true), true);
  assert.equal(Search.canRestoreViewState(state, '/work/example/', true), false);
  assert.equal(Search.canRestoreViewState({ ...state, surface: 'invalid' }, state.url, true), false);
  assert.equal(Search.canRestoreViewState(state, state.url, false), false);
  const candidates = Array.from({ length: 24 }, (_, index) => ({
    surfaces: [index < 12 ? 'memory' : 'profile'], categories: [index < 12 ? '音樂' : '工作']
  }));
  candidates[11].surfaces = ['profile', 'memory'];
  assert.deepEqual([...Search.recentIndexes(candidates, 'profile')], [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual([...Search.recentIndexes(candidates, 'memory', '音樂')], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
test('results link to a passage, stable micro ID, or learning note with article fallback', () => {
  assert.equal(Search.search([record()], 'JavaScript')[0].href, '/one/#nav-one');
  const note = Search.search([record()], '早段拉臂時機')[0];
  assert.equal(note.href, '/one/');
  assert.equal(note.learning.id, 'reading-topic-01');
  assert.match(Search.render(note, '早段拉臂時機'), /href="\/reading\/#reading-topic-01"/);
  assert.equal(Search.search([micro], '沒有被使用')[0].href, '/status/#micro-123');
  assert.equal(Search.search([record()], '有工作的第N+6天')[0].locationLabel, '開啟文章');
});
test('rendered HTML escapes titles, snippets and query without executable markup', () => {
  const item = record({ title: '<img src=x onerror=alert(1)>', text: '<script>alert(1)</script> &', passages: [], learningItems: [] });
  const html = Search.render(Search.search([item], '<script>')[0], '<script>');
  const $ = cheerio.load(html);
  assert.equal($('script,img').length, 0);
  assert.equal($('mark').text(), '<script>');
  assert.match($.text(), /<img src=x onerror=alert\(1\)>/);
});
test('schema rejects HTML responses, malformed records, duplicates and unsafe local URLs', () => {
  const pack = records => JSON.stringify({ schemaVersion: 1, records });
  assert.equal(Search.parse(pack([])).length, 0);
  assert.equal(Search.parse(pack([record({ url: '/中文 含空白/' })])).length, 1);
  for (const surfaces of [['profile'], ['memory'], ['profile', 'memory']]) {
    assert.equal(Search.parse(pack([record({ id: `surface-${surfaces.join('-')}`, surfaces })])).length, 1);
  }
  for (const text of ['<html>error</html>', '{}', pack([record(), record()]), pack([record({ sources: null })]),
    ...[undefined, null, [], ['unknown'], ['profile', 'profile'], ['memory', 'profile'], ['profile', 2]].map(surfaces => pack([record({ surfaces })])),
    ...['javascript:alert(1)', '//evil.test/', '/\\evil.test/', '/\nevil.test/'].map(url => pack([record({ url })]))]) {
    assert.throws(() => Search.parse(text), /invalid/);
  }
});
test('paragraph anchors preserve authored IDs, avoid duplicates and survive unrelated inserts/reordering', () => {
  const original = '<h2 id="authored">原標題</h2><p>A &amp; B</p><p>另一段</p><p>另一段</p><ul><li><p>內文</p></li></ul>';
  const anchored = anchorContent(original, 'post-a');
  const $ = cheerio.load(anchored);
  const ids = $('[id]').map((_, node) => $(node).attr('id')).get();
  assert.equal(new Set(ids).size, ids.length);
  assert.equal($('h2').attr('id'), 'authored');
  assert.equal($('li[id]').length, 0);
  assert.equal(anchorContent(anchored, 'post-a'), anchored);
  const before = passagesOf(anchored).find(item => item.text === 'A & B');
  const after = passagesOf(anchorContent('<p>新段落</p><p>另一段</p><p>A &amp; B</p>', 'post-a')).find(item => item.text === 'A & B');
  assert.equal(before.id, after.id);
  assert.notEqual(before.id, passagesOf(anchorContent('<p>A &amp; B</p>', 'post-b'))[0].id);
});
test('article paragraph targets scroll into view without persistent highlight styling', () => {
  const styles = fs.readFileSync(path.resolve(__dirname, '../../themes/next/source/css/main.styl'), 'utf8');
  assert.doesNotMatch(styles, /\[data-navigation-anchor\]:target/);
  assert.match(styles, /\.status-item:target, \.reading-calendar-update-card:target/);
});
