'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PLAN_PATH = path.join(__dirname, 'data', 'microblog-boundary-migration.v1.json');
const TEXT_EXTENSIONS = new Set([
  '.atom', '.css', '.csv', '.html', '.ics', '.js', '.json', '.map', '.md',
  '.rss', '.svg', '.txt', '.webmanifest', '.xml', '.yaml', '.yml'
]);

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) !== -1) {
    count++;
    offset += needle.length;
  }
  return count;
}

function addError(errors, code, filePath, count = 1) {
  errors.push({ code, path: filePath, count });
}

function collectTextFiles(root, errors) {
  const files = [];
  function walk(directory) {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch {
      addError(errors, 'scan_failed', path.relative(root, directory) || '.', 1);
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.isSymbolicLink()) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(filename);
    }
  }
  walk(root);
  return files;
}

/**
 * Audits a source snapshot and one generated/deployment tree without logging
 * private source text or fingerprints. Inputs are injectable for isolated tests.
 */
function auditBoundary({ root, plan, baselineRecords, sourceRecords }) {
  const outputRoot = path.resolve(root);
  const errors = [];
  const decisions = Array.isArray(plan?.records) ? plan.records : [];
  const dRecords = decisions.filter(record => record?.decision === 'D');
  const vRecords = decisions.filter(record => record?.decision === 'V');

  if (!fs.existsSync(outputRoot) || !fs.statSync(outputRoot).isDirectory()) {
    addError(errors, 'output_root_missing', '.', 1);
  }
  if (!Array.isArray(sourceRecords)) {
    addError(errors, 'source_invalid', 'source/microblog.json', 1);
    sourceRecords = [];
  }
  if (!Array.isArray(baselineRecords)) {
    addError(errors, 'baseline_invalid', plan?.source || 'source/microblog.json', 1);
    baselineRecords = [];
  }
  if (decisions.length !== 3 || dRecords.length !== 2 || vRecords.length !== 1) {
    addError(errors, 'decision_plan_invalid', 'tools/data/microblog-boundary-migration.v1.json', decisions.length);
  }
  if (!Array.isArray(plan?.retiredIds) || plan.retiredIds.length !== vRecords.length ||
      vRecords.some(record => !plan.retiredIds.includes(record.id))) {
    addError(errors, 'retired_id_plan_invalid', 'tools/data/microblog-boundary-migration.v1.json', plan?.retiredIds?.length || 0);
  }
  const baselineById = new Map(baselineRecords.filter(record => record && typeof record.id === 'string').map(record => [record.id, record]));
  const sourceById = new Map(sourceRecords.filter(record => record && typeof record.id === 'string').map(record => [record.id, record]));
  const sourceIds = sourceRecords.map(record => record?.id);
  if (sourceIds.some(id => typeof id !== 'string' || id.length === 0) || new Set(sourceIds).size !== sourceIds.length) {
    addError(errors, 'source_microblog_id_invalid_or_duplicate', 'source/microblog.json', 1);
  }
  const originalTexts = [];
  for (const decision of decisions) {
    const original = baselineById.get(decision.id);
    if (!original || typeof original.content !== 'string') {
      addError(errors, 'baseline_record_missing', plan?.source || 'source/microblog.json', 1);
      continue;
    }
    if (original.content) originalTexts.push(original.content);
    if (decision.decision === 'D') {
      const current = sourceById.get(decision.id);
      if (!current) addError(errors, 'd_record_missing', 'source/microblog.json', 1);
      else if (current.content !== decision.publicContent) addError(errors, 'd_replacement_mismatch', 'source/microblog.json', 1);
    } else if (decision.decision === 'V' && sourceById.has(decision.id)) {
      addError(errors, 'retired_id_in_source', 'source/microblog.json', 1);
    }
  }

  for (const baseline of baselineRecords) {
    if (!baseline || typeof baseline.id !== 'string' || decisions.some(decision => decision.id === baseline.id)) continue;
    const current = sourceById.get(baseline.id);
    if (!current) addError(errors, 'persistent_microblog_id_missing', 'source/microblog.json', 1);
    else if (current.content !== baseline.content) addError(errors, 'persistent_microblog_content_changed', 'source/microblog.json', 1);
  }

  let sourceOldTextHits = 0;
  const serializedSource = JSON.stringify(sourceRecords);
  for (const text of originalTexts) sourceOldTextHits += countOccurrences(serializedSource, text);
  if (sourceOldTextHits) addError(errors, 'old_text_in_source', 'source/microblog.json', sourceOldTextHits);

  const files = fs.existsSync(outputRoot) ? collectTextFiles(outputRoot, errors) : [];
  let oldTextHits = 0;
  let oldTextPathCount = 0;
  let retiredIdHits = 0;
  let retiredIdPathCount = 0;
  const replacementPathCounts = dRecords.map(() => 0);
  for (const filename of files) {
    let text;
    try { text = fs.readFileSync(filename, 'utf8'); }
    catch {
      addError(errors, 'read_failed', path.relative(outputRoot, filename).split(path.sep).join('/'), 1);
      continue;
    }
    let pathHasOldText = false;
    for (const original of originalTexts) {
      const count = countOccurrences(text, original);
      oldTextHits += count;
      if (count) pathHasOldText = true;
    }
    if (pathHasOldText) oldTextPathCount++;
    let pathHasRetiredId = false;
    for (const record of vRecords) {
      const count = countOccurrences(text, record.id);
      retiredIdHits += count;
      if (count) pathHasRetiredId = true;
    }
    if (pathHasRetiredId) retiredIdPathCount++;
    dRecords.forEach((record, index) => {
      if (typeof record.publicContent === 'string' && text.includes(record.publicContent)) replacementPathCounts[index]++;
    });
  }
  if (oldTextHits) addError(errors, 'old_text_in_output', '.', oldTextHits);
  if (retiredIdHits) addError(errors, 'retired_id_in_output', '.', retiredIdHits);
  const missingReplacementCount = replacementPathCounts.filter(count => count === 0).length;
  if (missingReplacementCount) addError(errors, 'replacement_missing', '.', missingReplacementCount);

  return {
    ok: errors.length === 0,
    root: outputRoot,
    scannedTextFiles: files.length,
    sourceCount: sourceRecords.length,
    sourceOldTextHits,
    oldTextHits,
    oldTextPathCount,
    retiredIdHits,
    retiredIdPathCount,
    replacementPathCounts,
    errors
  };
}

