'use strict';

const index = { schemaVersion: 1, records: [
  { kind: 'article', url: '/newest/', title: 'New & Newest', date: '2026-09-09', tags: ['測試', 'Ａ&B'], surfaces: ['profile'] },
  { kind: 'article', url: '/memory-only/', title: 'Memory only', date: '2026-09-10', tags: ['不應出現'], surfaces: ['memory'] },
  { kind: 'article', url: '/dual/', title: '雙面文章', date: '2026-09-08', tags: ['測試', '<tag>'], surfaces: ['profile', 'memory'] },
  { kind: 'article', url: '/oldest/', title: 'Oldest', date: '2025-12-31', tags: ['測試', 'Ａ&B'], surfaces: ['profile'] },
  { kind: 'microblog', url: '/status/', title: 'Not an article', date: '2026-09-11', tags: ['測試'], surfaces: ['profile'] }
] };

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function page(route = 'home') {
  const articles = index.records.filter(record => record.kind === 'article' && record.surfaces.includes('profile'))
    .sort((left, right) => right.date.localeCompare(left.date) || left.url.localeCompare(right.url));
  const tags = [
    { name: '測試', count: 3 },
    { name: 'Ａ&B', count: 2 },
    { name: '<tag>', count: 1 }
  ];
  const filters = `<div data-profile-tag-filters aria-label="依標籤篩選" hidden role="group"><button data-profile-tag-all aria-pressed="true">全部 3</button>${tags.map(tag => `<button data-profile-tag="${escapeHtml(tag.name)}" aria-pressed="false">${escapeHtml(tag.name)} ${tag.count}</button>`).join('')}</div>`;
  const rows = articles.map(article => `<li data-profile-article-row>${article.tags.map(tag => `<span data-profile-article-tag="${escapeHtml(tag)}" hidden></span>`).join('')}<a class="profile-list-link" href="${article.url}"><time datetime="${article.date}">${article.date}</time><span class="profile-list-title">${escapeHtml(article.title)}</span></a></li>`).join('');
  const cover = `<section data-profile-article-home><div class="profile-home-tools"><h2>文章</h2><p class="profile-home-count" data-profile-home-count data-total="${articles.length}">共 ${articles.length} 篇・依發表時間排序</p></div><div data-profile-home-search hidden><label for="profile-home-query">搜尋文章</label><input id="profile-home-query" type="search" placeholder="搜尋文章標題或標籤" aria-controls="profile-home-article-list"></div><ul id="profile-home-article-list" data-profile-home-article-list>${articles.map(article => `<li data-profile-home-article-row data-profile-home-search-text="${escapeHtml(article.title)}"><a class="profile-home-article-link" href="${article.url}"><time datetime="${article.date}">${article.date}</time><span class="profile-home-article-title">${escapeHtml(article.title)}</span></a></li>`).join('')}</ul><p data-profile-home-empty hidden>找不到符合的文章</p><script src="/js/profile-article-home-search.js" data-pjax defer></script></section>`;
  const body = route === 'home' ? cover : `<section data-profile-article-library><p data-profile-result-count aria-live="polite">全部 3</p>${filters}<p data-profile-filter-empty hidden>目前沒有符合這個標籤的文章。</p><ul data-profile-article-list>${rows}</ul></section>`;
  return `<html><head>${route === 'compatibility' ? '<script src="/js/profile-article-filter.js" data-pjax defer></script>' : ''}</head><body><h1 id="profile-title">工作與學習</h1>${body}</body></html>`;
}

const config = {
  presentation: { pageTitle: '工作與學習' },
  statusValues: ['learning-in-progress'],
  paths: [{ workingDescription: 'internal curation', items: [{ selectionReason: 'secret reason', readerValue: 'secret reader value' }] }]
};

module.exports = { index, page, config };
