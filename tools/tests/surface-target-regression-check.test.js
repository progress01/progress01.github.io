'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { FIXED, SURFACE_CHECKS, parseArgs, validateFixedSamples } = require('../surface-target-regression-check');

test('fixed-sample contract follows later author approval for profile-only learning and the actual dual article', () => {
  assert.deepEqual(FIXED.learning.surfaces, ['profile']);
  assert.equal(FIXED.learning.deskId, 'reading-topic-07');
  assert.deepEqual(FIXED.dual.surfaces, ['profile', 'memory']);
  assert.equal(FIXED.dual.url, '/work/flow-friendly-work-system/');
});

test('target command requires an isolated output under tmp and cannot inspect formal public', () => {
  assert.throws(() => parseArgs([]), /missing_root/);
  assert.throws(() => parseArgs(['--root', 'public']), /root_must_be_isolated_under_tmp/);
  const parsed = parseArgs(['--root', 'tmp/wbs101-public-20260927']);
  assert.equal(parsed.root, path.resolve('tmp/wbs101-public-20260927'));
});

test('all target regression entries point to read-only checkers and use the supplied isolated root', () => {
  assert.ok(SURFACE_CHECKS.length >= 15);
  for (const [, script] of SURFACE_CHECKS) assert.ok(script.startsWith('tools/'));
  assert.equal(validateFixedSamples({}).errors[0].code, 'root_required');
});
