'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePostSurface } = require('../lib/post-surface');

const manifest = { schemaVersion: 1, posts: ['source/_posts/legacy.md'] };

test('resolves profile, memory and dual post markers in canonical order', () => {
  const profile = resolvePostSurface({ source: '_posts/profile.md', surfaces: ['profile'] }, { legacySurfaceManifest: manifest });
  const memory = resolvePostSurface({ source: '_posts/memory.md', surfaces: ['memory'] }, { legacySurfaceManifest: manifest });
  const dual = resolvePostSurface({ source: '_posts/dual.md', surfaces: ['memory', 'profile'] }, { legacySurfaceManifest: manifest });
  assert.deepEqual(profile.items, [{ id: 'profile', label: '工作與學習', href: '/' }]);
  assert.deepEqual(memory.items, [{ id: 'memory', label: '個人記憶庫', href: '/memory/' }]);
  assert.deepEqual(dual.surfaces, ['profile', 'memory']);
  assert.deepEqual(dual.items.map(item => item.label), ['工作與學習', '個人記憶庫']);
});

test('uses the frozen legacy manifest for old fields and rejects missing new fields', () => {
  assert.deepEqual(resolvePostSurface({ source: '_posts/legacy.md' }, { legacySurfaceManifest: manifest }).surfaces, ['memory']);
  assert.throws(
    () => resolvePostSurface({ source: '_posts/new.md' }, { legacySurfaceManifest: manifest }),
    error => error.code === 'missing_surfaces'
  );
});

test('returns null for non-article pages instead of inventing a surface', () => {
  assert.equal(resolvePostSurface({ source: 'profile/index.md' }, { legacySurfaceManifest: manifest }), null);
});
