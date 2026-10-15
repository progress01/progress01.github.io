'use strict';

const { spawnSync } = require('node:child_process');

const PAGES_BUILDS_ENDPOINT = 'repos/progress01/progress01.github.io/pages/builds/latest';
const HEX_SHA = /^[a-f0-9]{40,64}$/i;

function classifyPagesBuild(build, deploymentSha) {
  if (!build || typeof build !== 'object' || !HEX_SHA.test(deploymentSha || '') || typeof build.status !== 'string') {
    return { status: 'unavailable', reason: 'Pages API 回傳資料不完整。' };
  }
  const status = build.status.toLowerCase();
  const matches = typeof build.commit === 'string' && build.commit.toLowerCase() === deploymentSha.toLowerCase();
  if (status === 'errored' || status === 'failed') {
    return matches ? { status: 'failed', build } : { status: 'pending', build, reason: 'Pages 最新建置不是本次部署版本。' };
  }
  if (status === 'built') {
    if (matches) return { status: 'confirmed', build };
    return { status: 'pending', build, reason: 'Pages 最新完成版本尚非本次部署 SHA。' };
  }
  if (['queued', 'building', 'created', 'waiting', 'requested'].includes(status)) return { status: 'pending', build };
  return { status: 'unavailable', build, reason: `不支援的 Pages build 狀態：${build.status}` };
}

function queryPagesBuild({ deploymentSha, timeoutMs = 10000, gh = spawnSync } = {}) {
  if (!HEX_SHA.test(deploymentSha || '')) return { status: 'unavailable', reason: '缺少有效的本次部署 main SHA。' };
  const executables = process.platform === 'win32'
    ? ['gh.exe', require('node:path').join(process.env.ProgramFiles || 'C:\\Program Files', 'GitHub CLI', 'gh.exe')]
    : ['gh'];
  let result;
  let lastError;
  for (const executable of [...new Set(executables)]) {
    try {
      result = gh(executable, ['api', PAGES_BUILDS_ENDPOINT], {
        encoding: 'utf8', shell: false, timeout: timeoutMs, maxBuffer: 1024 * 1024
      });
    } catch (error) { lastError = error; result = { error, status: null }; }
    if (result && !result.error || result?.error?.code !== 'ENOENT') break;
    result = null;
  }
  if (!result) return { status: 'unavailable', reason: `GitHub Pages API 無法查詢：${lastError?.message || 'gh 未安裝。'}` };
  if (result.error || result.status !== 0) {
    const reason = result.error?.code === 'ETIMEDOUT' ? 'GitHub Pages 查詢逾時。'
      : `GitHub Pages 無法查詢${result.status === 1 ? '（gh 未安裝、未登入或權限不足）' : ''}。`;
    return { status: 'unavailable', reason };
  }
  let build;
  try { build = JSON.parse(result.stdout); }
  catch { return { status: 'unavailable', reason: 'GitHub Pages API 回傳非 JSON 資料。' }; }
  return classifyPagesBuild(build, deploymentSha);
}

module.exports = { PAGES_BUILDS_ENDPOINT, classifyPagesBuild, queryPagesBuild };
