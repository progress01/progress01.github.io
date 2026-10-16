'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { git, parseArgs, planPublication, readState, runPublication, confirmPages, writeState, createProgressLogger } = require('../publish');

const article = 'source/_posts/中文 空白 & [稿].md';
function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-publish-'));
  t.after(() => {
    assert.ok(folder.startsWith(path.join(os.tmpdir(), 'blog-publish-')));
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const root = path.join(folder, 'working');
  const remote = path.join(folder, 'remote.git');
  fs.mkdirSync(root); fs.mkdirSync(remote);
  git(remote, ['init', '--bare']);
  git(root, ['init', '--initial-branch=source']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  git(root, ['config', 'core.hooksPath', path.join(folder, 'no-hooks')]);
  git(root, ['remote', 'add', 'origin', remote]);
  fs.mkdirSync(path.dirname(path.join(root, article)), { recursive: true });
  fs.writeFileSync(path.join(root, article), 'original\n');
  fs.writeFileSync(path.join(root, '_config.yml'), `deploy:\n  type: git\n  branch: main\n  repo: ${JSON.stringify(remote)}\n`);
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\npublic/\n*.secret\n');
  git(root, ['add', '--', article, '_config.yml', '.gitignore']);
  git(root, ['commit', '-m', 'baseline']);
  git(root, ['push', 'origin', 'source']);
  const initial = git(root, ['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(path.join(root, article), 'edited\n');
  const events = [];
  const pagesCalls = [];
  const deploymentSha = 'a'.repeat(40);
  const options = { root, repository: remote, message: '更新 & $(literal)', execute: true,
    log: () => {}, verify: () => events.push('verify'),
    push: commit => { events.push('push'); git(root, ['push', 'origin', `${commit}:refs/heads/source`]); },
    deploy: guard => { guard(); events.push('deploy'); },
    resolveSha: () => deploymentSha,
    queryPages: ({ deploymentSha: sha, timeoutMs }) => { pagesCalls.push({ sha, timeoutMs }); return { status: 'confirmed', build: { status: 'built', commit: sha } }; },
    sleep: () => {} };
  return { root, remote, initial, events, pagesCalls, deploymentSha, options,
    statePath: path.join(root, 'node_modules/.cache/blog-publish-state.json') };
}

test('progress continues displaying completed stages after a log append failure, warning only once', () => {
  const displayed = [];
  const warnings = [];
  let attempts = 0;
  const progress = createProgressLogger('D:\\missing\\publish.log', message => displayed.push(message), {
    append: () => { attempts++; throw new Error('disk full'); },
    warn: message => warnings.push(message)
  });
  progress('Pages 已確認完成部署。');
  progress('後續進度仍可顯示。');
  assert.deepEqual(displayed, ['Pages 已確認完成部署。', '後續進度仍可顯示。']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /disk full/);
  assert.equal(attempts, 1);
});

test('preview is read-only and CLI flags cannot silently execute', t => {
  const f = fixture(t);
  const result = runPublication({ ...f.options, execute: false });
  assert.deepEqual(result, { preview: true, ready: true });
  assert.deepEqual(f.events, []);
  assert.equal(git(f.root, ['rev-parse', 'HEAD']).trim(), f.initial);
  assert.equal(fs.existsSync(f.statePath), false);
  assert.equal(fs.existsSync(path.join(f.root, 'node_modules')), false);
  assert.deepEqual(f.pagesCalls, []);
  assert.throws(() => parseArgs(['--excute']), /未知選項/);
  assert.throws(() => parseArgs([article]), /不需指定檔案/);
  assert.throws(() => parseArgs(['--message']), /缺少/);
});

test('one execution verifies, commits all current changes with literal paths, backs up, then deploys', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'notes.md'), 'unfinished notes');
  const output = [];
  const result = runPublication({ ...f.options, log: line => output.push(line) });
  assert.deepEqual(f.events, ['verify', 'push', 'deploy']);
  assert.equal(result.backedUp, true);
  assert.equal(readState(f.statePath).stage, 'deployed');
  assert.equal(readState(f.statePath).deploymentSha, f.deploymentSha);
  assert.equal(result.pages, 'confirmed');
  assert.deepEqual(f.pagesCalls, [{ sha: f.deploymentSha, timeoutMs: 10000 }]);
  assert.equal(git(f.root, ['log', '-1', '--format=%s']).trim(), '更新 & $(literal)');
  assert.equal(git(f.root, ['ls-remote', '--heads', 'origin', 'source']).split(/\s/)[0], result.commit);
  assert.equal(git(f.root, ['diff', '--cached', '--name-only']), '');
  assert.equal(fs.readFileSync(path.join(f.root, 'notes.md'), 'utf8'), 'unfinished notes');
  assert.equal(git(f.root, ['ls-files', '--', 'notes.md']).trim(), 'notes.md');
  assert.ok(output.some(line => line.includes('2 個原稿檔案')));
  assert.ok(output.some(line => line.includes('source 已備份')));
  assert.ok(output.some(line => line.includes('GitHub Pages 已確認完成部署')));
  assert.ok(!output.join('\n').includes(article));
  assert.ok(!/[a-f0-9]{9}/i.test(output.join('\n')));
  const logs = fs.readdirSync(path.join(f.root, 'node_modules/.cache')).filter(name => name.startsWith('blog-publish-') && name.endsWith('.log'));
  assert.equal(logs.length, 1);
});

test('Pages pending or query errors keep the successfully deployed stage', t => {
  const f = fixture(t);
  const state = { version: 1, stage: 'deployed', commit: 'c'.repeat(40), fingerprint: 'd'.repeat(64), repository: f.remote };
  writeState(f.statePath, state);
  const pending = confirmPages({ root: f.root, repository: f.remote, state, statePath: f.statePath,
    resolveSha: () => f.deploymentSha, queryPages: () => ({ status: 'pending' }), sleep: () => {} });
  assert.equal(pending.status, 'pending');
  assert.equal(readState(f.statePath).stage, 'deployed');
  const unavailable = confirmPages({ root: f.root, repository: f.remote, state, statePath: f.statePath,
    resolveSha: () => f.deploymentSha, queryPages: () => { throw new Error('network down'); } });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(readState(f.statePath).stage, 'deployed');
});

test('legacy deployed state without a saved SHA is never guessed', () => {
  const { saveDeploymentSha } = require('../publish');
  assert.equal(saveDeploymentSha({ state: { stage: 'deployed' } }), null);
});

test('deployment SHA is accepted only when local deploy HEAD and remote main match it', t => {
  const { saveDeploymentSha } = require('../publish');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-pages-sha-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const root = path.join(folder, 'root');
  const deploy = path.join(root, '.deploy_git');
  const remote = path.join(folder, 'remote.git');
  fs.mkdirSync(deploy, { recursive: true });
  fs.mkdirSync(remote, { recursive: true });
  git(remote, ['init', '--bare']);
  git(deploy, ['init', '--initial-branch=main']);
  git(deploy, ['config', 'user.name', 'Fixture']);
  git(deploy, ['config', 'user.email', 'fixture@example.test']);
  fs.writeFileSync(path.join(deploy, 'index.html'), 'first');
  git(deploy, ['add', 'index.html']);
  git(deploy, ['commit', '-m', 'first']);
  const savedSha = git(deploy, ['rev-parse', 'HEAD']).trim();
  git(deploy, ['push', remote, 'HEAD:refs/heads/main']);
  const state = { stage: 'deployed', deploymentSha: savedSha };
  assert.equal(saveDeploymentSha({ root, repository: remote, state }), savedSha);
  fs.writeFileSync(path.join(deploy, 'index.html'), 'second');
  git(deploy, ['commit', '-am', 'second']);
  git(deploy, ['push', remote, 'HEAD:refs/heads/main']);
  git(deploy, ['reset', '--hard', savedSha]);
  assert.equal(saveDeploymentSha({ root, repository: remote, state }), null);
});

test('other unfinished public records are included in the same publication', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'source/_posts/other.md'), 'unfinished');
  const plan = planPublication(f.options);
  assert.equal(plan.blockers.length, 0);
  runPublication(f.options);
  assert.deepEqual(f.events, ['verify', 'push', 'deploy']);
  assert.equal(git(f.root, ['show', 'HEAD:source/_posts/other.md']), 'unfinished');
  assert.equal(git(f.root, ['diff', '--cached', '--name-only']), '');
});

