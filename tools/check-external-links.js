#!/usr/bin/env node
'use strict';

// 檢查文章裡的外部連結還打不打得開。只列出問題，不改任何檔案。
// 每次都重新掃 source/_posts/，新文章不用另外設定。
//
//   npm run check:links            只在畫面上列出結果
//   npm run check:links -- --save  另外把報告存到 ../部落格檢查紀錄/外部連結檢查/日期.md

const fs = require('fs');
const path = require('path');
const {
  BROKEN, CHECK, OK, extractLinks, readTitle, parseIgnoreList, isIgnored, classify, buildReport, formatDate,
} = require('./lib/external-links');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_FILE = path.join(ROOT, 'tools', 'data', 'external-link-ignore.txt');
const REPORT_DIR = path.resolve(ROOT, '..', '部落格檢查紀錄', '外部連結檢查');
const TIMEOUT_MS = 15000;
const HOST_WORKERS = 6;
const SAME_HOST_DELAY_MS = 400;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; personal-blog-link-check/1.0)',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function listPosts(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPosts(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function collect(root, ignoreRules) {
  const posts = listPosts(path.join(root, 'source', '_posts'));
  const byUrl = new Map();
  let ignored = 0;
  for (const file of posts) {
    const text = fs.readFileSync(file, 'utf8');
    const title = readTitle(text);
    const rel = path.relative(root, file).split(path.sep).join('/');
    for (const { url, line } of extractLinks(text)) {
      if (isIgnored(url, ignoreRules)) { ignored += 1; continue; }
      if (!byUrl.has(url)) byUrl.set(url, { url, places: [] });
      byUrl.get(url).places.push({ file: rel, title, line });
    }
  }
  return { postCount: posts.length, items: [...byUrl.values()], ignoredCount: ignored };
}

function errorCode(error) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'TIMEOUT';
  const code = (error.cause && (error.cause.code || error.cause.name)) || error.code || '';
  if (/TIMEOUT/i.test(code)) return 'TIMEOUT';
  return code || error.message;
}

async function request(url, method, fetchImpl) {
  const response = await fetchImpl(url, {
    method, headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.body) response.body.cancel().catch(() => {});
  return { status: response.status, finalUrl: response.url || url };
}

// 先用 HEAD（不下載內容）；有些網站不接受 HEAD，失敗再用 GET 確認一次。
async function probe(url, fetchImpl) {
  let first;
  try {
    first = await request(url, 'HEAD', fetchImpl);
    if (first.status < 400) return first;
  } catch (error) {
    first = { error: { code: errorCode(error) } };
    if (first.error.code === 'ENOTFOUND') return first;
  }
  try {
    return await request(url, 'GET', fetchImpl);
  } catch (error) {
    return { error: { code: errorCode(error) } };
  }
}

async function checkUrl(url, { fetchImpl = fetch, retryDelay = 2000 } = {}) {
  let verdict = classify(url, await probe(url, fetchImpl));
  // 逾時、連不上、被擋，等一下再試一次，減少誤報。
  if (verdict.kind === CHECK && !/首頁/.test(verdict.reason)) {
    await sleep(retryDelay);
    const again = classify(url, await probe(url, fetchImpl));
    if (again.kind !== CHECK) verdict = again;
  }
  return verdict;
}

// 同一個網站一次只連一個，中間稍微停一下；不同網站同時檢查。
async function checkAll(items, { fetchImpl = fetch, onProgress = () => {}, delay = SAME_HOST_DELAY_MS, retryDelay } = {}) {
  const byHost = new Map();
  for (const item of items) {
    const host = new URL(item.url).hostname;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(item);
  }
  const queue = [...byHost.values()].sort((a, b) => b.length - a.length);
  let done = 0;
  async function worker() {
    while (queue.length) {
      const group = queue.shift();
      for (let i = 0; i < group.length; i += 1) {
        if (i) await sleep(delay);
        Object.assign(group[i], await checkUrl(group[i].url, { fetchImpl, retryDelay }));
        done += 1;
        onProgress(done, items.length);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(HOST_WORKERS, queue.length) }, worker));
  return items;
}

function printSummary(items, log) {
  for (const [kind, title] of [[BROKEN, '確定壞了'], [CHECK, '要你點開確認']]) {
    const list = items.filter(item => item.kind === kind);
    log(`\n== ${title}：${list.length} 個 ==`);
    for (const item of list) {
      const where = item.places.map(place => `${place.title || place.file}（第 ${place.line} 行）`).join('、');
      log(`- ${item.url}\n    ${item.reason}\n    在：${where}`);
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const save = argv.includes('--save');
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : ROOT;
  const ignoreRules = parseIgnoreList(fs.existsSync(IGNORE_FILE) ? fs.readFileSync(IGNORE_FILE, 'utf8') : '');

  const { postCount, items, ignoredCount } = collect(root, ignoreRules);
  console.log(`找到 ${postCount} 篇文章、${items.length} 個外部網址，開始檢查（大約要幾分鐘）……`);

  let lastShown = 0;
  await checkAll(items, {
    onProgress(done, total) {
      if (done === total || done - lastShown >= 25) {
        lastShown = done;
        console.log(`已檢查 ${done}/${total}`);
      }
    },
  });

  printSummary(items, console.log);
  const okCount = items.filter(item => item.kind === OK).length;
  console.log(`\n正常 ${okCount} 個，確定壞了 ${items.filter(i => i.kind === BROKEN).length} 個，要確認 ${items.filter(i => i.kind === CHECK).length} 個。`);

  if (save) {
    const date = new Date();
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const file = path.join(REPORT_DIR, `${formatDate(date)}.md`);
    fs.writeFileSync(file, buildReport({ date, items, postCount, ignoredCount }) + '\n', 'utf8');
    console.log(`報告已存到：${file}`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`檢查中斷：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { collect, checkUrl, checkAll, probe };
