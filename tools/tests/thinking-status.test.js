'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  THINKING_FIELDS,
  EXPLORING_STATUS,
  ThinkingStatusError,
  resolveThinkingStatus
} = require('../lib/thinking-status');

const source = 'article-fixture.frontMatter';
const valid = (overrides = {}) => ({
  thinking_status: 'exploring',
  thinking_updated: '2024-02-29',
  thinking_boundary: '  個人實作經驗  ',
  ...overrides
});
const resolve = (frontMatter, errorSource = source) =>
  resolveThinkingStatus(frontMatter, { source: errorSource });

function assertThinkingError(run, code, field, errorSource = source) {
  assert.throws(run, error => {
    assert.ok(error instanceof ThinkingStatusError);
    assert.equal(error.name, 'ThinkingStatusError');
    assert.equal(error.code, code);
    assert.equal(error.source, errorSource);
    assert.equal(error.field, field);
    assert.match(error.message, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return true;
  });
}

test('accepts the only status and returns canonical immutable values', () => {
  const result = resolve(valid());
  assert.deepEqual(result, {
    status: 'exploring',
    updated: '2024-02-29',
    boundary: '個人實作經驗',
    isExploring: true,
    visible: true
  });
  assert.ok(Object.isFrozen(result));
  assert.equal(EXPLORING_STATUS, 'exploring');
  assert.ok(Object.isFrozen(THINKING_FIELDS));
  assert.deepEqual(THINKING_FIELDS, ['thinking_status', 'thinking_updated', 'thinking_boundary']);
});

test('treats only a true absence of all own thinking fields as the legal default', () => {
  const result = resolve({ title: 'ignored' });
  assert.deepEqual(result, {
    status: null,
    updated: null,
    boundary: null,
    isExploring: false,
    visible: false
  });
  assert.ok(Object.isFrozen(result));
  assert.strictEqual(resolve({}), result);
});

test('rejects orphan companion fields, including explicitly undefined and null own properties', () => {
  for (const field of ['thinking_updated', 'thinking_boundary']) {
    for (const value of [undefined, null, '']) {
      assertThinkingError(() => resolve({ [field]: value }), 'THINKING_ORPHAN_FIELD', field);
    }
  }
  assert.deepEqual(resolve(Object.create({ thinking_status: 'exploring' })), {
    status: null, updated: null, boundary: null, isExploring: false, visible: false
  });
});

test('requires both companion fields when exploring is explicitly present', () => {
  assertThinkingError(() => resolve({ thinking_status: 'exploring' }), 'THINKING_UPDATED_REQUIRED', 'thinking_updated');
  assertThinkingError(() => resolve({ thinking_status: 'exploring', thinking_updated: '2024-01-01' }), 'THINKING_BOUNDARY_REQUIRED', 'thinking_boundary');
  for (const value of [undefined, null]) {
    assertThinkingError(() => resolve(valid({ thinking_updated: value })), 'THINKING_UPDATED_INVALID_TYPE', 'thinking_updated');
    assertThinkingError(() => resolve(valid({ thinking_boundary: value })), 'THINKING_BOUNDARY_INVALID_TYPE', 'thinking_boundary');
  }
});

test('accepts only exact lowercase exploring and rejects unknown values and wrong types', () => {
  for (const status of ['stable', 'published', 'revising', 'Exploring', 'EXPLORING', ' exploring ', '']) {
    assertThinkingError(() => resolve(valid({ thinking_status: status })), 'THINKING_STATUS_UNSUPPORTED', 'thinking_status');
  }
  for (const status of [undefined, null, 1, true, {}, []]) {
    assertThinkingError(() => resolve(valid({ thinking_status: status })), 'THINKING_STATUS_INVALID_TYPE', 'thinking_status');
  }
});

test('accepts real Gregorian dates and rejects noncanonical, impossible, and non-string dates', () => {
  for (const updated of ['0001-01-01', '2000-02-29', '2024-02-29', '2026-09-27', '9999-12-31']) {
    assert.equal(resolve(valid({ thinking_updated: updated })).updated, updated);
  }
  for (const updated of [
    '0000-01-01', '1900-02-29', '2023-02-29', '2024-04-31', '2024-13-01',
    '2024-00-01', '2024-01-00', '2024-01-32', '2024/01/01', '2024-1-01',
    ' 2024-01-01', '2024-01-01 ', '2024-01-01T00:00:00Z', ''
  ]) {
    assertThinkingError(() => resolve(valid({ thinking_updated: updated })), 'THINKING_UPDATED_INVALID_DATE', 'thinking_updated');
  }
  for (const updated of [undefined, null, new Date('2024-01-01T00:00:00Z'), 20240101, {}]) {
    assertThinkingError(() => resolve(valid({ thinking_updated: updated })), 'THINKING_UPDATED_INVALID_TYPE', 'thinking_updated');
  }
});

test('requires boundary text to be a string with non-whitespace content', () => {
  assert.equal(resolve(valid({ thinking_boundary: '\t 適用於單人專案 \n' })).boundary, '適用於單人專案');
  for (const boundary of ['', ' ', '\t\r\n', '　']) {
    assertThinkingError(() => resolve(valid({ thinking_boundary: boundary })), 'THINKING_BOUNDARY_EMPTY', 'thinking_boundary');
  }
  for (const boundary of [undefined, null, 1, true, {}, []]) {
    assertThinkingError(() => resolve(valid({ thinking_boundary: boundary })), 'THINKING_BOUNDARY_INVALID_TYPE', 'thinking_boundary');
  }
});

test('does not mutate front matter or allow output/constant mutation to affect later calls', () => {
  const input = valid();
  const before = { ...input };
  const result = resolve(input);
  assert.deepEqual(input, before);
  assert.throws(() => { result.boundary = 'changed'; }, TypeError);
  assert.throws(() => THINKING_FIELDS.push('other'), TypeError);
  assert.equal(resolve(valid()).boundary, '個人實作經驗');
  assert.throws(() => { EXPLORING_STATUS = 'other'; }, TypeError);
});

test('thinking resolution is independent of surfaces and other article status fields', () => {
  const combinations = [
    {},
    { surfaces: ['profile'] },
    { surfaces: ['memory'] },
    { surfaces: ['profile', 'memory'] },
    { surfaces: ['memory', 'profile'] },
    { profile: true, learning_status: 'active' },
    { status: 'published-note', category: ['學習'] }
  ];
  const outcomes = combinations.map(extra => resolve({ ...valid(), ...extra }));
  for (const outcome of outcomes.slice(1)) assert.deepEqual(outcome, outcomes[0]);
  assert.notStrictEqual(outcomes[0], outcomes[1]);
});

test('errors expose stable source and field context without echoing content', () => {
  const privateBody = 'unique secret body phrase';
  let captured;
  try {
    resolve({ ...valid({ thinking_status: 'stable' }), body: privateBody }, 'posts/example.md');
  } catch (error) {
    captured = error;
  }
  assert.equal(captured.code, 'THINKING_STATUS_UNSUPPORTED');
  assert.equal(captured.source, 'posts/example.md');
  assert.equal(captured.field, 'thinking_status');
  assert.equal(captured.message.includes(privateBody), false);
  assert.equal(captured.message.includes('stable'), false);
});

test('rejects non-object front matter with a stable contract error', () => {
  for (const frontMatter of [null, undefined, [], 'article']) {
    assertThinkingError(() => resolve(frontMatter), 'THINKING_INVALID_RECORD', 'front matter');
  }
});
