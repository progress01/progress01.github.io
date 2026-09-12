// 前端 fetch 使用的資料檔仍需輸出，但不把它們當作搜尋結果 URL 提交。
const SITEMAP_EXCLUDED_DATA = new Set([
  'reading-desk.json',
  'microblog.json',
  'life-index.json'
]);

function excludeFrontendDataFromSitemap(pages) {
  const list = typeof pages?.toArray === 'function' ? pages.toArray() : (Array.isArray(pages) ? pages : []);
  const updates = [];
  list.forEach(page => {
    if (SITEMAP_EXCLUDED_DATA.has(page?.path) || SITEMAP_EXCLUDED_DATA.has(page?.source)) {
      // Warehouse returns cloned Documents from Page.find(). Persist the flag
      // through the model, otherwise Hexo's next locals query loses it.
      if (typeof page?.update === 'function' && page.sitemap !== false) {
        updates.push(Promise.resolve(page.update({ sitemap: false })));
      } else {
        page.sitemap = false;
      }
    }
  });
  return Promise.all(updates).then(() => list);
}

if (typeof hexo !== 'undefined' && hexo.extend?.filter) {
  hexo.extend.filter.register('before_generate', function() {
    return excludeFrontendDataFromSitemap(this.locals.get('pages'));
  });
}

module.exports = { SITEMAP_EXCLUDED_DATA, excludeFrontendDataFromSitemap };
