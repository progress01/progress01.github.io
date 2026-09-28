'use strict';

const SURFACE_ORDER = Object.freeze(['profile', 'memory']);
const SURFACE_VALUES = new Set(SURFACE_ORDER);
const MISSING_POLICIES = new Set(['legacy', 'error', 'inherit']);

/** A surface-contract error with a stable code and the source that supplied the value. */
class SurfaceContractError extends TypeError {
  constructor(code, source, message) {
    super(`${source}: ${message}`);
    this.name = 'SurfaceContractError';
    this.code = code;
    this.source = source;
    this.field = 'surfaces';
  }
}

function contextName(value) {
  return typeof value === 'string' && value.trim() ? value : '<missing source context>';
}

function fail(code, source, message) {
  throw new SurfaceContractError(code, source, message);
}

/**
 * Validate and canonicalize an explicitly supplied surface array.
 * The returned surfaces and warning objects are newly allocated per call.
 * @param {unknown} value
 * @param {string} source
 * @returns {{surfaces: string[], warnings: Array<{code: string, source: string, value: string, index: number, message: string}>}}
 */
function normalizeArray(value, source) {
  if (!Array.isArray(value)) {
    fail('invalid_surfaces_type', source, 'surfaces must be a non-empty array of strings');
  }
  if (value.length === 0) {
    fail('empty_surfaces', source, 'surfaces must contain at least one allowed value');
  }

  const seen = new Set();
  const warnings = [];
  value.forEach((surface, index) => {
    if (typeof surface !== 'string') {
      fail('invalid_surface_type', source, `surfaces[${index}] must be a string`);
    }
    if (!SURFACE_VALUES.has(surface)) {
      fail('unknown_surface', source, `surfaces[${index}] has unsupported value ${JSON.stringify(surface)}; allowed values are profile and memory`);
    }
    if (seen.has(surface)) {
      warnings.push({
        code: 'duplicate_surface',
        source,
        value: surface,
        index,
        message: `${source}: duplicate surface ${JSON.stringify(surface)} at index ${index}; duplicate removed`
      });
      return;
    }
    seen.add(surface);
  });

  return {
    surfaces: SURFACE_ORDER.filter(surface => seen.has(surface)),
    warnings
  };
}

/**
 * Read and normalize a record's own surfaces field.
 *
 * missingPolicy is mandatory: legacy defaults an absent field to memory; error
 * rejects an absent field (use for new records); inherit copies an explicitly
 * supplied inheritedSurfaces array (use for an old linked learning item). An
 * own property whose value is undefined or null is always invalid, never missing.
 * No dates, mtimes, categories, or other fields are used to infer policy.
 *
 * @param {Record<string, unknown>} record Content record, such as a post or learning item.
 * @param {{source: string, missingPolicy: 'legacy'|'error'|'inherit', inheritedSurfaces?: unknown}} options
 * @returns {{surfaces: string[], warnings: Array<{code: string, source: string, value: string, index: number, message: string}>}}
 * @throws {SurfaceContractError} On missing policy/context, missing required fields, or invalid values.
 */
function normalizeSurfaces(record, options) {
  const source = contextName(options && options.source);
  if (!options || !MISSING_POLICIES.has(options.missingPolicy)) {
    fail('invalid_missing_policy', source, 'missingPolicy must be explicitly set to legacy, error, or inherit');
  }
  if (source === '<missing source context>') {
    fail('missing_source_context', source, 'options.source must be a non-empty source identifier');
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail('invalid_record', source, 'record must be a non-null object');
  }

  if (Object.prototype.hasOwnProperty.call(record, 'surfaces')) {
    return normalizeArray(record.surfaces, source);
  }

  switch (options.missingPolicy) {
    case 'legacy':
      return { surfaces: ['memory'], warnings: [] };
    case 'error':
      fail('missing_surfaces', source, 'surfaces is required for new content');
      break;
    case 'inherit':
      if (!Object.prototype.hasOwnProperty.call(options, 'inheritedSurfaces')) {
        fail('missing_inherited_surfaces', source, 'inherit policy requires inheritedSurfaces from the linked article');
      }
      return normalizeArray(options.inheritedSurfaces, `${source} (inherited target)`);
    default:
      fail('invalid_missing_policy', source, 'unsupported missingPolicy');
  }
}

/**
 * Return whether every normalized surface in subset is present in superset.
 * Both arguments must be non-empty arrays containing only allowed values.
 *
 * @param {unknown} subset Child/linked-record surfaces.
 * @param {unknown} superset Target/article surfaces.
 * @param {{source?: string}} [options] Error context.
 * @returns {boolean}
 * @throws {SurfaceContractError} If either value is not a valid surface array.
 */
function isSurfaceSubset(subset, superset, options = {}) {
  const source = contextName(options.source) === '<missing source context>'
    ? 'surface subset check'
    : options.source;
  const normalizedSubset = normalizeArray(subset, `${source} (subset)`).surfaces;
  const normalizedSuperset = normalizeArray(superset, `${source} (superset)`).surfaces;
  return normalizedSubset.every(surface => normalizedSuperset.includes(surface));
}

module.exports = Object.freeze({
  SURFACE_ORDER,
  SurfaceContractError,
  normalizeSurfaces,
  isSurfaceSubset
});

