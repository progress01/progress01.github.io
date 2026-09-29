'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');
const cheerio = require('cheerio');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SURFACE_CHECKS = [
  ['content contract', 'tools/content-check.js', []],
  ['profile curation source', 'tools/profile-home-check.js', []],
  ['copy and one-article contract', 'tools/surface-copy-check.js', ['--root']],
  ['profile home output', 'tools/profile-page-output-check.js', ['--root']],
  ['profile article list', 'tools/profile-articles-output-check.js', ['--root']],
  ['surface switch', 'tools/surface-control-output-check.js', ['--root']],
  ['memory-to-profile bridge', 'tools/home-profile-bridge-output-check.js', ['--root']],
  ['context menu', 'tools/contextual-menu-output-check.js', ['--root']],
  ['article surface markers', 'tools/post-surface-output-check.js', ['--root']],
  ['thinking maturity output', 'tools/thinking-status-output-check.js', ['--root']],
  ['surface visual output', 'tools/surface-visual-check.js', ['--root']],
  ['surface transition', 'tools/surface-transition-check.js', ['--root']],
  ['surface accessibility', 'tools/surface-accessibility-check.js', ['--root']],
  ['surface responsive output', 'tools/surface-responsive-check.js', ['--root']],
  ['surface history', 'tools/surface-history-output-check.js', ['--root']],
  ['search surface and deduplication', 'tools/search-surface-output-check.js', ['--root']],
  ['memory random eligibility', 'tools/random-surface-output-check.js', ['positional-root']],
  ['public boundary', 'tools/public-boundary-check.js', ['--root']],
  ['generated site integrity', 'tools/site-check.js', ['--root']]
];

const FIXED = Object.freeze({
  profileArticle: {
    source: 'source/_posts/實驗室/工作知識-從實際抽象功能一-先從真實工作問出系統該做什麼.md',
    url: '/work/from-real-work-to-features/',
    surfaces: ['profile', 'memory'],
    category: '工作知識',
    date: '2026-09-17',
    updated: '2026-09-17',
    phrase: '真實工作情境'
  },
  song: {
    source: 'source/_posts/歌曲推薦/歌曲推薦-sailing back to you.md',
    url: '/2026/09/01/歌曲推薦/歌曲推薦-sailing%20back%20to%20you/',
    surfaces: ['memory'],
    category: '音樂',
    date: '2026-09-01',
    cover: '/images/song_sailing back to you.webp'
  },
  learning: {
    source: 'source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md',
    url: '/learning/website-quality-testing-roadmap/',
    surfaces: ['profile', 'memory'],
    date: '2026-09-04',
    updated: '2026-09-17',
    deskId: 'reading-topic-07',
    deskDate: '2026-09-04'
  },
  operations: { source: 'source/_posts/部落格改版規劃.md', url: '/2026/01/25/部落格改版規劃/', category: '站務', date: '2026-01-25', updated: '2026-09-17' },
  microblog: { id: 'micro-56bb6eec75c50bcd', date: '2026-09-13' },
  dual: {
    source: 'source/_posts/實驗室/工作知識-讓工具服務心流.md',
    url: '/work/flow-friendly-work-system/',
    surfaces: ['profile', 'memory'],
    date: '2026-05-28',
    updated: '2026-09-17'
  }
});

