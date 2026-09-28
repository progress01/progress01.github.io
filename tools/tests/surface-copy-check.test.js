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
  const year = Math.max(...records.map(record => Number(record.date.slice(0, 4))));
  const newestYear = records.filter(record => record.date.startsWith(`${year}-`));
  const postsByDate = {};
  newestYear.forEach(record => { (postsByDate[record.date] ||= []).push({ title: record.title, url: record.url, eventType: 'published', eventLabel: '發表' }); });
  Object.keys(postsByDate).forEach(date => postsByDate[date].sort((left, right) => left.url.localeCompare(right.url)));
  const counts = Object.fromEntries(Object.entries(postsByDate).map(([date, articles]) => [date, articles.length]));
  const latestDate = Object.keys(counts).sort().pop();
  const payload = JSON.stringify({ latestYear: String(year), latestDate, counts, postsByDate, articleTotal: records.length, eventTotal: records.length, activeDateCount: Object.keys(counts).length });
  return `<section class="profile-article-calendar" data-profile-article-calendar aria-label="工作與學習更新日曆"><h2 class="profile-calendar-year">${year} 更新日曆</h2><p class="profile-calendar-status" data-profile-calendar-status>共 ${records.length} 篇文章，${Object.keys(counts).length} 個活動日期</p><div class="profile-calendar-legend" aria-label="文章活動次數圖例">少 <span class="profile-calendar-gradient"></span> 多</div><div class="profile-calendar-scroll" tabindex="0" aria-label="全年更新熱力圖，可水平捲動"><div id="profile-calendar-chart" role="img" aria-label="${year} 工作與學習文章活動熱力圖"></div><div data-profile-calendar-controls role="group" aria-label="選擇有文章的日期"></div></div><section aria-live="polite"><h3 data-profile-calendar-detail-heading>${latestDate} 文章活動</h3><div data-profile-calendar-updates>${postsByDate[latestDate].map(record => `<a class="profile-calendar-article" href="${record.url}"><span class="profile-calendar-event-label" data-event-type="${record.eventType}">${record.eventLabel}</span><span class="profile-calendar-article-title">${record.title}</span></a>`).join('')}</div></section><nav class="profile-navigation"><a href="/profile/articles/">查看全部 ${records.length} 篇</a></nav><script type="application/json" data-profile-calendar-data>${payload}</script><script src="/lib/echarts.min.js" data-pjax></script><script src="/lib/languages.js" data-pjax></script><script src="/lib/calendar.js" data-pjax></script><script src="/js/profile-article-calendar.js" data-pjax></script></section>`;
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
