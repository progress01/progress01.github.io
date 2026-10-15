'use strict';

// One entry point for preview, candidate verification, full verification, and deploy.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RECEIPT_VERSION = 2;
const RECEIPT_PATH = path.join(ROOT, 'node_modules', '.cache', 'blog-verify-receipt.json');
const OMIT_DIRECTORIES = new Set(['.git', 'node_modules', 'public', 'tmp', '.deploy_git']);
const OMIT_FILES = new Set(['db.json', '.DS_Store', 'Thumbs.db']);
// This Markdown file is read by a verifier, unlike ordinary author notes.
// Add future documentation inputs here when a build/checker begins reading them.
const CHECK_DOCUMENTATION = new Set(['docs/dual-surface-visual-rules.md']);

function isDocumentation(name) {
  return !CHECK_DOCUMENTATION.has(name) &&
    (/^[^/]+\.md$/i.test(name) || /^docs\/.*\.md$/i.test(name));
}

function isContentPath(name) {
  return /^source\/_posts\/.*\.md$/i.test(name) ||
    /^source\/images\/.*\.(?:png|jpe?g|gif|webp|avif|ico)$/i.test(name) ||
    name === 'source/microblog.json' ||
    name === 'source/life-index.json' ||
    name === 'source/reading-desk.yml';
}
const SOURCE_CHECKS = ['check:content', 'check:tags', 'check:song-tags', 'check:profile-home'];
const FULL_SOURCE_CHECKS = [
  ...SOURCE_CHECKS,
  'check:article-scaffold', 'check:surface-copy', 'check:surface-visual',
  'check:surface-transition', 'check:surface-accessibility', 'check:surface-responsive'
];
const OUTPUT_CHECKS = [
  'check:surface-copy-output', 'check:site', 'check:record-data-output', 'check:archive-category-compat',
  'check:sidebar-stats', 'check:seo-urls', 'check:public-output'
];

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function taipeiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

function relativePath(root, file) { return path.relative(root, file).split(path.sep).join('/'); }

function hashFile(file) { return sha256(fs.readFileSync(file)); }

function walkFiles(root, current = root, output = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const filename = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`verification input contains an unsupported symlink: ${relativePath(root, filename)}`);
    if (entry.isDirectory()) {
      if (current === root && OMIT_DIRECTORIES.has(entry.name)) continue;
      if (current === root && entry.name.startsWith('.deploy')) continue;
      walkFiles(root, filename, output);
    } else if (entry.isFile() &&
        !(current === root && (OMIT_FILES.has(entry.name) || entry.name.toLowerCase().endsWith('.log'))) &&
        !isDocumentation(relativePath(root, filename))) {
      output.push(filename);
    }
  }
  return output;
}

function inputInventory(root = ROOT) {
  const files = {};
  for (const file of walkFiles(root)) files[relativePath(root, file)] = hashFile(file);
  files['@runtime/node'] = sha256(JSON.stringify({
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    executable: process.execPath
  }));
  const installLock = path.join(root, 'node_modules', '.package-lock.json');
  if (fs.existsSync(installLock)) {
    const stat = fs.statSync(installLock);
    files['@runtime/node-modules-lock'] = sha256(JSON.stringify({
      content: hashFile(installLock),
      mtimeMs: stat.mtimeMs,
      ctimeMs: stat.ctimeMs
    }));
  } else {
    files['@runtime/node-modules-lock'] = 'missing';
  }
  return files;
}

function contentInventory(files) {
  return Object.fromEntries(Object.entries(files)
    .filter(([name]) => isContentPath(name))
    .sort(([left], [right]) => left.localeCompare(right)));
}

function programFingerprint(files) {
  return sha256(JSON.stringify(Object.entries(files)
    .filter(([name]) => !isContentPath(name))
    .sort(([left], [right]) => left.localeCompare(right))));
}

function inventoryFingerprint(files) {
  return sha256(JSON.stringify(Object.entries(files).sort(([left], [right]) => left.localeCompare(right))));
}

