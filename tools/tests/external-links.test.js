const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractLinks, readTitle, parseIgnoreList, isIgnored, classify, buildReport, BROKEN, CHECK, OK,
} = require('../lib/external-links');
const { collect, checkUrl, checkAll } = require('../check-external-links');

test('extractLinks finds markdown, bare and html links with line numbers', () => {
  const text = [
    '---',
    'title: 測試',
    '---',
    '參考[這篇](https://a.example.jp/entry-1.html)，裡面有劇照。',
    '裸網址 https://b.example.jp/x，後面接全形逗號',
    '<a href="https://c.example.jp/y?z=1">c</a>',
    '維基 [頁](https://en.wikipedia.org/wiki/Foo_(bar)) 結束.',
    '句尾 https://d.example.jp/page.',
    '[論文](https://arxiv.org/abs/2608.13900)核對，[中文](https://zh.wikipedia.org/wiki/排球)與[片語](https://e.example.jp/go-on)有',
    '裸網址後接中文 https://f.example.jp/q)與 和雙括號 (見 https://g.example.jp/1))以',
  ].join('\n');
  assert.deepEqual(extractLinks(text), [
    { url: 'https://a.example.jp/entry-1.html', line: 4 },
    { url: 'https://b.example.jp/x', line: 5 },
    { url: 'https://c.example.jp/y?z=1', line: 6 },
    { url: 'https://en.wikipedia.org/wiki/Foo_(bar)', line: 7 },
    { url: 'https://d.example.jp/page', line: 8 },
    { url: 'https://arxiv.org/abs/2608.13900', line: 9 },
    { url: 'https://zh.wikipedia.org/wiki/排球', line: 9 },
    { url: 'https://e.example.jp/go-on', line: 9 },
    { url: 'https://f.example.jp/q', line: 10 },
    { url: 'https://g.example.jp/1', line: 10 },
  ]);
});

test('extractLinks skips code, localhost and example domains', () => {
  const text = [
    '```bash',
    'curl https://in-fence.example.jp/',
    '```',
    '行內 `https://inline.example.jp/` 不算',
    'http://localhost:4000/ 和 https://example.com/ 不算',
    'https://real.example.jp/ok',
  ].join('\n');
  assert.deepEqual(extractLinks(text), [{ url: 'https://real.example.jp/ok', line: 6 }]);
});

test('readTitle reads the front matter title', () => {
  assert.equal(readTitle('---\ntitle: "以早乙女佳奈子為例"\ndate: 2026-08-29\n---\n正文'), '以早乙女佳奈子為例');
  assert.equal(readTitle('沒有 front matter'), '');
});

test('ignore list supports exact urls, prefixes and comments', () => {
  const rules = parseIgnoreList('# 註解\nhttps://a.jp/x\nhttps://open.spotify.com/*  # 很少壞\n\n');
  assert.deepEqual(rules, ['https://a.jp/x', 'https://open.spotify.com/*']);
  assert.equal(isIgnored('https://a.jp/x', rules), true);
  assert.equal(isIgnored('https://a.jp/x/y', rules), false);
  assert.equal(isIgnored('https://open.spotify.com/track/1', rules), true);
});

test('classify separates broken, needs-check and ok', () => {
  assert.equal(classify('https://a.jp/p', { status: 404 }).kind, BROKEN);
  assert.equal(classify('https://a.jp/p', { status: 410 }).kind, BROKEN);
  assert.equal(classify('https://a.jp/p', { error: { code: 'ENOTFOUND' } }).kind, BROKEN);
  assert.equal(classify('https://a.jp/p', { status: 403 }).kind, CHECK);
  assert.equal(classify('https://a.jp/p', { status: 503 }).kind, CHECK);
  assert.equal(classify('https://a.jp/p', { error: { code: 'TIMEOUT' } }).kind, CHECK);
  const home = classify('https://a.jp/old-post', { status: 200, finalUrl: 'https://a.jp/' });
  assert.equal(home.kind, CHECK);
  assert.match(home.reason, /首頁/);
  assert.equal(classify('http://a.jp/p', { status: 200, finalUrl: 'https://a.jp/p/' }).kind, OK);
  assert.equal(classify('https://a.jp/', { status: 200, finalUrl: 'https://a.jp/' }).kind, OK);
});

