// scripts/calendar-generator.js
// 這是一個自製的 Hexo 插件，用來自動生成 calendar.json
// 不需要依賴外部壞掉的 npm 套件
const { resolvePostSurface } = require('../tools/lib/post-surface');

function getPostCategories(post) {
  return post.categories && typeof post.categories.toArray === 'function'
    ? post.categories.toArray().map(category => category.name)
    : [];
}

function getPostRecord(post) {
  const path = String(post.path || '').replace(/^\/+/, '');
  return {
    title: String(post.title || '未命名文章'),
    url: '/' + path,
    categories: getPostCategories(post),
    date: post.date.format('YYYY-MM-DD')
  };
}

// 熱力圖只算 B 面的內容紀錄；站務文章和隨機抽文章一樣排除（作者 2026-11-10 決定）。
function isCalendarPost(post) {
  return Boolean(resolvePostSurface(post)?.surfaces.includes('memory')) && !getPostCategories(post).includes('站務');
}

hexo.extend.generator.register('calendar_json', function(locals) {
  const data = {};

  // 保留原本的日期計數格式，供 ECharts 熱力圖使用。
  locals.posts.filter(isCalendarPost).forEach(post => {
    const date = post.date.format('YYYY-MM-DD');
    data[date] = (data[date] || 0) + 1;
  });

  return {
    path: 'calendar.json',
    data: JSON.stringify(data)
  };
});

hexo.extend.generator.register('calendar_posts_json', function(locals) {
  const data = {};

  // 另外提供日期對應的文章明細，避免改變 calendar.json 的既有資料結構。
  locals.posts.filter(isCalendarPost).forEach(post => {
    const date = post.date.format('YYYY-MM-DD');
    if (!data[date]) data[date] = [];
    data[date].push(getPostRecord(post));
  });

  return {
    path: 'calendar-posts.json',
    data: JSON.stringify(data)
  };
});
