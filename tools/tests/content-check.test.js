const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkContent, validateReadingDesk, validatePostDate } = require('../content-check');
const { buildTaxonomy } = require('../../scripts/tag-taxonomy');
const { getCanonicalTags, loadAliases } = require('../../scripts/tags-normalizer');

function makeFixture({ posts = [], desk, tags = '- name: 主標籤\n  aliases: [舊標籤]\n  code: MAIN\n  icon: fa fa-tag\n  url: /tags/主標籤/\n  description: 測試', cover, manifest, microblog = [], targetSurfaces = '[profile, memory]' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-content-check-'));
  fs.mkdirSync(path.join(root, 'source', '_posts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', '_data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', 'photos'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', 'images'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tools', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tools', 'data', 'legacy-surfaces.v1.json'), JSON.stringify(manifest || {
    schemaVersion: 1, baselineDate: 'fixture', posts: [], microblogIds: [], readingDeskItemIds: []
  }));
  fs.writeFileSync(path.join(root, 'source', '_data', 'content-categories.yml'), '- name: 音樂\n  code: AUDIO\n  icon: fa fa-music\n  url: /categories/音樂/\n  description: 測試\n');
  fs.writeFileSync(path.join(root, 'source', '_data', 'content-tags.yml'), tags + '\n');
  fs.writeFileSync(path.join(root, 'source', 'life-index.json'), JSON.stringify({ current: { listen: { title: 'a', url: '/a' }, watch: { title: 'b', url: '/b' } } }));
  fs.writeFileSync(path.join(root, 'source', 'microblog.json'), JSON.stringify(microblog));
  fs.writeFileSync(path.join(root, 'source', 'photos', 'index.md'), '# photos\n');
  fs.writeFileSync(path.join(root, 'source', 'reading-desk.yml'), desk || 'topics: []\n');
  if (cover) fs.writeFileSync(path.join(root, 'source', 'images', 'cover.webp'), 'fixture');
  posts.forEach((frontmatter, index) => {
    const withSurfaces = /^surfaces\s*:/m.test(frontmatter) ? frontmatter : `${frontmatter}\nsurfaces: [memory]`;
    fs.writeFileSync(path.join(root, 'source', '_posts', `post-${index}.md`), `---\n${withSurfaces}\n---\n文章\n`);
  });
  for (const [file, permalink] of [['linked-target.md', '/learning/test/'], ['work-target.md', '/work/from-real-work-to-features/']]) {
    fs.writeFileSync(path.join(root, 'source', '_posts', file), `---\ntitle: Linked target\ndate: 2026-02-28\ncategories: [音樂]\npermalink: ${permalink}\nsurfaces: ${targetSurfaces}\n---\n文章\n`);
  }
  return root;
}

function cleanupFixture(root) {
  const tempRoot = path.join(os.tmpdir(), 'blog-content-check-');
  assert.ok(root.startsWith(tempRoot));
  fs.rmSync(root, { recursive: true, force: true });
}

const validDesk = `topics:\n  - id: topic-1\n    name: 測試題目\n    items:\n      - id: item-1\n        date: 2026-02-28\n        title: 測試項目\n        source: 測試來源\n        url: /learning/test/\n        state: learning\n        note: 持續整理\n        surfaces: [memory]\n`;

test('真 YAML 支援 inline/block categories，日期與 reading desk 通過', t => {
  assert.ok(validatePostDate('2026-01-01T00:00:00+08:00'));
  assert.equal(validatePostDate('2026-01-01 99:99:99'), null);
  assert.equal(validatePostDate('2026-09-10 12:00:00').timestamp, validatePostDate('2026-09-10T12:00:00+08:00').timestamp);
  assert.ok(validatePostDate('2026-09-10 12:00:01').timestamp > validatePostDate('2026-09-10T12:00:00+08:00').timestamp);
  const root = makeFixture({ desk: validDesk, posts: [
    'title: Inline\ndate: 2026-02-28 12:00:00\ncategories: [音樂]\ntags: [主標籤]',
    'title: Block\ndate: 2028-02-29\ncategories:\n  - 音樂\ntags: [舊標籤]'
  ] });
  const result = checkContent({ root });
  t.after(() => cleanupFixture(root));
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 0);
});

