const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readReceipt, runVerification, verificationStages } = require('../verification');

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-verify-'));
  t.after(() => {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'blog-verify-')));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const directory of ['source/_posts', 'source/_data', 'themes', 'tools', 'node_modules']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'source/_posts/article.md'), 'first version\n');
  fs.writeFileSync(path.join(root, 'themes/site.css'), 'body { color: black; }\n');
  fs.writeFileSync(path.join(root, 'tools/check.js'), 'module.exports = true;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{}}\n');
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  const receiptPath = path.join(root, 'node_modules', '.cache', 'receipt.json');
  const clock = () => new Date('2026-10-13T04:00:00.000Z');
  return { root, receiptPath, clock };
}

function fakeRunner(root, calls, { failAt, mutateAt, mutatePublicAt } = {}) {
  return stage => {
    calls.push(stage);
    if (stage === failAt) throw new Error(`failed ${stage}`);
    if (stage === 'clean') fs.rmSync(path.join(root, 'public'), { recursive: true, force: true });
    if (stage === 'build') {
      fs.mkdirSync(path.join(root, 'public'), { recursive: true });
      fs.writeFileSync(path.join(root, 'public', 'index.html'), fs.readFileSync(path.join(root, 'source/_posts/article.md'), 'utf8'));
    }
    if (stage === mutateAt) fs.appendFileSync(path.join(root, 'source/_posts/article.md'), 'changed while checking\n');
    if (stage === mutatePublicAt) fs.appendFileSync(path.join(root, 'public/index.html'), ' changed during output checks');
  };
}

test('first verify is full, article-only changes use the candidate path, and deploy reuses exact receipt', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  const firstCalls = [];
  const first = runVerification({ root, receiptPath, clock, runner: fakeRunner(root, firstCalls) });
  assert.equal(first.level, 'full');
  assert.ok(firstCalls.indexOf('build') < firstCalls.indexOf('test:regression'));
  assert.equal(firstCalls.at(-1), 'test:regression');
  const fullBaseline = readReceipt(receiptPath).fullSourceFingerprint;

  fs.writeFileSync(path.join(root, 'source/_posts/article.md'), 'edited body and updated date\n');
  const candidateCalls = [];
  const candidate = runVerification({ root, receiptPath, clock, runner: fakeRunner(root, candidateCalls) });
  assert.deepEqual(candidate, { action: 'auto', level: 'article', reused: false, deployed: false });
  assert.ok(candidateCalls.includes('check:content'));
  assert.ok(candidateCalls.includes('check:profile-home'));
  assert.ok(candidateCalls.includes('check:site'));
  assert.ok(!candidateCalls.includes('test:regression'));
  assert.equal(readReceipt(receiptPath).fullSourceFingerprint, fullBaseline);

  const deployCalls = [];
  const deployed = runVerification({ action: 'deploy', root, receiptPath, clock, runner: stage => deployCalls.push(stage) });
  assert.deepEqual(deployed, { action: 'deploy', level: 'article', reused: true, deployed: true });
  assert.deepEqual(deployCalls, ['deploy']);
});

test('code, untracked inputs, and dependency metadata changes force full verification', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  const full = () => runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  full();

  fs.writeFileSync(path.join(root, 'themes/site.css'), 'body { color: blue; }\n');
  let calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'full');
  assert.ok(calls.includes('test:regression'));

  fs.writeFileSync(path.join(root, 'tools/new-untracked-check.js'), 'module.exports = false;\n');
  calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'full');

  fs.writeFileSync(path.join(root, 'public/index.html'), 'manually changed output');
  calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'article');
  assert.ok(calls.includes('build'));
  assert.ok(!calls.includes('test:regression'));

  fs.mkdirSync(path.join(root, 'node_modules', '.cache'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', '.package-lock.json'), '{"packages":{"changed":true}}');
  calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'full');
});

test('source files named like root temp files remain fingerprinted', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  const first = runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  assert.equal(first.level, 'full');

  fs.writeFileSync(path.join(root, 'source/_data/db.json'), '{"new":true}\n');
  fs.writeFileSync(path.join(root, 'source/_data/import.log'), 'deployed source data\n');
  const calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'full');
  assert.ok(calls.includes('test:regression'));
});

test('missing or malformed receipt requires a full baseline', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  fs.appendFileSync(path.join(root, 'source/_posts/article.md'), 'article edit\n');
  fs.unlinkSync(receiptPath);
  let calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'full');
  assert.ok(calls.includes('test:regression'));

  fs.appendFileSync(path.join(root, 'source/_posts/article.md'), 'another article edit\n');
  fs.writeFileSync(receiptPath, '{broken json');
  calls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'full');
  assert.ok(calls.includes('test:regression'));
});

test('time-dependent checks refresh on a new Taipei day', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  const nextDay = () => new Date('2026-10-13T16:30:00.000Z');
  const calls = [];
  const refreshed = runVerification({ root, receiptPath, clock: nextDay, runner: fakeRunner(root, calls) });
  assert.equal(refreshed.level, 'article');
  assert.ok(calls.includes('check:content'));
  assert.ok(calls.includes('build'));
});

test('failed, mutated, or changed-before-deploy inputs never issue a receipt or deploy', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });

  fs.writeFileSync(path.join(root, 'source/_posts/article.md'), 'candidate text\n');
  const failedCalls = [];
  assert.throws(() => runVerification({
    action: 'deploy', root, receiptPath, clock,
    runner: fakeRunner(root, failedCalls, { failAt: 'check:content' })
  }), /failed check:content/);
  assert.ok(!failedCalls.includes('deploy'));
  assert.equal(readReceipt(receiptPath), null);

  const changedCalls = [];
  assert.throws(() => runVerification({
    root, receiptPath, clock,
    runner: fakeRunner(root, changedCalls, { mutateAt: 'build' })
  }), /inputs changed while checks were running/);
  assert.equal(readReceipt(receiptPath), null);

  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  fs.appendFileSync(path.join(root, 'source/_posts/article.md'), 'new candidate after baseline\n');
  const publicCalls = [];
  assert.throws(() => runVerification({
    root, receiptPath, clock,
    runner: fakeRunner(root, publicCalls, { mutatePublicAt: 'check:site' })
  }), /public output changed while output checks were running/);
  assert.equal(readReceipt(receiptPath), null);

  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  fs.appendFileSync(path.join(root, 'source/_posts/article.md'), 'publishable candidate\n');
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  let clockCalls = 0;
  const changingClock = () => {
    clockCalls += 1;
    if (clockCalls === 2) fs.appendFileSync(path.join(root, 'source/_posts/article.md'), 'late edit\n');
    return clock();
  };
  const preDeployCalls = [];
  assert.throws(() => runVerification({
    action: 'deploy', root, receiptPath, clock: changingClock,
    runner: stage => preDeployCalls.push(stage)
  }), /changed before deploy/);
  assert.ok(!preDeployCalls.includes('deploy'));
  assert.equal(readReceipt(receiptPath), null);
});

test('both verification routes build before public-dependent regression tests', () => {
  const full = verificationStages('full');
  assert.ok(full.indexOf('build') < full.indexOf('test:regression'));
  assert.ok(!verificationStages('article').includes('test:regression'));
});
