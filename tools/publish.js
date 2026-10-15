'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { inputInventory, inventoryFingerprint, isDocumentation, publicFingerprint,
  readReceipt, runVerification, runNpmScript, taipeiDate } = require('./verification');
const { queryPagesBuild } = require('./pages-build');

const ROOT = path.resolve(__dirname, '..');
const REPOSITORY = 'https://github.com/progress01/progress01.github.io.git';
const splitPaths = output => output.split('\0').filter(Boolean);
const samePaths = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

function git(root, args, timeout = 0) {
  // Paths and commit messages are arguments, never interpolated into a shell command.
  const result = spawnSync('git', ['--literal-pathspecs', ...args], {
    cwd: root, encoding: 'utf8', shell: false, maxBuffer: 32 * 1024 * 1024,
    ...(timeout ? { timeout } : {})
  });
  if (result.error) throw new Error(`Git 無法執行：${result.error.message}`);
  if (result.status !== 0) throw new Error(`Git ${args[0]} 失敗：${result.stderr.trim()}`);
  return result.stdout;
}

function isSourcePath(name) {
  return !/^(?:node_modules|public|tmp|\.git|\.deploy[^/]*)(?:\/|$)/.test(name)
    && !/^(?:db\.json|_multiconfig\.yml|[^/]+\.log)$/.test(name);
}

function indexFingerprint(root) {
  return crypto.createHash('sha256').update(git(root, ['ls-files', '--stage', '-z'])).digest('hex');
}