test('reading desk 可以連到公開工作知識文章', t => {
  const desk = validDesk.replace('/learning/test/', '/work/from-real-work-to-features/');
  const root = makeFixture({ desk });
  const result = checkContent({ root });
  t.after(() => cleanupFixture(root));
  assert.deepEqual(result.errors, []);
});

test('日期、duplicate ID、unknown state 與壞 cover 編碼會產生可讀錯誤', t => {
  const desk = validDesk.replace('state: learning', 'state: broken\n        resolved_date: 2026-02-27');
  const root = makeFixture({ desk, posts: ['title: Bad\ndate: 2026-02-31\ncategories: [音樂]\ntags: [主標籤]\ncover: /images/%E0%A4%A'] });
  const result = checkContent({ root });
  t.after(() => cleanupFixture(root));
  assert.ok(result.errors.some(error => error.includes('date 必須是有效日期')));
  assert.ok(result.errors.some(error => error.includes('cover 路徑編碼無效')));
  assert.ok(result.errors.some(error => error.includes('state 只能是')));
  const duplicate = `topics:\n  - id: topic-1\n    name: 測試題目\n    items:\n      - id: item-1\n        date: 2026-02-28\n        title: 測試項目\n        source: 測試來源\n        url: /learning/test/\n        state: learning\n        note: 持續整理\n      - id: item-1\n        date: 2026-03-01\n        title: duplicate\n        source: source\n        url: /learning/duplicate/\n        state: learning\n        note: note\n`;
  const duplicateRoot = makeFixture({ desk: duplicate });
  t.after(() => cleanupFixture(duplicateRoot));
  const duplicateErrors = [];
  validateReadingDesk(duplicateRoot, duplicateErrors);
  assert.ok(duplicateErrors.some(error => error.includes('item id 重複')));
});

test('註冊 tag 是 canonical source；alias 去重，未知 tag 產生錯誤且不生成新 tag', t => {
  const tags = '- name: 新主標籤\n  aliases: [舊名稱]\n  code: NEW\n  icon: fa fa-tag\n  url: /tags/新主標籤/\n  description: 測試';
  const knownRoot = makeFixture({ tags, posts: ['title: Tags\ndate: 2026-02-28\ncategories: [音樂]\ntags: [新主標籤, 舊名稱]'] });
  const knownResult = checkContent({ root: knownRoot });
  t.after(() => cleanupFixture(knownRoot));
  assert.deepEqual(knownResult.errors, []);
  assert.deepEqual(knownResult.warnings, []);
  const aliases = loadAliases(knownRoot);
  assert.deepEqual(getCanonicalTags(['新主標籤', '舊名稱', '未註冊'], aliases), ['新主標籤']);
  fs.writeFileSync(path.join(knownRoot, 'source', '_data', 'content-tags.yml'), tags.replace(/新主標籤/g, '更新主標籤'));
  assert.deepEqual(getCanonicalTags(['更新主標籤'], loadAliases(knownRoot)), ['更新主標籤']);
  const mixedRoot = makeFixture({ tags, posts: ['title: Mixed\ndate: 2026-02-28\ncategories: [音樂]\ntags: [新主標籤, 未註冊]'] });
  const mixedResult = checkContent({ root: mixedRoot });
  t.after(() => cleanupFixture(mixedRoot));
  assert.ok(mixedResult.errors.some(error => error.includes('未註冊標籤') && error.includes('post-0.md')));
  assert.deepEqual(mixedResult.warnings, []);
  const unknownRoot = makeFixture({ tags, posts: ['title: Unknown\ndate: 2026-02-28\ncategories: [音樂]\ntags: [未註冊]'] });
  const unknownResult = checkContent({ root: unknownRoot });
  t.after(() => cleanupFixture(unknownRoot));
  assert.ok(unknownResult.errors.some(error => error.includes('未註冊標籤') && error.includes('post-0.md')));
  assert.deepEqual(getCanonicalTags(['新主標籤', '舊名稱'], buildTaxonomy([{ name: '新主標籤', aliases: ['舊名稱'] }]).aliases), ['新主標籤']);
  assert.deepEqual(getCanonicalTags(['toString'], new Map()), []);
  assert.ok(buildTaxonomy([{ name: 'A', aliases: ['same'] }, { name: 'B', aliases: ['same'] }]).errors.some(error => error.includes('同時指向')));
});

