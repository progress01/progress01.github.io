'use strict';

const { archivePreview } = require('../tools/lib/archive-preview');

hexo.extend.helper.register('archive_preview', archivePreview);
