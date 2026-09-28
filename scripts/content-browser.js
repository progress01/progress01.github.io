'use strict';
const { filterPostsBySurface } = require('../tools/lib/content-browser');
const legacySurfaces = require('../tools/data/legacy-surfaces.v1.json');
if (!legacySurfaces || legacySurfaces.schemaVersion !== 1 || !Array.isArray(legacySurfaces.posts)) {
  throw new Error('legacy_surface_manifest_invalid [tools/data/legacy-surfaces.v1.json]');
}
const legacyPostSources = new Set(legacySurfaces.posts);

hexo.extend.helper.register('content_browser_records', function(range = 'all') {
  const posts = filterPostsBySurface(this.site.posts.sort('date', -1).toArray(), range, {
    legacyPostSources,
    onWarning: warning => hexo.log.warn(`${warning.source} [${warning.code}]`)
  });
  return posts.map(post => ({
    title: post.title, url: this.url_for(post.path), date: this.date(post.date, 'YYYY-MM-DD'),
    categories: post.categories.toArray().map(item => item.name), tags: post.tags.toArray().map(item => item.name)
  }));
});

hexo.extend.helper.register('content_browser_topics', function() {
  const definitions = this.site.data['content-tags'] || [];
  return definitions.filter(item => item.group === 'topic').map(item => item.name);
});
