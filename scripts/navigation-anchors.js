'use strict';
const { anchorContent } = require('../tools/lib/navigation-anchors');
hexo.extend.filter.register('after_post_render', data => {
  if (data.layout === 'post') data.content = anchorContent(data.content, data.source || data.slug || '');
  return data;
}, 30);
