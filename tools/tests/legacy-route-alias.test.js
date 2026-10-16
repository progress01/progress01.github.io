'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const yaml = require('js-yaml');
const { validateSeoUrls, routeFile } = require('../seo-url-audit');
const { checkDocument } = require('../site-check');

const origin = 'https://progress01.github.io';
const legacyRoute = '/watch/reply-1988-writing-plan/';
const currentRoute = '/watch/reply-1988-30-questions/';
const aliasFile = path.resolve(__dirname, '../../source/watch/reply-1988-writing-plan/index.html');
const historicalAliases = [
  ['/2026/05/21/歌曲推薦/歌曲推薦-動不動就說愛我/', '/2026/05/20/歌曲推薦/歌曲推薦-動不動就說愛我/'],
  ['/2026/05/22/歌曲推薦/歌曲推薦-理想/', '/2026/05/21/歌曲推薦/歌曲推薦-理想/'],
  ['/2026/04/06/實驗室/討論GEO篇一_做網頁說明/', '/2026/04/06/實驗室/討論GEO篇一/'],
  ['/2026/09/10/隨筆/有些事情要分開/', '/2026/09/10/隨筆/在喜歡與被喜歡之間/'],
  ['/2026/02/03/歌曲推薦-我在紐約打電話給你/', '/2026/02/03/歌曲推薦/歌曲推薦-我在紐約打電話給你/'],
  ['/2025/06/16/閱讀影評/有工作的第N-3天/', '/2025/06/16/隨筆/有工作的第N-3天/'],
  ['/2025/04/09/呼吸/', '/2025/04/09/閱讀影評/呼吸/'],
  ['/2026/01/22/歌曲推薦/When-you-say-nothing-at-all/', '/2026/01/22/歌曲推薦/歌曲推薦-When-you-say-nothing-at-all/'],
  ['/2022/07/31/明天別再來敲門-書籍閱讀紀錄/', '/2022/07/31/閱讀影評/明天別再來敲門/'],
  ['/2024/12/24/若草物語-戀愛姐妹與無法戀愛的我-影片紀錄/', '/2024/12/24/閱讀影評/若草物語-戀愛姐妹與無法戀愛的我/'],
  ['/2025/01/07/請不要在大家面前稱讚我-書籍閱讀紀錄/', '/2025/01/07/閱讀影評/請不要在大家面前稱讚我/'],
  ['/2025/04/09/女給時代：1930年代臺灣的珈琲店文化/', '/2025/04/09/閱讀影評/女給時代：1930年代臺灣的珈琲店文化/'],
  ['/2025/10/24/歌曲推薦-2375/', '/2025/10/24/歌曲推薦/歌曲推薦-2375/'],
  ['/2025/12/25/歌曲推薦-Better-Man/', '/2025/12/25/歌曲推薦/歌曲推薦-Better-Man/'],
  ['/2026/01/19/歌曲推薦-Free-Loop/', '/2026/01/19/歌曲推薦/歌曲推薦-Free-Loop/'],
  ['/2026/01/21/歌曲推薦-說，你愛我/', '/2026/01/21/歌曲推薦/歌曲推薦-說，你愛我/'],
  ['/2026/01/22/welcome-board/', '/2026/01/21/welcome-board/']
];

function put(root, relative, value) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
}