test('collect scans every post, groups places by url and applies the ignore list', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-links-'));
  const posts = path.join(root, 'source', '_posts', '分類');
  fs.mkdirSync(posts, { recursive: true });
  fs.writeFileSync(path.join(posts, 'a.md'), '---\ntitle: 甲\n---\nhttps://x.example.jp/1\nhttps://skip.example.jp/2\n');
  fs.writeFileSync(path.join(posts, 'b.md'), '---\ntitle: 乙\n---\n\n[x](https://x.example.jp/1)\n');
  const result = collect(root, ['https://skip.example.jp/*']);
  assert.equal(result.postCount, 2);
  assert.equal(result.ignoredCount, 1);
  assert.deepEqual(result.items, [{
    url: 'https://x.example.jp/1',
    places: [
      { file: 'source/_posts/分類/a.md', title: '甲', line: 4 },
      { file: 'source/_posts/分類/b.md', title: '乙', line: 5 },
    ],
  }]);
});

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push(`${options.method} ${url}`);
    const route = routes[`${options.method} ${url}`] || routes[url];
    if (route instanceof Error) throw route;
    return { status: route.status, url: route.finalUrl || url, body: null };
  };
  impl.calls = calls;
  return impl;
}

test('checkUrl falls back to GET when HEAD is refused', async () => {
  const fetchImpl = fakeFetch({ 'HEAD https://a.jp/p': { status: 405 }, 'GET https://a.jp/p': { status: 200 } });
  const verdict = await checkUrl('https://a.jp/p', { fetchImpl, retryDelay: 0 });
  assert.equal(verdict.kind, OK);
  assert.deepEqual(fetchImpl.calls, ['HEAD https://a.jp/p', 'GET https://a.jp/p']);
});

test('checkUrl reports a missing domain without retrying GET', async () => {
  const error = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  const fetchImpl = fakeFetch({ 'https://gone.jp/p': error });
  const verdict = await checkUrl('https://gone.jp/p', { fetchImpl, retryDelay: 0 });
  assert.equal(verdict.kind, BROKEN);
  assert.deepEqual(fetchImpl.calls, ['HEAD https://gone.jp/p']);
});

test('checkAll fills every item and builds a readable report', async () => {
  const items = [
    { url: 'https://a.jp/ok', places: [{ file: 'source/_posts/a.md', title: '甲', line: 3 }] },
    { url: 'https://a.jp/gone', places: [{ file: 'source/_posts/a.md', title: '甲', line: 9 }] },
    { url: 'https://b.jp/blocked', places: [{ file: 'source/_posts/b.md', title: '乙', line: 2 }] },
  ];
  const fetchImpl = fakeFetch({
    'https://a.jp/ok': { status: 200 },
    'https://a.jp/gone': { status: 404 },
    'https://b.jp/blocked': { status: 403 },
  });
  await checkAll(items, { fetchImpl, delay: 0, retryDelay: 0 });
  assert.deepEqual(items.map(item => item.kind), [OK, BROKEN, CHECK]);

  const report = buildReport({ date: new Date(2026, 10, 15), items, postCount: 2, ignoredCount: 0 });
  assert.match(report, /^# 外部連結檢查 2026-11-15/);
  assert.match(report, /- 確定壞了：1 個/);
  assert.match(report, /### 甲\n\n`source\/_posts\/a.md`\n\n- 第 9 行：https:\/\/a.jp\/gone\n {2}- 找不到頁面（404）/);
  assert.match(report, /### 乙[\s\S]*403/);
  assert.doesNotMatch(report, /a\.jp\/ok/);
});
