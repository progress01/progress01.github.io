'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const Search = require('../themes/next/source/js/third-party/search/navigation-search');

const SCOPE_OPTIONS = Object.freeze([
  ['profile', '工作與學習'],
  ['memory', '個人記憶庫'],
  ['all', '全部公開內容']
]);

function diagnostic(code, file) { return { code, path: file }; }
function routeFile(url) {
  try {
    const pathname = decodeURIComponent(new URL(url, 'https://example.test').pathname);
    const relative = pathname.replace(/^\/+/, '');
    return relative.endsWith('/') ? `${relative}index.html` : relative;
  } catch { return null; }
}
function generatedArticlePaths(root) {
  const found = new Set();
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        let html;
        try { html = fs.readFileSync(file, 'utf8'); } catch { continue; }
        if (!cheerio.load(html)('.post-content-single[itemtype*="BlogPosting"]').length) continue;
        const relative = path.relative(root, file).split(path.sep).join('/');
        const route = relative.endsWith('/index.html') ? `/${relative.slice(0, -'index.html'.length)}` : `/${relative}`;
        found.add(decodeURIComponent(route));
      }
    }
  };
  visit(root);
  return found;
}

function validateSearchSurface({ root, pages, index, sources = {} } = {}) {
  const errors = [];
  const files = {
    localSearch: 'themes/next/source/js/third-party/search/local-search.js',
    navigationSearch: 'themes/next/source/js/third-party/search/navigation-search.js',
    template: 'themes/next/layout/_partials/search/index.njk',
    helper: 'tools/lib/navigation-index.js'
  };
  let articlePagePath = null;
  for (const key of Object.keys(files)) {
    if (typeof sources[key] !== 'string') {
      try { sources[key] = fs.readFileSync(path.join(__dirname, '..', files[key]), 'utf8'); }
      catch { sources[key] = ''; }
    }
    if (!sources[key]) errors.push(diagnostic('search_surface_source_unreadable', files[key]));
  }
  if (!/NavigationSearch\.defaultSurface\([\s\S]*?window\.location\?\.pathname[\s\S]*?\.post-surface-marker/.test(sources.localSearch)
      || !/document\.addEventListener\('pjax:success',[\s\S]*?currentPageSurface\(\)/.test(sources.localSearch)
      || !/NavigationSearch\.resetFilters\(defaultSurface\)/.test(sources.localSearch)
      || !/saved\.filters\.surface !== saved\.surface/.test(sources.localSearch)
      || !/searchState = 'failed'/.test(sources.localSearch)
      || /searchState = 'error'/.test(sources.localSearch)
      || !/role="status" aria-live="polite" aria-atomic="true"/.test(sources.localSearch)
      || !/data-search-empty-kind/.test(sources.localSearch)
      || !/重試載入搜尋索引/.test(sources.localSearch)) {
    errors.push(diagnostic('search_surface_page_state_wiring_invalid', files.localSearch));
  }
  if (!/search-result-surfaces/.test(sources.navigationSearch)
      || !/收錄於：/.test(sources.navigationSearch)
      || !/surfaceLabels/.test(sources.navigationSearch)
      || !/seenIds/.test(sources.navigationSearch)) {
    errors.push(diagnostic('search_surface_result_labels_or_dedup_missing', files.navigationSearch));
  }
  if (!/data-search-recent-list/.test(sources.template)
      || /search_recent_posts\(\)/.test(sources.template)
      || !/publishedAt/.test(sources.helper)
      || !/NavigationSearch\.renderRecent\(document, recent, records, filters\.surface, selectedCategory, restoreFocus\)/.test(sources.localSearch)) {
    errors.push(diagnostic('search_surface_recent_source_invalid', files.template));
  }

  if (!index) {
    try { index = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8')); }
    catch { return { errors: [...errors, diagnostic('search_surface_index_unreadable', 'navigation-index.json')], recordCount: 0, recentCount: 0 }; }
  }
  let records;
  try { records = Search.parse(JSON.stringify(index)); }
  catch { return { errors: [...errors, diagnostic('search_surface_index_invalid', 'navigation-index.json')], recordCount: 0, recentCount: 0 }; }
  const articles = records.filter(record => record.kind === 'article');
  const articleByPath = new Map(articles.map(record => [new URL(record.url, 'https://example.test').pathname, record]));
  if (!pages) {
    const generated = generatedArticlePaths(root);
    const indexed = new Set(articleByPath.keys());
    if (generated.size !== indexed.size || [...generated].some(route => !indexed.has(route))) {
      errors.push(diagnostic('search_surface_article_dataset_incomplete', 'navigation-index.json'));
    }
  }
  for (const record of articles) {
    if (typeof record.publishedAt !== 'string' || Number.isNaN(Date.parse(record.publishedAt))) {
      errors.push(diagnostic('search_surface_article_publication_time_missing', record.url));
      continue;
    }
    const file = routeFile(record.url);
    let articleHtml = pages?.[file];
    try { if (articleHtml === undefined) articleHtml = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
    catch { errors.push(diagnostic('search_surface_article_page_unreadable', file)); continue; }
    const articlePage = cheerio.load(articleHtml);
    const jsonLd = articlePage('script[type="application/ld+json"]').toArray().map(node => {
      try { return JSON.parse(articlePage(node).text()); } catch { return null; }
    }).find(value => value && (value['@type'] === 'BlogPosting' || Array.isArray(value['@type']) && value['@type'].includes('BlogPosting')));
    const visibleDate = articlePage('[itemprop~="datePublished"]').first().attr('datetime');
    if (!jsonLd?.datePublished || Date.parse(jsonLd.datePublished) !== Date.parse(record.publishedAt) ||
        !visibleDate || Date.parse(visibleDate) !== Date.parse(record.publishedAt)) {
      errors.push(diagnostic('search_surface_article_publication_time_mismatch', file));
    }
  }
  const pageFiles = ['index.html', 'memory/index.html', 'profile/index.html', 'archives/index.html'];
  const articleRecord = articles.find(record => record.surfaces.includes('profile') && record.surfaces.includes('memory'));
  if (articleRecord) { articlePagePath = routeFile(articleRecord.url); pageFiles.push(articlePagePath); }
  else errors.push(diagnostic('search_surface_dual_article_missing', 'navigation-index.json'));

  const dualResults = articleRecord ? ['profile', 'memory', 'all'].map(surface =>
    Search.search(records, articleRecord.title, { surface }).filter(result => result.record.id === articleRecord.id).length
  ) : [];
  if (dualResults.length && dualResults.some(count => count !== 1)) {
    errors.push(diagnostic('search_surface_dual_result_not_unique', 'navigation-index.json'));
  }
  const sharedUrlRecords = [...records.reduce((groups, record) => {
    const group = groups.get(record.url) || [];
    group.push(record);
    groups.set(record.url, group);
    return groups;
  }, new Map()).values()].find(group => group.length > 1 && new Set(group.map(record => record.id)).size > 1);
  const sharedUrlResults = sharedUrlRecords ? ['profile', 'memory', 'all'].map(surface => {
    const expected = sharedUrlRecords.filter(record => surface === 'all' || record.surfaces.includes(surface)).map(record => record.id).sort();
    const actual = Search.search(records, '', { surface }).filter(result => result.record.url === sharedUrlRecords[0].url).map(result => result.record.id).sort();
    return JSON.stringify(actual) === JSON.stringify(expected);
  }) : [];
  if (!sharedUrlRecords || sharedUrlResults.some(ok => !ok)) {
    errors.push(diagnostic('search_surface_shared_url_records_not_preserved', 'navigation-index.json'));
  }

  let recentCount = 0;
  for (const file of [...new Set(pageFiles)]) {
    let html = pages?.[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch { errors.push(diagnostic('search_surface_page_unreadable', file)); continue; }
    }
    const $ = cheerio.load(html);
    const select = $('select[data-navigation-filter="surface"]');
    if (select.length !== 1) {
      errors.push(diagnostic('search_surface_scope_control_missing', file));
    } else {
      const label = select.closest('label').text().replace(/\s+/g, ' ').trim();
      const options = select.find('option').toArray().map(option => [$(option).attr('value'), $(option).text().trim()]);
      if (!label.includes('搜尋範圍') || JSON.stringify(options) !== JSON.stringify(SCOPE_OPTIONS)) {
        errors.push(diagnostic('search_surface_scope_options_invalid', file));
      }
    }
    const list = $('[data-search-recent-list]');
    if (list.length !== 1 || list.children().length !== 0 || $('[data-search-recent-item]').length) {
      errors.push(diagnostic('search_surface_recent_static_candidates_present', file));
    }
    const scope = file === articlePagePath ? 'all' : file === 'profile/index.html' || file === 'index.html' ? 'profile' : 'memory';
    const categories = ['all', ...new Set(articles.flatMap(record => record.categories))];
    for (const category of categories) {
      const eligible = articles.filter(record => (scope === 'all' || record.surfaces.includes(scope)) &&
        (category === 'all' || record.categories.includes(category)));
      const expected = eligible.slice().sort((a, b) => {
        const aTime = Date.parse(a.publishedAt || `${a.date || ''}T00:00:00.000Z`) || 0;
        const bTime = Date.parse(b.publishedAt || `${b.date || ''}T00:00:00.000Z`) || 0;
        return bTime - aTime || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
      }).slice(0, 10).map(record => record.id);
      const actual = Search.recentArticles(records, scope, category).map(record => record.id);
      if (expected.length > 10 || JSON.stringify(actual) !== JSON.stringify(expected) ||
          actual.some(id => !articleByPath.has(new URL(records.find(record => record.id === id).url, 'https://example.test').pathname))) {
        errors.push(diagnostic('search_surface_recent_dataset_selection_invalid', `${file}#${category}`));
      }
      recentCount = Math.max(recentCount, actual.length);
    }
  }

  const defaults = {
    profile: Search.defaultSurface('/', false),
    profileChild: Search.defaultSurface('/profile/articles/', false),
    memory: Search.defaultSurface('/memory/', false),
    archive: Search.defaultSurface('/archives/', false),
    article: Search.defaultSurface(articleRecord?.url || '/work/example/', true)
  };
  if (defaults.profile !== 'profile' || defaults.profileChild !== 'profile' || defaults.memory !== 'memory'
      || defaults.archive !== 'memory' || defaults.article !== 'all') {
    errors.push(diagnostic('search_surface_default_truth_invalid', 'NavigationSearch.defaultSurface'));
  }

  return { errors, recordCount: records.length, articleCount: articles.length, recentCount, defaults, dualResults, sharedUrlRecordCount: sharedUrlRecords?.length || 0 };
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('search-surface 檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const result = validateSearchSurface({ root: path.resolve(args[rootIndex + 1]) });
  if (result.errors.length) {
    console.error('搜尋面向輸出檢查失敗：');
    result.errors.forEach(error => console.error(`- ${error.code} path=${error.path}`));
    return 1;
  }
  console.log(`搜尋面向輸出檢查通過：${result.recordCount} records、${result.articleCount} 篇完整索引文章、每頁／分類最多 ${result.recentCount} 篇 recent、雙面文章各範圍 ${result.dualResults.join('/')} 筆、共用 URL ${result.sharedUrlRecordCount} 筆獨立紀錄、預設 ${JSON.stringify(result.defaults)}。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { routeFile, generatedArticlePaths, validateSearchSurface, runCli };
