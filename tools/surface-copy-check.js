'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');
const { expectedActivityEvents } = require('./profile-library-output-check');

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const FILES = Object.freeze({
  navigation: 'source/_data/surface-navigation.yml',
  profile: 'source/_data/profile-home.yml',
  postSurface: 'tools/lib/post-surface.js',
  searchJs: 'themes/next/source/js/third-party/search/navigation-search.js',
  searchTemplate: 'themes/next/layout/_partials/search/index.njk',
  home: 'themes/next/layout/index.njk',
  post: 'themes/next/layout/_macro/post.njk',
  profileTemplate: 'themes/next/layout/profile.njk',
  articlesTemplate: 'themes/next/layout/profile-articles.njk',
  profileLibraryTemplate: 'themes/next/layout/_partials/profile-article-library.njk',
  profileCalendarTemplate: 'themes/next/layout/_partials/profile-article-calendar.njk',
  filterScript: 'themes/next/source/js/profile-article-filter.js',
  layout: 'themes/next/layout/_layout.njk'
});
const OPTIONS = [['profile', '工作與學習'], ['memory', '個人記憶庫'], ['all', '全部公開內容']];
const ARTICLE_MARKERS = { profile: '工作與學習', memory: '個人記憶庫' };

function diagnostic(code, file) { return { code, path: file }; }
function hasAll(text, snippets) { return snippets.every(snippet => text.includes(snippet)); }
function normalizedPath(url) {
  try { return decodeURIComponent(new URL(url, 'https://example.test').pathname); }
  catch { return null; }
}
function routeFile(url) {
  const pathname = normalizedPath(url);
  if (pathname === null) return null;
  const relative = pathname.replace(/^\/+/, '');
  return relative.endsWith('/') ? `${relative}index.html` : relative;
}

function validateSourceContract({ sourceRoot = DEFAULT_SOURCE_ROOT, sources = {} } = {}) {
  const errors = [];
  const text = {};
  for (const [key, file] of Object.entries(FILES)) {
    try { text[key] = sources[key] ?? fs.readFileSync(path.join(sourceRoot, file), 'utf8'); }
    catch { text[key] = ''; }
    if (!text[key]) errors.push(diagnostic('surface_copy_source_unreadable', file));
  }

  let navigation;
  let profile;
  try { navigation = yaml.load(text.navigation); } catch { navigation = null; }
  try { profile = yaml.load(text.profile); } catch { profile = null; }
  const controls = navigation?.controls || {};
  if (controls.memory?.target !== 'profile' || controls.memory?.href !== '/' || controls.memory?.label !== 'SIDE A／看工作與學習'
      || controls.profile?.target !== 'memory' || controls.profile?.href !== '/memory/' || controls.profile?.label !== 'SIDE B／翻到個人記憶庫') {
    errors.push(diagnostic('surface_copy_flip_contract_invalid', FILES.navigation));
  }
  if (!Array.isArray(navigation?.menus?.profile) || navigation.menus.profile.length !== 2
      || navigation.menus.profile[0]?.id !== 'home' || navigation.menus.profile[0]?.label !== '工作與學習'
      || navigation.menus.profile[0]?.href !== '/' || navigation.menus.profile[1]?.id !== 'articles'
      || navigation.menus.profile[1]?.label !== '全部文章' || navigation.menus.profile[1]?.href !== '/profile/articles/') {
    errors.push(diagnostic('surface_copy_profile_menu_invalid', FILES.navigation));
  }
  const presentation = profile?.presentation || {};
  if (profile?.copyStatus !== 'approved/10.6'
      || presentation.pageTitle !== '工作與學習' || presentation.flipLabel !== 'SIDE B／翻到個人記憶庫'
      || Object.keys(presentation).some(key => !['pageTitle', 'flipLabel'].includes(key))
      || Object.hasOwn(profile || {}, 'intro') || Object.hasOwn(profile || {}, 'tagline') || Object.hasOwn(profile || {}, 'summary')) {
    errors.push(diagnostic('surface_copy_profile_home_contract_invalid', FILES.profile));
  }
  if ((profile?.paths || []).length !== 3 || profile.paths.some(item => item?.workingDescriptionVisibility !== 'internal')) {
    errors.push(diagnostic('surface_copy_internal_profile_data_invalid', FILES.profile));
  }

  const requirements = [
    ['postSurface', ['profile: Object.freeze({ id: \'profile\', label: \'工作與學習\', href: \'/\' })', "memory: Object.freeze({ id: 'memory', label: '個人記憶庫', href: '/memory/' })"]],
    ['searchJs', ["surfaceLabels = { profile: '工作與學習', memory: '個人記憶庫' }", '收錄於：', 'seenIds']],
    ['searchTemplate', ['搜尋範圍', '<option value="profile">工作與學習</option>', '<option value="memory">個人記憶庫</option>', '<option value="all">全部公開內容</option>']],
    ['home', ['<span class="home-profile-bridge-label">SIDE A</span>', '<h2 id="home-profile-bridge-title">工作與學習</h2>', '看整理過的經驗與方法', '翻到 A 面 ↗']],
    ['post', ['收錄於', '文章收錄面向', '・', '🚧 當前假設／探索中', '最近校準', '目前適用邊界']],
    ['profileTemplate', ['profile-article-calendar.njk', '工作與學習']],
    ['articlesTemplate', ['profile-article-library.njk', '工作與學習']],
    ['profileLibraryTemplate', ['data-profile-result-count', '全部 {{ library.total }}', 'data-profile-tag-filters', 'data-profile-article-row', 'article.tags', '目前沒有可顯示的文章。']],
    ['profileCalendarTemplate', ['profile_article_calendar()', 'data-profile-calendar-data', 'data-profile-calendar-controls', 'profile-calendar-year', '個活動日期', '文章活動', 'eventLabel', '少', '多', '查看全部 {{ calendar.articleTotal }} 篇']],
    ['filterScript', ['readTagFilter', 'serializeTagFilter', 'hashchange', 'popstate', 'pjax:success', '__profileArticleFilterInstalled', 'controls.hidden = false']],
    ['layout', ['class="skip-link" href="#main-content">跳到主要內容</a>']]
  ];
  for (const [key, snippets] of requirements) {
    if (!hasAll(text[key], snippets)) errors.push(diagnostic('surface_copy_template_drift', FILES[key]));
  }
  if (!hasAll(text.searchTemplate, OPTIONS.map(([, label]) => label))) errors.push(diagnostic('surface_copy_search_scope_invalid', FILES.searchTemplate));

  const activeSources = ['navigation', 'postSurface', 'searchJs', 'searchTemplate', 'home', 'post', 'profileTemplate', 'articlesTemplate', 'profileLibraryTemplate', 'profileCalendarTemplate', 'filterScript', 'layout'];
  for (const key of activeSources) {
    if (/個人記憶(?!庫)/u.test(text[key])) errors.push(diagnostic('surface_copy_legacy_memory_name', FILES[key]));
    if (/私人模式|私密模式/u.test(text[key])) errors.push(diagnostic('surface_copy_private_mode_wording', FILES[key]));
    if (/A版.{0,12}B版|B版.{0,12}A版|複製.{0,8}文章/u.test(text[key])) errors.push(diagnostic('surface_copy_duplicate_article_implication', FILES[key]));
  }
  return { errors };
}

