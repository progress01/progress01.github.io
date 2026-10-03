'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSeoUrls, normalizeRoute, routeFile, configuredOrigin } = require('../seo-url-audit');

const origin = 'https://example.test';
const articles = [
  { url: '/學習/提問 方法/', title: '中文與空白', surfaces: ['profile'] },
  { url: '/work/雙面文章/', title: '雙面文章', surfaces: ['profile', 'memory'] }
];
const fixtureSamples = [
  { id: 'unicode', route: articles[0].url, surfaces: ['profile'] },
  { id: 'dual-flow', route: articles[1].url, surfaces: ['profile', 'memory'] }
];

function put(root, relative, value) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function canonical(route) { return `${origin}${encodeURI(route)}`; }
function articleHtml(post, body = `<p>${post.title} 正文內容</p>`) {
  const url = canonical(post.url);
  return `<html><head><link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', url })}</script></head><body><article class="post-content-single"><h1 itemprop="headline">${post.title}</h1><div class="post-body">${body}</div></article></body></html>`;
}
function pageHtml(route, type) {
  const url = canonical(route);
  return `<html><head><link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify({ '@type': type, url })}</script></head><body></body></html>`;
}
function sitemap(routes) {
  return `<urlset>${routes.map(route => `<url><loc>${canonical(route)}</loc></url>`).join('')}</urlset>`;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-url-audit-'));
  put(root, 'navigation-index.json', JSON.stringify({ records: articles.map(post => ({ kind: 'article', ...post })) }));
  put(root, 'index.html', pageHtml('/', 'WebSite'));
  put(root, 'profile/index.html', `<html><head><link rel="canonical" href="${canonical('/profile/')}"></head><body><a href="${encodeURI(articles[1].url)}">dual</a></body></html>`);
  put(root, 'profile/articles/index.html', pageHtml('/profile/articles/', 'CollectionPage'));
  put(root, 'memory/index.html', pageHtml('/memory/', 'CollectionPage'));
  put(root, routeFile(articles[0].url), articleHtml(articles[0]));
  put(root, routeFile(articles[1].url), articleHtml(articles[1]));
  put(root, 'index.html', pageHtml('/', 'WebSite').replace('</body>', `<body><a href="${encodeURI(articles[1].url)}">dual</a></body>`));
  put(root, 'sitemap.xml', sitemap(['/', '/profile/', '/profile/articles/', '/memory/', ...articles.map(item => item.url)]));
  return root;
}
function run(root) {
  return validateSeoUrls({ root, origin, expectedArticleCount: articles.length, samples: fixtureSamples });
}

test('normalizes Unicode and percent-encoded routes to the same output identity', () => {
  assert.equal(normalizeRoute('/%E5%AD%B8%E7%BF%92/%E6%8F%90%E5%95%8F%20%E6%96%B9%E6%B3%95/', origin), '/學習/提問 方法/');
  assert.equal(normalizeRoute('/學習/提問 方法/', origin), '/學習/提問 方法/');
  assert.equal(routeFile('/學習/提問 方法/'), path.join('學習', '提問 方法', 'index.html'));
});

test('uses the configured Hexo site origin as the default audit origin', () => {
  assert.equal(configuredOrigin(path.resolve(__dirname, '../..')), 'https://progress01.github.io');
});

test('accepts unique A and dual article routes, including Unicode and a unique dual entrance', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = run(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.articleHtml, 2);
  assert.equal(result.counts.uniqueArticleRoutes, 2);
  assert.equal(result.counts.sitemapUrls, 6);
  const automatic = validateSeoUrls({ root, origin, samples: fixtureSamples });
  assert.deepEqual(automatic.errors, []);
  const fixedCount = validateSeoUrls({ root, origin, expectedArticleCount: 3, samples: fixtureSamples });
  assert.ok(fixedCount.errors.some(error => error.code === 'navigation_article_count_mismatch'));
});

test('rejects duplicate and non-self canonicals and duplicated article output/body', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = articles[0];
  put(root, 'profile/articles/copy/index.html', articleHtml(first));
  const secondFile = path.join(root, routeFile(articles[1].url));
  put(root, routeFile(articles[1].url), articleHtml(articles[1], `<p>${first.title} 正文內容</p>`));
  put(root, 'navigation-index.json', JSON.stringify({ records: [...articles.map(post => ({ kind: 'article', ...post })), { kind: 'article', ...first }] }));
  const result = run(root);
  assert.ok(result.errors.some(error => error.code === 'article_canonical_duplicate'));
  assert.ok(result.errors.some(error => error.code === 'article_canonical_not_self'));
  assert.ok(result.errors.some(error => error.code === 'duplicate_article_body'));
  assert.ok(result.errors.some(error => error.code === 'article_copy_under_profile_path'));
  assert.ok(result.errors.some(error => error.code === 'navigation_article_duplicate'));
  assert.ok(fs.existsSync(secondFile));
});

test('rejects sitemap omissions, duplicate locs, off-origin locs, missing outputs, and data endpoints', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  put(root, 'sitemap.xml', `<urlset>${[
    canonical('/'), canonical('/profile/'), canonical('/profile/'),
    canonical(articles[0].url), 'https://other.test/work/elsewhere/', canonical('/missing/'), canonical('/navigation-index.json')
  ].map(loc => `<url><loc>${loc}</loc></url>`).join('')}</urlset>`);
  const result = run(root);
  assert.ok(result.errors.some(error => error.code === 'sitemap_required_route_missing'));
  assert.ok(result.errors.some(error => error.code === 'sitemap_article_missing'));
  assert.ok(result.errors.some(error => error.code === 'sitemap_duplicate_loc'));
  assert.ok(result.errors.some(error => error.code === 'sitemap_off_origin'));
  assert.ok(result.errors.some(error => error.code === 'sitemap_output_missing'));
  assert.ok(result.errors.some(error => error.code === 'sitemap_data_endpoint_included'));
});

test('rejects duplicate navigation entries and an A/B copied route', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const copy = { ...articles[1], url: '/profile/articles/flow-copy/' };
  put(root, routeFile(copy.url), articleHtml(copy, `<p>${articles[1].title} 正文內容</p>`));
  put(root, 'navigation-index.json', JSON.stringify({ records: [...articles.map(post => ({ kind: 'article', ...post })), { kind: 'article', ...articles[0] }, { kind: 'article', ...copy }] }));
  put(root, 'sitemap.xml', sitemap(['/', '/profile/', '/profile/articles/', '/memory/', ...articles.map(item => item.url), copy.url]));
  const result = run(root);
  assert.ok(result.errors.some(error => error.code === 'navigation_article_duplicate'));
  assert.ok(result.errors.some(error => error.code === 'article_copy_under_profile_path'));
  assert.ok(result.errors.some(error => error.code === 'sitemap_ab_copy_route'));
});
