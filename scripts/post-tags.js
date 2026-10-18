'use strict';

const { getOrderedPostTags } = require('../tools/lib/post-tags');
hexo.extend.helper.register('ordered_post_tags', post => getOrderedPostTags(post));
