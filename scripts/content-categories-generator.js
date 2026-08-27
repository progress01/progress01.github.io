// 將 source/_data/content-categories.yml 提供給需要在瀏覽器執行的自訂頁面。

hexo.extend.generator.register('content_categories_json', function(locals) {
  const data = locals.data || hexo.locals.get('data') || {};
  const categories = data['content-categories'] || data.content_categories || [];

  return {
    path: 'content-categories.json',
    data: JSON.stringify(categories)
  };
});
