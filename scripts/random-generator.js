// 自動產生隨機文章資料，讓隨機入口不必直接解析 search.xml。

function visualKind(post, categories, tags) {
  const source = String(post.source || '');
  const title = String(post.title || '');
  if (post.work_knowledge) return 'work';
  if (post.learning) return 'learning';
  if (source.includes('歌曲推薦') || categories.includes('音樂') || tags.includes('歌曲推薦')) return 'audio';
  if (source.includes('隨筆') || categories.includes('生活紀錄')) return 'daily';
  if (source.includes('閱讀影評') || categories.includes('閱讀與影視')) {
    return tags.includes('觀影心得') || title.includes('觀影紀錄') ? 'watch' : 'reading';
  }
  return 'generic';
}

function safeCover(value) {
  const cover = String(value || '');
  return /^\/images\/[^?#]+$/.test(cover) && !cover.includes('..') && !cover.includes('\\') ? cover : '';
}

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

    const kind = visualKind(post, categories, tags);
    posts.push({
      title: String(post.title || '未命名文章'),
      url: '/' + path,
      date: post.date.format('YYYY-MM-DD'),
      categories: categories.length ? categories : ['未分類'],
      tags,
      excerpt,
      kind,
      cover: (kind === 'audio' || kind === 'reading' || kind === 'watch' || kind === 'generic') ? safeCover(post.cover) : '',
      note: String(post.work_note || post.learning_status || '').slice(0, 60)
    });
  });

  return {
    path: 'random.json',
    data: JSON.stringify(posts)
  };
});
