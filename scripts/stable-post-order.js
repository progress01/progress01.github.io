'use strict';

const POST_ORDER = '-date stable_order_path';

function stableOrderPath(post) {
  // Custom permalinks may resolve with a leading slash; compare the same path form as generated posts.
  return String(post?.path || '').replace(/^\/+/, '');
}

function createPostNeighbors(posts) {
  const ordered = posts.sort(POST_ORDER).toArray();
  const neighbors = new Map();

  ordered.forEach((post, index) => {
    neighbors.set(post.path, {
      prev: index > 0 ? ordered[index - 1] : null,
      next: index + 1 < ordered.length ? ordered[index + 1] : null
    });
  });

  return neighbors;
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

    neighbors ||= createPostNeighbors(this.locals.get('posts'));
    const adjacent = neighbors.get(post.path);
    post.prev = adjacent?.prev || null;
    post.next = adjacent?.next || null;
    return locals;
  });
}

module.exports = { POST_ORDER, createPostNeighbors, stableOrderPath };
