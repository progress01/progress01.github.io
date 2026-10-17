const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readReceipt, runNpmScript, runVerification, verificationStages } = require('../verification');

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
  assert.deepEqual(candidate, { action: 'auto', level: 'content', reused: false, deployed: false });
  assert.ok(candidateCalls.includes('check:content'));
  assert.ok(candidateCalls.includes('check:profile-home'));
  assert.ok(candidateCalls.includes('check:site'));
  assert.ok(!candidateCalls.includes('test:regression'));
  assert.equal(readReceipt(receiptPath).fullSourceFingerprint, fullBaseline);

  const deployCalls = [];
  const deployed = runVerification({ action: 'deploy', root, receiptPath, clock, runner: stage => deployCalls.push(stage) });
  assert.deepEqual(deployed, { action: 'deploy', level: 'content', reused: true, deployed: true });
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
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) }).level, 'content');
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

test('adding, editing and deleting raster images and microblog data uses content checks', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  fs.mkdirSync(path.join(root, 'source/images'), { recursive: true });
  const photo = path.join(root, 'source/images/new-photo.webp');
  const edits = [
    () => fs.writeFileSync(photo, 'fixture image one'),
    () => fs.writeFileSync(photo, 'fixture image two'),
    () => fs.unlinkSync(photo),
    () => fs.writeFileSync(path.join(root, 'source/microblog.json'), '[]'),
    () => fs.writeFileSync(path.join(root, 'source/microblog.json'), '[{"id":"new","content":"new text"}]')
  ];
  for (const edit of edits) {
    edit();
    const calls = [];
    const result = runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) });
    assert.equal(result.level, 'content');
    assert.equal(result.reused, false);
    for (const check of ['check:content', 'check:microblog-history', 'build', 'check:site', 'check:public-output']) {
      assert.ok(calls.includes(check), check);
    }
    assert.ok(!calls.includes('test:regression'));
  }
  fs.writeFileSync(photo, 'image with a failed output check');
  const calls = [];
  assert.throws(() => runVerification({ action: 'deploy', root, receiptPath, clock,
    runner: fakeRunner(root, calls, { failAt: 'check:public-output' }) }), /failed check:public-output/);
  assert.ok(!calls.includes('deploy'));
  assert.equal(readReceipt(receiptPath), null);
});

test('ordinary notes reuse the result while executable, contract and other data inputs require full checks', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  for (const file of ['docs/new-review.md', 'docs/personal-navigation-progress.md', '網站維護更新手冊.md', 'AGENTS.md']) {
    fs.writeFileSync(path.join(root, file), 'documentation only');
  }
  const noteCalls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, noteCalls) }).reused, true);
  assert.deepEqual(noteCalls, []);

  for (const file of [
    'docs/dual-surface-visual-rules.md', 'docs/config.json', 'source/new-page.md', 'source/_data/content-tags.yml', 'tools/check-script.js',
    'source/images/script.js', 'source/images/interactive.svg', 'tools/data/migration.json',
    '_config.yml'
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'changed input');
    const calls = [];
    const result = runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) });
    assert.equal(result.level, 'full', file);
    assert.equal(result.reused, false, file);
    assert.ok(calls.includes('test:regression'), file);
  }
});

test('life and reading desk changes use content verification while output checks remain enabled', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });

  const changes = [
    ['source/life-index.json', () => fs.writeFileSync(path.join(root, 'source/life-index.json'), '{"current":{"listen":{"title":"new"}}}\n')],
    ['source/reading-desk.yml', () => fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), 'topics:\n  - id: topic\n    name: New\n    items: []\n')],
    ['source/life-index.json modify', () => fs.writeFileSync(path.join(root, 'source/life-index.json'), '{"current":{"listen":{"title":"changed"}}}\n')],
    ['source/reading-desk.yml modify', () => fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), 'topics: []\n')],
    ['source/life-index.json delete', () => fs.unlinkSync(path.join(root, 'source/life-index.json'))],
    ['source/reading-desk.yml delete', () => fs.unlinkSync(path.join(root, 'source/reading-desk.yml'))]
  ];
  for (const [file, change] of changes) {
    change();
    const calls = [];
    const result = runVerification({ root, receiptPath, clock, runner: fakeRunner(root, calls) });
    assert.equal(result.level, 'content', file);
    assert.ok(calls.includes('check:content'), file);
    assert.ok(calls.includes('clean') && calls.includes('build'), file);
    assert.ok(calls.includes('check:record-data-output'), file);
    assert.ok(!calls.includes('test:regression'), file);
  }
});

test('previous receipt versions and explicit full mode cannot skip the complete suite', t => {
  const { root, receiptPath, clock } = makeFixture(t);
  runVerification({ root, receiptPath, clock, runner: fakeRunner(root, []) });
  const oldReceipt = readReceipt(receiptPath);
  oldReceipt.version = 1;
  fs.writeFileSync(receiptPath, JSON.stringify(oldReceipt));
  const upgradeCalls = [];
  assert.equal(runVerification({ root, receiptPath, clock, runner: fakeRunner(root, upgradeCalls) }).level, 'full');
  assert.ok(upgradeCalls.includes('test:regression'));
  const forcedCalls = [];
  assert.equal(runVerification({ action: 'full', root, receiptPath, clock, runner: fakeRunner(root, forcedCalls) }).reused, false);
  assert.ok(forcedCalls.includes('test:regression'));
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
  assert.equal(refreshed.level, 'content');
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
  assert.ok(!verificationStages('content').includes('test:regression'));
});

