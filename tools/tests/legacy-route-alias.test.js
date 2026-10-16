'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const { validateSeoUrls, routeFile } = require('../seo-url-audit');
const { checkDocument } = require('../site-check');

const origin = 'https://progress01.github.io';
const legacyRoute = '/watch/reply-1988-writing-plan/';
const currentRoute = '/watch/reply-1988-30-questions/';
const aliasFile = path.resolve(__dirname, '../../source/watch/reply-1988-writing-plan/index.html');

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
