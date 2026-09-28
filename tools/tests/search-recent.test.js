const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHelper(legacyPosts = []) {
  let helper;
  const warnings = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../scripts/search-recent-posts.js'), 'utf8'), {
    require: id => {
      if (id === '../tools/lib/content-browser') return require('../lib/content-browser');
      if (id === '../tools/lib/post-surface') return require('../lib/post-surface');
      if (id === '../tools/data/legacy-surfaces.v1.json') return { schemaVersion: 1, posts: legacyPosts };
      throw new Error(`unexpected require ${id}`);
    },
    hexo: {
      extend: { helper: { register: (_, callback) => { helper = callback; } } },
      log: { warn: warning => warnings.push(warning) }
    }
  });
  return { helper, warnings };
}

function category(name) { return { toArray: () => name.map(value => ({ name: value })) }; }
function record(rank, surfaces = ['memory'], categories = ['音樂']) {
  return {
    rank, source: `source/_posts/${rank}.md`, ...(surfaces === null ? {} : { surfaces }),
    categories: category(categories)
  };
}

test('最近搜尋候選完整輸出並依日期排序，分類與面向配額交由消費端計算', () => {
  const { helper } = loadHelper();
  const posts = Array.from({ length: 240 }, (_, rank) => ({
    rank,
    source: `source/_posts/${rank}.md`, surfaces: ['memory'],
    categories: category(rank < 12 ? ['音樂'] : rank < 18 ? ['音樂', '閱讀'] : ['閱讀'])
  }));
  const records = helper.call({ site: {
    data: { 'content-categories': [{ name: '音樂' }, { name: '閱讀' }, { name: '無文章' }] },
    posts: { sort: () => ({ toArray: () => posts }) }
  } });
  assert.equal(records.length, 240);
  assert.equal(new Set(records.map(record => record.rank)).size, records.length);
  assert.ok(records.every(record => record.surfaces.includes('memory')));
  assert.deepEqual(Array.from(records.filter(record => record.rank < 10), record => record.rank), [...Array(10).keys()]);
  for (const category of ['音樂', '閱讀']) assert.equal(records.filter(record => record.post.categories.toArray().some(item => item.name === category)).length, posts.filter(post => post.categories.toArray().some(item => item.name === category)).length);
});

test('explicit ranges scope before calculating global rank and per-category quotas', () => {
  const { helper } = loadHelper(['source/_posts/legacy.md']);
  const posts = [
    ...Array.from({ length: 12 }, (_, rank) => record(`memory-${rank}`, ['memory'])),
    ...Array.from({ length: 12 }, (_, rank) => record(`profile-${rank}`, ['profile'])),
    record('dual', ['memory', 'profile'], ['閱讀']),
    record('legacy', null, ['閱讀'])
  ];
  const context = { site: {
    data: { 'content-categories': [{ name: '音樂' }, { name: '閱讀' }] },
    posts: { sort: () => ({ toArray: () => posts }) }
  } };
  const profile = helper.call(context, 'profile');
  const memory = helper.call(context, 'memory');
  const all = helper.call(context);
  assert.ok(profile.every(item => item.post.surfaces?.includes('profile')));
  assert.ok(memory.every(item => item.post.surfaces?.includes('memory') || item.post.source.endsWith('/legacy.md')));
  assert.equal(profile.filter(item => item.post.rank === 'dual').length, 1);
  assert.equal(memory.filter(item => item.post.rank === 'dual').length, 1);
  assert.deepEqual(profile.slice(0, 10).map(item => item.rank), Array.from({ length: 10 }, (_, i) => i));
  assert.deepEqual(memory.slice(0, 10).map(item => item.rank), Array.from({ length: 10 }, (_, i) => i));
  assert.equal(all.length, 26);
  assert.equal(new Set(all.map(item => item.post)).size, all.length);
  assert.deepEqual(all.find(item => item.post.rank === 'legacy').surfaces, ['memory']);
});

test('new missing and invalid surfaces fail with source context; empty filtered scopes stay empty', () => {
  const { helper } = loadHelper();
  const context = categories => ({ site: {
    data: { 'content-categories': [] },
    posts: { sort: () => ({ toArray: () => categories }) }
  } });
  assert.throws(() => helper.call(context([record('new', null)]), 'all'),
    /source\/\_posts\/new\.md \[missing_surfaces\]/);
  assert.throws(() => helper.call(context([record('bad', ['PROFILE'])]), 'profile'),
    /source\/\_posts\/bad\.md \[unknown_surface\]/);
  assert.deepEqual(helper.call(context([]), 'profile'), []);
  assert.throws(() => helper.call(context([]), 'private'), /content_browser_range_invalid/);
});

test('search template carries canonical surfaces and local-search scopes recent lists and resets per page', () => {
  const template = fs.readFileSync(path.join(__dirname, '../../themes/next/layout/_partials/search/index.njk'), 'utf8');
  const localSearch = fs.readFileSync(path.join(__dirname, '../../themes/next/source/js/third-party/search/local-search.js'), 'utf8');
  assert.match(template, /搜尋範圍[\s\S]*value="profile"[\s\S]*工作與學習[\s\S]*value="memory"[\s\S]*個人記憶庫[\s\S]*value="all"[\s\S]*全部公開內容/);
  assert.match(template, /data-search-recent-surfaces="\{\{ record\.surfaces \| join\('\|'\) \}\}"/);
  assert.match(localSearch, /const recentMarkup = container\.innerHTML/);
  assert.match(localSearch, /container\.innerHTML = recentMarkup/);
  assert.match(localSearch, /document\.addEventListener\('pjax:success',[\s\S]*?currentPageSurface\(\)/);
  assert.match(localSearch, /surface: filters\.surface/);
  assert.match(localSearch, /NavigationSearch\.resetFilters\(defaultSurface\)/);
});
