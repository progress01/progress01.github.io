'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SURFACE_ORDER,
  SurfaceContractError,
  normalizeSurfaces,
  isSurfaceSubset
} = require('../lib/content-surfaces');

const source = 'surface-fixture.yml';
const normalize = (record, missingPolicy = 'error', extra = {}) =>
  normalizeSurfaces(record, { source, missingPolicy, ...extra });
const assertSurfaceError = (fn, code, errorSource = source) => {
  assert.throws(fn, error => {
    assert.ok(error instanceof SurfaceContractError);
    assert.equal(error.name, 'SurfaceContractError');
    assert.equal(error.code, code);
    assert.equal(error.source, errorSource);
    assert.equal(error.field, 'surfaces');
    assert.match(error.message, new RegExp(errorSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return true;
  });
};

test('accepts each surface and canonicalizes the pair to profile then memory', () => {
  assert.deepEqual(normalize({ surfaces: ['profile'] }).surfaces, ['profile']);
  assert.deepEqual(normalize({ surfaces: ['memory'] }).surfaces, ['memory']);
  assert.deepEqual(normalize({ surfaces: ['profile', 'memory'] }).surfaces, ['profile', 'memory']);
  assert.deepEqual(normalize({ surfaces: ['memory', 'profile'] }).surfaces, ['profile', 'memory']);
  assert.deepEqual(SURFACE_ORDER, ['profile', 'memory']);
});

test('deduplicates values with a source-aware warning and isolates each result', () => {
  const first = normalize({ surfaces: ['memory', 'profile', 'memory'] });
  const second = normalize({ surfaces: ['memory', 'profile', 'memory'] });
  assert.deepEqual(first.surfaces, ['profile', 'memory']);
  assert.deepEqual(first.warnings, [{
    code: 'duplicate_surface', source, value: 'memory', index: 2,
    message: `${source}: duplicate surface "memory" at index 2; duplicate removed`
  }]);
  assert.notStrictEqual(first.surfaces, second.surfaces);
  assert.notStrictEqual(first.warnings, second.warnings);
  assert.notStrictEqual(first.warnings[0], second.warnings[0]);
  const originalWarning = `${source}: duplicate surface "memory" at index 2; duplicate removed`;
  first.surfaces.push('corrupt');
  first.warnings[0].message = 'changed';
  first.warnings.push({ code: 'changed' });
  assert.deepEqual(second.surfaces, ['profile', 'memory']);
  assert.equal(second.warnings[0].message, originalWarning);
  assert.equal(second.warnings.length, 1);
  const afterMutation = normalize({ surfaces: ['memory', 'profile', 'memory'] });
  assert.deepEqual(afterMutation.surfaces, ['profile', 'memory']);
  assert.equal(afterMutation.warnings[0].message, originalWarning);
});

test('exports frozen canonical constants and never returns their shared array', () => {
  assert.ok(Object.isFrozen(SURFACE_ORDER));
  assert.throws(() => SURFACE_ORDER.push('other'), TypeError);
  const result = normalize({ surfaces: ['profile'] });
  assert.notStrictEqual(result.surfaces, SURFACE_ORDER);
  result.surfaces.push('other');
  assert.deepEqual(SURFACE_ORDER, ['profile', 'memory']);
  assert.deepEqual(normalize({ surfaces: ['memory'] }).surfaces, ['memory']);
});

test('requires explicit missing-field policy and distinguishes absent from own undefined or null', () => {
  assert.deepEqual(normalize({}, 'legacy').surfaces, ['memory']);
  assertSurfaceError(() => normalize({}), 'missing_surfaces');
  assertSurfaceError(() => normalize({ surfaces: undefined }, 'legacy'), 'invalid_surfaces_type');
  assertSurfaceError(() => normalize({ surfaces: null }, 'legacy'), 'invalid_surfaces_type');
  assertSurfaceError(() => normalize({}), 'missing_surfaces');
  assert.deepEqual(normalize({}, 'inherit', { inheritedSurfaces: ['profile'] }).surfaces, ['profile']);
  assertSurfaceError(() => normalize({}, 'inherit'), 'missing_inherited_surfaces');
  assertSurfaceError(() => normalize({}, 'unknown'), 'invalid_missing_policy');
  assertSurfaceError(() => normalize({}, 'error', { missingPolicy: undefined }), 'invalid_missing_policy');
});

test('rejects invalid records, options, and missing or malformed source context', () => {
  assertSurfaceError(() => normalize(null), 'invalid_record');
  assertSurfaceError(() => normalize([]), 'invalid_record');
  assertSurfaceError(() => normalize('record'), 'invalid_record');
  assert.throws(() => normalizeSurfaces({}, { missingPolicy: 'legacy' }), error =>
    error instanceof SurfaceContractError && error.code === 'missing_source_context');
  assert.throws(() => normalizeSurfaces({}, { source: '', missingPolicy: 'legacy' }), error =>
    error instanceof SurfaceContractError && error.code === 'missing_source_context');
  assert.throws(() => normalizeSurfaces({}, { source: 42, missingPolicy: 'legacy' }), error =>
    error instanceof SurfaceContractError && error.code === 'missing_source_context');
  assertSurfaceError(() => normalizeSurfaces({}, null), 'invalid_missing_policy', '<missing source context>');
});

test('rejects empty arrays, scalars, invalid element types, and unknown or noncanonical values', () => {
  const invalidArrays = [
    [],
    'profile',
    1,
    true,
    {},
    ['profile', 1],
    [null],
    [['profile']],
    ['unknown'],
    ['PROFILE'],
    ['Profile'],
    [' profile'],
    ['profile '],
    [' profile ']
  ];
  for (const surfaces of invalidArrays) {
    assert.throws(() => normalize({ surfaces }), error =>
      error instanceof SurfaceContractError && typeof error.code === 'string' && error.source === source,
      `expected invalid surfaces to fail: ${JSON.stringify(surfaces)}`);
  }
  assertSurfaceError(() => normalize({ surfaces: [] }), 'empty_surfaces');
  assertSurfaceError(() => normalize({ surfaces: 'profile' }), 'invalid_surfaces_type');
  assertSurfaceError(() => normalize({ surfaces: ['profile', 1] }), 'invalid_surface_type');
  assertSurfaceError(() => normalize({ surfaces: ['private'] }), 'unknown_surface');
});


test('inherit policy validates inherited values and preserves an isolated warning list', () => {
  assertSurfaceError(() => normalize({}, 'inherit', { inheritedSurfaces: undefined }), 'invalid_surfaces_type', `${source} (inherited target)`);
  assertSurfaceError(() => normalize({}, 'inherit', { inheritedSurfaces: null }), 'invalid_surfaces_type', `${source} (inherited target)`);
  assertSurfaceError(() => normalize({}, 'inherit', { inheritedSurfaces: [] }), 'empty_surfaces', `${source} (inherited target)`);
  const inherited = normalize({}, 'inherit', { inheritedSurfaces: ['memory', 'memory'] });
  assert.deepEqual(inherited.surfaces, ['memory']);
  assert.equal(inherited.warnings.length, 1);
  inherited.warnings[0].code = 'changed';
  const next = normalize({ surfaces: ['profile'] });
  assert.deepEqual(next.warnings, []);
});

test('subset helper handles true, false, canonicalization, and invalid values', () => {
  assert.equal(isSurfaceSubset(['profile'], ['profile', 'memory']), true);
  assert.equal(isSurfaceSubset(['memory', 'profile'], ['profile', 'memory']), true);
  assert.equal(isSurfaceSubset(['memory'], ['profile']), false);
  assert.throws(() => isSurfaceSubset([], ['memory']), error =>
    error instanceof SurfaceContractError && error.code === 'empty_surfaces');
  assert.throws(() => isSurfaceSubset(['private'], ['profile']), error =>
    error instanceof SurfaceContractError && error.code === 'unknown_surface');
  assert.throws(() => isSurfaceSubset(['profile'], null), error =>
    error instanceof SurfaceContractError && error.code === 'invalid_surfaces_type');
});

test('error details remain stable and include the supplied source context', () => {
  assertSurfaceError(() => normalize({ surfaces: ['memory', 'unknown'] }), 'unknown_surface');
});