function issue(errors, code, file) { errors.push({ code, file }); }
function parsePost(root, file, errors) {
  const fullPath = path.join(root, ...file.split('/'));
  try {
    const text = fs.readFileSync(fullPath, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error('frontmatter_missing');
    return { metadata: yaml.load(match[1]) || {}, body: text.slice(match[0].length) };
  } catch {
    issue(errors, 'fixed_sample_source_unreadable', file);
    return { metadata: {}, body: '' };
  }
}
function readJson(file, label, errors) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { issue(errors, `${label}_unreadable`, path.basename(file)); return null; }
}
function isoDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value.slice(0, 10) : '';
}
function readPage(root, url, errors) {
  let decoded;
  try { decoded = decodeURIComponent(new URL(url, 'https://example.test').pathname); }
  catch { issue(errors, 'fixed_sample_url_invalid', url); return null; }
  const relative = decoded.replace(/^\/+/, '');
  const file = path.join(root, ...(relative ? relative.split('/') : []), 'index.html');
  try { return { file, html: fs.readFileSync(file, 'utf8') }; }
  catch { issue(errors, 'fixed_sample_page_missing', url); return null; }
}
function normalizedPath(url) {
  try { return decodeURIComponent(new URL(url, 'https://example.test').pathname); } catch { return ''; }
}
function byUrl(records, url) {
  const expected = normalizedPath(url);
  return records.filter(record => record?.kind === 'article' && normalizedPath(record.url) === expected);
}
function verifyArticleIdentity({ root, records, url, expectedSurfaces, expectedDate, errors }) {
  const matches = byUrl(records, url);
  if (matches.length !== 1) {
    issue(errors, 'fixed_sample_article_record_count_invalid', url);
    return null;
  }
  if (JSON.stringify(matches[0].surfaces) !== JSON.stringify(expectedSurfaces)) {
    issue(errors, 'fixed_sample_article_surface_invalid', url);
  }
  if (expectedDate && matches[0].date !== expectedDate) issue(errors, 'fixed_sample_article_date_invalid', url);
  const page = readPage(root, url, errors);
  if (!page) return matches[0];
  const $ = cheerio.load(page.html);
  const canonical = $('link[rel="canonical"]');
  if ($('article.post-content-single').length !== 1 || canonical.length !== 1) {
    issue(errors, 'fixed_sample_single_body_or_canonical_invalid', url);
  } else {
    let canonicalPath = '';
    try { canonicalPath = new URL(canonical.attr('href'), 'https://example.test').pathname; } catch {}
    if (decodeURIComponent(canonicalPath) !== decodeURIComponent(url)) issue(errors, 'fixed_sample_canonical_mismatch', url);
  }
  return matches[0];
}

