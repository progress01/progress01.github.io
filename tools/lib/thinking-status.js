'use strict';

const THINKING_FIELDS = Object.freeze([
  'thinking_status',
  'thinking_updated',
  'thinking_boundary'
]);
const EXPLORING_STATUS = 'exploring';
const NO_THINKING_STATUS = Object.freeze({
  status: null,
  updated: null,
  boundary: null,
  isExploring: false,
  visible: false
});

class ThinkingStatusError extends TypeError {
  constructor(code, source, field, message) {
    super(`${source}: ${field}: ${message}`);
    this.name = 'ThinkingStatusError';
    this.code = code;
    this.source = source;
    this.field = field;
  }
}

function sourceName(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : '<missing source context>';
}

function fail(code, source, field, message) {
  throw new ThinkingStatusError(code, source, field, message);
}

function hasOwn(record, field) {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function isGregorianDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

/**
 * Resolve the article-only thinking maturity fields without changing input.
 * Missing all three own properties is a valid no-declaration default. Once
 * status is declared, both companion fields are required and validated.
 *
 * @param {Record<string, unknown>} frontMatter Article front matter.
 * @param {{source?: string}} [options] Non-content source context for errors.
 * @returns {{status: string|null, updated: string|null, boundary: string|null, isExploring: boolean, visible: boolean}}
 * @throws {ThinkingStatusError} For incomplete or invalid declarations.
 */
function resolveThinkingStatus(frontMatter, options = {}) {
  const source = sourceName(options && options.source);
  if (!frontMatter || typeof frontMatter !== 'object' || Array.isArray(frontMatter)) {
    fail('THINKING_INVALID_RECORD', source, 'front matter', 'expected an object');
  }

  const hasStatus = hasOwn(frontMatter, 'thinking_status');
  const hasUpdated = hasOwn(frontMatter, 'thinking_updated');
  const hasBoundary = hasOwn(frontMatter, 'thinking_boundary');

  if (!hasStatus) {
    if (hasUpdated) fail('THINKING_ORPHAN_FIELD', source, 'thinking_updated', 'requires thinking_status');
    if (hasBoundary) fail('THINKING_ORPHAN_FIELD', source, 'thinking_boundary', 'requires thinking_status');
    return NO_THINKING_STATUS;
  }

  const status = frontMatter.thinking_status;
  if (typeof status !== 'string') {
    fail('THINKING_STATUS_INVALID_TYPE', source, 'thinking_status', 'expected the exact string exploring');
  }
  if (status !== EXPLORING_STATUS) {
    fail('THINKING_STATUS_UNSUPPORTED', source, 'thinking_status', 'unsupported value');
  }

  if (!hasUpdated) {
    fail('THINKING_UPDATED_REQUIRED', source, 'thinking_updated', 'required when thinking_status is exploring');
  }
  if (!hasBoundary) {
    fail('THINKING_BOUNDARY_REQUIRED', source, 'thinking_boundary', 'required when thinking_status is exploring');
  }

  const updated = frontMatter.thinking_updated;
  if (typeof updated !== 'string') {
    fail('THINKING_UPDATED_INVALID_TYPE', source, 'thinking_updated', 'expected a Gregorian YYYY-MM-DD string');
  }
  if (!isGregorianDate(updated)) {
    fail('THINKING_UPDATED_INVALID_DATE', source, 'thinking_updated', 'expected a real Gregorian YYYY-MM-DD date');
  }

  const boundary = frontMatter.thinking_boundary;
  if (typeof boundary !== 'string') {
    fail('THINKING_BOUNDARY_INVALID_TYPE', source, 'thinking_boundary', 'expected a non-empty string');
  }
  const canonicalBoundary = boundary.trim();
  if (!canonicalBoundary) {
    fail('THINKING_BOUNDARY_EMPTY', source, 'thinking_boundary', 'expected a non-empty string after trimming');
  }

  return Object.freeze({
    status: EXPLORING_STATUS,
    updated,
    boundary: canonicalBoundary,
    isExploring: true,
    visible: true
  });
}

module.exports = Object.freeze({
  THINKING_FIELDS,
  EXPLORING_STATUS,
  ThinkingStatusError,
  resolveThinkingStatus
});
