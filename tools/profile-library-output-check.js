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

function publicationTimestamp(article, root) {
  if (!root) return Number.NEGATIVE_INFINITY;
  try {
    const target = new URL(article.url, 'https://local.invalid');
    const route = decodeURIComponent(target.pathname).replace(/^\/+|\/+$/g, '');
    const base = path.resolve(root);
    const output = path.resolve(base, route, 'index.html');
    if (target.origin !== 'https://local.invalid' || !output.startsWith(base + path.sep)) return Number.NEGATIVE_INFINITY;
    const $ = cheerio.load(fs.readFileSync(output, 'utf8'));
    for (const element of $('script[type="application/ld+json"]').toArray()) {
      const data = JSON.parse($(element).text());
      const candidates = Array.isArray(data) ? data : [data];
      const posting = candidates.find(item => item?.['@type'] === 'BlogPosting' || item?.['@type']?.includes?.('BlogPosting'));
      const timestamp = Date.parse(posting?.datePublished || '');
      if (Number.isFinite(timestamp)) return timestamp;
    }
  } catch { /* Missing article output is reported by the route check below. */ }
  return Number.NEGATIVE_INFINITY;
}

function expectedArticles(index, root) {
  return index.records
    .filter(record => record?.kind === 'article' && Array.isArray(record.surfaces) && record.surfaces.includes('profile'))
    .map(record => {
      const article = { ...record, tags: normalizeTags(record.tags) };
      return { article, timestamp: publicationTimestamp(article, root) };
    })
    .sort((left, right) => String(right.article.date || '').localeCompare(String(left.article.date || ''))
      || right.timestamp - left.timestamp
      || String(left.article.url || '').localeCompare(String(right.article.url || '')))
    .map(entry => entry.article);
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

  const articles = expectedArticles(navigationIndex, root);
  const tagSummary = summarizeTagCounts(articles);
  const $ = cheerio.load(html);
  if (route === 'home') {
    const home = $('[data-profile-article-home]');
    if ($('h1#profile-title').text().trim() !== '工作與學習') errors.push(diagnostic('profile_cover_title_invalid', file));
    if (home.length !== 1 || home.find('[data-profile-tag-filters], [data-profile-article-library]').length) errors.push(diagnostic('profile_cover_root_invalid', file));
    const search = home.find('[data-profile-home-search]');
    const input = search.find('input#profile-home-query[type="search"]');
    if (search.length !== 1 || search.attr('hidden') === undefined
        || search.find('label[for="profile-home-query"]').text().trim() !== '搜尋文章'
        || input.length !== 1 || input.attr('aria-controls') !== 'profile-home-article-list'
        || input.attr('placeholder') !== '搜尋文章標題或標籤'
        || home.find('script[src="/js/profile-article-home-search.js"][data-pjax]').length !== 1
        || home.find('.popup-trigger').length) errors.push(diagnostic('profile_home_search_invalid', file));
    const count = home.find('.profile-home-count').text().replace(/\s+/g, ' ').trim();
    if (count !== `共 ${articles.length} 篇・依發表時間排序`) errors.push(diagnostic('profile_home_count_invalid', file));
    const rows = home.find('[data-profile-home-article-row]').toArray().map(row => {
      const link = $(row).find('a.profile-home-article-link');
      const time = link.find('time');
      return { url: link.attr('href'), title: link.find('.profile-home-article-title').text().trim(), date: time.attr('datetime'), visibleDate: time.text().trim() };
    });
    if (home.find('ul#profile-home-article-list[data-profile-home-article-list]').length !== 1 || home.find('[data-profile-home-article-row]').toArray().some(row => !$(row).attr('data-profile-home-search-text')?.includes($(row).find('.profile-home-article-title').text().trim())) || JSON.stringify(rows) !== JSON.stringify(articles.map(article => ({
      url: article.url, title: article.title, date: String(article.date).slice(0, 10), visibleDate: String(article.date).slice(0, 10)
    })))) errors.push(diagnostic('profile_home_articles_invalid', file));
    if (home.find('.profile-article-calendar, #profile-calendar-chart, .profile-calendar-month, .profile-cover-main, .profile-path').length
        || $('script[src="/lib/echarts.min.js"], script[src="/lib/calendar.js"], script[src="/js/profile-article-calendar.js"]').length
        || /calendar(?:-posts)?\.json/.test(html)) errors.push(diagnostic('profile_home_calendar_rendered', file));
    if (home.find('.profile-path, .profile-learning, .profile-all-articles').length) errors.push(diagnostic('profile_cover_legacy_curation_rendered', file));
    const curationText = (config.paths || []).flatMap(entry => [entry.workingDescription,
      ...(entry.items || []).flatMap(item => [item.selectionReason, item.readerValue])])
      .filter(value => typeof value === 'string' && value.trim());
    if (curationText.some(value => html.includes(value)) || (config.statusValues || []).some(value => html.includes(value))) {
      errors.push(diagnostic('profile_library_internal_curation_leaked', file));
    }
    return { errors, articleCount: articles.length, tagCount: tagSummary.length };
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
  console.log(`profile-library ${route} 通過：${result.articleCount} unique profile articles、${result.tagCount} tags。`);
  return 0;
}

module.exports = { PAGE_PATHS, expectedArticles, validateProfileLibrary, runCli };
