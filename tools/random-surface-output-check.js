'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cheerio = require('cheerio');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function routeFile(url) {
  const pathname = new URL(url, 'https://example.test').pathname;
  return path.join(...pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean), 'index.html');
}

function validateRandomSurfaceOutput(root) {
  const errors = [];
  const randomFile = path.join(root, 'random.json');
  const indexFile = path.join(root, 'navigation-index.json');
  let random, index;
  try { random = readJson(randomFile); } catch { errors.push('random_json_unreadable'); }
  try { index = readJson(indexFile); } catch { errors.push('navigation_index_unreadable'); }
  if (!Array.isArray(random) || !index || !Array.isArray(index.records)) return { errors, counts: {} };

  const expected = index.records.filter(record => record.kind === 'article' &&
    Array.isArray(record.surfaces) && record.surfaces.includes('memory') &&
    !record.categories.includes('站務'));
  const actualUrls = random.map(record => record && record.url);
  const expectedUrls = expected.map(record => record.url);
  if (new Set(actualUrls).size !== actualUrls.length) errors.push('random_urls_not_unique');
  if (actualUrls.some(url => typeof url !== 'string' || !url.startsWith('/'))) errors.push('random_url_invalid');
  if (JSON.stringify([...actualUrls].sort()) !== JSON.stringify([...expectedUrls].sort())) {
    errors.push('random_set_mismatch');
  }
  if (random.some(record => Object.hasOwn(record || {}, 'surfaces'))) errors.push('random_schema_contains_surfaces');

  const byUrl = new Map(expected.map(record => [record.url, record]));
  const profileOnly = index.records.filter(record => record.kind === 'article' &&
    Array.isArray(record.surfaces) && !record.surfaces.includes('memory'));
  if (profileOnly.some(record => actualUrls.includes(record.url))) errors.push('profile_only_in_random');
  const dual = expected.filter(record => record.surfaces.includes('profile'));
  if (dual.some(record => actualUrls.filter(url => url === record.url).length !== 1)) errors.push('dual_article_not_single');
  for (const record of random) {
    if (!byUrl.has(record.url)) errors.push('random_record_without_memory_article:' + record.url);
  }

  const homeFile = path.join(root, 'memory', 'index.html');
  const randomPageFile = path.join(root, routeFile('/random/'));
  let home = '', randomPage = '';
  try { home = fs.readFileSync(homeFile, 'utf8'); } catch { errors.push('home_output_unreadable'); }
  try { randomPage = fs.readFileSync(randomPageFile, 'utf8'); } catch { errors.push('random_page_output_unreadable'); }
  if (!home.includes("fetch('/random.json')")) errors.push('home_random_json_wiring_missing');
  if (!randomPage.includes("fetch(dataUrl)") || !randomPage.includes("var dataUrl = '/random.json'")) {
    errors.push('random_page_json_wiring_missing');
  }
  if (!randomPage.includes('random-tape-selection-v1') || !randomPage.includes('restoreSelection()')) {
    errors.push('random_page_state_wiring_missing');
  }
  const $ = cheerio.load(randomPage);
  const randomScript = $('script').toArray().map(element => $(element).text())
    .find(script => script.includes("var dataUrl = '/random.json'"));
  if (!randomScript) errors.push('random_page_script_missing');
  else {
    try { new vm.Script(randomScript); }
    catch (error) { errors.push('random_page_script_syntax_invalid:' + error.message); }
  }

  return {
    errors,
    counts: { randomRecords: random.length, expectedMemoryArticles: expected.length,
      profileOnlyArticles: profileOnly.length, dualSurfaceArticles: dual.length }
  };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || 'public');
  const result = validateRandomSurfaceOutput(root);
  if (result.errors.length) {
    console.error('random-surface-check failed:', result.errors.join(', '));
    process.exitCode = 1;
  } else {
    console.log(`random-surface-check passed: ${result.counts.randomRecords} random records, ` +
      `${result.counts.profileOnlyArticles} profile-only excluded, ${result.counts.dualSurfaceArticles} dual-surface articles retained`);
  }
}

module.exports = { validateRandomSurfaceOutput };
