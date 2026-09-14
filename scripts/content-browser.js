'use strict';
hexo.extend.helper.register('content_browser_records', function() {
  return this.site.posts.sort('date', -1).toArray().filter(post => post.published !== false && post.draft !== true).map(post => ({
    title: post.title, url: this.url_for(post.path), date: this.date(post.date, 'YYYY-MM-DD'),
    categories: post.categories.toArray().map(item => item.name), tags: post.tags.toArray().map(item => item.name)
  }));
});
