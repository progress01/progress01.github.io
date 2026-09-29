'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const yaml = require('js-yaml');

const FIXED_SAMPLES = Object.freeze([
  { id: 'profile-work', route: '/work/from-real-work-to-features/', surfaces: ['profile', 'memory'] },
  { id: 'song-encoded', route: '/2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/', surfaces: ['memory'] },
  { id: 'profile-learning', route: '/learning/website-quality-testing-roadmap/', surfaces: ['profile', 'memory'] },
  { id: 'dual-flow', route: '/work/flow-friendly-work-system/', surfaces: ['profile', 'memory'] },
  { id: 'site-planning', route: '/2026/01/25/部落格改版規劃/', surfaces: ['memory'] }
]);
const CORE_ROUTES = Object.freeze(['/', '/profile/', '/profile/articles/', '/memory/']);
const DATA_ENDPOINT = /\.(?:json|xml)$/i;

function decodedPath(value) {
  try { return decodeURIComponent(value); } catch { return null; }
}

function normalizeRoute(value, origin) {
  let parsed;
  try { parsed = new URL(value, `${origin}/`); } catch { return null; }
  if (parsed.search || parsed.hash || !/^https?:$/.test(parsed.protocol)) return null;
  const decoded = decodedPath(parsed.pathname);
  if (decoded === null || decoded.split('/').some(part => part === '.' || part === '..')) return null;
  let route = decoded.replace(/\/{2,}/g, '/');
  route = route.replace(/\/index\.html$/i, '/');
  if (!route.startsWith('/')) route = `/${route}`;
  if (!path.posix.extname(route) && !route.endsWith('/')) route += '/';
  return route;
}

function routeFile(route) {
  const relative = route.replace(/^\/+/, '');
  return path.join(...(relative ? relative.split('/') : []), ...(route.endsWith('/') || !relative ? ['index.html'] : []));
}

function listHtmlFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(filename);
    }
  }
  visit(root);
  return files;
}