test('缺 title 與 JSON null 會產生資料形狀錯誤', t => {
  const root = makeFixture({ posts: ['date: 2026-02-28\ncategories: [音樂]\ntags: [主標籤]'] });
  fs.writeFileSync(path.join(root, 'source', 'life-index.json'), 'null');
  fs.writeFileSync(path.join(root, 'source', 'microblog.json'), 'null');
  const result = checkContent({ root });
  t.after(() => cleanupFixture(root));
  assert.ok(result.errors.some(error => error.includes('缺少有效 title')));
  assert.ok(result.errors.some(error => error.includes('life-index.json 頂層')));
  assert.ok(result.errors.some(error => error.includes('microblog.json 必須是陣列')));
});

function deskItem({ id = 'item-new', url = '/learning/test/', surfaces } = {}) {
  return `topics:\n  - id: topic-new\n    name: 測試題目\n    items:\n      - id: ${id}\n        date: 2026-02-28\n        title: 測試項目\n        source: 測試來源\n        url: ${url}\n        state: learning\n        note: 測試附註\n${surfaces === undefined ? '' : `        surfaces: ${surfaces}\n`}`;
}

function removeFixturePostSurfaces(root, postIndex = 0) {
  const file = path.join(root, 'source', '_posts', `post-${postIndex}.md`);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^surfaces: .*\r?\n/m, ''));
}

