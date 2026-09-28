'use strict';

const { resolvePostSurface } = require('../tools/lib/post-surface');
const { resolveBrandContext } = require('../tools/lib/brand-context');

hexo.extend.helper.register('post_surface_navigation', function(post) {
  try {
    const result = resolvePostSurface(post);
    result?.warnings.forEach(warning => hexo.log.warn(`${warning.source} [${warning.code}]`));
    return result;
  } catch (error) {
    const source = String(post?.source || '<unknown post source>');
    throw new Error(`${source} [${error.code || error.name}]: post surface marker contract violation`);
  }
});

hexo.extend.helper.register('brand_surface_context', function(page) {
  return resolveBrandContext(page);
});
