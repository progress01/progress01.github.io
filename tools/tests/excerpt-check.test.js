'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const checker = require('../excerpt-check');

function post(body, extraFrontmatter = '') {
  return `---\ntitle: fixture\ndate: 2026-09-12\n${extraFrontmatter}---\n${body}`;
}

test('86 visible Unicode characters pass and 87 fail', () => {
  const passing = checker.inspectExcerpt(post(`${'字'.repeat(86)}\n<!-- more -->`), 'source/_posts/fixture.md');
  assert.strictEqual(passing.ok, true);
  assert.strictEqual(passing.visibleCharacters, 86);

  const failing = checker.inspectExcerpt(post(`${'字'.repeat(87)}\n<!-- more -->`), 'source/_posts/fixture.md');
  assert.strictEqual(failing.ok, false);
  assert(failing.errors.some((message) => message.includes('87 Unicode characters')));
});

test('Markdown links count visible label only and entities are decoded', () => {
  const report = checker.inspectExcerpt(
    post('[可見文字](https://example.test/a-long-url) &amp; [第二個](https://example.test)'),
    'source/_posts/fixture.md'
  );
  assert.strictEqual(report.visibleText, '可見文字 & 第二個');
  assert.strictEqual(report.visibleCharacters, 8);
  assert.strictEqual(report.ok, false, 'a fixture without a marker is not a valid post');
  assert(report.errors.some((message) => message.includes('missing Hexo')));
});

test('marker in a fenced code example is ignored', () => {
  const body = ['```html', '<!-- more -->', '```', '', '真正摘要', '<!-- more -->'].join('\n');
  const report = checker.inspectExcerpt(post(body), 'source/_posts/fixture.md');
  assert.strictEqual(report.markerCount, 1);
  assert(report.visibleText.includes('真正摘要'));
  assert.strictEqual(report.ok, true);
});

test('inline and indented code comments are not treated as Hexo markers', () => {
  const body = ['`<!-- more -->`', '', '    <!-- more -->', '', '真正摘要', '<!-- more -->'].join('\n');
  const report = checker.inspectExcerpt(post(body), 'source/_posts/fixture.md');
  assert.strictEqual(report.markerCount, 1);
  assert.strictEqual(report.ok, true);
});

test('song card HTML with one cover is allowed but asks for rendered preview', () => {
  const body = [
    '<div style="display:flex">',
    '  <div><p>推薦一首歌<br><a href="https://example.test/track">收聽連結</a></p></div>',
    '  <img src="/images/cover.webp" alt="封面">',
    '</div>',
    '<!-- more -->'
  ].join('\n');
  const report = checker.inspectExcerpt(post(body), 'source/_posts/歌曲推薦/fixture.md');
  assert.strictEqual(report.isSong, true);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.images, 1);
  assert(report.warnings.some((message) => message.includes('song card HTML')));
});

test('a non-song image is a review warning even when text passes', () => {
  const body = ['摘要文字', '', '![示意圖](/images/example.webp)', '<!-- more -->'].join('\n');
  const report = checker.inspectExcerpt(post(body), 'source/_posts/實驗室/fixture.md');
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.images, 1);
  assert(report.warnings.some((message) => message.includes('image affects layout')));
});

test('missing and repeated markers are errors', () => {
  const missing = checker.inspectExcerpt(post('只有正文'), 'source/_posts/fixture.md');
  assert.strictEqual(missing.ok, false);
  assert(missing.errors.some((message) => message.includes('missing Hexo')));

  const repeated = checker.inspectExcerpt(post('摘要\n<!-- more -->\n<!-- more -->'), 'source/_posts/fixture.md');
  assert.strictEqual(repeated.ok, false);
  assert(repeated.errors.some((message) => message.includes('multiple Hexo')));
});

test('frontmatter description override is explicit and structure risks are reported', () => {
  const body = ['# 摘要標題', '', '| a | b |', '| --- | --- |', '| c | d |', '', '```js', 'const x = 1;', '```', '<!-- more -->'].join('\n');
  const report = checker.inspectExcerpt(post(body, 'description: 首頁另用的摘要\n'), 'source/_posts/fixture.md');
  assert.strictEqual(report.ok, true, 'structure concerns are warnings; the excerpt still has valid text and marker');
  assert(report.warnings.some((message) => message.includes('description')));
  assert(report.warnings.some((message) => message.includes('table')));
  assert(report.warnings.some((message) => message.includes('fenced code')));
  assert(report.warnings.some((message) => message.includes('heading')));
});

test('frontmatter excerpt override reports its own visible length', () => {
  const report = checker.inspectExcerpt(
    post('marker body\n<!-- more -->', `excerpt: ${'字'.repeat(87)}\n`),
    'source/_posts/fixture.md'
  );
  assert(report.warnings.some((message) => message.includes('frontmatter excerpt overrides')));
  assert(report.warnings.some((message) => message.includes('87 visible Unicode characters')));
  assert(report.warnings.some((message) => message.includes('exceeds the 86-character guide')));
});

test('CLI argument and target path rules are deterministic', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'excerpt-check-'));
  try {
    const posts = path.join(root, 'source', '_posts');
    fs.mkdirSync(posts, { recursive: true });
    const target = path.join(posts, 'fixture.md');
    fs.writeFileSync(target, post('合格摘要\n<!-- more -->'), 'utf8');
    const outside = path.join(root, 'outside.md');
    fs.writeFileSync(outside, post('外部檔案\n<!-- more -->'), 'utf8');

    assert.throws(() => checker.parseArgs([]), /choose --post or --all/);
    assert.throws(() => checker.parseArgs(['--all', '--post', 'source/_posts/a.md']), /cannot be combined/);
    assert.throws(() => checker.parseArgs(['--post', 'source/_posts/a.md', '--all']), /cannot be combined/);
    assert.throws(() => checker.parseArgs(['--bogus']), /unknown option/);
    assert.throws(() => checker.resolvePostPath('outside.md', root), /source\/_posts/);
    assert.throws(() => checker.resolvePostPath('source/_posts/missing.md', root), /does not exist/);
    const resolved = checker.resolvePostPath('source/_posts/fixture.md', root);
    assert.strictEqual(path.basename(resolved), 'fixture.md');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