test('版本化 manifest 僅允許基準文章、持久 microblog ID 與 learning item ID 缺 surfaces', t => {
  const manifest = {
    schemaVersion: 1,
    baselineDate: '2026-09-25',
    posts: ['source/_posts/post-0.md'],
    microblogIds: ['micro-legacy'],
    readingDeskItemIds: ['item-legacy']
  };
  const root = makeFixture({
    posts: ['title: Legacy post\ndate: 2026-02-28\ncategories: [音樂]\ntags: [主標籤]'],
    microblog: [{ id: 'micro-legacy', date: '2026-02-28', tag: '💭', content: '舊碎碎念' }],
    desk: deskItem({ id: 'item-legacy' }),
    manifest
  });
  t.after(() => cleanupFixture(root));
  removeFixturePostSurfaces(root);
  const result = checkContent({ root });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('manifest 外的新 post、microblog 與 linked learning item 缺欄位均報來源與識別', t => {
  const root = makeFixture({
    posts: ['title: New post\ndate: 2026-02-28\ncategories: [音樂]\ntags: [主標籤]'],
    microblog: [{ id: 'micro-new', date: '2026-02-28', tag: '💭', content: '新碎碎念' }],
    desk: deskItem({ id: 'item-new' })
  });
  t.after(() => cleanupFixture(root));
  removeFixturePostSurfaces(root);
  const result = checkContent({ root });
  assert.ok(result.errors.some(error => error.includes('source/_posts/post-0.md') && error.includes('missing_surfaces')));
  assert.ok(result.errors.some(error => error.includes('source/microblog.json#micro-new') && error.includes('missing_surfaces')));
  assert.ok(result.errors.some(error => error.includes('source/reading-desk.yml#item-new') && error.includes('missing_surfaces')));

  const standaloneRoot = makeFixture({ desk: deskItem({ id: 'item-standalone-new', url: 'https://example.com/new-note/' }) });
  t.after(() => cleanupFixture(standaloneRoot));
  const standalone = checkContent({ root: standaloneRoot });
  assert.ok(standalone.errors.some(error => error.includes('source/reading-desk.yml#item-standalone-new') && error.includes('missing_surfaces')));
});

test('明確無效 surfaces 失敗；重複值由 content-check 輸出可定位 warning', t => {
  const invalidRoot = makeFixture({
    posts: ['title: Invalid\ndate: 2026-02-28\ncategories: [音樂]\ntags: [主標籤]\nsurfaces: [PROFILE]'],
    microblog: [{ id: 'micro-invalid', date: '2026-02-28', tag: '💭', content: '無效', surfaces: [] }],
    desk: deskItem({ id: 'item-invalid', surfaces: 'profile' })
  });
  t.after(() => cleanupFixture(invalidRoot));
  const invalid = checkContent({ root: invalidRoot });
  assert.ok(invalid.errors.some(error => error.includes('source/_posts/post-0.md') && error.includes('unknown_surface')));
  assert.ok(invalid.errors.some(error => error.includes('source/microblog.json#micro-invalid') && error.includes('empty_surfaces')));
  assert.ok(invalid.errors.some(error => error.includes('source/reading-desk.yml#item-invalid') && error.includes('invalid_surfaces_type')));

  const duplicateRoot = makeFixture({
    posts: ['title: Duplicate\ndate: 2026-02-28\ncategories: [音樂]\ntags: [主標籤]\nsurfaces: [memory, memory]'],
    microblog: [{ id: 'micro-duplicate', date: '2026-02-28', tag: '💭', content: '重複', surfaces: ['profile', 'profile'] }],
    desk: deskItem({ id: 'item-duplicate', surfaces: '[profile, profile]' })
  });
  t.after(() => cleanupFixture(duplicateRoot));
  const duplicate = checkContent({ root: duplicateRoot });
  assert.deepEqual(duplicate.errors, []);
  assert.equal(duplicate.warnings.length, 3);
  assert.ok(duplicate.warnings.some(warning => warning.includes('source/_posts/post-0.md')));
  assert.ok(duplicate.warnings.some(warning => warning.includes('source/microblog.json#micro-duplicate')));
  assert.ok(duplicate.warnings.some(warning => warning.includes('source/reading-desk.yml#item-duplicate')));
});

test('linked learning surfaces 是目標子集合，legacy linked 可繼承；不存在或未發布目標不降級', t => {
  const subsetRoot = makeFixture({ targetSurfaces: '[profile]', desk: deskItem({ id: 'item-subset', surfaces: '[memory]' }) });
  t.after(() => cleanupFixture(subsetRoot));
  const subset = checkContent({ root: subsetRoot });
  assert.ok(subset.errors.some(error => error.includes('item-subset.surfaces must be a subset')));

  const legacyRoot = makeFixture({
    targetSurfaces: '[profile]',
    desk: deskItem({ id: 'item-legacy-linked' }),
    manifest: { schemaVersion: 1, baselineDate: 'fixture', posts: [], microblogIds: [], readingDeskItemIds: ['item-legacy-linked'] }
  });
  t.after(() => cleanupFixture(legacyRoot));
  assert.deepEqual(checkContent({ root: legacyRoot }).errors, []);

  const missingTargetRoot = makeFixture({
    desk: deskItem({ id: 'item-missing-target', url: '/learning/missing/' }),
    manifest: { schemaVersion: 1, baselineDate: 'fixture', posts: [], microblogIds: [], readingDeskItemIds: ['item-missing-target'] }
  });
  t.after(() => cleanupFixture(missingTargetRoot));
  const missingTarget = checkContent({ root: missingTargetRoot });
  assert.ok(missingTarget.errors.some(error => error.includes('item-missing-target target: linked learning item URL')));
  assert.ok(missingTarget.errors.some(error => error.includes('item-missing-target') && error.includes('missing_surfaces')));

  const unpublishedRoot = makeFixture({
    desk: deskItem({ id: 'item-unpublished' }),
    manifest: { schemaVersion: 1, baselineDate: 'fixture', posts: [], microblogIds: [], readingDeskItemIds: ['item-unpublished'] }
  });
  t.after(() => cleanupFixture(unpublishedRoot));
  const targetFile = path.join(unpublishedRoot, 'source', '_posts', 'linked-target.md');
  fs.writeFileSync(targetFile, fs.readFileSync(targetFile, 'utf8').replace('permalink: /learning/test/', 'permalink: /learning/test/\npublished: false'));
  const unpublished = checkContent({ root: unpublishedRoot });
  assert.ok(unpublished.errors.some(error => error.includes('item-unpublished target: linked learning item URL') && error.includes('unpublished post')));
  assert.ok(unpublished.errors.some(error => error.includes('item-unpublished') && error.includes('missing_surfaces')));
});

test('standalone legacy learning item 可保留 memory 相容；manifest 結構錯誤使檢查失敗', t => {
  const root = makeFixture({
    desk: deskItem({ id: 'item-standalone', url: 'https://example.com/learning-note/' }),
    manifest: { schemaVersion: 1, baselineDate: 'fixture', posts: [], microblogIds: [], readingDeskItemIds: ['item-standalone'] }
  });
  t.after(() => cleanupFixture(root));
  assert.deepEqual(checkContent({ root }).errors, []);
  fs.writeFileSync(path.join(root, 'tools', 'data', 'legacy-surfaces.v1.json'), '{"schemaVersion":2}');
  assert.ok(checkContent({ root }).errors.some(error => error.includes('schemaVersion 1')));
});

function thinkingPost(fields, { date = '2026-02-27', updated } = {}) {
  return [
    'title: Thinking fixture', `date: ${date}`, ...(updated ? [`updated: ${updated}`] : []),
    'categories: [音樂]', 'tags: [主標籤]', ...fields
  ].join('\n');
}

function checkThinking(t, fields, dates = {}, clock = () => new Date('2026-03-05T04:00:00Z')) {
  const root = makeFixture({ posts: [thinkingPost(fields, dates)] });
  t.after(() => cleanupFixture(root));
  return checkContent({ root, clock });
}

function checkPostUpdated(t, updated, { date = '2026-02-27', clock = () => new Date('2026-03-05T04:00:00Z') } = {}) {
  const root = makeFixture({ posts: [
    `title: Updated fixture\ndate: ${date}\nupdated: ${updated}\ncategories: [音樂]\ntags: [主標籤]`
  ] });
  t.after(() => cleanupFixture(root));
  return checkContent({ root, clock });
}

test('post updated 可用昨日或台北今日；以 Asia/Taipei 日曆日阻擋未來日期', t => {
  const yesterday = checkPostUpdated(t, '2026-03-04');
  const today = checkPostUpdated(t, '2026-03-05T23:59:59+08:00');
  assert.deepEqual(yesterday.errors, []);
  assert.deepEqual(today.errors, []);

  const afterTodayInTaipei = checkPostUpdated(t, '2026-03-05T16:00:00Z');
  assert.ok(afterTodayInTaipei.errors.some(error => error.includes('[POST_UPDATED_AFTER_TODAY, updated]')));
});

test('post updated 的 future 檢查使用台北日而非 UTC 日期或機器本地時區', t => {
  const result = checkPostUpdated(t, '2026-03-04T17:00:00Z', {
    date: '2026-03-04T00:00:00+08:00',
    clock: () => new Date('2026-03-05T00:30:00Z')
  });
  assert.deepEqual(result.errors, []);
});

test('post updated 早於 date 與 invalid updated 保留既有來源錯誤', t => {
  const beforeDate = checkPostUpdated(t, '2026-03-02T11:59:59+08:00', { date: '2026-03-02T12:00:00+08:00' });
  assert.ok(beforeDate.errors.some(error => error.includes('updated 不得早於 date')));

  const invalid = checkPostUpdated(t, '2026-02-30');
  assert.ok(invalid.errors.some(error => error.includes('updated 必須是有效日期')));
  assert.ok(!invalid.errors.some(error => error.includes('POST_UPDATED_AFTER_TODAY')));
});

test('所有舊文章 thinking 欄位全缺合法；合法 exploring 通過', t => {
  const legacy = checkThinking(t, []);
  assert.deepEqual(legacy.errors, []);
  const exploring = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-01', 'thinking_boundary: 個人專案'
  ]);
  assert.deepEqual(exploring.errors, []);
});

