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
  events: [{ kind: 'published', date: '2026-09-13' }, { kind: 'learning-added', date: '2026-08-29' }],
  learningItems: [{ id: 'reading-topic-01', title: '排球', note: '早段拉臂時機', addedDate: '2026-08-29' }],
  passages: [{ id: 'nav-one', text: '中文 JavaScript <script> & 特殊字元' }], ...overrides });
const micro = record({ id: 'micro-123', kind: 'microblog', sources: ['microblog'], title: '沒有被使用', text: '完整成果沒有被使用',
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
  for (const text of ['<html>error</html>', '{}', pack([record(), record()]), pack([record({ sources: null })]),
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