test('staged and unstaged source changes join the same whole-site backup', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'notes.md'), 'staged notes');
  git(f.root, ['add', '--', 'notes.md']);
  runPublication(f.options);
  assert.equal(git(f.root, ['show', 'HEAD:notes.md']), 'staged notes');
  assert.equal(git(f.root, ['diff', '--cached', '--name-only']), '');
});

test('ignored build inputs and wrong branches are blocked, while tracked deletions can be saved', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'source/leak.secret'), 'ignored build input');
  assert.ok(planPublication(f.options).blockers.some(reason => reason.includes('Git 忽略')));
  fs.unlinkSync(path.join(f.root, 'source/leak.secret'));
  fs.unlinkSync(path.join(f.root, article));
  assert.equal(planPublication(f.options).blockers.length, 0);
  runPublication(f.options);
  assert.equal(git(f.root, ['ls-files', '--', article]), '');
  git(f.root, ['checkout', '-b', 'other']);
  assert.ok(planPublication(f.options).blockers.some(reason => reason.includes('source 分支')));
});

test('verification failure does not commit, push or deploy', t => {
  const f = fixture(t);
  const failure = () => runPublication({ ...f.options, verify: () => { throw new Error('fixture validation failure'); } });
  let firstError;
  try { failure(); } catch (error) { firstError = error; }
  assert.match(firstError.message, /validation failure/);
  assert.equal(path.isAbsolute(firstError.logPath), true);
  assert.equal(fs.existsSync(firstError.logPath), true);
  const firstLog = fs.readFileSync(firstError.logPath, 'utf8');
  let secondError;
  try { failure(); } catch (error) { secondError = error; }
  assert.notEqual(secondError.logPath, firstError.logPath);
  assert.equal(fs.existsSync(firstError.logPath), true);
  assert.equal(fs.existsSync(secondError.logPath), true);
  assert.equal(fs.readFileSync(firstError.logPath, 'utf8'), firstLog);
  assert.equal(git(f.root, ['rev-parse', 'HEAD']).trim(), f.initial);
  assert.equal(git(f.root, ['diff', '--cached', '--name-only']), '');
  assert.deepEqual(f.events, []);
});

