const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkArticleTags } = require('../tag-reorganization-check');

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-tag-check-'));
  t.after(() => {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'blog-tag-check-')));
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, 'source', '_posts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source', '_data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'source', '_data', 'content-tags.yml'), '- name: 主標籤\n  aliases: [舊標籤]\n');
  return root;
}

function writePost(root, name, { updated = '2026-10-01', tag = '主標籤', tags, body = '原始正文' } = {}) {
  const file = path.join(root, 'source', '_posts', name);
  fs.writeFileSync(file, `---\ntitle: ${name}\ndate: 2026-09-01\nupdated: ${updated}\ntags: ${JSON.stringify(tags || [tag])}\n---\n${body}\n`);
  return file;
}

test('正文及 updated 可日常修改，新增合法文章不需同步歷史快照', t => {
  const root = makeFixture(t);
  const existing = writePost(root, 'existing.md');
  assert.deepEqual(checkArticleTags({ root }), { errors: [], articles: 1 });

  writePost(root, 'existing.md', { updated: '2026-10-13', body: '編輯後的正文' });
  writePost(root, 'new-article.md', { updated: '2026-10-13', tag: '舊標籤', body: '新文章正文' });

  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  const report = path.join(root, 'docs', 'tag-reorganization-review.json');
  const corruptReport = '{ 舊快照已損壞';
  fs.writeFileSync(report, corruptReport);
  assert.deepEqual(checkArticleTags({ root }), { errors: [], articles: 2 });
  assert.equal(fs.readFileSync(report, 'utf8'), corruptReport);
  const staleReport = JSON.stringify({ publicArticleCount: 999, entries: [] });
  fs.writeFileSync(report, staleReport);
  assert.deepEqual(checkArticleTags({ root }), { errors: [], articles: 2 });
  assert.equal(fs.readFileSync(report, 'utf8'), staleReport);
  assert.match(fs.readFileSync(existing, 'utf8'), /編輯後的正文/);
});

test('非法標籤、重複標籤、超過兩個標籤與非文字標籤都會被攔截', t => {
  const invalidCases = [
    { tags: ['不存在的標籤'], message: '使用未註冊標籤「不存在的標籤」' },
    { tags: ['主標籤', '主標籤'], message: 'tags 有重複標籤「主標籤」' },
    { tags: ['主標籤', '主標籤', '主標籤'], message: 'tags 超過 2 個' },
    { tags: [12], message: '含有空白或非文字標籤' }
  ];
  const root = makeFixture(t);
  invalidCases.forEach((item, index) => writePost(root, `invalid-${index}.md`, { tags: item.tags }));
  const result = checkArticleTags({ root });
  assert.equal(result.articles, invalidCases.length);
  invalidCases.forEach(item => assert.ok(result.errors.some(error => error.includes(item.message)), item.message));
});
