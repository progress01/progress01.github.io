'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const SOURCE = {
  css: 'themes/next/source/css/_custom/surface-responsive.styl',
  mainCss: 'themes/next/source/css/main.styl',
  profile: 'themes/next/source/css/_custom/profile.styl',
  home: 'themes/next/source/css/_custom/home.styl',
  homeTemplate: 'themes/next/layout/index.njk',
  switchCss: 'themes/next/source/css/_custom/surface-switch.styl',
  accessCss: 'themes/next/source/css/_custom/accessibility.styl',
  profileTemplate: 'themes/next/layout/profile.njk',
  articlesTemplate: 'themes/next/layout/profile-articles.njk',
  profileHomeTemplate: 'themes/next/layout/_partials/profile-article-home.njk',
  profileLibraryTemplate: 'themes/next/layout/_partials/profile-article-library.njk',
  postTemplate: 'themes/next/layout/_macro/post.njk'
};
const CORE = ['index.html', 'profile/index.html', 'profile/articles/index.html', 'memory/index.html'];
const ARTICLE = 'work/flow-friendly-work-system/index.html';

function diagnostic(code, file = SOURCE.css) { return { code, path: file }; }
function checkSource(sources) {
  const errors = [];
  const css = sources.css || '';
  const bundle = `${css}\n${sources.profile || ''}\n${sources.home || ''}\n${sources.switchCss || ''}`;
  if (!sources.mainCss?.includes("@import '_custom/surface-responsive';")) errors.push(diagnostic('responsive_styles_not_loaded', SOURCE.mainCss));
  if (!/@media\s*\(max-width:\s*767px\)/.test(css)) errors.push(diagnostic('mobile_breakpoint_missing'));
  if (!/grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css)) errors.push(diagnostic('mobile_single_column_missing'));
  if (!/min-width:\s*0/.test(css) || !/overflow-wrap:\s*anywhere/.test(css)) errors.push(diagnostic('long_wrap_safety_missing'));
  if (/line-clamp|text-overflow\s*:\s*ellipsis|display\s*:\s*-webkit-box/.test(bundle)) errors.push(diagnostic('text_clamp_forbidden'));
  if (/overflow\s*:\s*hidden/.test(css)) errors.push(diagnostic('overflow_hidden_forbidden'));
  const cardRules = [...bundle.matchAll(/\.profile-list-link\s*\{([^}]*)\}/g)].map(match => match[1]);
  if (cardRules.some(rule => /(?:^|;)\s*height\s*:\s*\d+(?:px|em|rem|vh)/m.test(rule))) errors.push(diagnostic('fixed_card_height_forbidden'));
  if (/\.surface-switch-link\s*\{[^}]*white-space\s*:\s*nowrap/s.test(bundle)) errors.push(diagnostic('switch_nowrap_forbidden'));
  if (/\.surface-switch\s*\{[^}]*position\s*:\s*(?:absolute|fixed)/s.test(bundle)) errors.push(diagnostic('switch_overlay_position_forbidden'));
  if (!/\.surface-switch-link/.test(css) || !/\.skip-link:focus-visible/.test(sources.accessCss || '') || !/\.profile-list-link/.test(bundle)) errors.push(diagnostic('switch_skip_card_safety_missing'));
  if (!/\.profile-page \.profile-article-list/.test(bundle) || !/\.profile-page \.profile-list-link/.test(bundle) || !/grid-template-columns:\s*\d+px\s+minmax\(0,\s*1fr\)/.test(sources.profile || '')) errors.push(diagnostic('profile_grid_safety_missing'));
  if (!/class="home-landing-entry-grid"/.test(sources.homeTemplate || '')) errors.push(diagnostic('home_entry_template_hook_missing', SOURCE.homeTemplate));
  if (!/@media\s*\(max-width:\s*767px\)[\s\S]*?\.index \.home-landing-entry-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(css)) errors.push(diagnostic('home_entry_767_selector_or_grid_missing'));
  if (!/@media\s*\(max-width:\s*430px\)[\s\S]*?\.index \.home-landing-entry-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css)) errors.push(diagnostic('home_entry_430_single_column_missing'));
  if (/\.index \.home-landing-grid\b/.test(css)) errors.push(diagnostic('home_entry_selector_mismatch'));
  if (!/profile-article-home/.test(sources.profileTemplate || '') || !/profile-article-library/.test(sources.articlesTemplate || '')
      || !/data-profile-home-article-list/.test(sources.profileHomeTemplate || '')
      || !/data-profile-home-search/.test(sources.profileHomeTemplate || '')
      || !/profile-home-article-link:focus-visible/.test(bundle)
      || !/data-profile-tag-filters/.test(sources.profileLibraryTemplate || '') || !/data-profile-article-list/.test(sources.profileLibraryTemplate || '')) errors.push(diagnostic('profile_library_template_hooks_missing'));
  if (!/post-surface-marker/.test(sources.postTemplate || '')) errors.push(diagnostic('article_hook_missing'));
  return errors;
}

