'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');
const { summarizeTagCounts } = require('./lib/profile-articles');

const CONFIG_PATH = 'source/_data/profile-home.yml';
const INDEX_PATH = 'navigation-index.json';
const PAGE_PATHS = Object.freeze({
  home: 'profile/index.html',
  compatibility: 'profile/articles/index.html'
});

function diagnostic(code, file, url) {
  return { code, path: file, ...(url ? { url } : {}) };
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : []).map(tag => String(tag ?? '').trim()).filter(Boolean))];
}

function sortObjectKeys(value) {
  return Object.fromEntries(Object.keys(value || {}).sort().map(key => [key, value[key]]));
}

function expectedArticles(index) {
  return index.records
    .filter(record => record?.kind === 'article' && Array.isArray(record.surfaces) && record.surfaces.includes('profile'))
    .map(record => ({ ...record, tags: normalizeTags(record.tags) }))
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')) || String(left.url || '').localeCompare(String(right.url || '')));
}

function calendarDate(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return String(value || '').slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
}

function expectedActivityEvents(article, root) {
  let publishedDate = calendarDate(article.date);
  let updatedDate = '';
  if (root) {
    try {
      const route = decodeURIComponent(new URL(article.url, 'https://local.invalid').pathname).replace(/^\/+|\/+$/g, '');
      const base = path.resolve(root);
      const output = path.resolve(base, route, 'index.html');
      if (output.startsWith(base + path.sep)) {
        const $ = cheerio.load(fs.readFileSync(output, 'utf8'));
        for (const element of $('script[type="application/ld+json"]').toArray()) {
          const data = JSON.parse($(element).text());
          const candidates = Array.isArray(data) ? data : [data];
          const posting = candidates.find(item => item?.['@type'] === 'BlogPosting' || item?.['@type']?.includes?.('BlogPosting'));
          publishedDate = calendarDate(posting?.datePublished || article.date);
          updatedDate = calendarDate(posting?.dateModified || '');
          break;
        }
      }
    } catch { /* The output contract below still checks its route and visible data. */ }
  }
  const events = [{ date: publishedDate, eventType: 'published', eventLabel: '發表' }];
  if (/^\d{4}-\d{2}-\d{2}$/.test(updatedDate) && updatedDate !== publishedDate) {
    events.push({ date: updatedDate, eventType: 'updated', eventLabel: '更新' });
  }
  return events;
}

