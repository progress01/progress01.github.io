'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = 'navigation-index.json';
const PROFILE_PATHS = ['index.html', 'profile/index.html', 'profile/articles/index.html'];

function diagnostic(code, file) { return { code, path: file }; }

function routeFile(url) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(url, 'https://example.test').pathname); }
  catch { return null; }
  const relative = pathname.replace(/^\/+/, '');
  return relative.endsWith('/') ? `${relative}index.html` : relative;
}

function checkTemplateWiring(sourceRoot) {
  const errors = [];
  const requirements = [
    ['themes/next/layout/_macro/post.njk', [
      'thinking_status(post)', '<aside class="post-thinking-status"', 'aria-labelledby="post-thinking-status-title"',
      '🚧 當前假設／探索中', '最近校準', '目前適用邊界', 'escape_html(thinking.boundary)'
    ]],
    ['themes/next/layout/profile.njk', ['profile-article-home']],
    ['themes/next/layout/profile-articles.njk', ['profile-article-library']],
    ['scripts/thinking-status.js', ['resolveThinkingStatus(post, { source })', 'thinking status contract violation']],
    ['scripts/profile-learning.js', ['resolveThinkingStatus(post,', 'thinking: thinking.visible ? thinking : null']],
    ['scripts/profile-articles.js', ['resolveThinkingStatus(post,', 'thinking: thinking.visible ? thinking : null']]
  ];
  for (const [file, snippets] of requirements) {
    let source;
    try { source = fs.readFileSync(path.join(sourceRoot, file), 'utf8'); }
    catch {
      errors.push(diagnostic('thinking_template_source_unreadable', file));
      continue;
    }
    for (const snippet of snippets) {
      if (!source.includes(snippet)) errors.push(diagnostic('thinking_template_wiring_missing', `${file}#${snippet}`));
    }
  }
  return errors;
}

function validateArticle(html, file) {
  const $ = cheerio.load(html);
  const block = $('.post-thinking-status');
  const errors = [];
  if (block.length) errors.push(diagnostic('unexpected_thinking_status_without_declared_fields', file));
  return errors;
}

function validateThinkingStatusOutput({ root, sourceRoot = DEFAULT_SOURCE_ROOT, index, pages } = {}) {
  const errors = checkTemplateWiring(sourceRoot);
  if (!index) {
    try { index = JSON.parse(fs.readFileSync(path.join(root, INDEX_PATH), 'utf8')); }
    catch { return { errors: [...errors, diagnostic('thinking_status_index_unreadable', INDEX_PATH)], articleCount: 0, checkedCards: 0 }; }
  }
  if (!Array.isArray(index?.records)) {
    return { errors: [...errors, diagnostic('thinking_status_index_invalid', INDEX_PATH)], articleCount: 0, checkedCards: 0 };
  }

  const articleRecords = index.records.filter(record => record?.kind === 'article');
  const articleFiles = new Set();
  for (const record of articleRecords) {
    const file = routeFile(record.url);
    if (!file) {
      errors.push(diagnostic('thinking_status_article_route_invalid', String(record.url)));
      continue;
    }
    articleFiles.add(file);
    let html = pages?.[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch {
        errors.push(diagnostic('thinking_status_article_unreadable', file));
        continue;
      }
    }
    errors.push(...validateArticle(html, file));
  }

  let checkedCards = 0;
  for (const file of PROFILE_PATHS) {
    let html = pages?.[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch {
        errors.push(diagnostic('thinking_status_profile_unreadable', file));
        continue;
      }
    }
    const $ = cheerio.load(html);
    if (file === 'profile/articles/index.html') checkedCards += $('.profile-article-row').length;
    if ($('.profile-thinking-label').length) errors.push(diagnostic('unexpected_profile_thinking_label_without_declared_fields', file));
    if ($('.profile-thinking-boundary').length) errors.push(diagnostic('profile_thinking_boundary_leaked', file));
  }

  const profileFiles = new Set(PROFILE_PATHS);
  const htmlFiles = pages ? Object.keys(pages) : listHtmlFiles(root);
  for (const file of htmlFiles) {
    if (articleFiles.has(file) || profileFiles.has(file)) continue;
    let html = pages?.[file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
      catch { continue; }
    }
    const $ = cheerio.load(html);
    if ($('.post-thinking-status, .profile-thinking-label, .profile-thinking-boundary').length) {
      errors.push(diagnostic('thinking_status_marker_outside_allowed_regions', file));
    }
  }

  return { errors, articleCount: articleRecords.length, checkedCards };
}

function listHtmlFiles(root, directory = root, prefix = '') {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
  catch { return []; }
  return entries.flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(root, absolute, relative);
    return entry.isFile() && entry.name.endsWith('.html') ? [relative.replaceAll('\\', '/')] : [];
  });
}

function formatDiagnostics(result) { return result.errors.map(error => `${error.code} path=${error.path}`); }

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('thinking-status 輸出檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex !== -1 && args[sourceRootIndex + 1]
    ? path.resolve(args[sourceRootIndex + 1]) : DEFAULT_SOURCE_ROOT;
  const result = validateThinkingStatusOutput({ root: path.resolve(args[rootIndex + 1]), sourceRoot });
  if (result.errors.length) {
    console.error('thinking-status 輸出檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(`thinking-status 輸出檢查通過：${result.articleCount} 篇文章、${result.checkedCards} 列 A 面列表均無狀態標記；無成熟度邊界外洩。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { routeFile, checkTemplateWiring, validateArticle, validateThinkingStatusOutput, listHtmlFiles, formatDiagnostics, runCli };
