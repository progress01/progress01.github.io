// 自動產生隨機文章資料，讓隨機入口不必直接解析 search.xml。

hexo.extend.generator.register('random_json', function(locals) {
  const posts = [];

  locals.posts.forEach(post => {
    const path = String(post.path || '').replace(/^\/+/, '');
    const categories = post.categories && typeof post.categories.toArray === 'function'
      ? post.categories.toArray().map(category => category.name)
      : [];
    const tags = post.tags && typeof post.tags.toArray === 'function'
      ? post.tags.toArray().map(tag => tag.name)
      : [];

    // 入口頁與站務文章不列入隨機內容，避免抽到控制頁或系統頁。
    if (!path || post.type === 'random' || categories.includes('站務')) return;

    const excerpt = String(post.description || post.excerpt || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

    posts.push({
      title: String(post.title || '未命名文章'),
      url: '/' + path,
      date: post.date.format('YYYY-MM-DD'),
      categories: categories.length ? categories : ['未分類'],
      tags,
      excerpt
    });
  });

  return {
    path: 'random.json',
    data: JSON.stringify(posts)
  };
});