function publicationFingerprint(root) {
  const files = inputInventory(root);
  // Notes do not trigger website rebuilds, but concurrent edits must not escape this backup.
  for (const name of splitPaths(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']))) {
    const filename = path.join(root, name);
    if (isDocumentation(name) && fs.existsSync(filename)) {
      files[name] = crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    }
  }
  return inventoryFingerprint(files);
}

function readState(filename) {
  try {
    const state = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (state.version !== 1 || !['committed', 'backed-up', 'deployed'].includes(state.stage)
        || !/^[a-f0-9]{40,64}$/.test(state.commit) || !/^[a-f0-9]{64}$/.test(state.fingerprint)) return null;
    return state;
  } catch { return null; }
}

function writeState(filename, state) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(state, null, 2)}\n`);
}

function saveDeploymentSha({ root = ROOT, repository = REPOSITORY, state, statePath } = {}) {
  if (!state?.deploymentSha || !/^[a-f0-9]{40,64}$/i.test(state.deploymentSha)) return null;
  const deployGit = path.join(root, '.deploy_git');
  if (!fs.existsSync(path.join(deployGit, '.git'))) return null;
  let deploySha;
  try { deploySha = git(root, ['-C', deployGit, 'rev-parse', 'HEAD']).trim(); }
  catch { return null; }
  if (!/^[a-f0-9]{40,64}$/i.test(deploySha)) return null;
  let remoteMain;
  try { remoteMain = git(root, ['ls-remote', '--heads', repository, 'refs/heads/main'], 10000).trim().split(/\s+/)[0]; }
  catch { return null; }
  if (remoteMain !== deploySha || state.deploymentSha !== deploySha) return null;
  return deploySha;
}

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function confirmPages({ root, repository, state, statePath, queryPages = queryPagesBuild,
  resolveSha = saveDeploymentSha, sleep = sleepSync } = {}) {
  let deploymentSha;
  try { deploymentSha = resolveSha({ root, repository, state, statePath }); }
  catch (error) { return { status: 'unavailable', reason: `無法確認 main SHA：${error.message}` }; }
  if (!deploymentSha || !/^[a-f0-9]{40,64}$/i.test(deploymentSha)) return { status: 'unavailable', reason: '無法以 .deploy_git 與遠端 main 確認部署 SHA。' };
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { result = queryPages({ deploymentSha, timeoutMs: 10000 }); }
    catch (error) { result = { status: 'unavailable', reason: `GitHub Pages 查詢失敗：${error.message}` }; }
    if (!result || !['confirmed', 'pending', 'failed', 'unavailable'].includes(result.status)) result = { status: 'unavailable', reason: 'GitHub Pages 查詢回傳無效狀態。' };
    if (result.status !== 'pending' || attempt === 2) break;
    try { sleep(5000); } catch (error) { result = { status: 'unavailable', reason: `Pages 輪詢中止：${error.message}` }; break; }
  }
  const latest = readState(statePath);
  try {
    if (latest?.stage === 'deployed' && latest.commit === state.commit) {
      latest.repository = repository;
      latest.deploymentSha = deploymentSha;
      latest.pages = { status: result.status, checkedAt: new Date().toISOString(), ...(result.reason ? { reason: result.reason } : {}), ...(result.build ? { commit: result.build.commit, buildStatus: result.build.status } : {}) };
      writeState(statePath, latest);
    }
  } catch { /* Pages status persistence cannot undo a completed deploy. */ }
  return { ...result, deploymentSha };
}

function reportPages(result, log) {
  if (result.status === 'confirmed') log(`GitHub Pages 已確認完成部署（main ${result.deploymentSha.slice(0, 9)}）。`);
  else if (result.status === 'failed') log(`source 已備份、main 已推送，Pages 建置失敗${result.build?.error?.message ? `：${result.build.error.message}` : ''}。`);
  else if (result.status === 'pending') log('source 已備份、main 已推送，Pages 尚待確認/建置完成。');
  else log(`source 已備份、main 已推送，Pages 尚待確認（狀態查詢不可用：${result.reason || '未知原因'}）。`);
}

function planPublication({ root = ROOT, resume = false, repository = REPOSITORY } = {}) {
  const statePath = path.join(root, 'node_modules/.cache/blog-publish-state.json');
  const previous = readState(statePath);
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const branch = git(root, ['branch', '--show-current']).trim();
  const indexTree = indexFingerprint(root);
  const changed = [...new Set([
    ...splitPaths(git(root, ['diff', 'HEAD', '--name-only', '--no-renames', '-z'])),
    ...splitPaths(git(root, ['diff', '--cached', '--name-only', '--no-renames', '-z'])),
    ...splitPaths(git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
  ])].filter(isSourcePath);
  const files = inputInventory(root);
  const fingerprint = publicationFingerprint(root);
  const blockers = [];
  if (git(root, ['ls-files', '--unmerged']).trim()) blockers.push('Git 尚有未解決的合併衝突。');
  if (branch !== 'source') blockers.push('請在 source 分支操作。');
  const urls = git(root, ['remote', 'get-url', '--all', '--push', 'origin']).trim().split(/\r?\n/);
  if (urls.length !== 1 || urls[0] !== repository) blockers.push('origin 推送位置與預期來源備份儲存庫不同。');
  const config = yaml.load(fs.readFileSync(path.join(root, '_config.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
  if (config?.deploy?.type !== 'git' || config.deploy.repo !== repository || config.deploy.branch !== 'main'
      || config.deploy.extend_dirs || config.public_dir && config.public_dir !== 'public'
      || config.source_dir && config.source_dir !== 'source') {
    blockers.push('發布設定不是目前支援的 source → public → main 流程，請先確認。');
  }
  const excludedStaged = splitPaths(git(root, ['diff', '--cached', '--name-only', '-z'])).filter(name => !isSourcePath(name));
  if (excludedStaged.length) blockers.push(`暫存區包含生成檔或暫存檔，請先確認：${excludedStaged.join('、')}`);
  // A file ignored by Git can still enter a Hexo build. Never publish an unbacked source silently.
  const known = new Set(splitPaths(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])));
  const ignored = Object.keys(files).filter(name => !name.startsWith('@') && !known.has(name)
    && name !== '_multiconfig.yml'); // Hexo's generated multi-config cache; not a default build input.
  if (ignored.length) blockers.push(`建置輸入被 Git 忽略，無法確認已備份：${ignored.join('、')}`);
  if (resume) {
    if (!previous || previous.commit !== head || previous.fingerprint !== fingerprint) {
      blockers.push('沒有可接續的相同版本；請重新確認本次修改。');
    }
    if (changed.length) blockers.push('上次發布後又有新修改，請直接發布目前整站，不使用 --resume。');
  }
  return { root, statePath, previous, head, fingerprint, indexTree, changed, blockers, resume };
}

function printPlan(plan, log) {
  log('本次操作：檢查目前整站 → 保存全部原稿修改 → 推送 source 備份 → 全部發布到 main。');
  log('未完成的公開紀錄也一起發布；既有草稿與隱私設定仍生效。');
  log(`本次保存：${plan.changed.join('、') || '無新修改，使用目前已提交版本'}`);
  plan.blockers.forEach(reason => log(`停止原因：${reason}`));
}

function runPublication({ root = ROOT, message = '更新部落格紀錄', execute = false, resume = false,
  repository = REPOSITORY, log = console.log,
  queryPages = queryPagesBuild, resolveSha = saveDeploymentSha, sleep = sleepSync,
  verify = () => runVerification({ root, receiptPath: path.join(root, 'node_modules/.cache/blog-verify-receipt.json') }),
  push = commit => git(root, ['push', 'origin', `${commit}:refs/heads/source`]),
  deploy = guard => runVerification({ action: 'deploy', root,
    receiptPath: path.join(root, 'node_modules/.cache/blog-verify-receipt.json'),
    runner: stage => {
      if (stage === 'deploy') {
        guard();
        const receipt = readReceipt(path.join(root, 'node_modules/.cache/blog-verify-receipt.json'));
        if (!receipt || receipt.publicFingerprint !== publicFingerprint(path.join(root, 'public'))) {
          throw new Error('生成網站在部署前改變，已停止部署。');
        }
      }
      runNpmScript(stage, root);
    } })
} = {}) {
  const lockPath = path.join(root, 'node_modules/.cache/blog-publish.lock');
  let lock;
  try {
    if (execute) {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      try { lock = fs.openSync(lockPath, 'wx'); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error('另一個發布流程正在執行或先前中斷；請先確認程序已停止，再處理本機 blog-publish.lock。');
        throw error;
      }
    }
    const plan = planPublication({ root, resume, repository });
    printPlan(plan, log);
    if (!execute) return { preview: true, ready: plan.blockers.length === 0 };
    if (plan.blockers.length) throw new Error('發布條件尚未符合，未執行提交、推送或部署。');
    if (!message.trim()) throw new Error('更新說明不可空白。');
    if (plan.previous?.stage === 'deployed' && plan.previous.commit === plan.head
        && plan.previous.fingerprint === plan.fingerprint && plan.previous.day === taipeiDate() && !plan.changed.length) {
      const pages = confirmPages({ root, repository, state: plan.previous, statePath: plan.statePath, queryPages, resolveSha, sleep });
      reportPages(pages, log);
      return { commit: plan.head, alreadyDeployed: true, pages: pages.status };
    }
    let expectedHead = plan.head;
    let expectedIndex = plan.indexTree;
    function guard() {
      if (git(root, ['branch', '--show-current']).trim() !== 'source'
          || git(root, ['rev-parse', 'HEAD']).trim() !== expectedHead
          || publicationFingerprint(root) !== plan.fingerprint) {
        throw new Error('來源或 Git 版本在流程中改變，已停止；保留現有檔案與提交。');
      }
      if (indexFingerprint(root) !== expectedIndex) {
        throw new Error('暫存區在流程中改變，已停止；沒有清除你的暫存內容。');
      }
      if (git(root, ['remote', 'get-url', '--all', '--push', 'origin']).trim() !== repository) {
        throw new Error('來源備份位置在流程中改變，已停止。');
      }
    }
    log('正在驗證本次網站內容……');
    verify();
    guard();
    if (!resume && plan.changed.length) {
      git(root, ['add', '-A', '--', ...plan.changed]);
      const staged = splitPaths(git(root, ['diff', '--cached', '--name-only', '-z']));
      if (staged.some(name => !plan.changed.includes(name))) throw new Error('暫存區出現計畫外的檔案，停止提交並保留暫存內容。');
      if (staged.length) {
        git(root, ['commit', '-m', message]);
        expectedHead = git(root, ['rev-parse', 'HEAD']).trim();
        const committed = splitPaths(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', expectedHead]));
        if (!samePaths(committed, staged)) throw new Error('提交被其他程序或 hook 改變，未推送；請檢查本機提交。');
      }
      if (splitPaths(git(root, ['diff', 'HEAD', '--name-only', '-z'])).some(isSourcePath)
          || git(root, ['diff', '--cached', '--name-only']).trim()) {
        throw new Error('提交內容與目前原稿不一致，停止推送；請檢查 Git 狀態。');
      }
      expectedIndex = indexFingerprint(root);
      guard();
    }
    let state = { version: 1, stage: 'committed', commit: expectedHead, fingerprint: plan.fingerprint, repository };
    writeState(plan.statePath, state);
    guard();
    log(`正在備份 source：${state.commit.slice(0, 9)}`);
    push(state.commit);
    const remoteHead = git(root, ['ls-remote', '--heads', 'origin', 'refs/heads/source']).trim().split(/\s+/)[0];
    if (remoteHead !== state.commit) throw new Error('遠端來源版本未確認，停止網站部署。');
    state = { ...state, stage: 'backed-up' };
    writeState(plan.statePath, state);
    guard();
    log('source 已備份，正在發布驗證過的整站……');
    // Verification may rebuild for a new day, so capture the candidate at its final deploy stage.
    deploy(guard);
    // A successful remote push stays successful even if the author starts another edit meanwhile.
    let candidateSha = null;
    try { candidateSha = git(root, ['-C', path.join(root, '.deploy_git'), 'rev-parse', 'HEAD']).trim(); } catch {}
    state = { ...state, stage: 'deployed', day: taipeiDate(), ...(candidateSha && /^[a-f0-9]{40,64}$/i.test(candidateSha) ? { deploymentSha: candidateSha } : {}) };
    writeState(plan.statePath, state);
    const pages = confirmPages({ root, repository, state, statePath: plan.statePath, queryPages, resolveSha, sleep });
    reportPages(pages, log);
    return { commit: state.commit, backedUp: true, deployed: true, pages: pages.status, deploymentSha: pages.deploymentSha };
  } finally {
    if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(lockPath); }
  }
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--resume') options.resume = true;
    else if (arg === '--message') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--message 缺少更新說明。');
      options.message = args[++i];
    } else throw new Error(`未知選項：${arg}；此入口發布目前整站，不需指定檔案。`);
  }
  return options;
}

if (require.main === module) {
  try { runPublication(parseArgs(process.argv.slice(2))); }
  catch (error) {
    const state = readState(path.join(ROOT, 'node_modules/.cache/blog-publish-state.json'));
    console.error(`發布未完成：${error.message}\n現有檔案與提交均保留。${state ? '可先查看 npm run publish -- --resume 的計畫；有新修改時直接重新發布整站。' : '請先檢查 git status 與最近提交，再重新執行。'}`);
    process.exitCode = 1;
  }
}
module.exports = { git, parseArgs, planPublication, readState, writeState, saveDeploymentSha, confirmPages, reportPages, runPublication };