function formatReport(report) {
  const lines = [
    `${report.ok ? 'PASS' : 'FAIL'} root=${report.root} scannedTextFiles=${report.scannedTextFiles}` +
    ` sourceCount=${report.sourceCount} sourceOldTextHits=${report.sourceOldTextHits}` +
    ` oldTextHits=${report.oldTextHits} oldTextPathCount=${report.oldTextPathCount}` +
    ` retiredIdHits=${report.retiredIdHits} retiredIdPathCount=${report.retiredIdPathCount}` +
    ` replacementPathCounts=${report.replacementPathCounts.join(',')}`
  ];
  for (const error of report.errors) lines.push(`ERROR code=${error.code} path=${error.path} count=${error.count}`);
  return lines.join('\n');
}

function readJsonSafely(filename) {
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch { throw new Error('invalid_json'); }
}

function loadBoundaryInputs(projectRoot = PROJECT_ROOT) {
  const planPath = path.join(projectRoot, 'tools', 'data', 'microblog-boundary-migration.v1.json');
  const plan = readJsonSafely(planPath);
  const baselineText = execFileSync('git', ['show', `${plan.baselineCommit}:${plan.source}`], {
    cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
  });
  return {
    plan,
    baselineRecords: JSON.parse(baselineText),
    sourceRecords: readJsonSafely(path.join(projectRoot, plan.source))
  };
}

function resolveOutputRoot(args, projectRoot) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex >= 0) {
    if (!args[rootIndex + 1]) throw new Error('missing_root');
    return path.resolve(projectRoot, args[rootIndex + 1]);
  }
  const config = yaml.load(fs.readFileSync(path.join(projectRoot, '_config.yml'), 'utf8'));
  return path.resolve(projectRoot, config.public_dir || 'public');
}

function runCli(args = process.argv.slice(2)) {
  let outputRoot;
  try { outputRoot = resolveOutputRoot(args, PROJECT_ROOT); }
  catch (error) {
    console.error(`ERROR code=${error.message === 'missing_root' ? 'missing_root' : 'config_invalid'} path=_config.yml count=1`);
    process.exitCode = 1;
    return;
  }
  let inputs;
  try {
    inputs = loadBoundaryInputs(PROJECT_ROOT);
  } catch {
    console.error('ERROR code=inputs_invalid path=tools/data/microblog-boundary-migration.v1.json count=1');
    process.exitCode = 1;
    return;
  }
  const report = auditBoundary({ root: outputRoot, ...inputs });
  console.log(formatReport(report));
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) runCli();

module.exports = { auditBoundary, countOccurrences, formatReport, loadBoundaryInputs, runCli };
