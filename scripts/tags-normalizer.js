// 將歷史文章與新增文章的標籤統一成少量、可長期維護的主標籤。
// 文章 front matter 已整理為主標籤；建置時仍再次正規化，避免快取造成舊標籤殘留。

const { parse } = require('hexo-front-matter');

const TAG_ALIASES = {
  '音樂推薦': '音樂推薦',
  '歌曲推薦': '音樂推薦',
  '專輯插圖': '音樂推薦',
  '書籍': '閱讀紀錄',
  '閱讀紀錄': '閱讀紀錄',
  '閱讀心得': '閱讀紀錄',
  '網路小說': '閱讀紀錄',
  '輕小說': '閱讀紀錄',
  '觀影紀錄': '觀影紀錄',
  '觀影心得': '觀影紀錄',
  '影片': '觀影紀錄',
  '學習筆記': '學習筆記',
  '內容建模': '學習筆記',
  '前後台': '學習筆記',
  '動作分析': '學習筆記',
  '問題情境': '學習筆記',
  '排球': '學習筆記',
  '規格審查': '學習筆記',
  '設計思考': '學習筆記',
  '資料庫': '學習筆記',
  '網站流量': '學習筆記',
  'ACID': '學習筆記',
  'Agent Systems': '學習筆記',
  'Agentic Transaction': '學習筆記',
  'CMS': '學習筆記',
  'GEO': '學習筆記',
  '生活感受': '生活感受',
  '心情': '生活感受',
  '困擾': '生活感受',
  '旅行': '旅行',
  '站務': '站務'
};

function getTagNames(tags) {
  if (!tags) return [];

  const values = typeof tags.toArray === 'function' ? tags.toArray() : tags;
  const list = Array.isArray(values) ? values : [values];

  return list.map(tag => {
    if (tag && typeof tag === 'object' && tag.name) return String(tag.name).trim();
    return String(tag || '').trim();
  }).filter(Boolean);
}

function getCanonicalTags(tags) {
  const normalized = [];

  getTagNames(tags).forEach(tag => {
    const canonical = TAG_ALIASES[tag];
    if (canonical && !normalized.includes(canonical)) normalized.push(canonical);
  });

  return normalized;
}

// Hexo 的 tags 是由 PostTag 關聯表建立，必須在 generate 前更新關聯，
// 才能同時影響文章上的標籤連結、site.tags 數量和標籤文章列表。
hexo.extend.filter.register('before_generate', function() {
  const posts = this.locals.get('posts').toArray();
  return posts.reduce((promise, post) => promise.then(() => {
    // 以文章原始 front matter 為準；資料庫中的關聯可能因舊文章更新而尚未完整。
    let sourceTags;
    try {
      sourceTags = parse(post.raw || '').tags;
    } catch (error) {
      sourceTags = post.tags;
    }
    return post.setTags(getCanonicalTags(sourceTags == null ? post.tags : sourceTags));
  }), Promise.resolve());
});
