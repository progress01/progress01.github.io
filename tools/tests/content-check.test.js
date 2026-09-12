const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkContent, validateReadingDesk, validatePostDate } = require('../content-check');
const { buildTaxonomy } = require('../../scripts/tag-taxonomy');
const { getCanonicalTags, loadAliases } = require('../../scripts/tags-normalizer');

function makeFixture({ posts = [], desk, tags = '- name: 主標籤\n  aliases: [舊標籤]\n  code: MAIN\n  icon: fa fa-tag\n  url: /tags/主標籤/\n  description: 測試', cover }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-content-check-'));
  fs.mkdirSync(path.join(root, 'source', '_posts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', '_data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', 'photos'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', 'images'), { recursive: true });
  fs.writeFileSync(path.join(root, 'source', '_data', 'content-categories.yml'), '- name: 音樂\n  code: AUDIO\n  icon: fa fa-music\n  url: /categories/音樂/\n  description: 測試\n');
  fs.writeFileSync(path.join(root, 'source', '_data', 'content-tags.yml'), tags + '\n');
  fs.writeFileSync(path.join(root, 'source', 'life-index.json'), JSON.stringify({ current: { listen: { title: 'a', url: '/a' }, watch: { title: 'b', url: '/b' } } }));
  fs.writeFileSync(path.join(root, 'source', 'microblog.json'), '[]');
  fs.writeFileSync(path.join(root, 'source', 'photos', 'index.md'), '# photos\n');
  fs.writeFileSync(path.join(root, 'source', 'reading-desk.yml'), desk || 'topics: []\n');
  if (cover) fs.writeFileSync(path.join(root, 'source', 'images', 'cover.webp'), 'fixture');
  posts.forEach((frontmatter, index) => fs.writeFileSync(path.join(root, 'source', '_posts', `post-${index}.md`), `---\n${frontmatter}\n---\n文章\n`));
  return root;
}

function cleanupFixture(root) {
  const tempRoot = path.join(os.tmpdir(), 'blog-content-check-');
  assert.ok(root.startsWith(tempRoot));
  fs.rmSync(root, { recursive: true, force: true });
}

const validDesk = `topics:\n  - id: topic-1\n    name: 測試題目\n    items:\n      - id: item-1\n        date: 2026-02-28\n        title: 測試項目\n        source: 測試來源\n        url: /learning/test/\n        state: learning\n        note: 持續整理\n`;

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

test('註冊 tag 是 canonical source；alias 去重，未知 tag 只警告且不生成新 tag', t => {
  const tags = '- name: 新主標籤\n  aliases: [舊名稱]\n  code: NEW\n  icon: fa fa-tag\n  url: /tags/新主標籤/\n  description: 測試';
  const root = makeFixture({ tags, posts: ['title: Tags\ndate: 2026-02-28\ncategories: [音樂]\ntags: [新主標籤, 舊名稱, 未註冊]'] });
  const result = checkContent({ root });
  t.after(() => cleanupFixture(root));
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(warning => warning.includes('未註冊')));
  const aliases = loadAliases(root);
  assert.deepEqual(getCanonicalTags(['新主標籤', '舊名稱', '未註冊'], aliases), ['新主標籤']);
  fs.writeFileSync(path.join(root, 'source', '_data', 'content-tags.yml'), tags.replace(/新主標籤/g, '更新主標籤'));
  assert.deepEqual(getCanonicalTags(['更新主標籤'], loadAliases(root)), ['更新主標籤']);
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