test('file-output runner captures real child stdout and stderr and reports failed-child details', t => {
  const { root } = makeFixture(t);
  const logPath = path.join(root, 'node_modules/.cache', 'runner.log');
  runNpmScript('fixture-success', root, {
    output: 'file', logPath, command: process.execPath,
    args: ['-e', "process.stdout.write('child stdout marker\\n'); process.stderr.write('child stderr marker\\n');"]
  });
  const successLog = fs.readFileSync(logPath, 'utf8');
  assert.match(successLog, /child stdout marker/);
  assert.match(successLog, /child stderr marker/);
  assert.match(successLog, /完成：fixture-success/);

  assert.throws(() => runNpmScript('fixture-failure', root, {
    output: 'file', logPath, command: process.execPath,
    args: ['-e', "process.stdout.write('failure stdout marker\\n'); process.stderr.write('failure stderr marker\\n'); process.exit(7);"]
  }), error => {
    assert.match(error.message, /結束代碼 7/);
    assert.match(error.message, /failure stderr marker/);
    assert.match(error.message, new RegExp(path.resolve(logPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(error.logPath, path.resolve(logPath));
    return true;
  });
  const failedLog = fs.readFileSync(logPath, 'utf8');
  assert.match(failedLog, /failure stdout marker/);
  assert.match(failedLog, /failure stderr marker/);
});

test('Windows runner invokes real npm scripts and lifecycle hooks from a path containing spaces', { skip: process.platform !== 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog verify space-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'hexo', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'hexo', 'package.json'), JSON.stringify({ bin: { hexo: './bin/hexo.js' } }));
  fs.writeFileSync(path.join(root, 'node_modules', 'hexo', 'bin', 'hexo.js'), [
    "process.stdout.write(`hexo:${process.argv.slice(2).join(',')}:${process.cwd().includes(' ')}\\n`);"
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    private: true,
    scripts: {
      'precompat-success': 'node tools/compat-marker.js pre',
      'compat-success': 'node tools/compat-marker.js success',
      'postcompat-success': 'node tools/compat-marker.js post',
      'compat-failure': 'node tools/compat-marker.js failure'
    }
  }));
  fs.writeFileSync(path.join(root, 'tools/compat-marker.js'), [
    "const path = require('node:path');",
    "const phase = process.argv[2];",
    "process.stdout.write(`${process.env.npm_lifecycle_event}:${phase}:${process.cwd().includes(' ')}:${process.env.PATH.includes(path.join(process.cwd(), 'node_modules', '.bin'))}\\n`);",
    "process.stderr.write(`stderr:${phase}\\n`);",
    "if (phase === 'failure') process.exitCode = 7;"
  ].join('\n'));

  const logPath = path.join(root, 'runner log.txt');
  const runnerModule = require.resolve('../verification');
  const runnerCode = `require(${JSON.stringify(runnerModule)}).runNpmScript('compat-success', ${JSON.stringify(root)}, { output: 'file', logPath: ${JSON.stringify(logPath)} });`;
  const runnerProcess = spawnSync(process.execPath, ['-e', runnerCode], { cwd: root, encoding: 'utf8' });
  assert.equal(runnerProcess.status, 0, runnerProcess.stderr);
  assert.doesNotMatch(runnerProcess.stderr, /DEP0190/);
  const successLog = fs.readFileSync(logPath, 'utf8');
  for (const phase of ['precompat-success:pre', 'compat-success:success', 'postcompat-success:post']) {
    assert.match(successLog, new RegExp(`${phase}:true:true`));
  }

  const deployLogPath = path.join(root, 'deploy log.txt');
  runNpmScript('deploy', root, { output: 'file', logPath: deployLogPath });
  assert.match(fs.readFileSync(deployLogPath, 'utf8'), /hexo:deploy:true/);

  const brokenRoot = path.join(root, 'broken');
  fs.mkdirSync(path.join(brokenRoot, 'node_modules'), { recursive: true });
  const brokenLogPath = path.join(brokenRoot, 'deploy log.txt');
  assert.throws(() => runNpmScript('deploy', brokenRoot, { output: 'file', logPath: brokenLogPath }), error => {
    assert.match(error.message, /無法讀取 Hexo CLI 宣告/);
    assert.match(error.message, new RegExp(path.resolve(brokenLogPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(error.logPath, path.resolve(brokenLogPath));
    return true;
  });
  assert.match(fs.readFileSync(brokenLogPath, 'utf8'), /開始：deploy/);

  assert.throws(() => runNpmScript('compat-failure', root, { output: 'file', logPath }), error => {
    assert.match(error.message, /結束代碼 7/);
    assert.match(error.message, /stderr:failure/);
    assert.equal(error.logPath, path.resolve(logPath));
    return true;
  });
  assert.match(fs.readFileSync(logPath, 'utf8'), /compat-failure:failure:true:true/);
});

test('successful child status is preserved when the completion log marker cannot be written', t => {
  const { root } = makeFixture(t);
  const logPath = path.join(root, 'node_modules/.cache', 'runner.log');
  const warnings = [];
  const originalWriteSync = fs.writeSync;
  let writes = 0;
  fs.writeSync = (...args) => {
    writes++;
    if (writes === 2) throw new Error('disk full after child success');
    return originalWriteSync(...args);
  };
  try {
    assert.doesNotThrow(() => runNpmScript('fixture-success', root, {
      output: 'file', logPath, command: process.execPath,
      args: ['-e', "process.stdout.write('deployment finished\\n');"],
      warn: message => warnings.push(message)
    }));
  } finally {
    fs.writeSync = originalWriteSync;
  }
  assert.equal(writes, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /disk full after child success/);
  assert.match(fs.readFileSync(logPath, 'utf8'), /deployment finished/);
});
