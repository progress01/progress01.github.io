'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateArchiveCategoryCompat, normalizeRoute } = require('../archive-category-compat-output-check');

const samples = [
  { url: '/work/from-real-work-to-features/', title: 'Profile sample', surfaces: ['profile', 'memory'], category: '工作知識' },
  { url: '/2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/', title: 'Song sample', surfaces: ['memory'], category: '音樂' },
  { url: '/work/flow-friendly-work-system/', title: 'Dual sample', surfaces: ['profile', 'memory'], category: '工作知識' },
  { url: '/2026/01/25/部落格改版規劃/', title: 'Site sample', surfaces: ['memory'], category: '站務' }
];

function writePage(root, route, html) {
  const file = path.join(root, route.replace(/^\/+/, ''), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
function link(post) { return `<a href="${encodeURI(post.url)}">${post.title}</a>`; }
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-category-compat-'));
  const article = post => `<html><head><link rel="canonical" href="https://example.test${encodeURI(post.url)}"></head><body><article class="post-content-single"><h1 itemprop="headline">${post.title}</h1></article></body></html>`;
  const records = samples.map((post, i) => ({ kind: 'article', url: post.url, title: post.title, categories: [post.category], surfaces: post.surfaces, date: `2026-09-0${i + 1}` }));
  fs.writeFileSync(path.join(root, 'navigation-index.json'), JSON.stringify({ records }));
  writePage(root, '/', '<html><head><link rel="canonical" href="https://example.test/"></head></html>');
  samples.forEach(post => writePage(root, post.url, article(post)));
  writePage(root, '/archives/', `<html><head><link rel="canonical" href="https://example.test/archives/"></head><body><div class="post-block">${samples.map(post => `<div class="post-title">${link(post).replace('<a ', '<a class="post-title-link" ')}</div>`).join('')}</div></body></html>`);
  writePage(root, '/categories/', `<html><body><section>${samples.map(post => `<article data-browse-item>${link(post)}</article>`).join('')}</section><noscript>分類入口 標籤入口</noscript></body></html>`);
  for (const category of new Set(samples.map(post => post.category))) {
    const posts = samples.filter(post => post.category === category);
    writePage(root, `/categories/${category}/`, `<html>${samples.map(post => `<article data-browse-item${post.category === category ? '' : ' hidden'}>${link(post)}</article>`).join('')}</html>`);
  }
  writePage(root, '/profile/articles/', `<html><ul data-profile-article-list>${samples.filter(post => post.surfaces.includes('profile')).map(post => `<li><a class="profile-list-link" href="${post.url}">${post.title}</a></li>`).join('')}</ul></html>`);
  return root;
}

test('normalizes generated URI routes while retaining decoded article identity', () => {
  assert.equal(normalizeRoute('/2026/09/01/%E6%AD%8C%E6%9B%B2/a%20b/'), '/2026/09/01/歌曲/a b/');
  assert.equal(normalizeRoute('/article/?surface=memory'), null);
});

test('accepts complete archive, root browser, native categories, and one canonical per article', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = validateArchiveCategoryCompat({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.navigationArticles, 4);
  assert.equal(result.counts.archiveUniqueRoutes, 4);
  assert.equal(result.counts.categoriesRootItems, 4);
  assert.equal(result.counts.nativeCategoryRoutes, 3);
  assert.deepEqual(result.counts.surfaceDistribution, { profile: 2, memory: 4, dual: 2 });
});

test('rejects missing full-site and native-category memberships', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const categoriesFile = path.join(root, 'categories', 'index.html');
  fs.writeFileSync(categoriesFile, fs.readFileSync(categoriesFile, 'utf8').replace(/<article data-browse-item>[\s\S]*?<\/article>/, ''));
  const archiveFile = path.join(root, 'archives', 'index.html');
  fs.writeFileSync(archiveFile, fs.readFileSync(archiveFile, 'utf8').replace(encodeURI(samples[0].url), '/missing/'));
  const result = validateArchiveCategoryCompat({ root });
  assert.ok(result.errors.some(error => error.startsWith('categories_root_membership_invalid:')));
  assert.ok(result.errors.some(error => error.startsWith('archive_membership_invalid:')));
});
