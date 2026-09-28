'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');

const CONFIG_PATH = 'source/_data/surface-navigation.yml';
const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const EXPECTED = Object.freeze({
  memory: Object.freeze({ target: 'profile', href: '/', label: 'SIDE A／看工作與學習' }),
  profile: Object.freeze({ target: 'memory', href: '/memory/', label: 'SIDE B／翻到個人記憶庫' })
});
const PAGES = Object.freeze([
  Object.freeze({ file: 'index.html', surface: 'profile', contentSelector: '.profile-home' }),
  Object.freeze({ file: 'profile/index.html', surface: 'profile', contentSelector: '.profile-home' }),
  Object.freeze({ file: 'profile/articles/index.html', surface: 'profile', contentSelector: '.profile-home' }),
  Object.freeze({ file: 'memory/index.html', surface: 'memory', contentSelector: '.home-landing, .home-legacy-archive-notice' })
]);

function diagnostic(code, file = CONFIG_PATH) {
  return { code, path: file };
}

function validateConfig(config) {
  const errors = [];
  if (!config || config.version !== 1 || !config.controls || typeof config.controls !== 'object') {
    return [diagnostic('surface_control_config_invalid')];
  }
  const actualKeys = Object.keys(config.controls).sort();
  if (actualKeys.join(',') !== Object.keys(EXPECTED).sort().join(',')) {
    errors.push(diagnostic('surface_control_keys_invalid'));
  }
  for (const [surface, expected] of Object.entries(EXPECTED)) {
    const actual = config.controls[surface];
    if (!actual || actual.target !== expected.target || actual.href !== expected.href || actual.label !== expected.label) {
      errors.push(diagnostic('surface_control_value_invalid', `${CONFIG_PATH}#controls.${surface}`));
    }
  }
  return errors;
}

function validatePage(html, page) {
  const errors = [];
  const expected = EXPECTED[page.surface];
  const $ = cheerio.load(html);
  const controls = $('.surface-switch');
  if (controls.length !== 1) {
    errors.push(diagnostic('surface_control_count_invalid', page.file));
    return errors;
  }
  const control = controls.first();
  const links = control.children('a.surface-switch-link');
  if (control.attr('aria-label') !== '雙面導覽'
      || control.attr('data-current-surface') !== page.surface) {
    errors.push(diagnostic('surface_control_semantics_invalid', page.file));
  }
  if (links.length !== 1 || links.attr('href') !== expected.href
      || links.attr('data-target-surface') !== expected.target
      || links.text().trim() !== expected.label) {
    errors.push(diagnostic('surface_control_link_invalid', page.file));
  }
  const cassette = links.children('.surface-switch-cassette');
  if (links.children('.surface-switch-current-side').length !== 0
      || cassette.length !== 1 || cassette.attr('aria-hidden') !== 'true') {
    errors.push(diagnostic('surface_control_decoration_invalid', page.file));
  }
  if (links.length && cassette.length) {
    const sourceRoot = links.clone();
    sourceRoot.children('[aria-hidden="true"]').remove();
    if (sourceRoot.text().trim() !== expected.label) errors.push(diagnostic('surface_control_accessible_copy_invalid', page.file));
  }
  const unsafeAttribute = links.length && Object.keys(links[0].attribs || {}).some(name => /^on/i.test(name));
  if (control.find('script').length || unsafeAttribute) {
    errors.push(diagnostic('surface_control_script_dependency', page.file));
  }
  const mainInner = control.parent('.main-inner');
  const content = mainInner.find(page.contentSelector).first();
  if (mainInner.length !== 1 || content.length !== 1 || control.index() >= content.index()) {
    errors.push(diagnostic('surface_control_position_invalid', page.file));
  }
  return errors;
}

function validateSurfaceControls({ root, sourceRoot = DEFAULT_SOURCE_ROOT, config, pages } = {}) {
  const errors = [];
  if (!config) {
    try { config = yaml.load(fs.readFileSync(path.join(sourceRoot, CONFIG_PATH), 'utf8')); }
    catch { return { errors: [diagnostic('surface_control_config_unreadable')], pageCount: 0 }; }
  }
  errors.push(...validateConfig(config));
  let pageCount = 0;
  for (const page of PAGES) {
    let html = pages && pages[page.file];
    if (html === undefined) {
      try { html = fs.readFileSync(path.join(root, ...page.file.split('/')), 'utf8'); }
      catch {
        errors.push(diagnostic('surface_control_page_unreadable', page.file));
        continue;
      }
    }
    errors.push(...validatePage(html, page));
    pageCount += 1;
  }
  return { errors, pageCount };
}

function formatDiagnostics(result) {
  return result.errors.map(error => `${error.code} path=${error.path}`);
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('surface-control 檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex !== -1 && args[sourceRootIndex + 1]
    ? path.resolve(args[sourceRootIndex + 1])
    : DEFAULT_SOURCE_ROOT;
  const result = validateSurfaceControls({ root: path.resolve(args[rootIndex + 1]), sourceRoot });
  if (result.errors.length) {
    console.error('surface-control 輸出檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(`surface-control 輸出檢查通過：${result.pageCount} pages。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { validateSurfaceControls, formatDiagnostics, runCli };
