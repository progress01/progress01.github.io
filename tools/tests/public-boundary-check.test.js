'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditBoundary, formatReport } = require('../public-boundary-check');

const plan = {
  schemaVersion: 1,
  source: 'source/microblog.json',
  expectedPublicCount: 3,
  records: [
    { id: 'fixture-d1', decision: 'D', publicContent: 'approved public alpha' },
    { id: 'fixture-d2', decision: 'D', publicContent: 'approved public beta' },
    { id: 'fixture-v1', decision: 'V' }
  ],
  retiredIds: ['fixture-v1']
};
const baselineRecords = [
  { id: 'fixture-d1', content: 'fixture-original-alpha' },
  { id: 'fixture-d2', content: 'fixture-original-beta' },
  { id: 'fixture-v1', content: 'fixture-original-vanish' },
  { id: 'fixture-p1', content: 'published unchanged' }
];
const sourceRecords = [
  { id: 'fixture-d1', content: 'approved public alpha' },
  { id: 'fixture-d2', content: 'approved public beta' },
  { id: 'fixture-p1', content: 'published unchanged' }
];

function makeOutput(t, { microblog = sourceRecords, status = 'approved public alpha approved public beta' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-boundary-check-'));
  fs.mkdirSync(path.join(root, 'status'), { recursive: true });
  fs.mkdirSync(path.join(root, '.git', 'objects'), { recursive: true });
  fs.writeFileSync(path.join(root, 'microblog.json'), JSON.stringify(microblog));
  fs.writeFileSync(path.join(root, 'status', 'index.html'), status);
  fs.writeFileSync(path.join(root, '.git', 'objects', 'fixture'), 'fixture-original-alpha fixture-original-vanish fixture-v1');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function audit(root, options = {}) {
  return auditBoundary({ root, plan, baselineRecords, sourceRecords: options.sourceRecords || sourceRecords });
}

test('passes clean generated output and skips .git objects', t => {
  const root = makeOutput(t);
  const report = audit(root);
  assert.equal(report.ok, true);
  assert.equal(report.oldTextHits, 0);
  assert.equal(report.retiredIdHits, 0);
  assert.deepEqual(report.replacementPathCounts, [2, 2]);
});

test('detects an old D text without returning the matched text', t => {
  const root = makeOutput(t, { status: 'fixture-original-alpha' });
  const report = audit(root);
  assert.ok(report.errors.some(error => error.code === 'old_text_in_output'));
  assert.equal(report.oldTextHits, 1);
  assert.equal(formatReport(report).includes('fixture-original-alpha'), false);
});

test('detects V original text and the retired ID in outputs', t => {
  const root = makeOutput(t, { status: 'fixture-original-vanish fixture-v1' });
  const report = audit(root);
  assert.ok(report.errors.some(error => error.code === 'old_text_in_output'));
  assert.ok(report.errors.some(error => error.code === 'retired_id_in_output'));
  assert.equal(report.retiredIdHits, 1);
});

test('requires both approved D replacements in each output tree', t => {
  const root = makeOutput(t, { microblog: [], status: 'no replacement present' });
  const report = audit(root);
  assert.ok(report.errors.some(error => error.code === 'replacement_missing' && error.count === 2));
});

test('rejects a D mismatch or a V ID still present in the source', t => {
  const root = makeOutput(t);
  const invalidSource = [
    { id: 'fixture-d1', content: 'not approved' },
    { id: 'fixture-d2', content: 'approved public beta' },
    { id: 'fixture-v1', content: 'fixture-original-vanish' }
  ];
  const report = audit(root, { sourceRecords: invalidSource });
  assert.ok(report.errors.some(error => error.code === 'd_replacement_mismatch'));
  assert.ok(report.errors.some(error => error.code === 'retired_id_in_source'));
});

test('formatted diagnostics contain codes, paths, and counts, never fixture text or fingerprints', t => {
  const root = makeOutput(t, { status: 'fixture-original-beta sha256-fixture-beta fixture-v1' });
  const output = formatReport(audit(root));
  assert.equal(output.includes('fixture-original-beta'), false);
  assert.equal(output.includes('sha256-fixture-beta'), false);
  assert.match(output, /ERROR code=old_text_in_output path=\. count=1/);
  assert.match(output, /ERROR code=retired_id_in_output path=\. count=1/);
});