function validateFixedSamples({ sourceRoot = PROJECT_ROOT, root } = {}) {
  const errors = [];
  if (!root) return { errors: [{ code: 'root_required', file: '--root' }], counts: {} };
  const outputRoot = path.resolve(root);
  const sourceBase = path.resolve(sourceRoot);
  const index = readJson(path.join(outputRoot, 'navigation-index.json'), 'navigation_index', errors);
  const random = readJson(path.join(outputRoot, 'random.json'), 'random', errors);
  const records = Array.isArray(index?.records) ? index.records : [];
  if (!Array.isArray(index?.records)) issue(errors, 'navigation_index_records_invalid', 'navigation-index.json');
  if (!Array.isArray(random)) issue(errors, 'random_records_invalid', 'random.json');

  const profile = parsePost(sourceBase, FIXED.profileArticle.source, errors);
  if (JSON.stringify(profile.metadata.surfaces) !== JSON.stringify(FIXED.profileArticle.surfaces)
      || !profile.metadata.categories?.includes(FIXED.profileArticle.category)
      || isoDate(profile.metadata.date) !== FIXED.profileArticle.date
      || isoDate(profile.metadata.updated) !== FIXED.profileArticle.updated
      || !profile.body.includes(FIXED.profileArticle.phrase)) issue(errors, 'profile_sample_source_contract_invalid', FIXED.profileArticle.source);
  const profileRecord = verifyArticleIdentity({ root: outputRoot, records, url: FIXED.profileArticle.url, expectedSurfaces: FIXED.profileArticle.surfaces, expectedDate: FIXED.profileArticle.date, errors });
  if (profileRecord && !String(profileRecord.text || '').includes(FIXED.profileArticle.phrase)) issue(errors, 'profile_sample_output_semantics_missing', FIXED.profileArticle.url);
  let profileHome;
  try { profileHome = yaml.load(fs.readFileSync(path.join(sourceBase, 'source/_data/profile-home.yml'), 'utf8')); } catch {}
  const curatedRefs = (profileHome?.paths || []).flatMap(item => item.items || []).filter(item => item.url === FIXED.profileArticle.url);
  if (curatedRefs.length !== 1) issue(errors, 'profile_sample_curation_reference_invalid', 'source/_data/profile-home.yml');

  const song = parsePost(sourceBase, FIXED.song.source, errors);
  if ((song.metadata.surfaces !== undefined && JSON.stringify(song.metadata.surfaces) !== JSON.stringify(FIXED.song.surfaces))
      || !song.metadata.categories?.includes(FIXED.song.category) || song.metadata.cover !== FIXED.song.cover
      || isoDate(song.metadata.date) !== FIXED.song.date) {
    issue(errors, 'song_sample_source_contract_invalid', FIXED.song.source);
  }
  const songRecord = verifyArticleIdentity({ root: outputRoot, records, url: FIXED.song.url, expectedSurfaces: FIXED.song.surfaces, expectedDate: FIXED.song.date, errors });
  if (songRecord && !songRecord.categories?.includes(FIXED.song.category)) issue(errors, 'song_sample_output_category_invalid', FIXED.song.url);
  const songOutput = readPage(outputRoot, FIXED.song.url, errors);
  if (songOutput) {
    const $ = cheerio.load(songOutput.html);
    if (!$(`img[src="${FIXED.song.cover}"]`).length) issue(errors, 'song_sample_cover_missing', FIXED.song.url);
  }
  const songRandomCount = Array.isArray(random) ? random.filter(item => normalizedPath(item?.url) === normalizedPath(FIXED.song.url)).length : 0;
  if (songRandomCount !== 1) issue(errors, 'song_sample_random_eligibility_invalid', 'random.json');

  const learning = parsePost(sourceBase, FIXED.learning.source, errors);
  if (JSON.stringify(learning.metadata.surfaces) !== JSON.stringify(FIXED.learning.surfaces)
      || learning.metadata.permalink !== FIXED.learning.url
      || isoDate(learning.metadata.date) !== FIXED.learning.date
      || isoDate(learning.metadata.updated) !== FIXED.learning.updated) issue(errors, 'learning_sample_source_contract_invalid', FIXED.learning.source);
  const learningRecord = verifyArticleIdentity({ root: outputRoot, records, url: FIXED.learning.url, expectedSurfaces: FIXED.learning.surfaces, expectedDate: FIXED.learning.date, errors });
  if (learningRecord) {
    const events = learningRecord.events || [];
    if (!learningRecord.sources?.includes('learning')
        || !events.some(event => event.kind === 'learning-added' && event.sourceId === FIXED.learning.deskId && isoDate(event.date) === FIXED.learning.deskDate)
        || !events.some(event => event.kind === 'published' && isoDate(event.date) === '2026-09-04')) {
      issue(errors, 'learning_sample_events_or_dates_invalid', FIXED.learning.url);
    }
  }
  let desk;
  try { desk = yaml.load(fs.readFileSync(path.join(sourceBase, 'source/reading-desk.yml'), 'utf8')); } catch {}
  const deskItems = (desk?.topics || []).flatMap(topic => topic.items || []).filter(item => item.id === FIXED.learning.deskId);
  if (deskItems.length !== 1 || deskItems[0].url !== FIXED.learning.url || isoDate(deskItems[0].date) !== FIXED.learning.deskDate) {
    issue(errors, 'learning_sample_desk_reference_invalid', 'source/reading-desk.yml');
  }
  const profileArticlePage = readPage(outputRoot, '/profile/articles/', errors);
  if (profileArticlePage && cheerio.load(profileArticlePage.html)('[data-profile-article-list] .profile-list-link[href="/learning/website-quality-testing-roadmap/"]').length !== 1) {
    issue(errors, 'learning_sample_profile_reference_invalid', '/profile/articles/');
  }

  const operations = parsePost(sourceBase, FIXED.operations.source, errors);
  if (!operations.metadata.categories?.includes(FIXED.operations.category)
      || isoDate(operations.metadata.date) !== FIXED.operations.date
      || isoDate(operations.metadata.updated) !== FIXED.operations.updated) issue(errors, 'operations_sample_source_contract_invalid', FIXED.operations.source);
  verifyArticleIdentity({ root: outputRoot, records, url: FIXED.operations.url, expectedSurfaces: ['memory'], expectedDate: FIXED.operations.date, errors });
  if (Array.isArray(random) && random.some(item => normalizedPath(item?.url) === normalizedPath(FIXED.operations.url))) issue(errors, 'operations_sample_random_exclusion_invalid', 'random.json');

  const dual = parsePost(sourceBase, FIXED.dual.source, errors);
  if (JSON.stringify(dual.metadata.surfaces) !== JSON.stringify(FIXED.dual.surfaces)
      || isoDate(dual.metadata.date) !== FIXED.dual.date
      || isoDate(dual.metadata.updated) !== FIXED.dual.updated) issue(errors, 'dual_sample_source_contract_invalid', FIXED.dual.source);
  verifyArticleIdentity({ root: outputRoot, records, url: FIXED.dual.url, expectedSurfaces: FIXED.dual.surfaces, expectedDate: FIXED.dual.date, errors });
  if (Array.isArray(random) && random.filter(item => normalizedPath(item?.url) === normalizedPath(FIXED.dual.url)).length !== 1) {
    issue(errors, 'dual_sample_random_eligibility_invalid', 'random.json');
  }

  let microblog;
  try { microblog = JSON.parse(fs.readFileSync(path.join(sourceBase, 'source/microblog.json'), 'utf8')); } catch {}
  const publicMicroblog = readJson(path.join(outputRoot, 'microblog.json'), 'public_microblog', errors);
  const sourceEntries = Array.isArray(microblog) ? microblog.filter(item => item.id === FIXED.microblog.id) : [];
  const indexedEntries = records.filter(record => record?.kind === 'microblog' && record.id === FIXED.microblog.id);
  const publicEntries = Array.isArray(publicMicroblog) ? publicMicroblog.filter(item => item.id === FIXED.microblog.id) : [];
  const statusPage = readPage(outputRoot, '/status/', errors);
  if (sourceEntries.length !== 1 || sourceEntries[0].date !== FIXED.microblog.date
      || indexedEntries.length !== 1 || indexedEntries[0].url !== '/status/' || indexedEntries[0].dateKind !== 'recorded'
      || publicEntries.length !== 1 || publicEntries[0].date !== FIXED.microblog.date
      || (statusPage && (!statusPage.html.includes("fetch('/microblog.json')") || !statusPage.html.includes('location.hash')))) {
    issue(errors, 'microblog_sample_id_anchor_or_date_invalid', 'source/microblog.json');
  }

  return {
    errors,
    counts: {
      fixedArticles: 5,
      fixedArticleRecords: [FIXED.profileArticle.url, FIXED.song.url, FIXED.learning.url, FIXED.operations.url, FIXED.dual.url]
        .reduce((sum, url) => sum + byUrl(records, url).length, 0),
      fixedMicroblogs: indexedEntries.length,
      songRandom: songRandomCount
    }
  };
}

