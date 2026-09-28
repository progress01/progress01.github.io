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
  if (!Array.isArray(data?.surfaces) || data.surfaces.length !== 0) {
    errors.push(`${name}: surfaces 必須是刻意未完成的空陣列`);
  }
  if (parts.body.trim() !== '') errors.push(`${name}: 提示只能在 front matter 註解，正文必須為空`);
  if (/^\s*(?:thinking_status|thinking_updated|thinking_boundary)\s*:/m.test(parts.frontmatter)) {
    errors.push(`${name}: 不得有 active thinking placeholder`);
  }

  const comments = parts.frontmatter.split(/\r?\n/).filter(line => /^\s*#/.test(line)).join('\n');
  const semanticChecks = [
    ['public-boundary', /任何人.{0,25}直接網址閱讀/.test(comments)
      && /純宣洩/.test(comments) && /可辨識.{0,12}人事衝突/.test(comments)
      && /未公開專案/.test(comments) && /他人隱私/.test(comments)
      && /A\/B.{0,12}公開.{0,8}不是隱私/.test(comments)],
    ['surface-choice', /改為\s*\[memory\]/.test(comments)
      && /\[profile\]/.test(comments) && /\[profile, memory\]/.test(comments)
      && /profile.{0,12}工作與學習/.test(comments)
      && /memory.{0,12}個人記憶庫/.test(comments)
      && /同一文章.{0,8}同一 URL/.test(comments)],
    ['thinking-guidance', /僅探索中/.test(comments)
      && /取消下方三行註解/.test(comments)
      && /# thinking_status:\s*exploring/.test(comments)
      && /# thinking_updated:\s*YYYY-MM-DD/.test(comments)
      && /# thinking_boundary:.*非空適用邊界/.test(comments)
      && /成熟文章.{0,15}省略整組欄位/.test(comments)
      && /不填 stable\/published/.test(comments)],
    ['curation-guidance', /首頁策展選填/.test(comments)
      && /不代表自動列為 A 面代表作/.test(comments)]
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
