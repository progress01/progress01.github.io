'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const CASES = Object.freeze([
  { file: 'index.html', context: 'profile' },
  { file: 'profile/index.html', context: 'profile' },
  { file: 'profile/articles/index.html', context: 'profile' },
  { file: 'work/from-solving-problems-to-choosing-what-matters/index.html', context: 'memory', surfaces: 'profile' },
  { file: 'work/flow-friendly-work-system/index.html', context: 'memory', surfaces: 'profile memory' },
  { file: '2026/01/25/部落格改版規劃/index.html', context: 'memory', surfaces: 'memory' },
  { file: 'memory/index.html', context: 'memory' }
]);

function validateBrandContext({ root, pages } = {}) {
  const errors = [];
  for (const item of CASES) {
    let html = pages?.[item.file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...item.file.split('/')), 'utf8'); }
      catch { errors.push({ code: 'brand_page_unreadable', path: item.file }); continue; }
    }
    const $ = cheerio.load(html);
    const brand = $('.site-meta > a.brand');
    const expectedPath = item.context === 'profile' ? '/' : '/memory/';
    let actualPath = '';
    try { actualPath = new URL(brand.attr('href') || '', 'https://example.test').pathname; } catch {}
    if (brand.length !== 1 || actualPath !== expectedPath) errors.push({ code: 'brand_href_invalid', path: item.file });
    const aria = brand.attr('aria-label') || '';
    const title = brand.attr('title') || '';
    if (item.context === 'profile' && (aria !== '工作與學習封面' || title !== '工作與學習封面')) {
      errors.push({ code: 'brand_profile_name_invalid', path: item.file });
    }
    if (item.context === 'memory' && (/首頁/.test(aria) || /首頁/.test(title))) {
      errors.push({ code: 'brand_memory_name_invalid', path: item.file });
    }
    if ($('.site-meta > a.brand .site-title').text().trim() !== "DON'T COUNT THE DAYS") {
      errors.push({ code: 'brand_visible_title_changed', path: item.file });
    }
    if (item.surfaces && $('.post-surface-marker').attr('data-surfaces') !== item.surfaces) {
      errors.push({ code: 'brand_article_surface_context_invalid', path: item.file });
    }
  }
  return { errors, pageCount: CASES.length };
}

function runCli(args = process.argv.slice(2)) {
  const index = args.indexOf('--root');
  if (index === -1 || !args[index + 1]) { console.error('brand-context 檢查需要明確指定 --root <generated-public-directory>。'); return 2; }
  const result = validateBrandContext({ root: path.resolve(args[index + 1]) });
  if (result.errors.length) { result.errors.forEach(error => console.error(`- ${error.code} path=${error.path}`)); return 1; }
  console.log(`brand-context 輸出檢查通過：${result.pageCount} routes。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { CASES, validateBrandContext, runCli };
