'use strict';

const POST_ORDER = '-date stable_order_path';

function stableOrderPath(post) {
  // Custom permalinks may resolve with a leading slash; compare the same path form as generated posts.
  return String(post?.path || '').replace(/^\/+/, '');
}

// isProfile：A 面文章的上一篇／下一篇只在 A 面文章之間循環（作者 2026-11-10 決定）；
// 其他文章維持全站時間序。未提供時全部用全站時間序。
function createPostNeighbors(posts, isProfile = () => false) {
  const ordered = posts.sort(POST_ORDER).toArray();
  const profileOrdered = ordered.filter(post => isProfile(post));
  const neighbors = new Map();

  ordered.forEach((post, index) => {
    neighbors.set(post.path, {
      prev: index > 0 ? ordered[index - 1] : null,
      next: index + 1 < ordered.length ? ordered[index + 1] : null
    });
  });
  profileOrdered.forEach((post, index) => {
    neighbors.set(post.path, {
      prev: index > 0 ? profileOrdered[index - 1] : null,
      next: index + 1 < profileOrdered.length ? profileOrdered[index + 1] : null
    });
  });

  return neighbors;
}

function isProfilePost(post) {
  const { resolvePostSurface } = require('../tools/lib/post-surface');
  try { return Boolean(resolvePostSurface(post)?.surfaces.includes('profile')); }
  catch { return false; }
}

if (typeof hexo !== 'undefined' && hexo.extend?.filter) {
  let neighbors;
  const postSchema = hexo.model('Post').schema;
  if (!postSchema.paths.stable_order_path) {
    postSchema.virtual('stable_order_path').get(function() {
      return stableOrderPath(this);
    });
  }

  hexo.extend.filter.register('before_generate', () => {
    neighbors = undefined;
  });

  hexo.extend.filter.register('template_locals', function(locals) {
    const post = locals?.page;
    if (!post?.__post) return locals;

    neighbors ||= createPostNeighbors(this.locals.get('posts'), isProfilePost);
    const adjacent = neighbors.get(post.path);
    post.prev = adjacent?.prev || null;
    post.next = adjacent?.next || null;
    return locals;
  });
}

module.exports = { POST_ORDER, createPostNeighbors, isProfilePost, stableOrderPath };