function publicFingerprint(root = path.join(ROOT, 'public')) {
  if (!fs.existsSync(root)) return 'missing';
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`public output contains an unsupported symlink: ${relativePath(root, filename)}`);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile()) files.push(filename);
      else throw new Error(`public output contains an unsupported entry: ${relativePath(root, filename)}`);
    }
  }
  visit(root);
  const records = files.sort((left, right) => relativePath(root, left).localeCompare(relativePath(root, right)))
    .map(file => [relativePath(root, file), hashFile(file)]);
  return sha256(JSON.stringify(records));
}

function readReceipt(receiptPath = RECEIPT_PATH) {
  try {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    const fingerprint = /^[a-f0-9]{64}$/;
    if (receipt?.version !== RECEIPT_VERSION || !['full', 'content'].includes(receipt.level) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(receipt.day || '') || !fingerprint.test(receipt.sourceFingerprint || '') ||
        !fingerprint.test(receipt.fullSourceFingerprint || '') || !fingerprint.test(receipt.publicFingerprint || '') ||
        !receipt.content || typeof receipt.content !== 'object' || Array.isArray(receipt.content) ||
        Object.entries(receipt.content).some(([name, hash]) => !isContentPath(name) || !fingerprint.test(hash))) return null;
    return receipt;
  } catch { return null; }
}

function isExactReceipt(receipt, files, outputHash, day) {
  return Boolean(receipt && receipt.day === day && receipt.sourceFingerprint === inventoryFingerprint(files) &&
    receipt.publicFingerprint === outputHash && receipt.fullSourceFingerprint === programFingerprint(files));
}

function selectLevel({ action, receipt, files, outputHash, day }) {
  if (action === 'full') return 'full';
  const currentCodeFingerprint = programFingerprint(files);
  if (!receipt) return 'full';
  if (currentCodeFingerprint !== receipt.fullSourceFingerprint) return 'full';
  return 'content';
}

function levelReason({ action, receipt, files }) {
  if (action === 'full') return '指定執行完整檢查';
  if (!receipt) return '尚無適用的完整驗證紀錄';
  if (programFingerprint(files) !== receipt.fullSourceFingerprint) return '程式、設定或其他需要完整檢查的輸入已變更';
  return '程式與設定未變更，重新檢查內容與生成網站';
}

