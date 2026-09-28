'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const ROUTES = Object.freeze([
  { file: 'index.html', surface: 'profile' },
  { file: 'profile/index.html', surface: 'profile' },
  { file: 'profile/articles/index.html', surface: 'profile' },
  { file: 'memory/index.html', surface: 'memory' },
  { file: 'work/from-solving-problems-to-choosing-what-matters/index.html', surface: 'memory' },
  { file: 'work/flow-friendly-work-system/index.html', surface: 'memory' }
]);

function uniqueValues(records, key) {
  return new Set(records.flatMap(record => Array.isArray(record[key]) ? record[key] : []).filter(Boolean)).size;
}

function validateSidebarStats({ root, pages = {}, navigationIndex } = {}) {
  const errors = [];
  const records = (navigationIndex?.records || []).filter(record => record.kind === 'article');
  const profileRecords = records.filter(record => Array.isArray(record.surfaces) && record.surfaces.includes('profile'));
  if (!records.length || !profileRecords.length) return { errors: [{ code: 'sidebar_stats_index_invalid' }] };
  const expected = {
    profilePosts: profileRecords.length,
    profileTags: uniqueValues(profileRecords, 'tags'),
    memoryPosts: records.length,
    memoryCategories: uniqueValues(records, 'categories'),
    memoryTags: uniqueValues(records, 'tags')
  };

  for (const route of ROUTES) {
    let html = pages[route.file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...route.file.split('/')), 'utf8'); }
      catch { errors.push({ code: 'sidebar_stats_page_unreadable', path: route.file }); continue; }
    }
    const $ = cheerio.load(html);
    const profileStats = $('[data-profile-site-state]');
    const items = $('.site-state-wrap .site-state-item');
    if (route.surface === 'profile') {
      if (profileStats.length !== 1 || items.length !== 2) errors.push({ code: 'sidebar_profile_stats_shape_invalid', path: route.file });
      if (Number(profileStats.find('.site-state-posts .site-state-item-count').text().trim()) !== expected.profilePosts) errors.push({ code: 'sidebar_profile_post_count_invalid', path: route.file });
      if (Number(profileStats.find('.site-state-tags .site-state-item-count').text().trim()) !== expected.profileTags) errors.push({ code: 'sidebar_profile_tag_count_invalid', path: route.file });
      if (profileStats.find('.site-state-item-categories').length || profileStats.find('a[href="/profile/articles/"]').length !== 1) errors.push({ code: 'sidebar_profile_stats_destination_invalid', path: route.file });
    } else {
      if (profileStats.length || items.length !== 3) errors.push({ code: 'sidebar_memory_stats_shape_invalid', path: route.file });
      if (Number($('.site-state-posts .site-state-item-count').text().trim()) !== expected.memoryPosts) errors.push({ code: 'sidebar_memory_post_count_invalid', path: route.file });
      if (Number($('.site-state-categories .site-state-item-count').text().trim()) !== expected.memoryCategories) errors.push({ code: 'sidebar_memory_category_count_invalid', path: route.file });
      if (Number($('.site-state-tags .site-state-item-count').text().trim()) !== expected.memoryTags) errors.push({ code: 'sidebar_memory_tag_count_invalid', path: route.file });
    }
  }
  return { errors, routeCount: ROUTES.length, expected };
}

function runCli(args = process.argv.slice(2)) {
  const index = args.indexOf('--root');
  if (index < 0 || !args[index + 1]) { console.error('sidebar stats 輸出檢查需要 --root <generated-public-directory>。'); return 2; }
  const root = path.resolve(args[index + 1]);
  let navigationIndex;
  try { navigationIndex = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8')); }
  catch { console.error('sidebar_stats_index_unreadable path=navigation-index.json'); return 1; }
  const result = validateSidebarStats({ root, navigationIndex });
  if (result.errors.length) { result.errors.forEach(error => console.error(`- ${error.code}${error.path ? ` path=${error.path}` : ''}`)); return 1; }
  console.log(`側欄統計輸出檢查通過：${result.routeCount} routes；A ${result.expected.profilePosts} 文章/${result.expected.profileTags} 標籤，B ${result.expected.memoryPosts} 文章/${result.expected.memoryCategories} 分類/${result.expected.memoryTags} 標籤。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { ROUTES, validateSidebarStats, runCli };
