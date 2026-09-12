// 將歷史文章與新增文章的標籤統一成少量、可長期維護的主標籤。
// 文章 front matter 已整理為主標籤；建置時仍再次正規化，避免快取造成舊標籤殘留。

const { parse } = require('hexo-front-matter');
const path = require('path');
const { loadTaxonomy } = require('./tag-taxonomy');

const TAG_ALIASES = loadTaxonomy().aliases;

function loadAliases(baseDir = path.resolve(__dirname, '..')) {
  return loadTaxonomy(path.join(baseDir, 'source', '_data', 'content-tags.yml')).aliases;
}

function getTagNames(tags) {
  if (!tags) return [];

  const values = typeof tags.toArray === 'function' ? tags.toArray() : tags;
  const list = Array.isArray(values) ? values : [values];

  return list.map(tag => {
    if (tag && typeof tag === 'object' && tag.name) return String(tag.name).trim();
    return String(tag || '').trim();
  }).filter(Boolean);
}

function getCanonicalTags(tags, aliases = TAG_ALIASES) {
  const normalized = [];

  getTagNames(tags).forEach(tag => {
    const canonical = aliases instanceof Map ? aliases.get(tag) : Object.hasOwn(aliases, tag) ? aliases[tag] : undefined;
    if (canonical && !normalized.includes(canonical)) normalized.push(canonical);
  });

  return normalized;
}

// Hexo 的 tags 是由 PostTag 關聯表建立，必須在 generate 前更新關聯，
// 才能同時影響文章上的標籤連結、site.tags 數量和標籤文章列表。
if (typeof hexo !== 'undefined' && hexo.extend?.filter) hexo.extend.filter.register('before_generate', function() {
  // Reload on every generation so a newly registered tag is usable in a
  // long-running Hexo server without restarting the process.
  const aliases = loadAliases(hexo.base_dir || process.cwd());
  const posts = this.locals.get('posts').toArray();
  return posts.reduce((promise, post) => promise.then(() => {
    // 以文章原始 front matter 為準；資料庫中的關聯可能因舊文章更新而尚未完整。
    let sourceTags;
    try {
      sourceTags = parse(post.raw || '').tags;
    } catch (error) {
      sourceTags = post.tags;
    }
    return post.setTags(getCanonicalTags(sourceTags == null ? post.tags : sourceTags, aliases));
  }), Promise.resolve());
});

module.exports = { TAG_ALIASES, loadAliases, getTagNames, getCanonicalTags };