test('push failure preserves the commit and resume completes without a second commit', t => {
  const f = fixture(t);
  assert.throws(() => runPublication({ ...f.options, push: () => { throw new Error('offline'); } }), /offline/);
  const committed = git(f.root, ['rev-parse', 'HEAD']).trim();
  assert.notEqual(committed, f.initial);
  assert.equal(readState(f.statePath).stage, 'committed');
  assert.deepEqual(f.events, ['verify']);
  runPublication({ ...f.options, paths: [], resume: true });
  assert.equal(git(f.root, ['rev-parse', 'HEAD']).trim(), committed);
  assert.equal(readState(f.statePath).stage, 'deployed');
});

test('deployment failure retains backup; resume is idempotent after success', t => {
  const f = fixture(t);
  assert.throws(() => runPublication({ ...f.options, deploy: () => { throw new Error('deploy failed'); } }), /deploy failed/);
  const state = readState(f.statePath);
  assert.equal(state.stage, 'backed-up');
  assert.equal(git(f.root, ['ls-remote', '--heads', 'origin', 'source']).split(/\s/)[0], state.commit);
  runPublication({ ...f.options, paths: [], resume: true });
  const count = f.events.length;
  assert.equal(runPublication({ ...f.options, paths: [], resume: true }).alreadyDeployed, true);
  assert.equal(f.events.length, count);
  const oldDay = readState(f.statePath);
  oldDay.day = '2000-01-01';
  fs.writeFileSync(f.statePath, JSON.stringify(oldDay));
  runPublication(f.options);
  assert.deepEqual(f.events.slice(count), ['verify', 'push', 'deploy']);
});

test('changes during verification or after backup stop before deployment', t => {
  const f = fixture(t);
  const change = () => fs.appendFileSync(path.join(f.root, article), 'concurrent edit\n');
  assert.throws(() => runPublication({ ...f.options, verify: change }), /流程中改變/);
  assert.equal(git(f.root, ['rev-parse', 'HEAD']).trim(), f.initial);
  assert.throws(() => runPublication({ ...f.options, push: commit => { f.options.push(commit); change(); } }), /流程中改變/);
  assert.equal(f.events.includes('deploy'), false);
  assert.throws(() => runPublication({ ...f.options, paths: [], resume: true }), /條件尚未符合/);
});

test('the last deployment guard rejects a source change after deployment preparation', t => {
  const f = fixture(t);
  assert.throws(() => runPublication({ ...f.options, deploy: guard => {
    fs.appendFileSync(path.join(f.root, article), 'concurrent edit');
    guard();
    assert.fail('must not reach deployment');
  } }), /流程中改變/);
  assert.equal(readState(f.statePath).stage, 'backed-up');
});

test('an overlapping execution cannot acquire the publication lock', t => {
  const f = fixture(t);
  const lock = path.join(f.root, 'node_modules/.cache/blog-publish.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, 'existing');
  assert.throws(() => runPublication(f.options), /另一個發布流程/);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'existing');
});

test('editing after a successful deployment does not erase its completed status', t => {
  const f = fixture(t);
  const result = runPublication({ ...f.options, deploy: guard => {
    guard();
    fs.appendFileSync(path.join(f.root, article), 'next edit after remote push');
  } });
  assert.equal(result.deployed, true);
  assert.equal(readState(f.statePath).stage, 'deployed');
  assert.ok(git(f.root, ['diff', '--name-only']).trim());
});

test('already committed work can be backed up and published without an empty commit', t => {
  const f = fixture(t);
  git(f.root, ['add', '--', article]);
  git(f.root, ['commit', '-m', 'author saved']);
  const head = git(f.root, ['rev-parse', 'HEAD']).trim();
  const result = runPublication(f.options);
  assert.equal(result.commit, head);
  assert.deepEqual(f.events, ['verify', 'push', 'deploy']);
});
