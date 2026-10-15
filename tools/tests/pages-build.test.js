'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyPagesBuild, queryPagesBuild, PAGES_BUILDS_ENDPOINT } = require('../pages-build');

const expected = 'a'.repeat(40);

test('only a built Pages commit exactly matching the deployment SHA is confirmed', () => {
  assert.equal(classifyPagesBuild({ status: 'built', commit: expected }, expected).status, 'confirmed');
  assert.equal(classifyPagesBuild({ status: 'built', commit: 'b'.repeat(40) }, expected).status, 'pending');
  assert.equal(classifyPagesBuild({ status: 'queued', commit: expected }, expected).status, 'pending');
  assert.equal(classifyPagesBuild({ status: 'errored', commit: expected, error: { message: 'build error' } }, expected).status, 'failed');
  assert.equal(classifyPagesBuild({ status: 'errored', commit: 'b'.repeat(40) }, expected).status, 'pending');
  assert.equal(classifyPagesBuild({ status: 'failed', commit: expected }, expected).status, 'failed');
  assert.equal(classifyPagesBuild({ status: 'building', commit: expected }, expected).status, 'pending');
});

test('gh Pages request uses argv, shell:false and a bounded timeout', () => {
  let actual;
  const result = queryPagesBuild({ deploymentSha: expected, timeoutMs: 1234, gh: (file, args, options) => {
    actual = { file, args, options };
    return { status: 0, stdout: JSON.stringify({ status: 'built', commit: expected }) };
  } });
  assert.equal(result.status, 'confirmed');
  assert.deepEqual(actual.args, ['api', PAGES_BUILDS_ENDPOINT]);
  assert.equal(actual.options.shell, false);
  assert.equal(actual.options.timeout, 1234);
});

test('gh missing, permissions/network errors, malformed JSON and timeouts are unavailable', () => {
  assert.equal(queryPagesBuild({ deploymentSha: expected, gh: () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; } }).status, 'unavailable');
  assert.equal(queryPagesBuild({ deploymentSha: expected, gh: () => ({ status: 1, stderr: 'auth required' }) }).status, 'unavailable');
  assert.equal(queryPagesBuild({ deploymentSha: expected, gh: () => ({ status: 0, stdout: '{' }) }).status, 'unavailable');
  assert.match(queryPagesBuild({ deploymentSha: expected, gh: () => ({ status: null, error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }) }).reason, /逾時/);
});

test('Windows gh lookup falls back to ProgramFiles when PATH lookup is missing', () => {
  const previousPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const previousProgramFiles = process.env.ProgramFiles;
  Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
  process.env.ProgramFiles = 'C:\\Tools';
  const calls = [];
  try {
    const result = queryPagesBuild({ deploymentSha: expected, gh: (file, args, options) => {
      calls.push({ file, args, options });
      if (calls.length === 1) return { error: Object.assign(new Error('missing'), { code: 'ENOENT' }), status: null };
      return { status: 0, stdout: JSON.stringify({ status: 'built', commit: expected }) };
    } });
    assert.equal(result.status, 'confirmed');
    assert.deepEqual(calls.map(call => call.file), ['gh.exe', 'C:\\Tools\\GitHub CLI\\gh.exe']);
    assert.equal(calls[1].options.shell, false);
  } finally {
    Object.defineProperty(process, 'platform', previousPlatform);
    if (previousProgramFiles === undefined) delete process.env.ProgramFiles;
    else process.env.ProgramFiles = previousProgramFiles;
  }
});
