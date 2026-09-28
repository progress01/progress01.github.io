'use strict';

const { normalizeSurfaces } = require('./content-surfaces');

const CONTENT_BROWSER_RANGES = Object.freeze(['all', 'profile', 'memory']);

function stableSource(post) {
  const source = String(post?.source || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!source) return '<unknown post source>';
  return source.startsWith('source/') ? source : `source/${source}`;
}

/**
 * Keep the existing public-post eligibility rules and optionally scope the
 * result to one canonical surface. Missing fields are legacy only when their
 * stable source path appears in the supplied baseline manifest.
 *
 * @param {Array<object>} posts Hexo post records, usually already date-sorted.
 * @param {'all'|'profile'|'memory'} range Requested content-browser range.
 * @param {{legacyPostSources?: Set<string>, onWarning?: (warning: object) => void}} options
 * @returns {Array<object>} The original eligible post records, in input order.
 */
function filterPostsBySurface(posts, range = 'all', options = {}) {
  if (!Array.isArray(posts)) throw new TypeError('content_browser_posts_invalid');
  if (!CONTENT_BROWSER_RANGES.includes(range)) {
    throw new RangeError(`content_browser_range_invalid: ${String(range)}`);
  }

  const legacyPostSources = options.legacyPostSources || new Set();
  if (typeof legacyPostSources.has !== 'function') throw new TypeError('content_browser_legacy_manifest_invalid');

  return posts.filter(post => {
    // Match the pre-surface content-browser helper: unpublished and draft
    // records are never listed, even for the all-public range.
    if (!post || post.published === false || post.draft === true) return false;

    const source = stableSource(post);
    let resolved;
    try {
      resolved = normalizeSurfaces(post, {
        source,
        missingPolicy: legacyPostSources.has(source) ? 'legacy' : 'error'
      });
    } catch (error) {
      throw new Error(`${source} [${error.code || error.name}]: content browser surface contract violation`);
    }
    resolved.warnings.forEach(warning => {
      if (typeof options.onWarning === 'function') options.onWarning(warning);
    });

    return range === 'all' || resolved.surfaces.includes(range);
  });
}

module.exports = Object.freeze({ CONTENT_BROWSER_RANGES, filterPostsBySurface });
