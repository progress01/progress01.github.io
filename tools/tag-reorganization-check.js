'use strict';

// 日常文章檢查：標籤必須屬於目前登錄的主標籤或相容別名，每篇最多兩個且不可重複。
// 日期、分類與文章欄位格式由 check:content 檢查，網址由既有網站／SEO 驗證檢查；歷史快照另用 check:tag-snapshot。
const fs = require('fs');
const path = require('path');
const frontMatter = require('hexo-front-matter');
const { loadTaxonomy } = require('../scripts/tag-taxonomy');

const ROOT = path.resolve(__dirname, '..');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const current = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(current) : entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [current] : [];
  });
}

function list(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

function checkArticleTags({ root = ROOT } = {}) {
  const errors = [];
  let taxonomy;
  try {
    taxonomy = loadTaxonomy(path.join(root, 'source', '_data', 'content-tags.yml'));
    errors.push(...taxonomy.errors);
  } catch (error) {
    return { errors: [`content-tags.yml 無法讀取：${error.message}`], articles: 0 };
  }

  const postsRoot = path.join(root, 'source', '_posts');
  if (!fs.existsSync(postsRoot)) return { errors: ['找不到 source/_posts 文章目錄。'], articles: 0 };
  const files = walk(postsRoot);
  files.forEach(file => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    let parsed;
    try { parsed = frontMatter.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { errors.push(`${relative} 的 front matter 無法解析：${error.message}`); return; }
    const tags = list(parsed.tags);
    if (tags.length > 2) errors.push(`${relative} 的 tags 超過 2 個。`);
    const seen = new Set();
    tags.forEach(tagValue => {
      const tag = typeof tagValue === 'string' ? tagValue.trim() : '';
      if (!tag) { errors.push(`${relative} 含有空白或非文字標籤。`); return; }
      if (seen.has(tag)) errors.push(`${relative} 的 tags 有重複標籤「${tag}」。`);
      seen.add(tag);
      if (!taxonomy.aliases.has(tag)) errors.push(`${relative} 使用未註冊標籤「${tag}」，請改用已登錄主標籤，或在 content-tags.yml 登錄相容別名。`);
    });
  });
  return { errors, articles: files.length };
}

if (require.main === module) {
  const result = checkArticleTags();
  if (result.errors.length) {
    console.error('文章標籤檢查失敗：\n' + result.errors.map(error => '- ' + error).join('\n'));
    process.exitCode = 1;
  } else console.log(`文章標籤檢查通過：${result.articles} 篇文章的標籤合法。`);
}

module.exports = { checkArticleTags };
