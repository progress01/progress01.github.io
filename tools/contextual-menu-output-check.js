'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');

const CONFIG_PATH = 'source/_data/surface-navigation.yml';
const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const MEMORY_ITEMS = Object.freeze([
  Object.freeze({ label: '首頁', href: '/memory/' }),
  Object.freeze({ label: '全部文章', href: '/archives/' }),
  Object.freeze({ label: '內容分類', href: '/categories/' }),
  Object.freeze({ label: '生活索引', href: '/reading-log/' }),
  Object.freeze({ label: '草稿夾', href: '/reading/' }),
  Object.freeze({ label: '記憶圖牆', href: '/photos/' }),
  Object.freeze({ label: '更新日曆', href: '/calendar/' })
]);
const PROFILE_ITEMS = Object.freeze([
  Object.freeze({ id: 'home', label: '工作與學習', href: '/', icon: 'fa fa-briefcase' })
]);
const PAGES = Object.freeze([
  Object.freeze({ file: 'index.html', surface: 'profile', current: 'home' }),
  Object.freeze({ file: 'memory/index.html', surface: 'memory', current: null }),
  Object.freeze({ file: 'profile/index.html', surface: 'profile', current: 'home' }),
  Object.freeze({ file: 'profile/articles/index.html', surface: 'profile', current: null })
]);

function diagnostic(code, file = CONFIG_PATH) {
  return { code, path: file };
}

function validateConfig(config) {
  const actual = config?.menus?.profile;
  if (!Array.isArray(actual) || actual.length !== PROFILE_ITEMS.length) {
    return [diagnostic('profile_menu_config_invalid')];
  }
  const errors = [];
  PROFILE_ITEMS.forEach((expected, index) => {
    const item = actual[index];
    if (!item || item.id !== expected.id || item.label !== expected.label
        || item.href !== expected.href || item.icon !== expected.icon) {
      errors.push(diagnostic('profile_menu_item_invalid', `${CONFIG_PATH}#menus.profile[${index}]`));
    }
  });
  return errors;
}

function collectItems($, menu) {
  return menu.children('li.menu-item').not('.menu-item-search').map((_, item) => {
    const link = $(item).children('a').first();
    return { label: link.text().trim(), href: link.attr('href'), current: link.attr('aria-current'), classes: $(item).attr('class') || '' };
  }).get();
}

function validatePage(html, page) {
  const errors = [];
  const $ = cheerio.load(html);
  const menu = $('.site-nav > .main-menu');
  if (menu.length !== 1 || menu.attr('data-navigation-surface') !== page.surface) {
    errors.push(diagnostic('contextual_menu_surface_invalid', page.file));
    return errors;
  }
  const search = menu.children('.menu-item-search').find('a.popup-trigger');
  if ((page.surface === 'memory' && (search.length !== 1 || search.attr('role') !== 'button' || search.text().trim() !== '搜尋'))
      || (page.surface === 'profile' && search.length !== 0)) {
    errors.push(diagnostic('contextual_menu_search_invalid', page.file));
  }
  const actual = collectItems($, menu);
  const expected = page.surface === 'profile' ? PROFILE_ITEMS : MEMORY_ITEMS;
  if (actual.length !== expected.length) errors.push(diagnostic('contextual_menu_count_invalid', page.file));
  expected.forEach((item, index) => {
    if (!actual[index] || actual[index].label !== item.label || actual[index].href !== item.href) {
      errors.push(diagnostic('contextual_menu_item_invalid', `${page.file}#menu[${index}]`));
    }
  });
  const currentItems = actual.filter(item => item.current === 'page' && item.classes.split(/\s+/).includes('menu-item-active'));
  if (page.current) {
    const expectedIndex = PROFILE_ITEMS.findIndex(item => item.id === page.current);
    if (currentItems.length !== 1 || actual[expectedIndex]?.current !== 'page') {
      errors.push(diagnostic('contextual_menu_current_invalid', page.file));
    }
  } else if (actual.some(item => item.current === 'page')) {
    errors.push(diagnostic('contextual_menu_current_invalid', page.file));
  }
  return errors;
}

function validateContextualMenus({ root, sourceRoot = DEFAULT_SOURCE_ROOT, config, pages } = {}) {
  const errors = [];
  if (!config) {
    try { config = yaml.load(fs.readFileSync(path.join(sourceRoot, CONFIG_PATH), 'utf8')); }
    catch { return { errors: [diagnostic('contextual_menu_config_unreadable')], pageCount: 0 }; }
  }
  errors.push(...validateConfig(config));
  let pageCount = 0;
  for (const page of PAGES) {
    let html = pages && pages[page.file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...page.file.split('/')), 'utf8'); }
      catch {
        errors.push(diagnostic('contextual_menu_page_unreadable', page.file));
        continue;
      }
    }
    errors.push(...validatePage(html, page));
    pageCount += 1;
  }
  return { errors, pageCount };
}

function formatDiagnostics(result) {
  return result.errors.map(error => `${error.code} path=${error.path}`);
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('contextual-menu 檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex !== -1 && args[sourceRootIndex + 1]
    ? path.resolve(args[sourceRootIndex + 1])
    : DEFAULT_SOURCE_ROOT;
  const result = validateContextualMenus({ root: path.resolve(args[rootIndex + 1]), sourceRoot });
  if (result.errors.length) {
    console.error('contextual-menu 輸出檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(`contextual-menu 輸出檢查通過：${result.pageCount} pages。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { validateContextualMenus, formatDiagnostics, runCli };
