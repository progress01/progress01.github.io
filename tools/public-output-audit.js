'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const cheerio = require('cheerio');
const yaml = require('js-yaml');
const { auditBoundary, countOccurrences, loadBoundaryInputs } = require('./public-boundary-check');
const { plain } = require('./lib/navigation-index');
const { checkUrl } = require('./site-check');
const { FIXED_SAMPLES, configuredOrigin, routeFile } = require('./seo-url-audit');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPECTED_THEME_IMAGES = new Set([
  'apple-touch-icon-next.png', 'avatar.gif', 'favicon-16x16-next.png',
  'favicon-32x32-next.png', 'logo-algolia-nebula-blue-full.svg', 'logo.svg'
]);
const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const TEXT_EXTENSIONS = new Set([
  '.atom', '.cjs', '.css', '.csv', '.html', '.ics', '.js', '.json', '.map', '.md', '.mjs',
  '.rss', '.scss', '.svg', '.txt', '.webmanifest', '.xml', '.yaml', '.yml'
]);
const FORBIDDEN_SEGMENTS = new Set([
  '.agents', '.codex', '.git', '_data', '_drafts', '_posts', 'agents', 'archive', 'backup', 'backups',
  'docs', 'private', 'private-storage', 'source', 'tests', 'tmp'
]);
const SOURCE_FILE_EXTENSIONS = new Set(['.md', '.markdown', '.yml', '.yaml']);
const BACKUP_EXTENSIONS = new Set(['.7z', '.bak', '.backup', '.gz', '.rar', '.tar', '.tgz', '.zip']);

function addError(errors, code, filePath = '.', count = 1) {
  errors.push({ code, path: filePath, count });
}

function relativePath(root, filename) {
  return path.relative(root, filename).split(path.sep).join('/');
}

function collectFiles(root, errors) {
  const files = [];
  function walk(directory) {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch { addError(errors, 'inventory_scan_failed', relativePath(root, directory)); return; }
    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) { addError(errors, 'output_symlink_unsupported', relativePath(root, filename)); continue; }
      if (entry.isDirectory()) walk(filename);
      else if (entry.isFile()) files.push(filename);
      else addError(errors, 'output_entry_unsupported', relativePath(root, filename));
    }
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) addError(errors, 'output_root_missing');
  else walk(root);
  return files.sort((a, b) => relativePath(root, a).localeCompare(relativePath(root, b)));
}

function classifyFile(filename, bytes) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.json' || ext === '.webmanifest') return 'json';
  if (['.xml', '.rss', '.atom'].includes(ext)) return 'xml';
  if (ext === '.js' || ext === '.cjs' || ext === '.mjs') return 'js';
  if (ext === '.css' || ext === '.scss') return 'css';
  if (IMAGE_EXTENSIONS.has(ext)) return 'images';
  const sample = bytes.subarray(0, 512);
  const isText = sample.length === 0 || !sample.includes(0);
  if (isText) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return 'text'; }
    catch { /* binary or unsupported text encoding */ }
  }
  return 'otherBinary';
}

