'use strict';

const path = require('node:path');
const { readState, saveDeploymentSha } = require('./publish');
const { queryPagesBuild } = require('./pages-build');

function checkSavedPages({ root, repository, gh, statePath, query = queryPagesBuild } = {}) {
  const filename = statePath || path.join(root, 'node_modules/.cache/blog-publish-state.json');
  const state = readState(filename);
  if (!state || state.stage !== 'deployed') return { status: 'unavailable', reason: '找不到已成功發布的版本 state。' };
  const sha = saveDeploymentSha({ root, repository, state, statePath: filename });
  if (!sha) return { status: 'unavailable', reason: '無法以 .deploy_git 與遠端 main 確認部署 SHA。' };
  const result = query({ deploymentSha: sha, gh });
  return { ...result, deploymentSha: sha };
}

function main(args = process.argv.slice(2)) {
  if (args.length && !(args.length === 2 && args[0] === '--root' && args[1])) throw new Error('用法：npm run check:pages [-- --root 專案目錄]');
  const rootIndex = args.indexOf('--root');
  const root = path.resolve(rootIndex < 0 ? path.resolve(__dirname, '..') : args[rootIndex + 1]);
  const state = readState(path.join(root, 'node_modules/.cache/blog-publish-state.json'));
  const repository = state?.repository || 'https://github.com/progress01/progress01.github.io.git';
  const result = checkSavedPages({ root, repository });
  if (!state || state.stage !== 'deployed') {
    console.log(`GitHub Pages：${result.reason || '找不到已成功發布的版本 state。'}`);
    process.exitCode = 1;
    return;
  }
  const messages = {
    confirmed: 'GitHub Pages 已確認完成本次部署。',
    pending: '已發布版本的 Pages 尚待確認/建置完成。',
    failed: '已發布版本的 Pages 建置失敗。',
    unavailable: `已發布版本的 Pages 狀態查詢不可用：${result.reason || '未知原因'}`
  };
  console.log(messages[result.status] || messages.unavailable);
  if (result.status !== 'confirmed') process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`Pages 狀態：unavailable（${error.message}）`); process.exitCode = 1; }
}

module.exports = { checkSavedPages, main };
