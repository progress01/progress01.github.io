const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseArgs, markerInfo, run
} = require('../restore-blogger-images');

function fixture({ noImages = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blogger-restore-'));
  fs.mkdirSync(path.join(root, 'source', '_posts'), { recursive: true });
  if (!noImages) fs.mkdirSync(path.join(root, 'source', 'images', 'blogger-import'), { recursive: true });
  const url1 = 'https://example.com/one';
  const url2 = 'https://example.com/two';
  const one = `---\ntitle: One\ndate: 2026-01-01\n---\nlocal body must be replaced\n<!-- Blogger 原文: ${url1} -->\n`;
  const two = `---\r\ntitle: Two\r\ndate: 2026-01-02\r\n---\r\nlocal body must stay\r\n<!-- Blogger 原文：${url2} -->\r\n`;
  fs.writeFileSync(path.join(root, 'source', '_posts', 'one.md'), one);
  fs.writeFileSync(path.join(root, 'source', '_posts', 'two.md'), two);
  return {
    root, url1, url2, onePath: path.join(root, 'source', '_posts', 'one.md'), twoPath: path.join(root, 'source', '_posts', 'two.md'),
    feed: { feed: { entry: [
      { title: { $t: 'One' }, link: [{ rel: 'alternate', href: url1 }], content: { $t: '<p>feed one</p><img src="https://img.test/s1600/one.png">' } },
      { title: { $t: 'Two' }, link: [{ rel: 'alternate', href: url2 }], content: { $t: '<p>feed two</p><img src="https://img.test/s1600/two.png">' } }
    ] } }
  };
}

function cleanup(root) {
  assert.ok(root.startsWith(path.join(os.tmpdir(), 'blogger-restore-')));
  fs.rmSync(root, { recursive: true, force: true });
}

test('scope parsing rejects unsafe combinations and requires write scope', () => {
  assert.deepEqual(parseArgs(['--feed', 'feed.json', '--post', 'a.md', '--post=b.md']).posts, ['a.md', 'b.md']);
  for (const argv of [
    ['--feed=f.json', '--write'],
    ['--feed=f.json', '--all', '--post=a.md'],
    ['--feed=f.json', '--unknown'],
    ['--feed=f.json', '--overwrite-images']
  ]) assert.throws(() => parseArgs(argv));
});

test('preview can inspect full feed without fetch and scoped write leaves other article untouched', async t => {
  const f = fixture(); t.after(() => cleanup(f.root));
  const beforeTwo = fs.readFileSync(f.twoPath);
  let fetches = 0;
  const fetchImpl = async () => { fetches += 1; throw new Error('preview must not fetch'); };
  const preview = await run({ feed: 'feed.json', posts: [], all: false, write: false, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: fetchImpl });
  assert.equal(preview.fetchCount, 0); assert.equal(fetches, 0); assert.equal(preview.selected.length, 2); assert.equal(preview.imageCount, 2);
  const write = await run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('one-image') }) });
  assert.equal(write.fetchCount, 1); assert.equal(write.writtenArticles, 1); assert.deepEqual(fs.readFileSync(f.twoPath), beforeTwo);
  const rerun = await run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('one-image') }) });
  assert.equal(rerun.writtenImages, 0); assert.equal(rerun.writtenArticles, 0);
  assert.ok(markerInfo(fs.readFileSync(f.twoPath, 'utf8')).url === f.url2);
});

test('invalid, outside, nonimport and nonmatching posts fail before writes', async t => {
  const f = fixture(); t.after(() => cleanup(f.root));
  const outside = path.join(path.dirname(f.root), `${path.basename(f.root)}-outside.md`); fs.writeFileSync(outside, '---\ntitle: outside\n---\n');
  t.after(() => fs.rmSync(outside, { force: true }));
  const cases = [
    ['source/_posts/missing.md', /文章不存在/],
    [outside, /超出 source\/_posts/],
    ['source/_posts/two.md', /不是 Blogger/]
  ];
  fs.writeFileSync(f.twoPath, fs.readFileSync(f.twoPath, 'utf8').replace(/<!-- Blogger 原文：.*? -->\r?\n/, ''));
  for (const [post, message] of cases) await assert.rejects(() => run({ feed: 'feed.json', posts: [post], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => { throw new Error('must not fetch'); } }), message);
  const noMatch = fixture(); t.after(() => cleanup(noMatch.root));
  await assert.rejects(() => run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: noMatch.root, feed: { feed: { entry: [] } }, fetch: async () => { throw new Error('must not fetch'); } }), /feed 找不到對應/);
});

