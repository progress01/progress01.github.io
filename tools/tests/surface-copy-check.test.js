'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateSourceContract, validateOutput, routeFile } = require('../surface-copy-check');

const root = path.resolve(__dirname, '../..');
const files = Object.fromEntries(Object.entries(require('../surface-copy-check').FILES).map(([key, file]) => [key, fs.readFileSync(path.join(root, file), 'utf8')]));
const index = { records: [
  { id: 'p', kind: 'article', url: '/a/', title: 'A 文章', date: '2026-09-09', tags: ['方法'], surfaces: ['profile'] },
  { id: 'unicode', kind: 'article', url: '/2026/01/25/部落格改版規劃/', title: '部落格改版規劃', date: '2026-01-25', tags: [], surfaces: ['memory'] },
  { id: 'm', kind: 'article', url: '/b/', title: 'B 文章', date: '2026-09-10', tags: [], surfaces: ['memory'] },
  { id: 'd', kind: 'article', url: '/c/', title: '雙面文章', date: '2026-09-08', tags: ['整理'], surfaces: ['profile', 'memory'] }
] };
const assets = { navigationSearch: "const surfaceLabels = { profile: '工作與學習', memory: '個人記憶庫' }; '收錄於：';" };
function article(url, surfaces, labels) {
  const links = labels.map((label, position) => `<a class="post-surface-marker-link" data-surface="${surfaces[position]}" href="${surfaces[position] === 'profile' ? '/' : '/memory/'}">${label}</a>`).join(surfaces.length === 2 ? '<span class="post-surface-marker-separator" aria-hidden="true">・</span>' : '');
  return `<html><head><link rel="canonical" href="${encodeURI(`https://example.test${url}`)}"></head><body><article class="post-content-single"><nav class="post-surface-marker"><span class="post-surface-marker-label">收錄於</span>${links}</nav></article></body></html>`;
}
function page(current) {
  const flip = current === 'memory' ? '<a class="surface-switch-link" href="/">SIDE A／看工作與學習</a>' : '<a class="surface-switch-link" href="/memory/">SIDE B／翻到個人記憶庫</a>';
  const profile = current === 'profile' ? `<main><div class="profile-home"><header class="profile-home-header"><h1 id="profile-title">工作與學習</h1></header><div class="profile-home-body">${profileCover()}</div></div></main>` : '';
  return `<html><body><a class="skip-link" href="#main-content">跳到主要內容</a><nav class="surface-switch" data-current-surface="${current}">${flip}</nav>${profile}<section class="home-profile-bridge"><span class="home-profile-bridge-label">SIDE A</span><h2>工作與學習</h2><p>看整理過的經驗與方法</p><a>翻到 A 面 ↗</a></section><div class="search-popup"><div class="search-filters"><select data-navigation-filter="surface"><option value="profile">工作與學習</option><option value="memory">個人記憶庫</option><option value="all">全部公開內容</option></select></div></div></body></html>`;
}
function profileCover() {
  const records = index.records.filter(record => record.kind === 'article' && record.surfaces.includes('profile')).sort((a, b) => b.date.localeCompare(a.date));
  return `<section data-profile-article-home><div class="profile-home-tools"><h2>文章</h2><p class="profile-home-count">共 ${records.length} 篇・依發表時間排序</p></div><div data-profile-home-search hidden><label for="profile-home-query">搜尋文章</label><input id="profile-home-query" type="search" placeholder="搜尋文章標題或標籤"></div><ul data-profile-home-article-list>${records.map(record => `<li data-profile-home-article-row><a class="profile-home-article-link" href="${record.url}"><time datetime="${record.date}">${record.date}</time><span class="profile-home-article-title">${record.title}</span></a></li>`).join('')}</ul></section>`;
}
function profileLibrary() {
  const records = index.records.filter(record => record.kind === 'article' && record.surfaces.includes('profile'));
  return `<section data-profile-article-library><p data-profile-result-count>全部 ${records.length}</p><div data-profile-tag-filters hidden aria-label="依標籤篩選"><button data-profile-tag-all>全部 ${records.length}</button></div><p data-profile-filter-empty hidden></p><ul data-profile-article-list>${records.map(record => `<li data-profile-article-row><a class="profile-list-link" href="${record.url}"><time datetime="2026-09-09">${record.date}</time><span class="profile-list-title">${record.title}</span></a></li>`).join('')}</ul></section>`;
}
function outputPages() { return {
  'index.html': page('profile'), 'memory/index.html': page('memory'), 'profile/index.html': page('profile'), 'profile/articles/index.html': page('profile').replace(profileCover(), profileLibrary()),
  'a/index.html': article('/a/', ['profile'], ['工作與學習']), 'b/index.html': article('/b/', ['memory'], ['個人記憶庫']),
  'c/index.html': article('/c/', ['profile', 'memory'], ['工作與學習', '個人記憶庫']),
  [routeFile('/2026/01/25/部落格改版規劃/')]: article('/2026/01/25/部落格改版規劃/', ['memory'], ['個人記憶庫'])
}; }
const codes = result => result.errors.map(error => error.code);