test('thinking 孤兒欄位、未知狀態、無效日期與空 boundary 訊息含定位、code、修正方式且不洩漏值', t => {
  const cases = [
    { fields: ['thinking_updated: 2026-03-01'], code: 'THINKING_ORPHAN_FIELD', field: 'thinking_updated' },
    { fields: ['thinking_status: stable', 'thinking_updated: 2026-03-01', 'thinking_boundary: confidential-boundary'], code: 'THINKING_STATUS_UNSUPPORTED', field: 'thinking_status' },
    { fields: ['thinking_status: exploring', 'thinking_updated: 2026-02-30', 'thinking_boundary: confidential-boundary'], code: 'THINKING_UPDATED_INVALID_DATE', field: 'thinking_updated' },
    { fields: ['thinking_status: exploring', 'thinking_updated: 2026-03-01', 'thinking_boundary: "  "'], code: 'THINKING_BOUNDARY_EMPTY', field: 'thinking_boundary' }
  ];
  for (const fixture of cases) {
    const result = checkThinking(t, fixture.fields);
    const error = result.errors.find(message => message.includes(fixture.code));
    assert.ok(error, `expected ${fixture.code}`);
    assert.ok(error.includes('source/_posts/post-0.md'));
    assert.ok(error.includes(fixture.field));
    assert.match(error, /請/);
    assert.doesNotMatch(error, /confidential-boundary|2026-02-30/);
  }
});

