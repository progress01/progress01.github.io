'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const plan = require('../data/microblog-boundary-migration.v1.json');

const projectRoot = path.resolve(__dirname, '../..');
const sourcePath = path.join(projectRoot, plan.source);

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

function assertMigrationState(baseline, current, plan) {
  const decisions = new Map(plan.records.map(record => [record.id, record]));
  const expectedD = [...decisions.values()].filter(record => record.decision === 'D');
  const expectedV = [...decisions.values()].filter(record => record.decision === 'V');

  assert.equal(plan.schemaVersion, 1);
  assert.equal(baseline.length, plan.expectedPublicCount + 1);
  assert.equal(expectedD.length, 2);
  assert.equal(expectedV.length, 1);
  assert.equal(plan.retiredIds.length, 1);
  assert.equal(plan.retiredIds[0], expectedV[0].id);
  assert.equal(plan.historyPolicy, 'no-tombstone; never-reuse-id');
  assert.ok(current.length >= plan.expectedPublicCount, 'historical IDs must remain while later public records may be added');
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
  assert.ok(expectedIdsAfterMigration.every(id => currentIds.includes(id)), 'historical public IDs must remain stable');
  const laterAdditions = current.filter(item => !historicalIds.has(item.id));
  assert.ok(laterAdditions.every(item => Array.isArray(item.surfaces) && item.surfaces.length > 0), 'later additions must declare their publication surfaces explicitly');

  const sourceIds = new Set(current.map(item => item.id));
  assert.equal([...plan.retiredIds].some(id => sourceIds.has(id)), false, 'retired IDs must not be reused');
}

test('current microblogs preserve approved D/V protections and stable historical IDs', () => {
  assertMigrationState(baselineRecords(), parseSafely(fs.readFileSync(sourcePath, 'utf8')), plan);
});

function fixtureState() {
  const plan = {
    schemaVersion: 1, expectedPublicCount: 4, historyPolicy: 'no-tombstone; never-reuse-id',
    records: [
      { id: 'd1', decision: 'D', publicContent: 'approved alpha' },
      { id: 'd2', decision: 'D', publicContent: 'approved beta' },
      { id: 'v1', decision: 'V' }
    ], retiredIds: ['v1']
  };
  const baseline = ['d1', 'd2', 'v1', 'p1', 'p2'].map(id => ({
    id, content: `fixture old ${id}`, date: '2026-09-01', tag: '生活', surfaces: ['memory']
  }));
  const current = baseline.filter(item => item.id !== 'v1').map(item => ({
    ...item, content: plan.records.find(rule => rule.id === item.id)?.publicContent || item.content
  }));
  return { plan, baseline, current };
}

test('ordinary public microblogs may change text, metadata and order without changing IDs', () => {
  const { plan, baseline, current } = fixtureState();
  Object.assign(current.find(item => item.id === 'p1'), {
    content: 'edited public text', date: '2026-10-14', tag: '學習', surfaces: ['profile', 'memory']
  });
  current.reverse();
  current.splice(1, 0, { id: 'new1', content: 'new entry', surfaces: ['memory'] });
  assertMigrationState(baseline, current, plan);
});

test('edited D text or metadata, retired IDs, and lost or duplicate public IDs still fail', () => {
  const changes = [
    state => { state.current[0].content = 'unapproved'; },
    state => { state.current[0].date = '2026-10-14'; },
    state => { state.current[0].tag = 'different'; },
    state => { state.current[0].extra = 'field'; },
    state => { state.current.push(state.baseline.find(item => item.id === 'v1')); },
    state => { state.current.find(item => item.id === 'p1').id = 'replacement-id'; },
    state => { state.current.push({ ...state.current.find(item => item.id === 'p1') }); }
  ];
  for (const change of changes) {
    const state = fixtureState();
    change(state);
    assert.throws(() => assertMigrationState(state.baseline, state.current, state.plan), assert.AssertionError);
  }
});