function articleBodyHash($) {
  const body = $('article.post-content-single .post-body').first();
  if (!body.length) return null;
  const clone = cheerio.load(`<div>${body.html() || ''}</div>`);
  clone('script, style, noscript').remove();
  clone('*').each((_, element) => {
    const attrs = Object.entries(element.attribs || {})
      .filter(([name]) => !/^on/i.test(name))
      .sort(([a], [b]) => a.localeCompare(b));
    element.attribs = Object.fromEntries(attrs);
  });
  const normalized = clone('div').html()
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function articleHtml($) {
  const hasArticleSchema = $('script[type="application/ld+json"]').toArray().some(element => {
    try {
      const data = JSON.parse($(element).text());
      return data?.['@type'] === 'BlogPosting';
    } catch { return false; }
  });
  return $('article.post-content-single').length > 0 || hasArticleSchema;
}

function readArticleIndex(root, errors) {
  try {
    const index = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8'));
    if (!Array.isArray(index?.records)) throw new Error('records_invalid');
    return index.records.filter(record => record?.kind === 'article');
  } catch {
    errors.push({ code: 'navigation_index_unreadable', path: 'navigation-index.json' });
    return [];
  }
}

function checkSitemap(root, origin, articleRoutes, htmlByRoute, errors) {
  let xml;
  try { xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'); }
  catch { errors.push({ code: 'sitemap_unreadable', path: 'sitemap.xml' }); return { urls: 0 }; }
  const $ = cheerio.load(xml, { xmlMode: true });
  const locs = $('urlset > url > loc').map((_, element) => $(element).text().trim()).get();
  if (!locs.length || !$('urlset').length) errors.push({ code: 'sitemap_xml_invalid', path: 'sitemap.xml' });
  const seen = new Set();
  const routes = new Set();
  for (const loc of locs) {
    let parsed;
    try { parsed = new URL(loc); } catch { errors.push({ code: 'sitemap_loc_invalid', path: 'sitemap.xml' }); continue; }
    if (parsed.origin !== origin) errors.push({ code: 'sitemap_off_origin', path: 'sitemap.xml' });
    const route = normalizeRoute(loc, origin);
    if (!route) { errors.push({ code: 'sitemap_unsafe_route', path: 'sitemap.xml' }); continue; }
    if (seen.has(route)) errors.push({ code: 'sitemap_duplicate_loc', path: 'sitemap.xml' });
    seen.add(route);
    routes.add(route);
    if (DATA_ENDPOINT.test(route)) errors.push({ code: 'sitemap_data_endpoint_included', path: 'sitemap.xml' });
    if (articleRoutes.has(route) && articleRoutes.get(route).length !== 1) errors.push({ code: 'sitemap_article_route_duplicate_output', path: 'sitemap.xml' });
    if (!htmlByRoute.has(route)) errors.push({ code: 'sitemap_output_missing', path: 'sitemap.xml' });
    if (route.startsWith('/profile/') && articleRoutes.has(route)) errors.push({ code: 'sitemap_ab_copy_route', path: 'sitemap.xml' });
  }
  const required = new Set([...CORE_ROUTES]);
  for (const [route, entry] of htmlByRoute) {
    if (entry.isArticle) continue;
    if (route === '/categories/' || route === '/tags/'
        || /^\/(?:categories|tags)\/[^/]+\/$/.test(route)
        || (route === '/profile/articles/' && entry.schemaType === 'CollectionPage')) required.add(route);
  }
  for (const route of required) {
    if (!routes.has(route)) errors.push({ code: 'sitemap_required_route_missing', path: route });
  }
  for (const route of articleRoutes.keys()) {
    if (!routes.has(route)) errors.push({ code: 'sitemap_article_missing', path: route });
  }
  return { urls: locs.length, routes };
}

function validateSeoUrls({ root, origin = 'https://progress01.github.io', expectedArticleCount = 276, samples = FIXED_SAMPLES } = {}) {
  const errors = [];
  const counts = { htmlFiles: 0, articleHtml: 0, navigationArticles: 0, uniqueArticleRoutes: 0, sitemapUrls: 0, duplicateBodyGroups: 0 };
  if (!root || !fs.existsSync(path.join(root, 'index.html'))) return { errors: [{ code: 'generated_root_invalid', path: String(root || '') }], counts };
  const absoluteRoot = path.resolve(root);
  const normalizedOrigin = new URL(origin).origin;
  const records = readArticleIndex(absoluteRoot, errors);
  counts.navigationArticles = records.length;
  if (records.length !== expectedArticleCount) errors.push({ code: 'navigation_article_count_mismatch', path: 'navigation-index.json' });

  const recordByRoute = new Map();
  for (const record of records) {
    const route = normalizeRoute(record.url, normalizedOrigin);
    if (!route || !route.endsWith('/')) {
      errors.push({ code: 'navigation_article_url_invalid', path: 'navigation-index.json' });
      continue;
    }
    if (recordByRoute.has(route)) errors.push({ code: 'navigation_article_duplicate', path: route });
    else recordByRoute.set(route, record);
  }
  counts.uniqueArticleRoutes = recordByRoute.size;

  const files = listHtmlFiles(absoluteRoot);
  counts.htmlFiles = files.length;
  const htmlByRoute = new Map();
  const articlesByCanonical = new Map();
  const bodyHashes = new Map();
  for (const filename of files) {
    const relative = path.relative(absoluteRoot, filename).split(path.sep).join('/');
    const inferredRoute = relative === 'index.html' ? '/' : `/${relative.replace(/index\.html$/i, '')}`;
    const html = fs.readFileSync(filename, 'utf8');
    const $ = cheerio.load(html);
    const isArticle = articleHtml($);
    const route = normalizeRoute(inferredRoute, normalizedOrigin);
    const data = $('script[type="application/ld+json"]').toArray().map(element => {
      try { return JSON.parse($(element).text()); } catch { return null; }
    }).find(item => item && typeof item === 'object');
    const entry = { filename, relative, route, isArticle, schemaType: data?.['@type'] };
    if (route) {
      if (!htmlByRoute.has(route)) htmlByRoute.set(route, entry);
      else errors.push({ code: 'html_output_route_collision', path: relative });
    }
    if (!isArticle) continue;
    counts.articleHtml++;
    const canonicalLinks = $('link[rel~="canonical"]');
    if (canonicalLinks.length !== 1) {
      errors.push({ code: 'article_canonical_count_invalid', path: relative });
      continue;
    }
    const href = canonicalLinks.attr('href') || '';
    let parsed;
    try { parsed = new URL(href); } catch { parsed = null; }
    if (!parsed || parsed.origin !== normalizedOrigin || !/^https?:$/.test(parsed.protocol)) {
      errors.push({ code: 'article_canonical_origin_invalid', path: relative });
      continue;
    }
    const canonicalRoute = normalizeRoute(href, normalizedOrigin);
    if (!canonicalRoute || canonicalRoute !== route) errors.push({ code: 'article_canonical_not_self', path: relative });
    if (canonicalRoute) {
      if (!articlesByCanonical.has(canonicalRoute)) articlesByCanonical.set(canonicalRoute, []);
      articlesByCanonical.get(canonicalRoute).push(relative);
      if (!recordByRoute.has(canonicalRoute)) errors.push({ code: 'article_canonical_not_in_navigation_index', path: canonicalRoute });
    }
    if (route?.startsWith('/profile/')) errors.push({ code: 'article_copy_under_profile_path', path: relative });
    const hash = articleBodyHash($);
    if (hash) {
      if (!bodyHashes.has(hash)) bodyHashes.set(hash, []);
      bodyHashes.get(hash).push({ route: canonicalRoute || route, relative });
    }
    const record = recordByRoute.get(canonicalRoute);
    if (record) {
      const title = $('article.post-content-single [itemprop~="headline"]').first().text().replace(/\s+/g, ' ').trim();
      if (typeof record.title !== 'string' || title !== record.title.replace(/\s+/g, ' ').trim()) {
        errors.push({ code: 'article_index_title_mismatch', path: canonicalRoute });
      }
    }
  }

  for (const [route, paths] of articlesByCanonical) {
    if (paths.length !== 1) errors.push({ code: 'article_canonical_duplicate', path: route });
  }
  for (const [route] of recordByRoute) {
    if (!articlesByCanonical.has(route)) errors.push({ code: 'navigation_article_html_missing', path: route });
    const filename = path.resolve(absoluteRoot, routeFile(route));
    if (!filename.startsWith(`${absoluteRoot}${path.sep}`) && filename !== path.join(absoluteRoot, 'index.html')) {
      errors.push({ code: 'navigation_article_output_unsafe', path: route });
    } else if (!fs.existsSync(filename)) errors.push({ code: 'navigation_article_output_missing', path: route });
  }
  for (const [hash, entries] of bodyHashes) {
    const distinctRoutes = new Set(entries.map(item => item.route));
    if (distinctRoutes.size > 1) {
      counts.duplicateBodyGroups++;
      errors.push({ code: 'duplicate_article_body', path: [...distinctRoutes].sort().join('|'), hash: hash.slice(0, 16) });
    }
  }

  if (records.length === expectedArticleCount && recordByRoute.size === expectedArticleCount) {
    for (const sample of samples) {
      const route = normalizeRoute(sample.route, normalizedOrigin);
      const record = recordByRoute.get(route);
      if (!record) { errors.push({ code: 'fixed_sample_missing', path: sample.id }); continue; }
      if (JSON.stringify(record.surfaces) !== JSON.stringify(sample.surfaces)) errors.push({ code: 'fixed_sample_surface_mismatch', path: sample.id });
      const matches = articlesByCanonical.get(route) || [];
      if (matches.length !== 1) errors.push({ code: 'fixed_sample_canonical_multiplicity', path: sample.id });
    }
    const dualSample = samples.find(sample => Array.isArray(sample.surfaces)
      && sample.surfaces.includes('profile') && sample.surfaces.includes('memory'));
    const dual = dualSample ? normalizeRoute(dualSample.route, normalizedOrigin) : null;
    for (const entrance of ['/', '/profile/']) {
      const file = path.join(absoluteRoot, routeFile(entrance));
      if (!fs.existsSync(file)) { errors.push({ code: 'dual_entrance_missing', path: entrance }); continue; }
      const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
      const linkedRoutes = $('a[href]').map((_, element) => normalizeRoute($(element).attr('href'), normalizedOrigin)).get();
      if (linkedRoutes.filter(item => item === dual).length < 1) errors.push({ code: 'dual_article_entrance_reference_missing', path: entrance });
    }
  }

  const sitemap = checkSitemap(absoluteRoot, normalizedOrigin, articlesByCanonical, htmlByRoute, errors);
  counts.sitemapUrls = sitemap.urls;
  return { errors, counts };
}

function formatDiagnostics(errors) {
  return errors.map(error => `${error.code} path=${error.path}${error.hash ? ` hash=${error.hash}` : ''}`);
}

function configuredOrigin(projectRoot = path.resolve(__dirname, '..')) {
  const config = yaml.load(fs.readFileSync(path.join(projectRoot, '_config.yml'), 'utf8'));
  if (typeof config?.url !== 'string') throw new Error('configured_site_origin_missing');
  return new URL(config.url).origin;
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex < 0 || !args[rootIndex + 1]) {
    console.error('SEO/URL audit requires --root <fresh generated directory>.');
    return 2;
  }
  const originIndex = args.indexOf('--origin');
  const origin = originIndex >= 0 ? args[originIndex + 1] : configuredOrigin();
  const result = validateSeoUrls({ root: path.resolve(args[rootIndex + 1]), origin });
  if (result.errors.length) {
    console.error('SEO/URL audit failed:');
    formatDiagnostics(result.errors).slice(0, 60).forEach(message => console.error(`- ${message}`));
    if (result.errors.length > 60) console.error(`... ${result.errors.length - 60} more diagnostics`);
    return 1;
  }
  console.log(`SEO/URL audit passed: ${result.counts.articleHtml} article HTML, ${result.counts.uniqueArticleRoutes} navigation routes, ${result.counts.sitemapUrls} sitemap locs; duplicate body groups ${result.counts.duplicateBodyGroups}.`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { CORE_ROUTES, FIXED_SAMPLES, normalizeRoute, routeFile, articleBodyHash, validateSeoUrls, formatDiagnostics, configuredOrigin, runCli };
