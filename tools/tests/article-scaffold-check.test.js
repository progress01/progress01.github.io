'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const Hexo = require('hexo');
const { PAGE_TEMPLATE, splitTemplate, validateArticleScaffolds } = require('../article-scaffold-check');

const root = path.resolve(__dirname, '../..');
const readTemplates = () => Object.fromEntries(['post', 'draft', 'page'].map(name => [
  name,
  fs.readFileSync(path.join(root, 'scaffolds', `${name}.md`), 'utf8')
]));

test('post and draft scaffolds have parseable active fields and all four front matter reminders', () => {
  assert.deepEqual(validateArticleScaffolds(readTemplates()), []);
  for (const name of ['post', 'draft']) {
    const { frontmatter, body } = splitTemplate(fs.readFileSync(path.join(root, `scaffolds/${name}.md`), 'utf8'));
    const data = yaml.load(frontmatter);
    assert.deepEqual(data.surfaces, []);
    assert.equal(Object.hasOwn(data, 'thinking_status'), false);
    assert.equal(body, '');
  }
});

test('draft keeps its no-date shape and fixed page scaffold stays byte-for-byte unchanged', () => {
  const templates = readTemplates();
  assert.deepEqual(Object.keys(yaml.load(splitTemplate(templates.draft).frontmatter)), ['title', 'tags', 'surfaces']);
  assert.equal(templates.page, PAGE_TEMPLATE);
  assert.deepEqual(validateArticleScaffolds({ ...templates, page: `${PAGE_TEMPLATE}surfaces: []\n` }).some(error => error.startsWith('page.md:')), true);
});

test('checker rejects default memory, missing public reminder, active thinking placeholders and body prompts', () => {
  const templates = readTemplates();
  const rejected = [
    { ...templates, post: templates.post.replace('surfaces: []', 'surfaces: [memory]') },
    { ...templates, post: templates.post.replace(/^# 發布前確認.*\r?\n/m, '') },
    { ...templates, draft: templates.draft.replace('surfaces: []', 'surfaces: []\nthinking_updated: YYYY-MM-DD') },
    { ...templates, post: templates.post.replace(/---\r?\n$/, '請在發布前判斷。\n') }
  ];
  for (const fixture of rejected) assert.notDeepEqual(validateArticleScaffolds(fixture), []);
});

test('checker rejects duplicate A/B article markers and article fields on page scaffold', () => {
  const templates = readTemplates();
  const duplicate = { ...templates, post: templates.post.replace('surfaces: []', 'surfaces: []\n# A版文章與B版文章各複製一份') };
  assert.ok(validateArticleScaffolds(duplicate).some(error => error.includes('文章副本')));
  const pageWithSurface = { ...templates, page: templates.page.replace('date: {{ date }}', 'date: {{ date }}\nsurfaces: []') };
  assert.ok(validateArticleScaffolds(pageWithSurface).some(error => error.startsWith('page.md:')));
});

test('deterministic Hexo placeholder rendering keeps comments in front matter and leaves the body empty', () => {
  const source = fs.readFileSync(path.join(root, 'scaffolds/post.md'), 'utf8');
  const rendered = source.replace(/\{\{\s*title\s*\}\}/g, 'Template Rendered Title')
    .replace(/\{\{\s*date\s*\}\}/g, '2026-09-27 12:34:56');
  const { frontmatter, body } = splitTemplate(rendered);
  const data = yaml.load(frontmatter);
  assert.equal(data.title, 'Template Rendered Title');
  assert.equal(data.date.toISOString(), '2026-09-27T12:34:56.000Z');
  assert.deepEqual(data.surfaces, []);
  assert.match(frontmatter, /任何人.*直接網址閱讀/);
  assert.match(frontmatter, /僅探索中才取消下方三行註解/);
  assert.equal(body, '');
});

test('real Hexo scaffold API renders post and draft into an isolated temporary source tree', async t => {
  const temp = fs.mkdtempSync(path.join(root, 'tmp', 'article-scaffold-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const sourceDir = path.join(temp, 'source');
  fs.mkdirSync(sourceDir);
  const isolatedScaffolds = path.join(temp, 'scaffolds');
  fs.mkdirSync(isolatedScaffolds);
  for (const name of ['post', 'draft', 'page']) {
    fs.copyFileSync(path.join(root, 'scaffolds', `${name}.md`), path.join(isolatedScaffolds, `${name}.md`));
  }
  const isolatedScripts = path.join(temp, 'scripts');
  fs.mkdirSync(isolatedScripts);
  fs.copyFileSync(path.join(root, 'scripts', 'article-scaffold-comments.js'), path.join(isolatedScripts, 'article-scaffold-comments.js'));
  const configPath = path.join(temp, '_config.yml');
  fs.writeFileSync(configPath, [
    `source_dir: ${JSON.stringify(sourceDir)}`,
    'new_post_name: :title.md'
  ].join('\n'));
  const hexo = new Hexo(temp, { silent: true });
  hexo.env.init = true;
  await hexo.init();
  try {
    for (const layout of ['post', 'draft']) {
      const title = `Scaffold QA ${layout}`;
      const result = await hexo.post.create({ title, layout });
      const generated = fs.readFileSync(result.path, 'utf8');
      const { frontmatter, body } = splitTemplate(generated);
      assert.ok(frontmatter, `${layout} output has front matter`);
      const data = yaml.load(frontmatter);
      assert.equal(data.title, title);
      assert.deepEqual(data.surfaces, [], `${layout} Hexo output front matter: ${frontmatter}`);
      assert.equal(/任何人.*直接網址閱讀/.test(frontmatter), true);
      assert.equal(/發布前確認/.test(body), false);
      for (const key of ['thinking_status', 'thinking_updated', 'thinking_boundary']) {
        assert.equal(Object.hasOwn(data, key), false, `${layout} has no active ${key}`);
      }
      if (layout === 'post') assert.ok(data.date instanceof Date || typeof data.date === 'string');
      assert.equal(fs.readdirSync(path.join(sourceDir, layout === 'draft' ? '_drafts' : '_posts')).length, 1);
    }
  } finally {
    await hexo.exit();
  }
});
