'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSearchSurface } = require('../search-surface-output-check');

const article = {
  id: 'article:/dual/', kind: 'article', sources: ['article'], title: '雙面文章', text: '內文', url: '/dual/',
  categories: ['工作'], tags: [], date: '2026-09-01', surfaces: ['profile', 'memory'],
  events: [{ kind: 'published', date: '2026-09-01' }], learningItems: []
};
const sharedA = { ...article, id: 'micro-a', kind: 'microblog', sources: ['microblog'], title: '共享頁面的碎碎念 A', url: '/status/', surfaces: ['memory'], events: [{ kind: 'recorded', date: '2026-09-01' }] };
const sharedB = { ...sharedA, id: 'micro-b', title: '共享頁面的碎碎念 B' };
const index = { schemaVersion: 1, records: [article, sharedA, sharedB] };
const scope = '<label>搜尋範圍<select data-navigation-filter="surface" disabled><option value="profile">工作與學習</option><option value="memory">個人記憶庫</option><option value="all">全部公開內容</option></select></label>';
function page(isArticle = false, surfaces = 'profile|memory') {
  const marker = isArticle ? '<article class="post-content-single" itemtype="https://schema.org/BlogPosting"><nav class="post-surface-marker" data-surfaces="profile memory"></nav></article>' : '';
  return `${scope}<a data-search-recent-item data-search-recent-surfaces="${surfaces}" href="/dual/"></a>${marker}`;
}
function pages(recentSurfaces = 'profile|memory') {
  return {
    'index.html': page(false, recentSurfaces),
    'memory/index.html': page(false, recentSurfaces),
    'profile/index.html': page(false, recentSurfaces),
    'archives/index.html': page(false, recentSurfaces),
    'dual/index.html': page(true, recentSurfaces)
  };
}
const check = (htmlPages = pages()) => validateSearchSurface({ root: '.', pages: htmlPages, index });

test('accepts three visible scope choices and complete surface-tagged recent candidates on all page types', () => {
  const result = check();
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 1);
  assert.deepEqual(result.dualResults, [1, 1, 1]);
  assert.equal(result.sharedUrlRecordCount, 2);
  assert.deepEqual(result.defaults, { profile: 'profile', profileChild: 'profile', memory: 'memory', archive: 'memory', article: 'all' });
});

test('rejects missing result labels and inconsistent dedupe/state wiring', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const navSource = fs.readFileSync(path.resolve(__dirname, '../../themes/next/source/js/third-party/search/navigation-search.js'), 'utf8');
  const result = validateSearchSurface({ root: '.', pages: pages(), index, sources: {
    localSearch: fs.readFileSync(path.resolve(__dirname, '../../themes/next/source/js/third-party/search/local-search.js'), 'utf8'),
    navigationSearch: navSource.replace('search-result-surfaces', 'result-surface'),
    template: fs.readFileSync(path.resolve(__dirname, '../../themes/next/layout/_partials/search/index.njk'), 'utf8'),
    helper: fs.readFileSync(path.resolve(__dirname, '../../scripts/search-recent-posts.js'), 'utf8')
  } });
  assert.ok(result.errors.some(error => error.code === 'search_surface_result_labels_or_dedup_missing'));
});

test('rejects missing options and recent candidate surface drift', () => {
  const htmlPages = pages('memory');
  htmlPages['profile/index.html'] = htmlPages['profile/index.html'].replace('value="all">全部公開內容', 'value="everything">全部公開內容');
  const result = check(htmlPages);
  assert.ok(result.errors.some(error => error.code === 'search_surface_scope_options_invalid'));
  assert.ok(result.errors.some(error => error.code === 'search_surface_recent_record_invalid'));
});
