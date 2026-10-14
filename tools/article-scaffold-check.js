'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PAGE_TEMPLATE = '---\r\ntitle: {{ title }}\r\ndate: {{ date }}\r\n---\r\n';

function splitTemplate(text) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

function checkArticleTemplate(name, text, expectedKeys, hasDate) {
  const errors = [];
  const parts = splitTemplate(text);
  if (!parts) return [`${name}: front matter 或正文分隔格式錯誤`];

  const parseableFrontmatter = parts.frontmatter
    .replace(/^title: \{\{ title \}\}$/m, "title: 'Template title'")
    .replace(/^date: \{\{ date \}\}$/m, "date: '2026-09-27'");
  let data;
  try {
    data = yaml.load(parseableFrontmatter);
  } catch (error) {
    errors.push(`${name}: YAML 無法解析 (${error.message})`);
    return errors;
  }

  const keys = Object.keys(data || {});
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    errors.push(`${name}: active 欄位須依序為 ${expectedKeys.join(', ')}`);
  }
  if (!/^title: \{\{ title \}\}$/m.test(parts.frontmatter) || data?.title !== 'Template title') {
    errors.push(`${name}: title scaffold placeholder 不符`);
  }
  if (hasDate && (!/^date: \{\{ date \}\}$/m.test(parts.frontmatter) || data?.date !== '2026-09-27')) {
    errors.push(`${name}: date scaffold placeholder 不符`);
  }
  if (data?.tags !== null) errors.push(`${name}: tags 欄位形狀須保留空值`);
  if (!Array.isArray(data?.surfaces) || data.surfaces.length !== 1 || data.surfaces[0] !== 'memory') {
    errors.push(`${name}: 新文章必須預設只放 B 面，surfaces 為 [memory]`);
  }
  if (parts.body.trim() !== '') errors.push(`${name}: 提示只能在 front matter 註解，正文必須為空`);
  if (/^\s*(?:thinking_status|thinking_updated|thinking_boundary)\s*:/m.test(parts.frontmatter)) {
    errors.push(`${name}: 不得有 active thinking placeholder`);
  }

  const comments = parts.frontmatter.split(/\r?\n/).filter(line => /^\s*#/.test(line)).join('\n');
  const semanticChecks = [
    ['public-boundary', /發布前確認/.test(comments) && /私人或未公開資料/.test(comments)
      && /A\/B.{0,12}公開入口/.test(comments)],
    ['memory-first', /新文章先放 B 面/.test(comments) && /整理好且作者確認/.test(comments)
      && /再加入 A 面/.test(comments) && /\[profile, memory\]/.test(comments)
      && /同一文章.{0,8}同一 URL/.test(comments)]
  ];
  for (const [code, passed] of semanticChecks) {
    if (!passed) errors.push(`${name}: 缺少必要註解 ${code}`);
  }

  if (/A版|B版|A\/B兩份|A\/B versions|duplicate-post|第二篇文章/i.test(text)) {
    errors.push(`${name}: 不得建立 A/B 文章副本提示`);
  }
  return errors;
}

function validateArticleScaffolds(templates) {
  const errors = [];
  errors.push(...checkArticleTemplate('post.md', templates.post, ['title', 'date', 'tags', 'surfaces'], true));
  errors.push(...checkArticleTemplate('draft.md', templates.draft, ['title', 'tags', 'surfaces'], false));

  const page = String(templates.page);
  if (page !== PAGE_TEMPLATE) errors.push('page.md: 固定功能頁 scaffold 必須維持原始位元組內容');
  const pageParts = splitTemplate(page);
  if (!pageParts) {
    errors.push('page.md: front matter 格式錯誤');
  } else {
    let data;
    try { data = yaml.load(pageParts.frontmatter); }
    catch (error) { errors.push(`page.md: YAML 無法解析 (${error.message})`); }
    if (data && ['surfaces', 'thinking_status', 'thinking_updated', 'thinking_boundary'].some(key => Object.hasOwn(data, key))) {
      errors.push('page.md: 固定功能頁不得加入文章面向或成熟度欄位');
    }
  }
  return errors;
}

function main() {
  const templates = Object.fromEntries(['post', 'draft', 'page'].map(name => [
    name,
    fs.readFileSync(path.join(PROJECT_ROOT, 'scaffolds', `${name}.md`), 'utf8')
  ]));
  const errors = validateArticleScaffolds(templates);
  if (errors.length) {
    console.error(`Article scaffold check failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('Article scaffold check passed: post/draft fields and comments are valid; page.md is unchanged.');
}

if (require.main === module) main();

module.exports = { PAGE_TEMPLATE, splitTemplate, validateArticleScaffolds };
