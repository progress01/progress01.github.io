'use strict';

// 驗證逐篇標籤重整清單與目前來源是否一致，並確認正文、分類、日期與 permalink 未被重寫。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const frontMatter = require('hexo-front-matter');
const { loadTaxonomy } = require('../scripts/tag-taxonomy');

const ROOT = path.resolve(__dirname, '..');
const POSTS_ROOT = path.join(ROOT, 'source', '_posts');
const REPORT_PATH = path.join(ROOT, 'docs', 'tag-reorganization-review.json');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const current = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(current) : entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [current] : [];
  });
}
function list(value) { return value == null ? [] : Array.isArray(value) ? value.map(String) : [String(value)]; }
function bodyOf(raw) { return raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim(); }
function frontmatterBlock(raw) { return raw.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/)?.[0] || ''; }
function frontmatterScalar(raw, key) {
  const match = frontmatterBlock(raw).match(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm'));
  if (!match) return null;
  const value = match[1].trim();
  return value === '' || value === 'null' || value === '~' ? null : value;
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function relative(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function publicPost(parsed) { return parsed.published !== false && parsed.draft !== true; }

function checkTagReorganization({ root = ROOT } = {}) {
  const errors = []; const reportPath = path.join(root, 'docs', 'tag-reorganization-review.json');
  if (!fs.existsSync(reportPath)) return { errors: ['找不到逐篇標籤重整清單。'], entries: [] };
  let report;
  try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); }
  catch (error) { return { errors: [`逐篇標籤重整清單不是有效 JSON：${error.message}`], entries: [] }; }
  const entries = Array.isArray(report.entries) ? report.entries : [];
  const files = walk(path.join(root, 'source', '_posts'));
  const publicFiles = files.filter(file => publicPost(frontMatter.parse(fs.readFileSync(file, 'utf8'))));
  if (report.publicArticleCount !== publicFiles.length) errors.push(`清單文章數 ${report.publicArticleCount} 與公開文章數 ${publicFiles.length} 不一致。`);
  if (entries.length !== publicFiles.length) errors.push(`清單項目數 ${entries.length} 與公開文章數 ${publicFiles.length} 不一致。`);
  if (entries.filter(entry => entry.uncertain).length > 5) errors.push('不確定案例超過 5 篇，應先縮小批次重新判讀。');
  const taxonomy = loadTaxonomy(path.join(root, 'source', '_data', 'content-tags.yml'));
  errors.push(...taxonomy.errors);
  const seen = new Set();
  entries.forEach(entry => {
    const label = entry.path || '(未命名)';
    if (seen.has(label)) errors.push(`逐篇清單路徑重複：${label}`);
    seen.add(label);
    if (entry.reviewed !== true) errors.push(`${label} 沒有標示 reviewed=true。`);
    if (!Array.isArray(entry.newTags) || entry.newTags.length > 2) errors.push(`${label} 的 newTags 必須是 0～2 個。`);
    (entry.newTags || []).forEach(tag => { if (!taxonomy.canonicalNames.has(tag)) errors.push(`${label} 使用未註冊主標籤：${tag}`); });
    const file = path.join(root, label);
    if (!fs.existsSync(file)) { errors.push(`逐篇清單找不到來源文章：${label}`); return; }
    const raw = fs.readFileSync(file, 'utf8'); const parsed = frontMatter.parse(raw);
    if (JSON.stringify(list(parsed.categories)) !== JSON.stringify(list(entry.categories))) errors.push(`${label} 的 categories 與清單不一致。`);
    if (frontmatterScalar(raw, 'date') !== (entry.date || null)) errors.push(`${label} 的 date 與清單不一致。`);
    if (frontmatterScalar(raw, 'updated') !== (entry.updated || null)) errors.push(`${label} 的 updated 與清單不一致。`);
    if ((parsed.permalink || null) !== (entry.permalink || null)) errors.push(`${label} 的 permalink 與清單不一致。`);
    if (JSON.stringify(list(parsed.tags)) !== JSON.stringify(entry.newTags || [])) errors.push(`${label} 的 tags 與清單不一致。`);
    if (hash(bodyOf(raw)) !== entry.bodySha256) errors.push(`${label} 正文雜湊改變。`);
  });
  publicFiles.forEach(file => { if (!seen.has(relative(file))) errors.push(`公開文章未列入逐篇清單：${relative(file)}`); });
  return { errors, entries };
}

if (require.main === module) {
  const result = checkTagReorganization();
  if (result.errors.length) { console.error('標籤重整檢查失敗：\n' + result.errors.map(error => '- ' + error).join('\n')); process.exitCode = 1; }
  else console.log(`標籤重整檢查通過：${result.entries.length} 篇公開文章、${result.entries.filter(entry => entry.uncertain).length} 篇不確定案例；正文與網址快照一致。`);
}

module.exports = { checkTagReorganization, bodyOf };
