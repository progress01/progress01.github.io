'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { SURFACE_PRESENTATION } = require('./lib/post-surface');

const INDEX_FILE = 'navigation-index.json';

function diagnostic(code, file) { return { code, path: file }; }

function routeFile(url) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(url, 'https://example.test').pathname); }
  catch { return null; }
  const relative = pathname.replace(/^\/+/, '');
  return relative.endsWith('/') ? `${relative}index.html` : relative;
}

function validateArticle(html, record, file) {
  const errors = [];
  const $ = cheerio.load(html);
  const marker = $('.post-surface-marker');
  if (marker.length !== 1) return [diagnostic('post_surface_marker_count_invalid', file)];

  const expected = Array.isArray(record.surfaces)
    ? record.surfaces.map(surface => SURFACE_PRESENTATION[surface]).filter(Boolean)
    : [];
  if (!expected.length || expected.length !== record.surfaces.length) {
    return [diagnostic('post_surface_index_value_invalid', `${INDEX_FILE}#${record.id}`)];
  }

  if (marker.attr('aria-label') !== '文章收錄面向'
      || marker.attr('data-surfaces') !== record.surfaces.join(' ')
      || marker.children('.post-surface-marker-label').text().trim() !== '收錄於') {
    errors.push(diagnostic('post_surface_marker_semantics_invalid', file));
  }

  const links = marker.children('a.post-surface-marker-link');
  if (links.length !== expected.length) {
    errors.push(diagnostic('post_surface_marker_links_invalid', file));
  } else {
    links.each((index, element) => {
      const link = $(element);
      const item = expected[index];
      if (link.attr('href') !== item.href || link.attr('data-surface') !== item.id || link.text().trim() !== item.label) {
        errors.push(diagnostic('post_surface_marker_links_invalid', file));
      }
    });
  }

  const separators = marker.children('.post-surface-marker-separator');
  if (separators.length !== Math.max(0, expected.length - 1)
      || separators.toArray().some(element => $(element).text().trim() !== '・' || $(element).attr('aria-hidden') !== 'true')) {
    errors.push(diagnostic('post_surface_marker_separator_invalid', file));
  }

  const unsafeAttribute = links.toArray().some(element => Object.keys(element.attribs || {}).some(name => /^on/i.test(name)));
  if (marker.find('script').length || unsafeAttribute) {
    errors.push(diagnostic('post_surface_marker_script_dependency', file));
  }

  const article = marker.closest('article.post-content-single');
  const header = article.children('.post-header');
  const body = article.children('.post-body');
  if (article.length !== 1 || header.length !== 1 || body.length !== 1
      || marker.parent()[0] !== article[0] || marker.index() <= header.index() || marker.index() >= body.index()) {
    errors.push(diagnostic('post_surface_marker_position_invalid', file));
  }
  return errors;
}

function validatePostSurfaces({ root, index, pages } = {}) {
  const errors = [];
  if (!index) {
    try { index = JSON.parse(fs.readFileSync(path.join(root, INDEX_FILE), 'utf8')); }
    catch { return { errors: [diagnostic('post_surface_index_unreadable', INDEX_FILE)], articleCount: 0, counts: {} }; }
  }
  if (!index || !Array.isArray(index.records)) {
    return { errors: [diagnostic('post_surface_index_invalid', INDEX_FILE)], articleCount: 0, counts: {} };
  }

  const records = index.records.filter(record => record.kind === 'article');
  const counts = { profile: 0, memory: 0, dual: 0 };
  const seen = new Set();
  for (const record of records) {
    const file = routeFile(record.url);
    if (!file || seen.has(file)) {
      errors.push(diagnostic('post_surface_article_route_invalid', file || String(record.url)));
      continue;
    }
    seen.add(file);
    if (record.surfaces?.length === 2) counts.dual += 1;
    else if (record.surfaces?.[0] === 'profile') counts.profile += 1;
    else if (record.surfaces?.[0] === 'memory') counts.memory += 1;

    let html = pages && pages[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch {
        errors.push(diagnostic('post_surface_article_unreadable', file));
        continue;
      }
    }
    errors.push(...validateArticle(html, record, file));
  }
  return { errors, articleCount: records.length, counts };
}

function formatDiagnostics(result) { return result.errors.map(error => `${error.code} path=${error.path}`); }

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('post-surface 檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const result = validatePostSurfaces({ root: path.resolve(args[rootIndex + 1]) });
  if (result.errors.length) {
    console.error('post-surface 輸出檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(`post-surface 輸出檢查通過：${result.articleCount} articles（A ${result.counts.profile}／B ${result.counts.memory}／雙面 ${result.counts.dual}）。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { routeFile, validatePostSurfaces, formatDiagnostics, runCli };
