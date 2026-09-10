// 每頁只嵌入「全部／各分類」最新十篇的聯集，完整搜尋仍按需讀取 search.xml。
hexo.extend.helper.register('search_recent_posts', function() {
  const categories = this.site.data['content-categories'] || [];
  const counts = new Map(categories.map(category => [category.name, 0]));
  return this.site.posts.sort('date', -1).toArray().flatMap((post, rank) => {
    let include = rank < 10;
    const names = new Set(post.categories.toArray().map(category => category.name));
    names.forEach(name => {
      if (!counts.has(name) || counts.get(name) >= 10) return;
      counts.set(name, counts.get(name) + 1);
      include = true;
    });
    return include ? [{ post, rank }] : [];
  });
});
