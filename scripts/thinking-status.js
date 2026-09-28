'use strict';

const { resolveThinkingStatus } = require('../tools/lib/thinking-status');

function sourceName(post) {
  const source = String(post?.source || '').replaceAll('\\', '/').replace(/^\/+/, '');
  return source.startsWith('source/') ? source : `source/${source || '<unknown post>'}`;
}

hexo.extend.helper.register('thinking_status', function(post) {
  const source = sourceName(post);
  try {
    const result = resolveThinkingStatus(post, { source });
    return result.visible ? result : null;
  } catch (error) {
    throw new Error(`${source} [${error.code || error.name}]: thinking status contract violation`);
  }
});
