'use strict';

/**
 * Resolve the server-rendered brand destination for a page.
 * Reuse the existing page-path context used by the contextual menu. Article
 * front matter determines discovery eligibility, not the current navigation
 * context; a shared canonical URL does not encode which surface linked to it.
 */
function resolveBrandContext(page) {
  const pagePath = String(page?.path || '').replaceAll('\\', '/').replace(/^\/+/, '');
  return pagePath === 'index.html' || pagePath === '' || pagePath.startsWith('profile/') ? 'profile' : 'memory';
}

module.exports = Object.freeze({ resolveBrandContext });
