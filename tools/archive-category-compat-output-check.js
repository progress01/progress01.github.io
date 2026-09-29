'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function normalizeRoute(value) {
  const parsed = new URL(value, 'https://local.invalid');
  if (parsed.search || parsed.hash) return null;
  try { return decodeURIComponent(parsed.pathname).replace(/\/{2,}/g, '/'); }
  catch { return null; }
}
function outputFile(root, route) {
  const pathname = normalizeRoute(route);
  if (!pathname || !pathname.startsWith('/')) return null;
  return path.resolve(root, `.${pathname}`, 'index.html');
}
function articleHtmlFiles(root) {
  const found = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        const html = fs.readFileSync(file, 'utf8');
        if (html.includes('post-content-single')) found.push(file);
      }
    }
  }
  visit(root);
  return found;
}
function anchorArticleRoutes($, articleRoutes, selector = 'a[href]') {
  const routes = [];
  $(selector).each((_, element) => {
    const route = normalizeRoute($(element).attr('href'));
    if (route && articleRoutes.has(route)) routes.push(route);
  });
  return routes;
}
function validateArchiveCategoryCompat({ root, baselineRoot } = {}) {
  const errors = [];
  const counts = {};
  if (!root) return { errors: ['generated_root_required'], counts };
  let index;
  try { index = readJson(path.join(root, 'navigation-index.json')); }
  catch { return { errors: ['navigation_index_unreadable'], counts }; }
  if (!Array.isArray(index?.records)) return { errors: ['navigation_index_records_invalid'], counts };
  const posts = index.records.filter(record => record?.kind === 'article');
  let siteOrigin = null;
  try {
    const sitePage = cheerio.load(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    siteOrigin = new URL(sitePage('link[rel="canonical"]').attr('href')).origin;
  } catch { errors.push('site_home_canonical_unreadable'); }
  const byRoute = new Map();
  for (const post of posts) {
    const route = normalizeRoute(post.url);
    if (!route || !route.endsWith('/')) errors.push(`article_route_invalid:${post.url}`);
    else if (byRoute.has(route)) errors.push(`article_route_duplicate_in_index:${route}`);
    else byRoute.set(route, post);
  }
  const articleRoutes = new Set(byRoute.keys());
  counts.navigationArticles = posts.length;
  counts.navigationUniqueRoutes = articleRoutes.size;

  const articleFiles = articleHtmlFiles(root);
  counts.articleHtmlFiles = articleFiles.length;
  const canonicalRoutes = new Map();
  for (const file of articleFiles) {
    const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
    const canonicals = $('link[rel="canonical"]').map((_, element) => $(element).attr('href')).get();
    if (canonicals.length !== 1) { errors.push(`article_canonical_count_invalid:${path.relative(root, file)}`); continue; }
    const route = normalizeRoute(canonicals[0]);
    if (!route || !route.endsWith('/')) { errors.push(`article_canonical_route_invalid:${path.relative(root, file)}`); continue; }
    try { if (new URL(canonicals[0]).origin !== siteOrigin) errors.push(`article_canonical_origin_mismatch:${route}`); }
    catch { errors.push(`article_canonical_origin_invalid:${route}`); }
    canonicalRoutes.set(route, (canonicalRoutes.get(route) || 0) + 1);
    if (!articleRoutes.has(route)) errors.push(`article_canonical_not_in_navigation_index:${route}`);
    const expected = byRoute.get(route);
    if (expected && !expected.title.includes($('article.post-content-single [itemprop="headline"]').first().text().replace(/\s+/g, ' ').trim())) {
      errors.push(`article_title_route_mismatch:${route}`);
    }
  }
  for (const route of articleRoutes) {
    const file = outputFile(root, route);
    if (!file || !fs.existsSync(file)) errors.push(`article_route_output_missing:${route}`);
    if (canonicalRoutes.get(route) !== 1) errors.push(`article_route_canonical_multiplicity:${route}:${canonicalRoutes.get(route) || 0}`);
  }
  for (const [route, count] of canonicalRoutes) if (count !== 1) errors.push(`article_canonical_duplicate:${route}:${count}`);
  counts.canonicalUniqueRoutes = canonicalRoutes.size;

  const categoryFile = path.join(root, 'categories', 'index.html');
  let categoryHtml = '';
  try { categoryHtml = fs.readFileSync(categoryFile, 'utf8'); }
  catch { errors.push('categories_root_unreadable'); }
  if (categoryHtml) {
    const $ = cheerio.load(categoryHtml);
    const listed = $('[data-browse-item] a[href]').map((_, element) => normalizeRoute($(element).attr('href'))).get();
    counts.categoriesRootItems = listed.length;
    counts.categoriesRootUniqueRoutes = new Set(listed).size;
    for (const route of articleRoutes) if (listed.filter(item => item === route).length !== 1) errors.push(`categories_root_membership_invalid:${route}`);
    for (const route of listed) if (!articleRoutes.has(route)) errors.push(`categories_root_unexpected_route:${route}`);
    if (!categoryHtml.includes('<noscript>')) errors.push('categories_noscript_fallback_missing');
    if (!$('noscript').text().includes('分類入口') || !$('noscript').text().includes('標籤入口')) errors.push('categories_noscript_original_links_missing');
  }

  const archiveFiles = [];
  const archiveRoot = path.join(root, 'archives');
  if (fs.existsSync(archiveRoot)) {
    function visitArchives(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visitArchives(file);
        else if (entry.name === 'index.html') {
          const relative = path.relative(root, file).replace(/\\/g, '/');
          const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
          const canonical = normalizeRoute($('link[rel="canonical"]').attr('href') || '');
          if (canonical === '/archives/' || /^\/archives\/page\/\d+\/$/.test(canonical || '')) archiveFiles.push({ file, canonical, $ });
        }
      }
    }
    visitArchives(archiveRoot);
  }
  const archived = archiveFiles.flatMap(page => anchorArticleRoutes(page.$, articleRoutes, '.post-block .post-title-link'));
  counts.archivePaginationPages = archiveFiles.length;
  counts.archiveUniqueRoutes = new Set(archived).size;
  counts.archiveMemberships = archived.length;
  for (const route of articleRoutes) if (archived.filter(item => item === route).length !== 1) errors.push(`archive_membership_invalid:${route}`);
  for (const route of archived) if (!articleRoutes.has(route)) errors.push(`archive_unexpected_route:${route}`);

  const categoryNames = [...new Set(posts.flatMap(post => Array.isArray(post.categories) ? post.categories : []))].sort();
  const memberships = new Map();
  for (const category of categoryNames) {
    const expected = posts.filter(post => post.categories?.includes(category)).map(post => normalizeRoute(post.url));
    const file = path.join(root, 'categories', category, 'index.html');
    if (!fs.existsSync(file)) { errors.push(`native_category_route_missing:${category}`); continue; }
    const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
    const actual = anchorArticleRoutes($, articleRoutes, '[data-browse-item]:not([hidden]) a[href]');
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    for (const route of expectedSet) if (actual.filter(item => item === route).length !== 1) errors.push(`native_category_membership_invalid:${category}:${route}`);
    for (const route of actualSet) if (!expectedSet.has(route)) errors.push(`native_category_unexpected_membership:${category}:${route}`);
    memberships.set(category, { expected: expected.length, actual: actual.length });
  }
  counts.nativeCategoryRoutes = categoryNames.length;
  counts.nativeCategoryMemberships = [...memberships.values()].reduce((total, item) => total + item.actual, 0);
  counts.nativeCategoryNames = categoryNames;

  const surfaces = { profile: 0, memory: 0, dual: 0 };
  for (const post of posts) {
    const values = Array.isArray(post.surfaces) ? post.surfaces : [];
    if (values.includes('profile')) surfaces.profile++;
    if (values.includes('memory')) surfaces.memory++;
    if (values.includes('profile') && values.includes('memory')) surfaces.dual++;
  }
  counts.surfaceDistribution = surfaces;

  const profileFile = path.join(root, 'profile', 'articles', 'index.html');
  try {
    const $ = cheerio.load(fs.readFileSync(profileFile, 'utf8'));
    counts.profileArticles = $('[data-profile-article-list] .profile-list-link').length;
    if (counts.profileArticles !== surfaces.profile) errors.push(`profile_articles_count_mismatch:${counts.profileArticles}:${surfaces.profile}`);
  } catch { errors.push('profile_articles_output_unreadable'); }

  const fixedSamples = [
    { route: '/work/from-real-work-to-features/', surfaces: ['profile', 'memory'] },
    { route: '/2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/', surfaces: ['memory'] },
    { route: '/work/flow-friendly-work-system/', surfaces: ['profile', 'memory'] },
    { route: '/2026/01/25/部落格改版規劃/', surfaces: ['memory'] }
  ];
  for (const sample of fixedSamples) {
    const post = byRoute.get(sample.route);
    if (!post) errors.push(`fixed_sample_missing:${sample.route}`);
    else if (JSON.stringify(post.surfaces) !== JSON.stringify(sample.surfaces)) errors.push(`fixed_sample_surface_mismatch:${sample.route}:${JSON.stringify(post.surfaces)}`);
  }
  counts.fixedSamples = fixedSamples.length;

  if (baselineRoot) {
    const baselineIndex = path.join(baselineRoot, 'navigation-index.json');
    try {
      const baselinePosts = readJson(baselineIndex).records.filter(record => record?.kind === 'article');
      const baselineRoutes = new Set(baselinePosts.map(post => normalizeRoute(post.url)).filter(Boolean));
      counts.baseline = {
        routeCount: baselineRoutes.size,
        missingFromBuild: [...baselineRoutes].filter(route => !articleRoutes.has(route)).sort(),
        newInBuild: [...articleRoutes].filter(route => !baselineRoutes.has(route)).sort()
      };
    } catch { errors.push('baseline_navigation_index_unreadable'); }
  }
  return { errors, counts };
}

function runCli(args = process.argv.slice(2)) {
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
  const root = value('--root') || 'public';
  const result = validateArchiveCategoryCompat({ root: path.resolve(root), baselineRoot: value('--baseline') ? path.resolve(value('--baseline')) : undefined });
  if (result.errors.length) {
    console.error('archive-category-compat failed:', result.errors.slice(0, 40).join('\n'));
    if (result.errors.length > 40) console.error(`... and ${result.errors.length - 40} more errors`);
    return 1;
  }
  console.log(`archive-category-compat passed: ${JSON.stringify(result.counts)}`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { validateArchiveCategoryCompat, normalizeRoute };
