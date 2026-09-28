'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateContextualMenus } = require('../contextual-menu-output-check');

const menuTemplate = fs.readFileSync(path.join(__dirname, '../../themes/next/layout/_partials/header/menu.njk'), 'utf8');
const headerTemplate = fs.readFileSync(path.join(__dirname, '../../themes/next/layout/_partials/header/index.njk'), 'utf8');

const config = {
  menus: {
    profile: [
      { id: 'home', label: '工作與學習', href: '/', icon: 'fa fa-briefcase' },
      { id: 'articles', label: '全部文章', href: '/profile/articles/', icon: 'fa fa-list' }
    ]
  }
};

const memoryItems = [
  ['首頁', '/memory/'], ['全部文章', '/archives/'], ['內容分類', '/categories/'], ['生活索引', '/reading-log/'],
  ['草稿夾', '/reading/'], ['記憶圖牆', '/photos/'], ['更新日曆', '/calendar/']
];

function menu(surface, items, currentIndex = -1) {
  const search = surface === 'memory' ? '<li class="menu-item menu-item-search"><a role="button" class="popup-trigger">搜尋</a></li>' : '';
  return `<nav class="site-nav"><ul class="main-menu menu" data-navigation-surface="${surface}">${items.map((item, index) => `<li class="menu-item${index === currentIndex ? ' menu-item-active' : ''}"><a href="${item[1]}"${index === currentIndex ? ' aria-current="page"' : ''}>${item[0]}</a></li>`).join('')}${search}</ul></nav>`;
}

function fixtures() {
  const profileItems = config.menus.profile.map(item => [item.label, item.href]);
  return {
    'index.html': `${menu('profile', profileItems, 0)}<h1>工作與學習</h1>`,
    'memory/index.html': menu('memory', memoryItems),
    'profile/index.html': `${menu('profile', profileItems, 0)}<h1>工作與學習</h1>`,
    'profile/articles/index.html': menu('profile', profileItems, 1)
  };
}

function codes(result) { return result.errors.map(error => error.code); }

test('selects the profile menu from the stable profile URL namespace', () => {
  assert.match(menuTemplate, /page_path\.indexOf\('profile\/'\) === 0/);
  assert.doesNotMatch(menuTemplate, /page\.layout === 'profile'/);
  assert.match(headerTemplate, /partial\('_partials\/header\/menu\.njk', \{\}, \{cache: false\}\)/);
});

test('keeps seven memory entries plus search and gives A cover/archive two focused entries without menu search', () => {
  const result = validateContextualMenus({ config, pages: fixtures() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.pageCount, 4);
});

test('rejects a removed memory entry or profile menu/search content leaking across surfaces', () => {
  const pages = fixtures();
  pages['memory/index.html'] = pages['memory/index.html'].replace(/<li class="menu-item"><a href="\/photos\/">記憶圖牆<\/a><\/li>/, '');
  pages['profile/index.html'] = pages['profile/index.html'].replace('</ul>', '<li class="menu-item menu-item-search"><a role="button" class="popup-trigger">搜尋</a></li></ul>');
  const result = validateContextualMenus({ config, pages });
  assert.ok(codes(result).includes('contextual_menu_count_invalid'));
  assert.ok(codes(result).includes('contextual_menu_search_invalid'));
});

test('requires the correct current profile menu entry and the existing B search action', () => {
  const pages = fixtures();
  pages['profile/index.html'] = pages['profile/index.html'].replace(' aria-current="page"', '');
  const result = validateContextualMenus({ config, pages });
  assert.ok(codes(result).includes('contextual_menu_current_invalid'));
  const archive = fixtures();
  archive['profile/articles/index.html'] = archive['profile/articles/index.html'].replace(' aria-current="page"', '');
  assert.ok(codes(validateContextualMenus({ config, pages: archive })).includes('contextual_menu_current_invalid'));
  assert.equal(codes(result).includes('contextual_menu_search_invalid'), false);
});

test('rejects reordered or changed profile menu configuration', () => {
  const changed = JSON.parse(JSON.stringify(config));
  changed.menus.profile[0].label = '其他名稱';
  assert.ok(codes(validateContextualMenus({ config: changed, pages: fixtures() })).includes('profile_menu_item_invalid'));
});
