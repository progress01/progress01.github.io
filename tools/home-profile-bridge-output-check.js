'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = 'source/_data/surface-navigation.yml';
const HOME_PATH = 'memory/index.html';
const EXPECTED_COPY = Object.freeze({
  label: 'SIDE A',
  title: '工作與學習',
  description: '看整理過的經驗與方法',
  action: '翻到 A 面 ↗'
});

function diagnostic(code, file = HOME_PATH) {
  return { code, path: file };
}

function validateHome(html, memoryControl) {
  const errors = [];
  const $ = cheerio.load(html);
  const landings = $('.home-landing');
  const bridges = $('.home-profile-bridge');
  if (landings.length !== 1 || bridges.length !== 1) {
    errors.push(diagnostic('home_profile_bridge_count_invalid'));
    return errors;
  }

  const landing = landings.first();
  const bridge = bridges.first();
  const entries = landing.children('.home-landing-entry-grid');
  const outro = landing.children('.home-outro');
  const random = landing.children('.home-random-feature');
  if (entries.length !== 1 || outro.length !== 1 || random.length !== 1
      || entries.children('.home-landing-entry').length !== 4
      || !(random.index() < entries.index() && entries.index() < bridge.index() && bridge.index() < outro.index())) {
    errors.push(diagnostic('home_profile_bridge_position_invalid'));
  }

  const label = bridge.children('.home-profile-bridge-label');
  const title = bridge.children('h2#home-profile-bridge-title');
  const description = bridge.children('p');
  const links = bridge.children('a');
  if (label.length !== 1 || label.text().trim() !== EXPECTED_COPY.label
      || title.length !== 1 || title.text().trim() !== EXPECTED_COPY.title
      || description.length !== 1 || description.text().trim() !== EXPECTED_COPY.description
      || links.length !== 1 || links.text().trim() !== EXPECTED_COPY.action) {
    errors.push(diagnostic('home_profile_bridge_copy_invalid'));
  }
  if (bridge.attr('aria-labelledby') !== 'home-profile-bridge-title'
      || links.attr('href') !== memoryControl?.href
      || links.attr('data-target-surface') !== memoryControl?.target
      || links.attr('aria-label') !== memoryControl?.label) {
    errors.push(diagnostic('home_profile_bridge_link_invalid'));
  }
  const unsafeAttribute = links.length && Object.keys(links[0].attribs || {}).some(name => /^on/i.test(name));
  if (bridge.find('script').length || unsafeAttribute || links.attr('href') !== '/') {
    errors.push(diagnostic('home_profile_bridge_script_dependency'));
  }
  return errors;
}

function walkHtmlFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walkHtmlFiles(file, files);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(file);
  }
  return files;
}

function validateHomeProfileBridge({ root, sourceRoot = DEFAULT_SOURCE_ROOT, html, memoryControl, otherHtml } = {}) {
  if (!memoryControl) {
    try {
      const config = yaml.load(fs.readFileSync(path.join(sourceRoot, CONFIG_PATH), 'utf8'));
      memoryControl = config?.controls?.memory;
    } catch {
      return { errors: [diagnostic('home_profile_bridge_config_unreadable', CONFIG_PATH)] };
    }
  }
  if (html === undefined) {
    try { html = fs.readFileSync(path.join(root, HOME_PATH), 'utf8'); }
    catch { return { errors: [diagnostic('home_profile_bridge_home_unreadable')] }; }
  }
  const errors = validateHome(html, memoryControl);
  if (otherHtml === undefined && root) {
    otherHtml = [];
    for (const file of walkHtmlFiles(root)) {
      if (path.relative(root, file).split(path.sep).join('/') === HOME_PATH) continue;
      try { otherHtml.push(fs.readFileSync(file, 'utf8')); }
      catch { errors.push(diagnostic('home_profile_bridge_scan_unreadable', path.relative(root, file).split(path.sep).join('/'))); }
    }
  }
  if (Array.isArray(otherHtml) && otherHtml.some(page => /class="home-profile-bridge"/.test(page))) {
    errors.push(diagnostic('home_profile_bridge_outside_home'));
  }
  return { errors };
}

function formatDiagnostics(result) {
  return result.errors.map(error => `${error.code} path=${error.path}`);
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1 || !args[rootIndex + 1]) {
    console.error('首頁 A 面橋接輸出檢查需要明確指定 --root <generated-public-directory>。');
    return 2;
  }
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex !== -1 && args[sourceRootIndex + 1]
    ? path.resolve(args[sourceRootIndex + 1])
    : DEFAULT_SOURCE_ROOT;
  const result = validateHomeProfileBridge({ root: path.resolve(args[rootIndex + 1]), sourceRoot });
  if (result.errors.length) {
    console.error('首頁 A 面橋接輸出檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log('首頁 A 面橋接輸出檢查通過：1 bridge，位於 4 個入口之後與收尾線稿之前。');
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { validateHomeProfileBridge, formatDiagnostics, runCli };