function writeReceipt(receipt, receiptPath = RECEIPT_PATH) {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  // A partial write is harmless: readReceipt rejects malformed JSON and forces a full verification.
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

function removeReceipt(receiptPath = RECEIPT_PATH) {
  try { fs.unlinkSync(receiptPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function runNpmScript(script, root = ROOT) {
  const deploying = script === 'deploy';
  const command = deploying
    ? (process.platform === 'win32' ? 'hexo.cmd' : 'hexo')
    : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = deploying ? ['deploy'] : ['run', script];
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm run ${script} failed with exit code ${result.status ?? 'unknown'}`);
}

function runStages(stages, runner) { for (const stage of stages) runner(stage); }

function verificationStages(level) {
  if (level === 'full') return [
    ...FULL_SOURCE_CHECKS, 'clean', 'build', ...OUTPUT_CHECKS, 'test:regression'
  ];
  // Preserve the historical microblog privacy migration assertions when the
  // wider regression suite is skipped. Its editing restrictions are separate.
  return [...SOURCE_CHECKS, 'check:microblog-history', 'clean', 'build', ...OUTPUT_CHECKS];
}

function runVerificationStages(level, root, runner) {
  const stages = verificationStages(level);
  const buildIndex = stages.indexOf('build');
  runStages(stages.slice(0, buildIndex + 1), runner);
  const builtPublic = publicFingerprint(path.join(root, 'public'));
  if (builtPublic === 'missing') throw new Error('build completed without a public output');
  runStages(stages.slice(buildIndex + 1), runner);
  const checkedPublic = publicFingerprint(path.join(root, 'public'));
  if (checkedPublic !== builtPublic) throw new Error('public output changed while output checks were running; no receipt was issued');
  return checkedPublic;
}

function currentState(root, clock) {
  const day = taipeiDate(clock());
  const files = inputInventory(root);
  return { files, day, sourceFingerprint: inventoryFingerprint(files) };
}

function runVerification({ action = 'auto', root = ROOT, receiptPath = RECEIPT_PATH, clock = () => new Date(), runner = stage => runNpmScript(stage, root) } = {}) {
  if (!['auto', 'full', 'deploy'].includes(action)) throw new Error(`unsupported verification action: ${action}`);
  const receipt = readReceipt(receiptPath);
  const before = currentState(root, clock);
  const beforePublic = publicFingerprint(path.join(root, 'public'));
  const plannedLevel = selectLevel({ action, receipt, files: before.files, outputHash: beforePublic, day: before.day });
  const reuse = action !== 'full' && isExactReceipt(receipt, before.files, beforePublic, before.day);
  const displayLevel = reuse ? receipt.level : plannedLevel;
  console.log(`驗證階段：${reuse ? '沿用既有' : ''}${displayLevel === 'full' ? '完整驗證' : '內容更新驗證'}（${reuse ? '來源、public 與日期指紋完全吻合' : levelReason({ action, receipt, files: before.files })}）。`);

  if (reuse) {
    if (action === 'deploy') {
      const finalState = currentState(root, clock);
      const finalPublic = publicFingerprint(path.join(root, 'public'));
      if (!isExactReceipt(receipt, finalState.files, finalPublic, finalState.day)) {
        removeReceipt(receiptPath);
        throw new Error('verified inputs or public output changed before deploy; rerun verification');
      }
      runner('deploy');
      return { action, level: receipt.level, reused: true, deployed: true };
    }
    return { action, level: receipt.level, reused: true, deployed: false };
  }

  const level = plannedLevel;
  // An unsuccessful attempt must not leave an older receipt available for a later deploy.
  removeReceipt(receiptPath);
  try {
    const outputHash = runVerificationStages(level, root, runner);
    const after = currentState(root, clock);
    if (after.sourceFingerprint !== before.sourceFingerprint || after.day !== before.day) {
      throw new Error('verification inputs changed while checks were running; no receipt was issued');
    }
    const nextReceipt = {
      version: RECEIPT_VERSION,
      level,
      day: before.day,
      sourceFingerprint: before.sourceFingerprint,
      fullSourceFingerprint: programFingerprint(before.files),
      content: contentInventory(before.files),
      publicFingerprint: outputHash,
      verifiedAt: clock().toISOString()
    };
    writeReceipt(nextReceipt, receiptPath);

    if (action === 'deploy') {
      const finalState = currentState(root, clock);
      const finalPublic = publicFingerprint(path.join(root, 'public'));
      if (!isExactReceipt(nextReceipt, finalState.files, finalPublic, finalState.day)) {
        removeReceipt(receiptPath);
        throw new Error('verified inputs or public output changed before deploy; deploy was not started');
      }
      runner('deploy');
      return { action, level, reused: false, deployed: true };
    }
    return { action, level, reused: false, deployed: false };
  } catch (error) {
    removeReceipt(receiptPath);
    throw error;
  }
}

function main(args = process.argv.slice(2)) {
  const action = args.includes('--full') ? 'full' : args.includes('--deploy') ? 'deploy' : 'auto';
  try {
    const result = runVerification({ action });
    if (result.deployed) console.log(`已部署；採用${result.level === 'full' ? '完整' : '內容更新'}驗證${result.reused ? '憑證' : ''}。`);
    else console.log(`${result.reused ? '沿用既有' : '完成'}${result.level === 'full' ? '完整' : '內容更新'}驗證；public 與來源指紋已核對。`);
    return 0;
  } catch (error) {
    console.error(`驗證／部署未完成：${error.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  RECEIPT_VERSION, contentInventory, currentState, inputInventory, inventoryFingerprint,
  isContentPath, isDocumentation, isExactReceipt, main, programFingerprint, publicFingerprint, readReceipt,
  runNpmScript, runVerification, runVerificationStages, selectLevel, taipeiDate, verificationStages, writeReceipt
};
