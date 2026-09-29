'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const plan = require('../data/microblog-boundary-migration.v1.json');

const projectRoot = path.resolve(__dirname, '../..');
const sourcePath = path.join(projectRoot, plan.source);
const decisions = new Map(plan.records.map(record => [record.id, record]));

function parseSafely(raw) {
  try { return JSON.parse(raw); }
  catch { throw new Error('microblog migration JSON is invalid'); }
}

function baselineRecords() {
  const raw = execFileSync('git', ['show', `${plan.baselineCommit}:${plan.source}`], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  return parseSafely(raw);
}

test('核准的 D/D/V public boundary migration preserves its baseline while allowing later additions', () => {
  const baseline = baselineRecords();
  const current = parseSafely(fs.readFileSync(sourcePath, 'utf8'));
  const expectedD = [...decisions.values()].filter(record => record.decision === 'D');
  const expectedV = [...decisions.values()].filter(record => record.decision === 'V');

  assert.equal(plan.schemaVersion, 1);
  assert.equal(baseline.length, plan.expectedPublicCount + 1);
  assert.equal(expectedD.length, 2);
  assert.equal(expectedV.length, 1);
  assert.equal(plan.retiredIds.length, 1);
  assert.equal(plan.retiredIds[0], expectedV[0].id);
  assert.equal(plan.historyPolicy, 'no-tombstone; never-reuse-id');
  assert.ok(current.length >= plan.expectedPublicCount, 'later public records may append after the historical migration baseline');
  const currentIds = current.map(item => item?.id);
  assert.ok(currentIds.every(id => typeof id === 'string' && id.length > 0), 'all current records must keep a stable ID');
  assert.equal(new Set(currentIds).size, currentIds.length, 'current record IDs must remain unique');

  for (const record of expectedD) {
    const before = baseline.find(item => item.id === record.id);
    const after = current.find(item => item.id === record.id);
    assert.ok(before && after, 'approved D record must retain its ID');
    assert.equal(after.content === record.publicContent, true, 'D public replacement must match the approved text');
    assert.equal(after.date, before.date, 'D date must remain unchanged');
    assert.equal(after.tag, before.tag, 'D tag must remain unchanged');
    assert.equal(after.id, before.id, 'D ID must remain unchanged');
    assert.equal(JSON.stringify(Object.keys(after).sort()), JSON.stringify(Object.keys(before).sort()), 'D fields must remain unchanged');
  }

  for (const record of expectedV) {
    assert.equal(current.some(item => item.id === record.id), false, 'V ID must not remain in public source');
  }
  const expectedIdsAfterMigration = baseline.map(item => item.id).filter(id => !expectedV.some(record => record.id === id));
  const historicalIds = new Set(expectedIdsAfterMigration);
  const currentHistoricalIds = currentIds.filter(id => historicalIds.has(id));
  assert.equal(JSON.stringify(currentHistoricalIds), JSON.stringify(expectedIdsAfterMigration), 'historical records must keep their original relative order');
  const laterAdditions = current.filter(item => !historicalIds.has(item.id));
  assert.ok(laterAdditions.every(item => Array.isArray(item.surfaces) && item.surfaces.length > 0), 'later additions must declare their publication surfaces explicitly');

  const unchangedIds = new Set(baseline.map(item => item.id).filter(id => !decisions.has(id)));
  const beforeP = baseline.filter(item => unchangedIds.has(item.id));
  const afterP = current.filter(item => unchangedIds.has(item.id));
  assert.equal(unchangedIds.size, 19);
  assert.equal(afterP.length, 19);
  const samePublishedRecords = beforeP.length === afterP.length && beforeP.every((item, index) =>
    item.id === afterP[index].id && JSON.stringify(item) === JSON.stringify(afterP[index]));
  assert.equal(samePublishedRecords, true, 'the 19 P records must retain their values and relative order');

  const sourceIds = new Set(current.map(item => item.id));
  assert.equal([...plan.retiredIds].some(id => sourceIds.has(id)), false, 'retired IDs must not be reused');
});
