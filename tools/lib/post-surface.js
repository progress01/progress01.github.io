'use strict';

const { normalizeSurfaces } = require('./content-surfaces');
const DEFAULT_LEGACY_SURFACES = require('../data/legacy-surfaces.v1.json');

const SURFACE_PRESENTATION = Object.freeze({
  profile: Object.freeze({ id: 'profile', label: '工作與學習', href: '/' }),
  memory: Object.freeze({ id: 'memory', label: '個人記憶庫', href: '/memory/' })
});

function stablePostSource(post) {
  const source = String(post?.source || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!source) return '<unknown post source>';
  return source.startsWith('source/') ? source : `source/${source}`;
}

function legacyPostSources(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.posts)) {
    throw new Error('legacy_surface_manifest_invalid [tools/data/legacy-surfaces.v1.json]');
  }
  return new Set(manifest.posts);
}

function resolvePostSurface(post, options = {}) {
  const source = stablePostSource(post);
  if (!source.startsWith('source/_posts/')) return null;

  const legacy = legacyPostSources(options.legacySurfaceManifest || DEFAULT_LEGACY_SURFACES);
  const result = normalizeSurfaces(post, {
    source,
    missingPolicy: legacy.has(source) ? 'legacy' : 'error'
  });
  return {
    source,
    surfaces: result.surfaces,
    items: result.surfaces.map(surface => SURFACE_PRESENTATION[surface]),
    warnings: result.warnings
  };
}

module.exports = Object.freeze({ SURFACE_PRESENTATION, stablePostSource, resolvePostSurface });
