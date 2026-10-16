'use strict';

const { archivePreview, clearImageDimensionCache } = require('../tools/lib/archive-preview');

hexo.extend.helper.register('archive_preview', post => archivePreview(post, hexo.source_dir));
hexo.extend.filter.register('before_generate', clearImageDimensionCache);
