'use strict';

const { getRecentProfileLearningPosts } = require('../tools/lib/profile-learning');
const { resolveThinkingStatus } = require('../tools/lib/thinking-status');
const legacySurfaces = require('../tools/data/legacy-surfaces.v1.json');

if (!legacySurfaces || legacySurfaces.schemaVersion !== 1 || !Array.isArray(legacySurfaces.posts)) {
  throw new Error('legacy_surface_manifest_invalid [tools/data/legacy-surfaces.v1.json]');
}
const legacyPostSources = new Set(legacySurfaces.posts);

hexo.extend.helper.register('profile_recent_learning', function(profileHome, limit = 3) {
  const records = getRecentProfileLearningPosts({
    posts: this.site.posts.toArray(),
    profileHome,
    legacyPostSources,
    limit,
    onWarning: warning => hexo.log.warn(`${warning.source} [${warning.code}]`)
  });
  return records.map(post => {
    const thinking = resolveThinkingStatus(post, { source: String(post.source || '<unknown post>') });
    return {
      title: post.title,
      url: this.url_for(post.path),
      date: this.date(post.date, 'YYYY-MM'),
      datetime: this.date(post.date, 'YYYY-MM-DD'),
      thinking: thinking.visible ? thinking : null
    };
  });
});
