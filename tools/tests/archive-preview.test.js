'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const nunjucks = require('nunjucks');
const { archivePreview } = require('../lib/archive-preview');

const root = path.resolve(__dirname, '../..');
const template = fs.readFileSync(path.join(root, 'themes/next/layout/_macro/post-collapse.njk'), 'utf8');
function render(post, enabled = true) {
  const env = new nunjucks.Environment(null, { autoescape: false });
  return env.renderString(template + '{{ render(posts, enabled) }}', {
    posts: { toArray: () => [{ title: '文章', path: '/original/', ...post }] }, enabled,
    date: () => '2026', moment: () => ({ format: () => '2026-10-14' }),
    is_archive: () => false, post_gallery: () => '', url_for: value => value,
    config: {}, archive_preview: archivePreview,
    escape_html: value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  });
}

test('ordinary summaries preserve readable boundaries and escape text without rendering media', () => {
  const html = render({ excerpt: '<p>第一段 &lt;img src=x onerror=alert(1)&gt;</p><p>下一段<br>末行</p><img src="/cover.webp"><script>BAD</script>' });
  const $ = cheerio.load(html);
  assert.equal($('.archive-preview').text(), '第一段 <img src=x onerror=alert(1)> 下一段 末行');
  assert.equal($('.archive-preview img, .archive-preview script').length, 0);
  assert.equal($('.post-title-link').attr('href'), '/original/');
});

test('description is preferred for text, while absent or image-only summaries do not expose full content', () => {
  assert.deepEqual(archivePreview({ description: '簡介', excerpt: '開場' }), { kind: 'text', text: '簡介' });
  for (const description of ['   ', '<img src="/cover.webp">', '<p>&nbsp;</p>']) {
    assert.deepEqual(archivePreview({ description, excerpt: '<p>原有摘要</p>' }), { kind: 'text', text: '原有摘要' });
  }
  for (const excerpt of ['', '<img src="/cover.webp">']) {
    assert.equal(archivePreview({ excerpt, content: '不要把全文塞進清單' }), null);
    assert.equal(cheerio.load(render({ excerpt, content: '全文' }))('.archive-preview').length, 0);
  }
});

test('all existing song cards retain cover, listening destination and text even when a description exists', () => {
  const dir = path.join(root, 'source/_posts/歌曲推薦');
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.md'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const excerpt = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').split(/<!--\s*more\s*-->/i)[0];
    const original = cheerio.load(excerpt);
    const output = cheerio.load(render({ source: `source/_posts/歌曲推薦/${file}`, excerpt, description: '另一份簡介' }));
    const card = output('.archive-preview-song');
    assert.equal(card.find('img').attr('src'), original('img').attr('src'), file);
    assert.equal(card.find('img').attr('alt'), original('img').attr('alt'), file);
    assert.equal(card.find('img').attr('loading'), 'lazy', file);
    assert.equal(card.find('a').attr('href'), original('a').attr('href'), file);
    assert.equal(card.text().replace(/\s+/g, ' ').trim(), original.root().text().replace(/\s+/g, ' ').trim(), file);
  }
});

test('songs outside the old directory are recognized by category or tag; no excerpt uses optional text description', () => {
  for (const metadata of [{ categories: { toArray: () => [{ name: '音樂' }] } }, { tags: ['歌曲推薦'] }]) {
    assert.equal(archivePreview({ ...metadata, excerpt: '<div>歌曲卡</div>' }).kind, 'song');
    assert.deepEqual(archivePreview({ ...metadata, description: '歌曲簡介' }), { kind: 'text', text: '歌曲簡介' });
  }
});

test('shared compact lists keep their original title-only layout unless archive previews are enabled', () => {
  const html = render({ excerpt: '不應出現在標籤清單' }, false);
  assert.doesNotMatch(html, /archive-preview|不應出現在標籤清單/);
  assert.equal(cheerio.load(html)('.post-title-link').attr('href'), '/original/');
});