function validateProfileLibrary({ root, route = 'home', sourceRoot = path.resolve(__dirname, '..'), html, config, navigationIndex } = {}) {
  const errors = [];
  const file = PAGE_PATHS[route];
  if (!file) return { errors: [diagnostic('profile_library_route_invalid', 'profile/index.html')], articleCount: 0, tagCount: 0 };
  if (!config) {
    try { config = yaml.load(fs.readFileSync(path.join(sourceRoot, CONFIG_PATH), 'utf8')); }
    catch { errors.push(diagnostic('profile_library_config_unreadable', CONFIG_PATH)); }
  }
  if (!navigationIndex) {
    try { navigationIndex = JSON.parse(fs.readFileSync(path.join(root, INDEX_PATH), 'utf8')); }
    catch { errors.push(diagnostic('profile_library_index_unreadable', INDEX_PATH)); }
  }
  if (html === undefined) {
    try { html = fs.readFileSync(path.join(root, file), 'utf8'); }
    catch { errors.push(diagnostic('profile_library_output_unreadable', file)); }
  }
  if (errors.length) return { errors, articleCount: 0, tagCount: 0 };
  if (!config?.presentation || !Array.isArray(navigationIndex?.records)) {
    return { errors: [diagnostic('profile_library_data_invalid', file)], articleCount: 0, tagCount: 0 };
  }

  const articles = expectedArticles(navigationIndex);
  const expectedByUrl = new Map(articles.map(article => [article.url, article.title]));
  const expectedPostsByDate = {};
  const expectedEvents = [];
  for (const article of articles) {
    for (const event of expectedActivityEvents(article, root)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
      const row = { title: article.title, url: article.url, eventType: event.eventType, eventLabel: event.eventLabel };
      expectedEvents.push({ ...row, date: event.date });
      (expectedPostsByDate[event.date] ||= []).push(row);
    }
  }
  const eventOrder = { published: 0, updated: 1 };
  Object.keys(expectedPostsByDate).forEach(date => expectedPostsByDate[date].sort((left, right) => eventOrder[left.eventType] - eventOrder[right.eventType] || left.url.localeCompare(right.url) || left.title.localeCompare(right.title)));
  const newestYear = Object.keys(expectedPostsByDate).sort().at(-1)?.slice(0, 4) || null;
  const expectedCounts = Object.fromEntries(Object.entries(expectedPostsByDate)
    .filter(([date]) => date.startsWith(`${newestYear}-`)).map(([date, entries]) => [date, entries.length]));
  const expectedLatestDate = Object.keys(expectedCounts).sort().at(-1) || null;
  const expectedCurrentArticles = Object.entries(expectedPostsByDate)
    .filter(([date]) => date.startsWith(`${newestYear}-`)).flatMap(([, entries]) => entries);
  const expectedCurrentEventKeys = expectedCurrentArticles.map(event => `${event.url}\u0000${event.eventType}`).sort();
  const tagSummary = summarizeTagCounts(articles);
  const $ = cheerio.load(html);
  if (route === 'home') {
    const cover = $('.profile-article-calendar');
    if ($('h1#profile-title').text().trim() !== '工作與學習') errors.push(diagnostic('profile_cover_title_invalid', file));
    if (cover.length !== 1 || cover.find('[data-profile-tag-filters], [data-profile-article-library], .profile-list-link').length) {
      errors.push(diagnostic('profile_cover_root_invalid', file));
    }
    if (cover.find('.profile-cover-main, .profile-cover-secondary, .profile-cover-eyebrow, .profile-cover-tags, .profile-article-link, .profile-cover-read, .profile-calendar-months, .profile-calendar-month, .profile-calendar-entry').length
        || cover.find('.profile-calendar-year').text().trim() !== (newestYear ? `${newestYear} 更新日曆` : '')
        || cover.find('#profile-calendar-chart[role="img"]').length !== 1
        || cover.find('[data-profile-calendar-controls][role="group"][aria-label="選擇有文章的日期"]').length !== 1) {
      errors.push(diagnostic('profile_calendar_heatmap_markup_invalid', file));
    }
    const payloadNode = cover.find('script[type="application/json"][data-profile-calendar-data]');
    let payload = null;
    try { payload = JSON.parse(payloadNode.text()); } catch { /* diagnosed below */ }
    const activityDates = Object.keys(payload?.counts || {}).sort();
    const activityArticles = [];
    let calendarValid = payload?.latestYear === newestYear
      && JSON.stringify(sortObjectKeys(payload?.counts)) === JSON.stringify(sortObjectKeys(expectedCounts))
      && payload?.latestDate === expectedLatestDate
      && payload?.articleTotal === articles.length && payload?.eventTotal === expectedEvents.length
      && payload?.activeDateCount === Object.keys(expectedCounts).length;
    for (const date of activityDates) {
      const entries = payload.postsByDate?.[date];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(`${payload.latestYear}-`)
          || !Array.isArray(entries) || payload.counts[date] !== entries.length) calendarValid = false;
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (!expectedByUrl.has(entry?.url) || expectedByUrl.get(entry.url) !== entry?.title
            || !['published', 'updated'].includes(entry?.eventType)
            || entry?.eventLabel !== (entry.eventType === 'published' ? '發表' : '更新')) calendarValid = false;
        activityArticles.push(entry);
      }
    }
    const activityEventKeys = activityArticles.map(event => `${event.url}\u0000${event.eventType}`).sort();
    if (payloadNode.length !== 1 || !calendarValid || activityArticles.length !== expectedCurrentArticles.length
        || new Set(activityEventKeys).size !== activityEventKeys.length
        || JSON.stringify(activityEventKeys) !== JSON.stringify(expectedCurrentEventKeys)) {
      errors.push(diagnostic('profile_calendar_data_invalid', file));
    }
    const fallbackLinks = cover.find('[data-profile-calendar-fallback] a');
    if (fallbackLinks.length !== 1 || fallbackLinks.attr('href') !== '/profile/articles/') errors.push(diagnostic('profile_calendar_fallback_invalid', file));
    if (cover.find('script[src="/lib/echarts.min.js"][data-pjax], script[src="/lib/languages.js"][data-pjax], script[src="/lib/calendar.js"][data-pjax], script[src="/js/profile-article-calendar.js"][data-pjax]').length !== 4
        || /calendar(?:-posts)?\.json/.test(html)) errors.push(diagnostic('profile_calendar_assets_invalid', file));
    const detailLinks = cover.find('[data-profile-calendar-updates] a.profile-calendar-article').toArray().map(link => ({
      title: $(link).find('.profile-calendar-article-title').text().trim(),
      url: $(link).attr('href'),
      eventType: $(link).find('.profile-calendar-event-label').attr('data-event-type'),
      eventLabel: $(link).find('.profile-calendar-event-label').text().trim()
    }));
    const expectedLatest = expectedPostsByDate[expectedLatestDate] || [];
    if (JSON.stringify(detailLinks) !== JSON.stringify(expectedLatest)) {
      errors.push(diagnostic('profile_calendar_latest_detail_invalid', file));
    }
    const oldCalendarText = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(cover.text());
    if (oldCalendarText || cover.find('[data-profile-tag-filters], .profile-cover-description, .profile-cover-category, .profile-cover-tags').length) {
      errors.push(diagnostic('profile_calendar_extra_copy_invalid', file));
    }
    const allLink = cover.find('.profile-navigation a');
    if (allLink.length !== 1 || allLink.attr('href') !== '/profile/articles/'
        || allLink.text().replace(/\s+/g, ' ').trim() !== `查看全部 ${articles.length} 篇`) {
      errors.push(diagnostic('profile_cover_all_articles_link_invalid', file));
    }
    if (cover.find('.profile-path, .profile-learning, .profile-all-articles').length) errors.push(diagnostic('profile_cover_legacy_curation_rendered', file));
    const curationText = (config.paths || []).flatMap(entry => [entry.workingDescription,
      ...(entry.items || []).flatMap(item => [item.selectionReason, item.readerValue])])
      .filter(value => typeof value === 'string' && value.trim());
    if (curationText.some(value => html.includes(value)) || (config.statusValues || []).some(value => html.includes(value))) {
      errors.push(diagnostic('profile_library_internal_curation_leaked', file));
    }
    const currentActivityArticles = expectedCurrentArticles.length;
    return { errors, articleCount: articles.length, tagCount: tagSummary.length, eventTotal: expectedEvents.length, calendarYear: Number(payload?.latestYear) || null, calendarCount: currentActivityArticles, activeDateCount: Object.keys(expectedCounts).length, activityCounts: expectedCounts };
  }
  if ($('h1#profile-title').text().trim() !== '工作與學習') errors.push(diagnostic('profile_library_title_invalid', file));
  const library = $('[data-profile-article-library]');
  if (library.length !== 1) errors.push(diagnostic('profile_library_root_invalid', file));
  const count = library.find('[data-profile-result-count]');
  if (count.length !== 1 || count.text().replace(/\s+/g, ' ').trim() !== `全部 ${articles.length}`) {
    errors.push(diagnostic('profile_library_total_invalid', file));
  }

  const filters = library.find('[data-profile-tag-filters]');
  if (filters.length !== 1 || filters.attr('hidden') === undefined || filters.attr('aria-label') !== '依標籤篩選') {
    errors.push(diagnostic('profile_library_filter_fallback_invalid', file));
  }
  const allButtons = filters.find('button[data-profile-tag-all]');
  if (allButtons.length !== 1 || allButtons.attr('aria-pressed') !== 'true'
      || allButtons.text().replace(/\s+/g, ' ').trim() !== `全部 ${articles.length}`) {
    errors.push(diagnostic('profile_library_all_filter_invalid', file));
  }
  const actualTags = filters.find('button[data-profile-tag]').toArray().map(button => ({
    name: $(button).attr('data-profile-tag'),
    label: $(button).text().replace(/\s+/g, ' ').trim(),
    pressed: $(button).attr('aria-pressed')
  }));
  if (JSON.stringify(actualTags.map(tag => tag.name)) !== JSON.stringify(tagSummary.map(tag => tag.name))
      || actualTags.some((tag, index) => tag.label !== `${tagSummary[index]?.name} ${tagSummary[index]?.count}` || tag.pressed !== 'false')) {
    errors.push(diagnostic('profile_library_tag_filters_invalid', file));
  }

  const rows = library.find('[data-profile-article-row]');
  if (rows.length !== articles.length) errors.push(diagnostic('profile_library_article_count_invalid', file));
  const actualUrls = [];
  rows.each((index, row) => {
    const expected = articles[index];
    const item = $(row);
    const link = item.find('a.profile-list-link');
    const url = link.attr('href');
    const date = link.find('time').attr('datetime');
    const title = link.find('.profile-list-title').text().trim();
    const tags = item.find('[data-profile-article-tag]').toArray().map(element => $(element).attr('data-profile-article-tag'));
    if (item.attr('hidden') !== undefined) errors.push(diagnostic('profile_library_initial_filter_active', `${file}#articles[${index}]`, url));
    if (!expected || link.length !== 1 || url !== expected.url || title !== expected.title || date !== expected.date
        || JSON.stringify(tags) !== JSON.stringify(expected.tags)) {
      errors.push(diagnostic('profile_library_article_invalid', `${file}#articles[${index}]`, expected?.url));
    }
    if (url) {
      actualUrls.push(url);
      if (root) {
        try {
          const target = new URL(url, 'https://local.invalid');
          const routePath = decodeURIComponent(target.pathname).replace(/^\/+|\/+$/g, '');
          const targetPath = path.resolve(root, routePath, 'index.html');
          if (target.origin !== 'https://local.invalid' || !targetPath.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(targetPath)) {
            errors.push(diagnostic('profile_library_article_route_missing', file, url));
          }
        } catch { errors.push(diagnostic('profile_library_article_route_invalid', file, url)); }
      }
    }
  });
  if (new Set(actualUrls).size !== actualUrls.length) errors.push(diagnostic('profile_library_urls_not_unique', file));

  const emptyFilter = library.find('[data-profile-filter-empty]');
  if (emptyFilter.length !== 1 || emptyFilter.attr('hidden') === undefined) errors.push(diagnostic('profile_library_filter_empty_state_invalid', file));
  if (articles.length && library.find('.profile-articles-empty').length) errors.push(diagnostic('profile_library_static_empty_state_unexpected', file));
  if (!articles.length && library.find('.profile-articles-empty').text().trim() !== '目前沒有可顯示的文章。') {
    errors.push(diagnostic('profile_library_static_empty_state_invalid', file));
  }
  if ($('.profile-path, .profile-learning, .profile-all-articles').length) errors.push(diagnostic('profile_library_legacy_curation_rendered', file));
  const curationText = (config.paths || []).flatMap(entry => [entry.workingDescription,
    ...(entry.items || []).flatMap(item => [item.selectionReason, item.readerValue])])
    .filter(value => typeof value === 'string' && value.trim());
  if (curationText.some(value => html.includes(value)) || (config.statusValues || []).some(value => html.includes(value))) {
    errors.push(diagnostic('profile_library_internal_curation_leaked', file));
  }
  if (!/profile-article-filter\.js/.test(html) || !/data-pjax/.test(html)) errors.push(diagnostic('profile_library_script_missing', file));
  return { errors, articleCount: articles.length, tagCount: tagSummary.length };
}

function runCli(args = process.argv.slice(2), route = 'home') {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('profile-library 檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex !== -1 && args[sourceRootIndex + 1] ? path.resolve(args[sourceRootIndex + 1]) : path.resolve(__dirname, '..');
  const result = validateProfileLibrary({ root: path.resolve(args[rootIndex + 1]), route, sourceRoot });
  if (result.errors.length) {
    console.error('profile-library 輸出檢查失敗：');
    result.errors.forEach(error => console.error(`- ${error.code} path=${error.path}${error.url ? ` url=${error.url}` : ''}`));
    return 1;
  }
  const calendar = route === 'home' ? `、${result.eventTotal} events／${result.activeDateCount} active dates ${JSON.stringify(result.activityCounts)}` : '';
  console.log(`profile-library ${route} 通過：${result.articleCount} unique profile articles、${result.tagCount} tags${calendar}。`);
  return 0;
}

module.exports = { PAGE_PATHS, expectedArticles, expectedActivityEvents, validateProfileLibrary, runCli };