test('thinking_updated 必須不早於文章 date、不晚於 explicit updated 及台北今日', t => {
  const beforeDate = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-02-26', 'thinking_boundary: 範圍'
  ]);
  assert.ok(beforeDate.errors.some(error => error.includes('THINKING_UPDATED_BEFORE_POST_DATE')));
  const afterUpdated = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-03', 'thinking_boundary: 範圍'
  ], { date: '2026-02-27', updated: '2026-03-02' });
  assert.ok(afterUpdated.errors.some(error => error.includes('THINKING_UPDATED_AFTER_POST_UPDATED')));
  const afterToday = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-06', 'thinking_boundary: 範圍'
  ]);
  assert.ok(afterToday.errors.some(error => error.includes('THINKING_UPDATED_AFTER_TODAY')));
});

test('同日含時區 date／updated 依文字日曆日比較；非法 date／updated 不觸發相對日期誤報', t => {
  const sameDay = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-01', 'thinking_boundary: 範圍'
  ], { date: '2026-03-01T00:15:00+09:00', updated: '2026-03-01T23:30:00-05:00' });
  assert.deepEqual(sameDay.errors, []);
  const invalid = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-01', 'thinking_boundary: 範圍'
  ], { date: '2026-02-30', updated: 'not-a-date' });
  assert.ok(invalid.errors.some(error => error.includes('date 必須是有效日期')));
  assert.ok(invalid.errors.some(error => error.includes('updated 必須是有效日期')));
  assert.equal(invalid.errors.some(error => error.includes('THINKING_UPDATED_BEFORE_POST_DATE') || error.includes('THINKING_UPDATED_AFTER_POST_UPDATED')), false);
});

test('clock injection 固定 Asia/Taipei 今日；surfaces 修正訊息清楚且同篇可回報多種錯誤', t => {
  const taipeiClock = () => new Date('2026-03-04T16:30:00Z');
  const today = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-05', 'thinking_boundary: 範圍'
  ], {}, taipeiClock);
  assert.deepEqual(today.errors, []);
  const tomorrow = checkThinking(t, [
    'thinking_status: exploring', 'thinking_updated: 2026-03-06', 'thinking_boundary: 範圍'
  ], {}, taipeiClock);
  assert.ok(tomorrow.errors.some(error => error.includes('THINKING_UPDATED_AFTER_TODAY')));

  const missingRoot = makeFixture({ posts: ['title: Missing surfaces\ndate: 2026-02-27\ncategories: [音樂]\ntags: [主標籤]'] });
  t.after(() => cleanupFixture(missingRoot));
  removeFixturePostSurfaces(missingRoot);
  const missing = checkContent({ root: missingRoot });
  assert.ok(missing.errors.some(error => error.includes('missing_surfaces') && error.includes('source/_posts/post-0.md') && error.includes('請在 front matter')));

  const multipleRoot = makeFixture({ posts: ['title: Multiple\ndate: 2026-02-27\ncategories: [音樂]\ntags: [主標籤]\nsurfaces: []\nthinking_status: stable'] });
  t.after(() => cleanupFixture(multipleRoot));
  const multiple = checkContent({ root: multipleRoot });
  assert.ok(multiple.errors.some(error => error.includes('empty_surfaces') && error.includes('source/_posts/post-0.md') && error.includes('請將空陣列')));
  assert.ok(multiple.errors.some(error => error.includes('THINKING_STATUS_UNSUPPORTED') && error.includes('source/_posts/post-0.md')));
});
