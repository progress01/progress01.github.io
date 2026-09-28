'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const SOURCE_FILES = Object.freeze({
  pjax: 'themes/next/source/js/pjax.js',
  menu: 'themes/next/layout/_partials/header/menu.njk',
  control: 'themes/next/layout/_partials/dual-surface-control.njk',
  post: 'themes/next/layout/_macro/post.njk',
  head: 'themes/next/layout/_partials/head/head-unique.njk'
});
const ENTRY_FILES = Object.freeze(['profile/articles/index.html', 'archives/index.html']);

function diagnostic(code, file) { return { code, path: file }; }

function routeFile(url) {
  try {
    const pathname = decodeURIComponent(new URL(url, 'https://example.test').pathname);
    const relative = pathname.replace(/^\/+/, '');
    return relative.endsWith('/') ? `${relative}index.html` : relative;
  } catch { return null; }
}

function readSources(sourceRoot, sources) {
  const result = {};
  for (const [key, file] of Object.entries(SOURCE_FILES)) {
    if (sources && sources[key] !== undefined) result[key] = sources[key];
    else {
      try { result[key] = fs.readFileSync(path.join(sourceRoot, file), 'utf8'); }
      catch { result[key] = null; }
    }
  }
  return result;
}

function validateSources(sources) {
  const errors = [];
  for (const [key, file] of Object.entries(SOURCE_FILES)) {
    if (typeof sources[key] !== 'string') {
      errors.push(diagnostic('surface_history_source_unreadable', file));
    }
  }
  const pjax = sources.pjax || '';
  if (!pjax.includes("'.site-nav'") || !pjax.includes("'.main-inner'")) {
    errors.push(diagnostic('surface_history_pjax_menu_selector_missing', SOURCE_FILES.pjax));
  }
  if (!/document\.addEventListener\(['"]pjax:success['"][\s\S]*?NexT\.boot\.refresh\(\)/.test(pjax)) {
    errors.push(diagnostic('surface_history_pjax_refresh_missing', SOURCE_FILES.pjax));
  }

  const surfaceSources = [sources.menu, sources.control, sources.post];
  const prohibited = [
    /document\s*\.\s*referrer/i,
    /(?:window\s*\.\s*)?localStorage/i,
    /(?:window\s*\.\s*)?sessionStorage/i,
    /document\s*\.\s*cookie/i,
    /location\s*\.\s*(?:replace|assign)\s*\(/i,
    /history\s*\.\s*(?:pushState|replaceState)\s*\(/i
  ];
  if (surfaceSources.some(source => prohibited.some(pattern => pattern.test(source || '')))) {
    errors.push(diagnostic('surface_history_state_or_redirect_forbidden', 'surface navigation templates'));
  }
  if (!/page_path\.indexOf\('profile\/'\)\s*===\s*0/.test(sources.menu || '')) {
    errors.push(diagnostic('surface_history_url_truth_missing', SOURCE_FILES.menu));
  }
  if (!/set canonical = url/.test(sources.head || '')
      || !/rel="canonical"\s+href="\{\{\s*canonical\s*\}\}"/.test(sources.head || '')
      || !/post\.permalink/.test(sources.post || '')) {
    errors.push(diagnostic('surface_history_canonical_source_invalid', SOURCE_FILES.head));
  }
  return errors;
}

function validateEntryLink(html, surface, targetUrl, file) {
  const errors = [];
  const $ = cheerio.load(html);
  const expectedSurface = surface === 'profile' ? 'profile' : 'memory';
  if ($('.site-nav > .main-menu').attr('data-navigation-surface') !== expectedSurface) {
    errors.push(diagnostic('surface_history_entry_surface_invalid', file));
  }
  const selector = surface === 'profile' ? '[data-profile-article-library] [data-profile-article-list] .profile-list-link' : '.archive-article-link, .post-title-link';
  const link = $(selector).filter((_, element) => $(element).attr('href') === targetUrl).first();
  if (!link.length || link[0].tagName !== 'a' || link.attr('onclick') !== undefined) {
    errors.push(diagnostic('surface_history_entry_link_invalid', `${file}#${targetUrl}`));
  }
  return errors;
}

function validateArticle(html, record, file) {
  const errors = [];
  const $ = cheerio.load(html);
  const canonical = $('link[rel="canonical"]');
  const expectedPath = new URL(record.url, 'https://example.test').pathname;
  if (canonical.length !== 1 || new URL(canonical.attr('href') || '/', 'https://example.test').pathname !== expectedPath) {
    errors.push(diagnostic('surface_history_article_canonical_invalid', file));
  }
  if ($('.site-nav > .main-menu').attr('data-navigation-surface') !== 'memory') {
    errors.push(diagnostic('surface_history_direct_article_not_neutral', file));
  }
  const marker = $('.post-surface-marker');
  if (marker.length !== 1 || marker.attr('data-surfaces') !== record.surfaces.join(' ')) {
    errors.push(diagnostic('surface_history_article_marker_invalid', file));
  }
  return errors;
}

function validateSurfaceHistory({ root, sourceRoot = path.resolve(__dirname, '..'), sources, pages, index } = {}) {
  const errors = validateSources(readSources(sourceRoot, sources));
  try {
    const home = pages?.['index.html'] ?? fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const pjaxEnabled = /src="[^"]*\/js\/pjax\.js"/.test(home);
    if (pjaxEnabled) {
      let pjaxOutput = '';
      try { pjaxOutput = fs.readFileSync(path.join(root, 'js', 'pjax.js'), 'utf8'); } catch {}
      if (!pjaxOutput.includes("'.site-nav'")) {
        errors.push(diagnostic('surface_history_generated_pjax_selector_missing', 'js/pjax.js'));
      }
    }
  } catch { errors.push(diagnostic('surface_history_home_unreadable', 'index.html')); }
  if (!index) {
    try { index = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8')); }
    catch { return { errors: [...errors, diagnostic('surface_history_index_unreadable', 'navigation-index.json')], articleCount: 0 }; }
  }
  if (!Array.isArray(index?.records)) {
    return { errors: [...errors, diagnostic('surface_history_index_invalid', 'navigation-index.json')], articleCount: 0 };
  }

  const records = index.records.filter(record => record.kind === 'article');
  const dualRecords = records.filter(record => Array.isArray(record.surfaces)
    && record.surfaces.includes('profile') && record.surfaces.includes('memory'));
  const outputRoutes = new Set();
  for (const record of records) {
    const file = routeFile(record.url);
    if (!file || outputRoutes.has(file)) {
      errors.push(diagnostic('surface_history_article_route_duplicate', file || String(record.url)));
      continue;
    }
    outputRoutes.add(file);
  }

  let selected;
  let profileHtml;
  let archiveHtml;
  for (const [file, surface] of [[ENTRY_FILES[0], 'profile'], [ENTRY_FILES[1], 'memory']]) {
    let html = pages && pages[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch { errors.push(diagnostic('surface_history_entry_unreadable', file)); continue; }
    }
    if (surface === 'profile') profileHtml = html;
    else archiveHtml = html;
    if (!selected && surface === 'profile') {
      const $ = cheerio.load(html);
      const links = $('[data-profile-article-library] [data-profile-article-list] .profile-list-link[href]');
      selected = dualRecords.find(record => links.toArray().some(element => $(element).attr('href') === record.url));
    }
    if (!selected) continue;
    errors.push(...validateEntryLink(html, surface, selected.url, file));
  }

  if (!dualRecords.length) errors.push(diagnostic('surface_history_dual_article_missing', 'navigation-index.json'));
  if (!selected) errors.push(diagnostic('surface_history_dual_article_not_linked_from_profile', ENTRY_FILES[0]));
  if (selected) {
    const file = routeFile(selected.url);
    let html = pages && pages[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch { errors.push(diagnostic('surface_history_article_unreadable', file)); }
    }
    if (html !== undefined) errors.push(...validateArticle(html, selected, file));
    if (archiveHtml) errors.push(...validateEntryLink(archiveHtml, 'memory', selected.url, ENTRY_FILES[1]));
  }
  return { errors, articleCount: records.length, dualCount: dualRecords.length, targetUrl: selected?.url };
}

function formatDiagnostics(result) { return result.errors.map(error => `${error.code} path=${error.path}`); }

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('surface-history 檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex !== -1 && args[sourceRootIndex + 1]
    ? path.resolve(args[sourceRootIndex + 1]) : path.resolve(__dirname, '..');
  const result = validateSurfaceHistory({ root: path.resolve(args[rootIndex + 1]), sourceRoot });
  if (result.errors.length) {
    console.error('surface-history 輸出檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(`surface-history 輸出檢查通過：${result.articleCount} articles、${result.dualCount} dual、route ${result.targetUrl}。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { routeFile, validateSurfaceHistory, formatDiagnostics, runCli };