function validateOutput({ root, pages = {}, assets = {}, index } = {}) {
  const errors = [];
  const readPage = file => {
    if (pages[file] !== undefined) return pages[file];
    try { return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
    catch { errors.push(diagnostic('surface_copy_output_unreadable', file)); return ''; }
  };
  if (!index) {
    try { index = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8')); }
    catch { errors.push(diagnostic('surface_copy_navigation_index_unreadable', 'navigation-index.json')); }
  }
  if (!Array.isArray(index?.records)) return { errors: [...errors, diagnostic('surface_copy_navigation_index_invalid', 'navigation-index.json')], articleCount: 0 };

  let navigationSearchJs = assets.navigationSearch;
  if (navigationSearchJs === undefined) {
    try { navigationSearchJs = fs.readFileSync(path.join(root, 'js/third-party/search/navigation-search.js'), 'utf8'); }
    catch { navigationSearchJs = ''; }
  }
  if (!navigationSearchJs.includes("memory: '個人記憶庫'") || !navigationSearchJs.includes('收錄於：')
      || /個人記憶(?!庫)/u.test(navigationSearchJs) || /私人模式|私密模式/u.test(navigationSearchJs)) {
    errors.push(diagnostic('surface_copy_output_search_js_invalid', 'js/third-party/search/navigation-search.js'));
  }

  for (const file of ['index.html', 'memory/index.html', 'profile/index.html', 'profile/articles/index.html']) {
    const html = readPage(file);
    const $ = cheerio.load(html);
    if ($('.skip-link').length !== 1 || $('.skip-link').text().trim() !== '跳到主要內容') errors.push(diagnostic('surface_copy_skip_link_invalid', file));
    const current = file === 'memory/index.html' ? 'memory' : 'profile';
    const flip = $(`.surface-switch[data-current-surface="${current}"] a.surface-switch-link`);
    const expectedFlip = current === 'memory' ? 'SIDE A／看工作與學習' : 'SIDE B／翻到個人記憶庫';
    const expectedHref = current === 'memory' ? '/' : '/memory/';
    if (flip.length !== 1 || flip.text().trim() !== expectedFlip || flip.attr('href') !== expectedHref) errors.push(diagnostic('surface_copy_output_flip_invalid', file));
    if (/私人模式|私密模式|個人記憶(?!庫)/u.test($.root().text())) errors.push(diagnostic('surface_copy_output_forbidden_wording', file));
    if (/A版.{0,12}B版|B版.{0,12}A版|複製.{0,8}文章/u.test($.root().text())) errors.push(diagnostic('surface_copy_output_duplicate_article_implication', file));
  }

  const profilePage = cheerio.load(readPage('index.html'));
  const profileShell = profilePage('.profile-home').first();
  const profileHeader = profileShell.children('.profile-home-header');
  const profileBody = profileShell.children('.profile-home-body');
  const cover = profileBody.find('.profile-article-calendar');
  if (profileShell.children().length !== 2 || profileHeader.length !== 1 || profileHeader.children().length !== 1
      || profileHeader.children('h1#profile-title').text().trim() !== '工作與學習'
      || profileBody.length !== 1
      || profileBody.children().length !== 1 || cover.length !== 1
      || cover.find('[data-profile-tag-filters], [data-profile-article-library]').length
      || profilePage('.profile-path, .profile-learning, .profile-all-articles').length) {
    errors.push(diagnostic('surface_copy_output_profile_intro_forbidden', 'index.html'));
  }

  const compatibility = cheerio.load(readPage('profile/articles/index.html'));
  const payloadNode = cover.find('script[data-profile-calendar-data]');
  let profileCalendar = null;
  try { profileCalendar = JSON.parse(payloadNode.text()); } catch { /* report through route contract below */ }
  const compatibilityLinks = compatibility('[data-profile-article-row] a.profile-list-link').toArray().map(link => compatibility(link).attr('href'));
  const expectedProfileUrls = index.records.filter(record => record?.kind === 'article' && record.surfaces?.includes('profile')).map(record => record.url).sort();
  const profileRecords = index.records.filter(record => record?.kind === 'article' && record.surfaces?.includes('profile'))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.url || '').localeCompare(String(b.url || '')));
  const activityRecords = profileRecords.flatMap(record => expectedActivityEvents(record, root).map(event => ({
    title: record.title, url: record.url, eventType: event.eventType, eventLabel: event.eventLabel, date: event.date
  })));
  const newestYear = activityRecords.reduce((year, event) => Math.max(year, Number(String(event.date || '').slice(0, 4)) || 0), 0);
  const expectedCoverRecords = activityRecords.filter(event => String(event.date || '').startsWith(`${newestYear}-`));
  const expectedCoverUrls = expectedCoverRecords.map(event => `${event.url}\u0000${event.eventType}`).sort();
  const expectedDates = [...new Set(expectedCoverRecords.map(event => event.date))].sort();
  const profileLinks = Object.values(profileCalendar?.postsByDate || {}).flat().map(event => `${event.url}\u0000${event.eventType}`).sort();
  const profileEvents = Object.values(profileCalendar?.postsByDate || {}).flat();
  const profileEventLabelsValid = profileEvents.every(event => ['published', 'updated'].includes(event.eventType)
    && event.eventLabel === (event.eventType === 'published' ? '發表' : '更新'));
  const allLink = cover.find('.profile-navigation a');
  const selectedDate = profileCalendar?.latestDate;
  const selectedHeading = cover.find('[data-profile-calendar-detail-heading]').text().trim();
  const activeDateCount = expectedDates.length;
  if (JSON.stringify(profileLinks) !== JSON.stringify(expectedCoverUrls)
      || cover.find('.profile-calendar-year').text().trim() !== (newestYear ? `${newestYear} 更新日曆` : '')
      || profileCalendar?.latestYear !== String(newestYear)
      || JSON.stringify(Object.keys(profileCalendar?.counts || {}).sort()) !== JSON.stringify(expectedDates)
      || profileCalendar?.articleTotal !== profileRecords.length || profileCalendar?.activeDateCount !== activeDateCount
      || selectedDate !== expectedDates.at(-1)
      || profileCalendar?.eventTotal !== activityRecords.length
      || !profileEventLabelsValid
      || selectedHeading !== `${selectedDate} 文章活動`
      || cover.find('.profile-calendar-status').text().replace(/\s+/g, ' ').trim() !== `共 ${profileRecords.length} 篇文章，${activeDateCount} 個活動日期`
      || cover.find('.profile-calendar-month').length
      || cover.find('.profile-cover-main, .profile-cover-secondary, .profile-cover-eyebrow, .profile-cover-tags, [data-profile-tag-filters]').length
      || allLink.attr('href') !== '/profile/articles/' || !allLink.text().includes(`查看全部 ${expectedProfileUrls.length} 篇`)
      || JSON.stringify(compatibilityLinks.slice().sort()) !== JSON.stringify(expectedProfileUrls)
      || new Set(profileLinks).size !== profileLinks.length
      || compatibility('h1#profile-title').text().trim() !== '工作與學習') {
    errors.push(diagnostic('surface_copy_output_profile_library_invalid', 'profile/articles/index.html'));
  }

  const home = cheerio.load(readPage('memory/index.html'));
  const bridge = home('.home-profile-bridge');
  if (bridge.children('.home-profile-bridge-label').text().trim() !== 'SIDE A'
      || bridge.children('h2').text().trim() !== '工作與學習'
      || bridge.children('p').text().trim() !== '看整理過的經驗與方法'
      || bridge.children('a').text().trim() !== '翻到 A 面 ↗') errors.push(diagnostic('surface_copy_output_bridge_invalid', 'memory/index.html'));
  const scope = home('.search-popup .search-filters select[data-navigation-filter="surface"]');
  const actualOptions = scope.find('option').toArray().map(option => [home(option).attr('value'), home(option).text().trim()]);
  if (JSON.stringify(actualOptions) !== JSON.stringify(OPTIONS)) errors.push(diagnostic('surface_copy_output_search_scope_invalid', 'memory/index.html'));

  const records = index.records.filter(record => record?.kind === 'article');
  const representatives = { profile: null, memory: null, dual: null };
  for (const record of records) {
    if (record.surfaces?.length === 1 && record.surfaces[0] === 'profile') representatives.profile ||= record;
    if (record.surfaces?.length === 1 && record.surfaces[0] === 'memory') representatives.memory ||= record;
    if (record.surfaces?.length === 2 && record.surfaces[0] === 'profile' && record.surfaces[1] === 'memory') representatives.dual ||= record;
  }
  if ((!representatives.profile && !representatives.dual) || (!representatives.memory && !representatives.dual)) {
    errors.push(diagnostic('surface_copy_representative_article_missing', 'navigation-index.json'));
  }
  const articleUrls = records.map(record => record.url);
  if (new Set(articleUrls).size !== articleUrls.length) errors.push(diagnostic('surface_copy_article_urls_not_unique', 'navigation-index.json'));
  for (const [kind, record] of Object.entries(representatives)) {
    if (!record) continue;
    const file = routeFile(record.url);
    const $ = cheerio.load(readPage(file));
    const marker = $('.post-surface-marker');
    const labels = record.surfaces.map(surface => ARTICLE_MARKERS[surface]);
    const actual = marker.children('a.post-surface-marker-link').toArray().map(link => $(link).text().trim());
    const separators = marker.children('.post-surface-marker-separator').toArray().map(node => $(node).text().trim());
    const canonical = $('link[rel="canonical"]');
    if (marker.children('.post-surface-marker-label').text().trim() !== '收錄於'
        || JSON.stringify(actual) !== JSON.stringify(labels)
        || JSON.stringify(separators) !== JSON.stringify(kind === 'dual' ? ['・'] : [])
        || $('article.post-content-single').length !== 1
        || canonical.length !== 1 || normalizedPath(canonical.attr('href') || '/') !== normalizedPath(record.url)) {
      errors.push(diagnostic('surface_copy_output_article_marker_invalid', file));
    }
  }
  return { errors, articleCount: records.length, representativeKinds: Object.keys(representatives).filter(key => representatives[key]) };
}

function formatDiagnostics(result) { return result.errors.map(error => `${error.code} path=${error.path}`); }
function runCli(args = process.argv.slice(2)) {
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex >= 0 && args[sourceRootIndex + 1] ? path.resolve(args[sourceRootIndex + 1]) : DEFAULT_SOURCE_ROOT;
  const source = validateSourceContract({ sourceRoot });
  const rootIndex = args.indexOf('--root');
  const result = rootIndex >= 0 && args[rootIndex + 1]
    ? validateOutput({ root: path.resolve(args[rootIndex + 1]) })
    : { errors: [], articleCount: 0 };
  const errors = [...source.errors, ...result.errors];
  if (errors.length) {
    console.error('surface-copy 檢查失敗：');
    formatDiagnostics({ errors }).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(rootIndex >= 0
    ? `surface-copy source/output 通過：${result.articleCount} 篇文章。`
    : 'surface-copy source contract 通過。');
  return 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { FILES, OPTIONS, normalizedPath, routeFile, validateSourceContract, validateOutput, formatDiagnostics, runCli };