function parseArgs(args) {
  const value = name => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : null;
  };
  const sourceRoot = path.resolve(value('--source-root') || PROJECT_ROOT);
  const rootArg = value('--root');
  if (!rootArg) throw new Error('missing_root');
  const root = path.resolve(rootArg);
  const tmpRoot = path.join(PROJECT_ROOT, 'tmp') + path.sep;
  const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep;
  if (!normalizedRoot.toLowerCase().startsWith(tmpRoot.toLowerCase())) throw new Error('root_must_be_isolated_under_tmp');
  if (root.toLowerCase() === path.join(PROJECT_ROOT, 'public').toLowerCase()) throw new Error('formal_public_forbidden');
  return { sourceRoot, root };
}

function runCli(args = process.argv.slice(2)) {
  let config;
  try { config = parseArgs(args); }
  catch (error) {
    console.error(`surface-target-regression argument error: ${error.message}`);
    return 2;
  }
  let failed = false;
  for (const [label, script, options] of SURFACE_CHECKS) {
    const argsForCheck = [path.join(PROJECT_ROOT, script)];
    if (options.includes('--root')) argsForCheck.push('--root', config.root, '--source-root', config.sourceRoot);
    else if (options.includes('positional-root')) argsForCheck.push(config.root);
    const result = spawnSync(process.execPath, argsForCheck, { cwd: PROJECT_ROOT, encoding: 'utf8', windowsHide: true });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error || result.status !== 0) {
      failed = true;
      console.error(`[FAIL] ${label}: exit=${result.status ?? 'spawn-error'}`);
    } else console.log(`[PASS] ${label}`);
  }
  const fixed = validateFixedSamples(config);
  if (fixed.errors.length) {
    failed = true;
    fixed.errors.forEach(error => console.error(`[FAIL] fixed samples ${error.code} path=${error.file}`));
  } else {
    console.log(`[PASS] WBS 0.2 fixed samples: ${fixed.counts.fixedArticleRecords}/5 unique article records; microblog ${fixed.counts.fixedMicroblogs}/1; song random ${fixed.counts.songRandom}/1`);
  }
  return failed ? 1 : 0;
}

if (require.main === module) process.exitCode = runCli();
module.exports = { FIXED, SURFACE_CHECKS, validateFixedSamples, parseArgs, runCli };