test('accepts exact source contract and output for core routes, search, and one-URL article representatives', () => {
  assert.deepEqual(validateSourceContract({ sources: files }).errors, []);
  const result = validateOutput({ root, pages: outputPages(), assets, index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 4);
  assert.equal(routeFile('/2026/01/25/%E9%83%A8%E8%90%BD%E6%A0%BC%E6%94%B9%E7%89%88%E8%A6%8F%E5%8A%83/'), '2026/01/25/部落格改版規劃/index.html');
});

test('accepts dual articles as the profile representative when no profile-only article exists', () => {
  const currentIndex = { records: index.records.map(record => record.id === 'p'
    ? { ...record, surfaces: ['profile', 'memory'] }
    : record) };
  const pages = outputPages();
  pages['a/index.html'] = article('/a/', ['profile', 'memory'], ['工作與學習', '個人記憶庫']);
  const result = validateOutput({ root, pages, assets, index: currentIndex });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.representativeKinds, ['memory', 'dual']);
});

test('rejects a real Unicode-route canonical mismatch after decoding both paths', () => {
  const pages = outputPages();
  pages[routeFile('/2026/01/25/部落格改版規劃/')] = pages[routeFile('/2026/01/25/部落格改版規劃/')]
    .replace(encodeURI('https://example.test/2026/01/25/部落格改版規劃/'), 'https://example.test/profile/');
  const result = validateOutput({ root, pages, assets, index });
  assert.ok(codes(result).includes('surface_copy_output_article_marker_invalid'));
});

test('rejects legacy label, private-mode wording, flip drift, unapproved copy status, thinking drift, and empty-state drift', () => {
  let changed = { ...files, postSurface: files.postSurface.replace('個人記憶庫', '個人記憶') };
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_legacy_memory_name'));
  changed = { ...files, navigation: files.navigation.replace('SIDE B／翻到個人記憶庫', 'SIDE B／私人模式') };
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_flip_contract_invalid'));
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_private_mode_wording'));
  changed = { ...files, profile: files.profile.replace('approved/10.6', 'working/10.6') };
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_profile_home_contract_invalid'));
  changed = { ...files, post: files.post.replace('🚧 當前假設／探索中', '探索中') };
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_template_drift'));
  changed = { ...files, profileLibraryTemplate: files.profileLibraryTemplate.replace('目前沒有可顯示的文章。', '還沒有內容') };
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_template_drift'));
});

test('rejects added profile intro and dual article order drift in output', () => {
  let changed = { ...files, profile: files.profile.replace('presentation:', 'intro: Added\npresentation:') };
  assert.ok(codes(validateSourceContract({ sources: changed })).includes('surface_copy_profile_home_contract_invalid'));
  const pages = outputPages();
  pages['index.html'] = pages['index.html'].replace('</div></div></main>', '<p class="profile-intro">未核准簡介</p></div></div></main>');
  assert.ok(codes(validateOutput({ root, pages, assets, index })).includes('surface_copy_output_profile_intro_forbidden'));
  pages['c/index.html'] = pages['c/index.html'].replace('工作與學習</a><span class="post-surface-marker-separator" aria-hidden="true">・</span><a class="post-surface-marker-link" data-surface="memory" href="/memory/">個人記憶庫', '個人記憶庫</a><span class="post-surface-marker-separator" aria-hidden="true">・</span><a class="post-surface-marker-link" data-surface="profile" href="/">工作與學習');
  assert.ok(codes(validateOutput({ root, pages, assets, index })).includes('surface_copy_output_article_marker_invalid'));
});
