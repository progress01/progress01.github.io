// scripts/calendar-generator.js
// 這是一個自製的 Hexo 插件，用來自動生成 calendar.json
// 不需要依賴外部壞掉的 npm 套件

hexo.extend.generator.register('calendar_json', function(locals){
  const posts = locals.posts;
  const data = {};

  // 遍歷每一篇文章，統計日期
  posts.forEach(post => {
    // 取得文章日期 (格式 YYYY-MM-DD)
    const date = post.date.format('YYYY-MM-DD');
    
    // 如果這一天已經有文章，計數 +1，否則設為 1
    if (data[date]) {
      data[date]++;
    } else {
      data[date] = 1;
    }
  });

  // 回傳生成的檔案
  return {
    path: 'calendar.json',
    data: JSON.stringify(data)
  };
});