test('legacy Reply 1988 route redirects to the canonical article without becoming another article URL', t => {
  const source = fs.readFileSync(aliasFile, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(match, 'legacy route source should have front matter and a static HTML page');
  const frontMatter = yaml.load(match[1]);
  const html = match[2];

  assert.equal(frontMatter.layout, false);
  assert.equal(frontMatter.permalink, legacyRoute);
  assert.equal(frontMatter.sitemap, false);
  assert.match(html, /http-equiv="refresh" content="0; url=\/watch\/reply-1988-30-questions\/"/);
  assert.match(html, /window\.location\.replace\('\/watch\/reply-1988-30-questions\/'\)/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${origin}${currentRoute}">`));
  assert.match(html, new RegExp(`<a href="${currentRoute}">`));
  assert.doesNotMatch(html, /BlogPosting|post-content-single|application\/ld\+json/);

  const siteCheckOptions = { origin, files: new Set([`watch/reply-1988-writing-plan/index.html`, `watch/reply-1988-30-questions/index.html`]), checkStructuredData: true };
  assert.deepEqual(checkDocument(html, 'watch/reply-1988-writing-plan/index.html', siteCheckOptions).errors, []);
  const fakeSchema = html.replace('</head>', '<script type="application/ld+json">{}</script></head>');
  assert.ok(checkDocument(fakeSchema, 'watch/reply-1988-writing-plan/index.html', siteCheckOptions).errors.some(error => error.includes('不得包含文章標記或 JSON-LD')));
  const wrongRefreshTarget = html.replace(`url=${currentRoute}`, 'url=/watch/incorrect-target/');
  assert.ok(checkDocument(wrongRefreshTarget, 'watch/reply-1988-writing-plan/index.html', siteCheckOptions).errors.some(error => error.includes('meta refresh')));
  assert.ok(checkDocument(html, 'watch/ordinary-page/index.html', siteCheckOptions).errors.some(error => error.includes('JSON-LD 應恰有一個')));

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-route-alias-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const article = `<html><head><link rel="canonical" href="${origin}${currentRoute}"><script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', url: `${origin}${currentRoute}` })}</script></head><body><article class="post-content-single"><h1 itemprop="headline">請回答1988｜雙門洞三十題</h1><div class="post-body"><p>唯一文章正文</p></div></article></body></html>`;
  const dualRoute = '/dual-article/';
  const dualArticle = `<html><head><link rel="canonical" href="${origin}${dualRoute}"><script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', url: `${origin}${dualRoute}` })}</script></head><body><article class="post-content-single"><h1 itemprop="headline">雙面文章</h1><div class="post-body"><p>雙面文章正文</p></div></article></body></html>`;
  const posts = [
    { kind: 'article', url: currentRoute, title: '請回答1988｜雙門洞三十題', surfaces: ['memory'] },
    { kind: 'article', url: dualRoute, title: '雙面文章', surfaces: ['profile', 'memory'] }
  ];
  put(root, 'navigation-index.json', JSON.stringify({ records: posts }));
  put(root, 'index.html', `<html><body><a href="${dualRoute}">雙面文章</a></body></html>`);
  put(root, 'profile/index.html', `<html><body><a href="${dualRoute}">雙面文章</a></body></html>`);
  put(root, 'profile/articles/index.html', '<html></html>');
  put(root, 'memory/index.html', '<html></html>');
  put(root, routeFile(currentRoute), article);
  put(root, routeFile(dualRoute), dualArticle);
  put(root, routeFile(legacyRoute), html);
  put(root, 'sitemap.xml', `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/profile/</loc></url><url><loc>${origin}/profile/articles/</loc></url><url><loc>${origin}/memory/</loc></url><url><loc>${origin}${currentRoute}</loc></url><url><loc>${origin}${dualRoute}</loc></url></urlset>`);

  const result = validateSeoUrls({ root, origin, samples: [{ id: 'dual-test', route: dualRoute, surfaces: ['profile', 'memory'] }] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.articleHtml, 2);
  assert.equal(result.counts.uniqueArticleRoutes, 2);
  assert.equal(result.counts.sitemapUrls, 6);
});

test('historical published article and page routes resolve through encoded static aliases', () => {
  for (const [legacyRoute, currentRoute] of historicalAliases) {
    const aliasFile = path.resolve(__dirname, '../../source', routeFile(legacyRoute));
    const source = fs.readFileSync(aliasFile, 'utf8');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    assert.ok(match, `${legacyRoute} should have front matter and a static HTML page`);
    const frontMatter = yaml.load(match[1]);
    const html = match[2];
    const encodedCurrentUrl = new URL(currentRoute, `${origin}/`).href;

    assert.equal(frontMatter.layout, false, `${legacyRoute} should bypass the article layout`);
    assert.equal(frontMatter.permalink, legacyRoute);
    assert.equal(frontMatter.sitemap, false);
    assert.match(html, new RegExp(`http-equiv="refresh" content="0; url=${currentRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.ok(html.includes(`<link rel="canonical" href="${encodedCurrentUrl}">`), `${legacyRoute} canonical should use the percent-encoded current URL`);
    assert.ok(html.includes(`window.location.replace('${currentRoute}')`));
    assert.ok(html.includes(`<a href="${currentRoute}">`));
    assert.doesNotMatch(html, /BlogPosting|post-content-single|application\/ld\+json/);

    const files = new Set([routeFile(legacyRoute), routeFile(currentRoute)].map(file => file.replace(/\\/g, '/')));
    const result = checkDocument(html, routeFile(legacyRoute), { origin, files, checkStructuredData: true });
    assert.deepEqual(result.errors, [], `${legacyRoute} should pass the static alias checks`);

    const targetFile = path.resolve(__dirname, '../../public', routeFile(currentRoute));
    const targetHtml = fs.readFileSync(targetFile, 'utf8');
    const $target = cheerio.load(targetHtml);
    assert.equal($target('article.post-content-single').length, 1, `${currentRoute} should resolve to its published article`);
    const schema = JSON.parse($target('script[type="application/ld+json"]').first().text());
    assert.equal(schema['@type'], 'BlogPosting', `${currentRoute} should retain the article schema`);
    assert.equal(schema.url, encodedCurrentUrl, `${currentRoute} schema should use the encoded canonical URL`);
  }
});
