'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { expectedArticles } = require('../profile-library-output-check');
const { validateProfileArticles } = require('../profile-articles-output-check');
const { index, page, config } = require('./helpers/profile-library');

test('/profile/articles/ remains a compatible view of the same profile-only list', () => {
  const result = validateProfileArticles({ html: page('compatibility'), config, navigationIndex: index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
});

test('compatibility route rejects an independently edited subset or changed title', () => {
  let html = page('compatibility').replace('href="/oldest/"', 'href="/memory-only/"');
  assert.ok(validateProfileArticles({ html, config, navigationIndex: index }).errors.length);
  html = page('compatibility').replace('工作與學習</h1>', '全部文章</h1>');
  assert.ok(validateProfileArticles({ html, config, navigationIndex: index }).errors.some(error => error.code === 'profile_library_title_invalid'));
});

test('same-day profile articles use their published time before the URL tie break', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-article-order-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const records = [
    { kind: 'article', surfaces: ['profile'], url: '/a-early/', date: '2026-09-03', title: 'Early' },
    { kind: 'article', surfaces: ['profile'], url: '/z-late/', date: '2026-09-03', title: 'Late' }
  ];
  for (const [route, published] of [['a-early', '2026-09-03T23:44:45+08:00'], ['z-late', '2026-09-03T23:55:00+08:00']]) {
    const directory = path.join(root, route);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'index.html'),
      `<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"${published}"}</script>`);
  }
  assert.deepEqual(expectedArticles({ records }, root).map(article => article.url), ['/z-late/', '/a-early/']);
  assert.deepEqual(expectedArticles({ records }).map(article => article.url), ['/a-early/', '/z-late/']);
});