test('fullwidth marker is accepted and differing existing images are protected', async t => {
  const f = fixture(); t.after(() => cleanup(f.root));
  const folder = `blogger-${crypto.createHash('sha1').update(f.url1).digest('hex').slice(0, 10)}`;
  const imagePath = path.join(f.root, 'source', 'images', 'blogger-import', folder, '01.png');
  fs.mkdirSync(path.dirname(imagePath), { recursive: true }); fs.writeFileSync(imagePath, 'different');
  await assert.rejects(() => run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('one-image') }) }), /內容不同/);
  assert.equal(fs.readFileSync(f.onePath, 'utf8').includes('local body must be replaced'), true);
});

test('eleven image markers replace by exact index and never by prefix', async t => {
  const f = fixture(); t.after(() => cleanup(f.root));
  f.feed.feed.entry[0].content.$t = Array.from({ length: 11 }, (_, index) => `<img src="https://img.test/s1600/${index + 1}.png">`).join('');
  const result = await run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('image') }) });
  assert.equal(result.fetchCount, 11);
  const body = fs.readFileSync(f.onePath, 'utf8');
  assert.equal((body.match(/class="blogger-import-image"/g) || []).length, 11);
  assert.equal(/BLOGGER_IMAGE_\d/.test(body), false);
  assert.match(body, /01\.png/); assert.match(body, /10\.png/); assert.match(body, /11\.png/);
});

test('selected post ignores unrelated duplicate marker, while selected feed URL duplicate fails', async t => {
  const f = fixture(); t.after(() => cleanup(f.root));
  fs.writeFileSync(f.twoPath, fs.readFileSync(f.twoPath, 'utf8').replace(f.url2, f.url1));
  const preview = await run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: false, overwriteImages: false }, { root: f.root, feed: f.feed });
  assert.equal(preview.selected.length, 1);
  const duplicateFeed = { feed: { entry: [f.feed.feed.entry[0], { ...f.feed.feed.entry[0] }] } };
  await assert.rejects(() => run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: duplicateFeed, fetch: async () => { throw new Error('must not fetch'); } }), /feed URL 重複/);
});

test('existing parent junction escaping image root fails before any write', async t => {
  const f = fixture(); t.after(() => cleanup(f.root));
  const folder = `blogger-${crypto.createHash('sha1').update(f.url1).digest('hex').slice(0, 10)}`;
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'blogger-restore-outside-'));
  t.after(() => cleanup(outside));
  const junction = path.join(f.root, 'source', 'images', 'blogger-import', folder);
  fs.symlinkSync(outside, junction, 'junction');
  await assert.rejects(() => run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('image') }) }), /既有父路徑超出 repo root/);
  assert.equal(fs.readdirSync(outside).length, 0);
});

test('image root junction is rejected, while a new repo without image directories can create them safely', async t => {
  const f = fixture({ noImages: true }); t.after(() => cleanup(f.root));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'blogger-restore-root-outside-')); t.after(() => cleanup(outside));
  fs.mkdirSync(path.join(f.root, 'source', 'images'), { recursive: true });
  fs.symlinkSync(outside, path.join(f.root, 'source', 'images', 'blogger-import'), 'junction');
  await assert.rejects(() => run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: f.root, feed: f.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('image') }) }), /既有父路徑超出 repo root/);
  const clean = fixture({ noImages: true }); t.after(() => cleanup(clean.root));
  const result = await run({ feed: 'feed.json', posts: ['source/_posts/one.md'], all: false, write: true, overwriteImages: false }, { root: clean.root, feed: clean.feed, fetch: async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('image') }) });
  assert.equal(result.writtenImages, 1);
  assert.equal(fs.existsSync(path.join(clean.root, 'source', 'images', 'blogger-import')), true);
});
