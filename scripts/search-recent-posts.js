// 嵌入完整公開文章候選，讓每個面向與分類都能在瀏覽器端各自取最新十篇。
const { filterPostsBySurface } = require('../tools/lib/content-browser');
const { resolvePostSurface } = require('../tools/lib/post-surface');
const legacySurfaces = require('../tools/data/legacy-surfaces.v1.json');
if (!legacySurfaces || legacySurfaces.schemaVersion !== 1 || !Array.isArray(legacySurfaces.posts)) {
  throw new Error('legacy_surface_manifest_invalid [tools/data/legacy-surfaces.v1.json]');
}
const legacyPostSources = new Set(legacySurfaces.posts);

hexo.extend.helper.register('search_recent_posts', function(range = 'all') {
  const posts = filterPostsBySurface(this.site.posts.sort('date', -1).toArray(), range, {
    legacyPostSources,
    onWarning: warning => hexo.log.warn(`${warning.source} [${warning.code}]`)
  });
  return posts.map((post, rank) => ({
    post,
    rank,
    surfaces: resolvePostSurface(post, { legacySurfaceManifest: legacySurfaces }).surfaces
  }));
});