function decodeText(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3));
  }
  if (bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
  }
  if (bytes.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function inventoryAndReadText(root, files, errors) {
  const inventory = { totalFiles: files.length, html: 0, json: 0, xml: 0, js: 0, css: 0, text: 0, images: 0, otherBinary: 0 };
  const texts = [];
  for (const filename of files) {
    let bytes;
    try { bytes = fs.readFileSync(filename); }
    catch { addError(errors, 'output_read_failed', relativePath(root, filename)); continue; }
    const type = classifyFile(filename, bytes);
    inventory[type]++;
    try {
      const text = decodeText(bytes);
      if (text.includes('\u0000')) throw new Error('binary_content');
      texts.push({ filename, relative: relativePath(root, filename), ext: path.extname(filename).toLowerCase(), text });
    } catch {
      if (TEXT_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
        addError(errors, 'declared_text_unreadable', relativePath(root, filename));
      }
    }
  }
  inventory.text = texts.length;
  return { inventory, texts };
}

function checkSourceCopies(root, files, errors) {
  const microblogPaths = [];
  for (const filename of files) {
    const relative = relativePath(root, filename);
    const segments = relative.split('/');
    const basename = path.basename(relative).toLowerCase();
    const ext = path.extname(basename);
    if (segments.some(segment => FORBIDDEN_SEGMENTS.has(segment.toLowerCase()))) {
      addError(errors, 'source_copy_forbidden_path', relative);
    }
    if (SOURCE_FILE_EXTENSIONS.has(ext)) addError(errors, 'raw_source_extension', relative);
    if (BACKUP_EXTENSIONS.has(ext) || /\.(?:bak|backup|old)\.[^.]+$/i.test(basename)
        || /(?:^|[._-])(?:backup|bak|old|private|raw-source)(?:[._-]|$)/i.test(basename)) {
      addError(errors, 'backup_or_private_artifact', relative);
    }
    if (/^microblog[-_.](?:source|raw|original|backup)\./i.test(basename)) {
      addError(errors, 'microblog_source_duplicate', relative);
    }
    if (basename === 'microblog.json') microblogPaths.push(relative);
  }
  if (microblogPaths.length !== 1 || microblogPaths[0] !== 'microblog.json') {
    addError(errors, 'microblog_source_duplicate', '.', microblogPaths.length || 1);
  }
}

function readJson(texts, relative, errors) {
  const entry = texts.find(item => item.relative === relative);
  if (!entry) { addError(errors, 'required_json_missing', relative); return null; }
  try { return JSON.parse(entry.text); }
  catch { addError(errors, 'required_json_invalid', relative); return null; }
}

function validateMicroblog({ root, texts, plan, sourceRecords, baselineRecords, errors }) {
  const publicRecords = readJson(texts, 'microblog.json', errors);
  const nav = readJson(texts, 'navigation-index.json', errors);
  const navRecords = Array.isArray(nav?.records) ? nav.records.filter(record => record?.kind === 'microblog') : [];
  if (!Array.isArray(nav?.records)) addError(errors, 'navigation_index_records_invalid', 'navigation-index.json');

  const sourceIds = sourceRecords.map(record => record?.id);
  const publicIds = Array.isArray(publicRecords) ? publicRecords.map(record => record?.id) : [];
  const navIds = navRecords.map(record => record?.id);
  for (const [label, ids, relative] of [
    ['source', sourceIds, plan.source], ['public', publicIds, 'microblog.json'], ['navigation', navIds, 'navigation-index.json']
  ]) {
    if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) addError(errors, `${label}_microblog_id_invalid_or_duplicate`, relative);
  }
  if (!Array.isArray(publicRecords) || publicRecords.length !== sourceRecords.length) addError(errors, 'public_microblog_count_mismatch', 'microblog.json', Array.isArray(publicRecords) ? publicRecords.length : 0);
  if (navRecords.length !== sourceRecords.length) addError(errors, 'navigation_microblog_count_mismatch', 'navigation-index.json', navRecords.length);

  const baselineById = new Map(baselineRecords.filter(item => typeof item?.id === 'string').map(item => [item.id, item]));
  const sourceById = new Map(sourceRecords.filter(item => typeof item?.id === 'string').map(item => [item.id, item]));
  const decisions = new Map((plan.records || []).map(item => [item.id, item]));
  for (const baseline of baselineRecords) {
    if (!baseline?.id) continue;
    const decision = decisions.get(baseline.id);
    const current = sourceById.get(baseline.id);
    if (decision?.decision === 'V') {
      if (current) addError(errors, 'retired_id_in_source', plan.source);
      continue;
    }
    if (!current) { addError(errors, 'persistent_microblog_id_missing', plan.source); continue; }
    if (!decision && current.content !== baseline.content) addError(errors, 'unchanged_microblog_content_changed', plan.source);
    if (decision?.decision === 'D' && current.content !== decision.publicContent) addError(errors, 'd_replacement_mismatch', plan.source);
  }
  const publicById = new Map((Array.isArray(publicRecords) ? publicRecords : []).filter(item => item?.id).map(item => [item.id, item]));
  const navById = new Map(navRecords.filter(item => item?.id).map(item => [item.id, item]));
  for (const source of sourceRecords) {
    const output = publicById.get(source.id);
    const indexed = navById.get(source.id);
    if (!output || output.content !== source.content) addError(errors, 'public_microblog_source_mismatch', 'microblog.json');
    if (!indexed || plain(indexed.text) !== plain(source.content)) addError(errors, 'navigation_microblog_source_mismatch', 'navigation-index.json');
  }
  for (const d of (plan.records || []).filter(item => item.decision === 'D')) {
    if (publicById.get(d.id)?.content !== d.publicContent) addError(errors, 'd_replacement_missing_public_json', 'microblog.json');
    if (plain(navById.get(d.id)?.text) !== plain(d.publicContent)) addError(errors, 'd_replacement_missing_navigation_index', 'navigation-index.json');
  }
  const status = texts.find(item => item.relative === 'status/index.html');
  if (!status) addError(errors, 'status_page_missing', 'status/index.html');
  else if (!/fetch\(\s*['"]\/microblog\.json['"]\s*\)/.test(status.text)) addError(errors, 'status_page_data_source_missing', 'status/index.html');
  return { sourceCount: sourceRecords.length, publicCount: Array.isArray(publicRecords) ? publicRecords.length : 0, navigationCount: navRecords.length };
}

function isLocalAsset(reference, from, origin, root, errors) {
  const value = String(reference || '').trim().replace(/^['"]|['"]$/g, '');
  if (!value || /^(?:#|mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return;
  let url;
  try { url = new URL(value, new URL(from, `${origin}/`)); }
  catch { addError(errors, 'asset_reference_invalid', from); return; }
  if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return;
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); }
  catch { addError(errors, 'asset_reference_invalid', from); return; }
  if (decoded.split('/').some(part => part === '..')) { addError(errors, 'asset_reference_unsafe', from); return; }
  const relative = decoded.replace(/^\/+/, '');
  const candidates = [relative, relative.endsWith('/') ? `${relative}index.html` : `${relative}/index.html`];
  if (!candidates.some(candidate => fs.existsSync(path.join(root, candidate)) && fs.statSync(path.join(root, candidate)).isFile())) {
    addError(errors, 'asset_reference_missing', from);
  }
}

function validateAssetReferences({ root, texts, origin, errors }) {
  let localImageReferences = 0;
  let checkedCssReferences = 0;
  for (const entry of texts) {
    if (entry.ext === '.html' || entry.ext === '.htm') {
      const $ = cheerio.load(entry.text);
      const from = entry.relative === 'index.html' ? '/' : `/${entry.relative.replace(/index\.html$/i, '')}`;
      $('[src], [poster], [srcset], [style]').each((_, element) => {
        for (const attr of ['src', 'poster']) {
          const value = $(element).attr(attr);
          if (value) {
            if ($(element).is('img, source') || attr === 'poster') localImageReferences++;
            isLocalAsset(value, from, origin, root, errors);
          }
        }
        const srcset = $(element).attr('srcset');
        if (srcset) srcset.split(',').forEach(candidate => {
          const value = candidate.trim().split(/\s+/)[0];
          if (value) { localImageReferences++; isLocalAsset(value, from, origin, root, errors); }
        });
        const style = $(element).attr('style');
        if (style) for (const match of style.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
          isLocalAsset(match[2], from, origin, root, errors);
        }
      });
    }
    if (entry.ext === '.css' || entry.ext === '.scss') {
      const from = `/${entry.relative}`;
      for (const match of entry.text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
        checkedCssReferences++;
        if (IMAGE_EXTENSIONS.has(path.extname(match[2].split(/[?#]/)[0]).toLowerCase())) localImageReferences++;
        isLocalAsset(match[2], from, origin, root, errors);
      }
    }
  }
  return { localImageReferences, checkedCssReferences };
}

function validateImages({ root, projectRoot, texts, errors, expectedImageFiles = null, expectedThemeImages = EXPECTED_THEME_IMAGES }) {
  const sourceImageRoot = path.join(projectRoot, 'source', 'images');
  const outputImageRoot = path.join(root, 'images');
  const sourceImages = fs.existsSync(sourceImageRoot)
    ? collectFiles(sourceImageRoot, errors).map(file => relativePath(sourceImageRoot, file)).sort()
    : [];
  const outputImages = fs.existsSync(outputImageRoot)
    ? collectFiles(outputImageRoot, errors).map(file => relativePath(outputImageRoot, file)).sort()
    : [];
  if (expectedImageFiles !== null && sourceImages.length !== expectedImageFiles) addError(errors, 'source_image_baseline_mismatch', 'source/images', sourceImages.length);
  const outputSet = new Set(outputImages);
  const missing = sourceImages.filter(file => !outputSet.has(file));
  if (missing.length) addError(errors, 'published_image_missing', 'images', missing.length);
  const sourceSet = new Set(sourceImages);
  const extra = outputImages.filter(file => !sourceSet.has(file));
  const unrecognized = extra.filter(file => !expectedThemeImages.has(file));
  if (unrecognized.length) addError(errors, 'unexpected_published_image', 'images', unrecognized.length);
  for (const expected of expectedThemeImages) {
    if (!outputSet.has(expected)) addError(errors, 'theme_image_missing', `images/${expected}`);
  }

  const photos = texts.find(item => item.relative === 'photos/index.html');
  if (!photos) addError(errors, 'photo_wall_page_missing', 'photos/index.html');
  let photoWallImages = 0;
  if (photos) {
    const $ = cheerio.load(photos.text);
    photoWallImages = $('.photo-wall-section .ig-card img').length;
    const songSample = FIXED_SAMPLES.find(sample => sample.id === 'song-encoded');
    const songFile = path.join(root, routeFile(songSample.route));
    if (!fs.existsSync(songFile)) addError(errors, 'fixed_song_article_missing', 'song-encoded');
    else {
      const song = cheerio.load(fs.readFileSync(songFile, 'utf8'));
      if (!song('article.post-content-single img').length) addError(errors, 'fixed_song_cover_missing', 'song-encoded');
    }
  }
  return { sourceImageFiles: sourceImages.length, publicImageFiles: outputImages.length, themeImageFiles: extra.length, photoWallImages };
}

function auditPublicOutput({ root, plan, baselineRecords, sourceRecords, projectRoot = PROJECT_ROOT, origin = 'https://progress01.github.io', expectedImageFiles = null, expectedThemeImages = EXPECTED_THEME_IMAGES }) {
  const outputRoot = path.resolve(root);
  const errors = [];
  const files = collectFiles(outputRoot, errors);
  const { inventory, texts } = inventoryAndReadText(outputRoot, files, errors);
  checkSourceCopies(outputRoot, files, errors);

  for (const entry of texts) {
    if (entry.ext === '.json' || entry.ext === '.webmanifest' || entry.ext === '.map') {
      try { JSON.parse(entry.text); } catch { addError(errors, 'json_parse_failed', entry.relative); }
    }
  }

  const baselineById = new Map((baselineRecords || []).filter(item => item?.id).map(item => [item.id, item]));
  const decisions = Array.isArray(plan?.records) ? plan.records : [];
  const originals = decisions.map(decision => baselineById.get(decision.id)?.content).filter(value => typeof value === 'string' && value.length);
  let oldTextHits = 0;
  let retiredIdHits = 0;
  const retiredIds = decisions.filter(item => item.decision === 'V').map(item => item.id);
  for (const entry of texts) {
    for (const original of originals) oldTextHits += countOccurrences(entry.text, original);
    for (const id of retiredIds) retiredIdHits += countOccurrences(entry.text, id);
  }
  if (oldTextHits) addError(errors, 'approved_private_fingerprint_in_output', '.', oldTextHits);
  if (retiredIdHits) addError(errors, 'retired_microblog_id_in_output', '.', retiredIdHits);

  const boundary = auditBoundary({ root: outputRoot, plan, baselineRecords, sourceRecords });
  for (const error of boundary.errors.filter(item => ![
    'old_text_in_output', 'retired_id_in_output', 'replacement_missing'
  ].includes(item.code))) errors.push(error);
  const microblog = validateMicroblog({ root: outputRoot, texts, plan, sourceRecords, baselineRecords, errors });
  const assets = validateAssetReferences({ root: outputRoot, texts, origin, errors });
  const images = validateImages({ root: outputRoot, projectRoot, texts, errors, expectedImageFiles, expectedThemeImages });

  return {
    ok: errors.length === 0,
    inventory,
    scannedTextFiles: texts.length,
    oldTextHits,
    retiredIdHits,
    replacementCount: decisions.filter(item => item.decision === 'D').length,
    replacementPresent: decisions.filter(item => item.decision === 'D').every(item =>
      texts.some(entry => entry.relative === 'microblog.json' && entry.text.includes(item.publicContent))
      && texts.some(entry => entry.relative === 'navigation-index.json' && entry.text.includes(item.publicContent))),
    microblog,
    assets,
    images,
    errors
  };
}

function formatReport(report) {
  const counts = report.inventory;
  const lines = [
    `${report.ok ? 'PASS' : 'FAIL'} public-output total=${counts.totalFiles} html=${counts.html} json=${counts.json} xml=${counts.xml} js=${counts.js} css=${counts.css} images=${counts.images} otherBinary=${counts.otherBinary}`,
    `decodedText=${counts.text} scannedText=${report.scannedTextFiles} oldTextHits=${report.oldTextHits} retiredIdHits=${report.retiredIdHits} dReplacements=${report.replacementCount} dReplacementOutputs=${report.replacementPresent ? 'present' : 'missing'}`,
    `microblog source=${report.microblog.sourceCount} public=${report.microblog.publicCount} navigation=${report.microblog.navigationCount}`,
    `images source=${report.images.sourceImageFiles} public=${report.images.publicImageFiles} theme=${report.images.themeImageFiles} photoWall=${report.images.photoWallImages} localReferences=${report.assets.localImageReferences} cssReferences=${report.assets.checkedCssReferences}`
  ];
  for (const error of report.errors) lines.push(`ERROR code=${error.code} path=${error.path} count=${error.count}`);
  return lines.join('\n');
}

function resolveRoot(args = process.argv.slice(2)) {
  const index = args.indexOf('--root');
  if (index >= 0) {
    if (!args[index + 1]) throw new Error('missing_root');
    return path.resolve(PROJECT_ROOT, args[index + 1]);
  }
  const config = yaml.load(fs.readFileSync(path.join(PROJECT_ROOT, '_config.yml'), 'utf8'));
  return path.resolve(PROJECT_ROOT, config.public_dir || 'public');
}

function runCli(args = process.argv.slice(2)) {
  try {
    const root = resolveRoot(args);
    const inputs = loadBoundaryInputs(PROJECT_ROOT);
    const report = auditPublicOutput({ root, ...inputs, projectRoot: PROJECT_ROOT, origin: configuredOrigin(PROJECT_ROOT) });
    console.log(formatReport(report));
    if (!report.ok) return 1;
    return 0;
  } catch {
    console.error('ERROR code=inputs_invalid path=tools/data/microblog-boundary-migration.v1.json count=1');
    return 1;
  }
}

if (require.main === module) process.exitCode = runCli();

module.exports = { auditPublicOutput, classifyFile, collectFiles, decodeText, formatReport, runCli, validateAssetReferences };
