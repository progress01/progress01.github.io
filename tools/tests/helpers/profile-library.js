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
  const newestYear = Math.max(...articles.map(article => Number(article.date.slice(0, 4))));
  const currentYear = articles.filter(article => article.date.startsWith(`${newestYear}-`));
  const postsByDate = {};
  currentYear.forEach(article => { (postsByDate[article.date] ||= []).push({ title: article.title, url: article.url, eventType: 'published', eventLabel: '發表' }); });
  Object.keys(postsByDate).forEach(date => postsByDate[date].sort((left, right) => left.url.localeCompare(right.url)));
  const counts = Object.fromEntries(Object.entries(postsByDate).map(([date, entries]) => [date, entries.length]));
  const latestDate = Object.keys(counts).sort().pop();
  const payload = { latestYear: String(newestYear), latestDate, counts, postsByDate, articleTotal: articles.length, eventTotal: articles.length, activeDateCount: Object.keys(counts).length };
  const cover = `<section class="profile-article-calendar" data-profile-article-calendar aria-label="工作與學習更新日曆"><h2 class="profile-calendar-year">${newestYear} 更新日曆</h2><p class="profile-calendar-status" data-profile-calendar-status>共 ${articles.length} 篇文章，${Object.keys(counts).length} 個活動日期</p><div class="profile-calendar-legend" aria-label="文章活動次數圖例">少 <span class="profile-calendar-gradient"></span> 多</div><div class="profile-calendar-scroll" tabindex="0" aria-label="全年更新熱力圖，可水平捲動"><div id="profile-calendar-chart" role="img" aria-label="${newestYear} 工作與學習文章活動熱力圖"><p data-profile-calendar-fallback>熱力圖載入中；若無法顯示，請<a href="/profile/articles/">前往文章庫</a>。</p></div><div data-profile-calendar-controls role="group" aria-label="選擇有文章的日期"></div></div><section aria-live="polite"><h3 data-profile-calendar-detail-heading>${latestDate} 文章活動</h3><div data-profile-calendar-updates>${postsByDate[latestDate].map(article => `<a class="profile-calendar-article" href="${article.url}"><span class="profile-calendar-event-label" data-event-type="${article.eventType}">${article.eventLabel}</span><span class="profile-calendar-article-title">${escapeHtml(article.title)}</span></a>`).join('')}</div></section><nav class="profile-navigation"><a href="/profile/articles/">查看全部 ${articles.length} 篇</a></nav><script type="application/json" data-profile-calendar-data>${JSON.stringify(payload)}</script><script src="/lib/echarts.min.js" data-pjax></script><script src="/lib/languages.js" data-pjax></script><script src="/lib/calendar.js" data-pjax></script><script src="/js/profile-article-calendar.js" data-pjax></script></section>`;
  const body = route === 'home' ? cover : `<section data-profile-article-library><p data-profile-result-count aria-live="polite">全部 3</p>${filters}<p data-profile-filter-empty hidden>目前沒有符合這個標籤的文章。</p><ul data-profile-article-list>${rows}</ul></section>`;
  return `<html><head>${route === 'compatibility' ? '<script src="/js/profile-article-filter.js" data-pjax defer></script>' : ''}</head><body><h1 id="profile-title">工作與學習</h1>${body}</body></html>`;
}

const config = {
  presentation: { pageTitle: '工作與學習' },
  statusValues: ['learning-in-progress'],
  paths: [{ workingDescription: 'internal curation', items: [{ selectionReason: 'secret reason', readerValue: 'secret reader value' }] }]
};

module.exports = { index, page, config };