function checkOutput({ root, pages } = {}) {
  const errors = [];
  const pageHtml = {};
  for (const file of [...CORE, ARTICLE]) {
    let html = pages?.[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch { errors.push(diagnostic('responsive_page_unreadable', file)); continue; }
    }
    pageHtml[file] = html;
    const $ = cheerio.load(html);
    if (!$('meta[name="viewport"]').length) errors.push(diagnostic('viewport_meta_missing', file));
    if (!$('link[rel="stylesheet"]').length) errors.push(diagnostic('compiled_css_missing', file));
    if ($('.main-inner').length !== 1) errors.push(diagnostic('main_inner_hook_missing', file));
    if (file !== ARTICLE && $('.surface-switch').length !== 1) errors.push(diagnostic('surface_switch_hook_missing', file));
  }
  if (pageHtml['memory/index.html']) {
    const $ = cheerio.load(pageHtml['memory/index.html']);
    if (!$('.home-random-card, .home-archive-rail-main, .home-profile-bridge').length) errors.push(diagnostic('home_responsive_hooks_missing', 'memory/index.html'));
    if (!$('.home-landing-entry-grid').length) errors.push(diagnostic('home_entry_template_hook_missing', 'memory/index.html'));
  }
  for (const file of ['index.html', 'profile/index.html']) {
    if (pageHtml[file] && !cheerio.load(pageHtml[file])('[data-profile-home-article-list] .profile-home-article-link, [data-profile-home-search] input[type=search]').length) errors.push(diagnostic('profile_responsive_hooks_missing', file));
  }
  if (pageHtml['profile/articles/index.html'] && !cheerio.load(pageHtml['profile/articles/index.html'])('[data-profile-article-list] .profile-list-link').length) errors.push(diagnostic('profile_articles_hooks_missing', 'profile/articles/index.html'));
  if (pageHtml[ARTICLE]) {
    const $ = cheerio.load(pageHtml[ARTICLE]);
    if (!$('.post-content-single, .post-content').length) errors.push(diagnostic('article_content_hook_missing', ARTICLE));
    if (!$('.post-surface-marker').length) errors.push(diagnostic('article_surface_hook_missing', ARTICLE));
  }
  return { errors, pageCount: Object.keys(pageHtml).length };
}

function loadSource(sourceRoot) {
  return Object.fromEntries(Object.entries(SOURCE).map(([key, file]) => [key, fs.readFileSync(path.join(sourceRoot, file), 'utf8')]));
}
function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex >= 0 && !args[rootIndex + 1]) { console.error('responsive 輸出檢查需要 --root <generated-public-directory>。'); return 2; }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex >= 0 && args[sourceRootIndex + 1] ? path.resolve(args[sourceRootIndex + 1]) : DEFAULT_SOURCE_ROOT;
  const sourceErrors = checkSource(loadSource(sourceRoot));
  const output = rootIndex >= 0 ? checkOutput({ root: path.resolve(args[rootIndex + 1]) }) : { errors: [], pageCount: 0 };
  const errors = [...sourceErrors, ...output.errors];
  if (errors.length) { console.error('surface-responsive 檢查失敗：'); errors.forEach(error => console.error(`- ${error.code} path=${error.path}`)); return 1; }
  console.log(`surface-responsive source 檢查通過${rootIndex >= 0 ? `，output ${output.pageCount} pages` : ''}。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { checkSource, checkOutput, runCli };
