'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const cheerio = require('cheerio');
const yaml = require('js-yaml');
const nunjucks = require('nunjucks');
const { archivePreview, clearImageDimensionCache, parseWebpDimensions } = require('../lib/archive-preview');

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
    assert.equal(card.find('img').attr('decoding'), 'async', file);
    assert.ok(Number(card.find('img').attr('width')) > 0, `image width missing: ${file}`);
    assert.ok(Number(card.find('img').attr('height')) > 0, `image height missing: ${file}`);
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

function webpVp8x(width, height) {
  const chunk = Buffer.alloc(18);
  chunk.write('VP8X', 0, 'ascii');
  chunk.writeUInt32LE(10, 4);
  chunk.writeUIntLE(width - 1, 12, 3);
  chunk.writeUIntLE(height - 1, 15, 3);
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  chunk.copy(buffer, 12);
  return buffer;
}

test('song previews use local WebP intrinsic dimensions, skip missing and remote images, and cache each image read', t => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-preview-'));
  t.after(() => {
    clearImageDimensionCache();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });
  const imageDir = path.join(sourceDir, 'images');
  fs.mkdirSync(imageDir);
  const imagePath = path.join(imageDir, 'cover art.webp');
  fs.writeFileSync(imagePath, webpVp8x(640, 480));
  assert.deepEqual(parseWebpDimensions(webpVp8x(640, 480)), { width: 640, height: 480 });

  const originalRead = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function(filePath, ...args) {
    if (path.resolve(String(filePath)) === imagePath) reads += 1;
    return originalRead.call(this, filePath, ...args);
  };
  try {
    clearImageDimensionCache();
    const excerpt = '<a href="https://listen.example/song"><img src="/images/cover%20art.webp?size=large" alt="封面"></a>' +
      '<img src="/images/missing.webp" alt="缺少封面"><img src="https://images.example/remote.webp" alt="遠端封面">';
    const preview = archivePreview({ categories: ['音樂'], excerpt }, sourceDir);
    const $ = cheerio.load(preview.html);
    assert.equal($('img').eq(0).attr('width'), '640');
    assert.equal($('img').eq(0).attr('height'), '480');
    assert.equal($('img').eq(1).attr('width'), undefined);
    assert.equal($('img').eq(2).attr('height'), undefined);
    assert.equal($('img').attr('loading'), 'lazy');
    assert.equal($('img').attr('decoding'), 'async');
    assert.equal($('a').attr('href'), 'https://listen.example/song');

    archivePreview({ categories: ['音樂'], excerpt: '<img src="/images/cover%20art.webp#again">' }, sourceDir);
    assert.equal(reads, 1, 'each local image should be parsed once per generation');
  } finally {
    fs.readFileSync = originalRead;
  }
});

test('archive content transitions can be disabled while other postList transitions remain opt-in', () => {
  const themeConfig = yaml.load(fs.readFileSync(path.join(root, 'themes/next/_config.yml'), 'utf8'));
  assert.deepEqual(
    ['post_block', 'post_header', 'post_body', 'coll_header'].map(key => themeConfig.motion.transition[key]),
    [false, false, false, false]
  );

  const source = fs.readFileSync(path.join(root, 'themes/next/source/js/motion.js'), 'utf8');
  const block = { querySelectorAll: () => [{}] };
  const document = {
    querySelectorAll(selector) {
      if (selector === '.post-block') return [block];
      if (selector === '.pagination, .comments') return [{}];
      return [];
    }
  };
  const context = { NexT: {}, CONFIG: { motion: { transition: { post_block: false, post_header: false, post_body: false, coll_header: false } } }, document };
  vm.runInNewContext(source, context);
  assert.equal(context.NexT.motion.middleWares.postList().length, 0);

  context.CONFIG.motion.transition.post_block = 'fadeIn';
  assert.equal(context.NexT.motion.middleWares.postList().length, 2, 'enabled block and pagination transitions should still be queued');
});
