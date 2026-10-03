'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROUTES, validateSidebarStats } = require('../sidebar-stats-output-check');

const navigationIndex = { records: [
  { kind: 'article', surfaces: ['profile'], categories: ['工作'], tags: ['方法', '紀錄'] },
  { kind: 'article', surfaces: ['profile', 'memory'], categories: ['工作', '站務'], tags: ['方法', '整理'] },
  { kind: 'article', surfaces: ['memory'], categories: ['站務'], tags: ['照片'] }
] };
const profile = '<div class="site-state-wrap" data-profile-site-state><nav class="site-state"><div class="site-state-item site-state-posts"><a href="/#profile-home-article-list"><span class="site-state-item-count">2</span></a></div><div class="site-state-item site-state-tags"><span class="site-state-item-count">3</span></div></nav></div>';
const memory = '<div class="site-state-wrap"><nav class="site-state"><div class="site-state-item site-state-posts"><span class="site-state-item-count">3</span></div><div class="site-state-item site-state-categories"><span class="site-state-item-count">2</span></div><div class="site-state-item site-state-tags"><span class="site-state-item-count">4</span></div></nav></div>';

function pagesFor(profileHtml = profile, memoryHtml = memory) {
  return Object.fromEntries(ROUTES.map(route => [route.file, route.surface === 'profile' ? profileHtml : memoryHtml]));
}

test('A routes show profile-only article and unique-tag counts, while canonical routes keep global stats', () => {
  const result = validateSidebarStats({ pages: pagesFor(), navigationIndex });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.expected, { profilePosts: 2, profileTags: 3, memoryPosts: 3, memoryCategories: 2, memoryTags: 4 });
});

test('A routes reject category counts and B routes reject profile-only stats', () => {
  const result = validateSidebarStats({ pages: pagesFor(profile.replace('</nav>', '<div class="site-state-item site-state-categories"></div></nav>')), navigationIndex });
  assert.ok(result.errors.some(error => error.code === 'sidebar_profile_stats_shape_invalid'));
});

test('source branches only on the shared route context and disables sidebar partial caching', () => {
  const root = path.resolve(__dirname, '../..');
  const template = fs.readFileSync(path.join(root, 'themes/next/layout/_partials/sidebar/site-overview.njk'), 'utf8');
  const sidebar = fs.readFileSync(path.join(root, 'themes/next/layout/_macro/sidebar.njk'), 'utf8');
  assert.match(template, /brand_surface_context\(page\) === 'profile'/);
  assert.match(template, /profile_article_library\(\)/);
  assert.match(template, /url_for\('\/'\) }}#profile-home-article-list/);
  assert.match(sidebar, /site-overview\.njk', \{\}, \{cache: false\}/);
});
