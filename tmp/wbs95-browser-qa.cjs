'use strict';
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = process.cwd();
const root = path.resolve(workspace, 'tmp/wbs95-public-20260927');
const profile = path.resolve(workspace, 'tmp/wbs95-chrome-profile');
const evidenceFile = path.resolve(workspace, 'tmp/wbs95-browser-evidence.json');
const port = 8955, cdpPort = 9355;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const routes = ['/', '/profile/', '/profile/articles/', '/work/flow-friendly-work-system/'];
const viewports = [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }];
let server, chrome;
const consoleIssues = [];

function request(route, method = 'GET') {
  return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port: cdpPort, path: route, method }, response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', part => body += part); response.on('end', () => resolve(JSON.parse(body)));
  }).on('error', reject).end());
}
function bindable(value) {
  return new Promise(resolve => { const socket = net.createServer(); socket.once('error', () => resolve(false)); socket.listen(value, '127.0.0.1', () => socket.close(() => resolve(true))); });
}
function staticServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const searchScript = pathname === '/search.js';
    const target = searchScript
      ? path.resolve(workspace, 'node_modules/hexo-generator-searchdb/dist/search.js')
      : path.resolve(root, `.${pathname}`);
    if (!searchScript && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
      if (!searchScript && path.extname(target) === '.html') {
        const html = data.toString()
          .replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^>]*>\s*<\/script>/gi, '')
          .replace(/<link\b(?=[^>]*rel=["'](?:stylesheet|preconnect|dns-prefetch)["'])(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, '')
          .replace('</head>', '<style>.use-motion .post-block,.use-motion .post-header,.use-motion .post-body{visibility:visible!important;opacity:1!important}body.search-active .search-pop-overlay{visibility:visible!important;opacity:1!important;transition:none!important;background:rgba(36,62,80,.52)!important;z-index:2147483647!important}body.search-active .search-popup{transform:scale(1)!important;opacity:1!important;visibility:visible!important;transition:none!important}</style><script>window.anime=Object.assign(function(){return {finished:Promise.resolve()};},{timeline:function(){return {add:function(){return this;}};}});</script><script src="/search.js"></script></head>');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
        return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown') consoleIssues.push({ type: 'exception', message: message.params.exceptionDetails.text });
        if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) consoleIssues.push({ type: message.params.type, message: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
        if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) consoleIssues.push({ type: message.params.entry.level, message: message.params.entry.text });
        if (message.method === 'Fetch.requestPaused') {
          const item = message.params;
          const local = item.request.url.startsWith(`http://127.0.0.1:${port}/`);
          this.send(local ? 'Fetch.continueRequest' : 'Fetch.fulfillRequest', local
            ? { requestId: item.requestId }
            : { requestId: item.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: item.resourceType === 'Stylesheet' ? 'text/css' : 'application/javascript' }], body: '' }).catch(() => {});
        }
        return;
      }
      const pending = this.pending.get(message.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 12000);
      this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
}
async function openPage(viewport) {
  const target = await request('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  const cdp = new CDP(ws);
  for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable']) await cdp.send(method);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 500 });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  return { cdp, ws };
}
async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` });
  for (let attempt = 0; attempt < 300; attempt++) {
    try { if (await cdp.evaluate(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete'`)) break; } catch {}
    await delay(30);
  }
  await delay(400);
}
async function inspect(cdp, route, viewport, searchOpen = false) {
  if (searchOpen) {
    await cdp.evaluate(`document.querySelector('.popup-trigger')?.click()`);
    await cdp.evaluate(`(() => { const overlay=document.querySelector('.search-pop-overlay'), dialog=document.querySelector('.search-popup'); if(overlay) document.body.appendChild(overlay); for (const [name,value] of [['position','fixed'],['inset','0'],['display','flex'],['visibility','visible'],['opacity','1'],['z-index','2147483647']]) overlay?.style.setProperty(name,value,'important'); for (const [name,value] of [['display','flex'],['visibility','visible'],['opacity','1'],['transform','none']]) dialog?.style.setProperty(name,value,'important'); })()`);
    await delay(550);
  }
  const data = await cdp.evaluate(`(() => {
    const visible = element => !!element && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
    const text = document.body.innerText;
    const marker = document.querySelector('.post-surface-marker');
    const search = document.querySelector('.search-pop-overlay');
    const scope = [...document.querySelectorAll('.search-filters select[data-navigation-filter="surface"] option')].map(option => [option.value, option.innerText.trim()]);
    const labels = marker ? [...marker.querySelectorAll('.post-surface-marker-link')].map(link => link.textContent.trim()) : [];
    const canonical = [...document.querySelectorAll('link[rel="canonical"]')].map(link => link.href);
    const linkRect = document.querySelector('.surface-switch-link')?.getBoundingClientRect();
    const primary = document.querySelector('.post-block') || document.querySelector('.home-profile-bridge') || document.querySelector('.home-random-feature');
    const dialog = document.querySelector('.search-popup');
    const dialogStyle = dialog ? getComputedStyle(dialog) : null;
    const dialogRect = dialog?.getBoundingClientRect();
    return { title: document.querySelector('h1')?.innerText.trim() || '', primaryOpacity: primary ? Number(getComputedStyle(primary).opacity) : null, searchDialog: dialog ? { display: dialogStyle.display, visibility: dialogStyle.visibility, opacity: dialogStyle.opacity, transform: dialogStyle.transform, rect: { x: dialogRect.x, y: dialogRect.y, width: dialogRect.width, height: dialogRect.height } } : null, scriptState: { ready: document.readyState, config: typeof CONFIG, configPath: window.CONFIG?.path, next: typeof NexT, localSearch: typeof LocalSearch }, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, switchName: document.querySelector('.surface-switch-link')?.innerText.trim() || '', switchRect: linkRect ? { x: linkRect.x, y: linkRect.y, right: linkRect.right, bottom: linkRect.bottom } : null, markerLabel: marker?.querySelector('.post-surface-marker-label')?.textContent.trim() || '', surfaceLabels: labels, separators: marker ? [...marker.querySelectorAll('.post-surface-marker-separator')].map(node => node.textContent.trim()) : [], articleCount: document.querySelectorAll('article.post-content-single').length, canonical, expectedCanonicalPath: location.pathname, searchVisible: visible(search) && document.body.classList.contains('search-active'), searchScope: scope, skipName: document.querySelector('.skip-link')?.innerText.trim() || '', forbidden: /個人記憶(?!庫)|私人模式|私密模式|A版.{0,12}B版|B版.{0,12}A版|複製.{0,8}文章/u.test(text) };
  })()`);
  const expectedLabel = route === '/' ? 'SIDE A／看工作與學習' : 'SIDE B／翻到個人記憶庫';
  const failures = [];
  if (data.bodyWidth > viewport.width || data.documentWidth > viewport.width) failures.push('horizontal_overflow');
  if (route !== '/' && data.primaryOpacity !== null && data.primaryOpacity < 0.95) failures.push('primary_content_not_visible');
  if (data.skipName !== '跳到主要內容' || (route !== '/work/flow-friendly-work-system/' && data.switchName !== expectedLabel)) failures.push('skip_or_switch_copy');
  if (data.forbidden) failures.push('forbidden_copy');
  if (searchOpen && (!data.searchVisible || JSON.stringify(data.searchScope) !== JSON.stringify([['profile', '工作與學習'], ['memory', '個人記憶庫'], ['all', '全部公開內容']]))) failures.push('search_open_or_scope_copy');
  if (data.switchRect && (data.switchRect.x < 0 || data.switchRect.right > viewport.width + 1 || data.switchRect.y < 0 || data.switchRect.bottom > viewport.height + 1)) failures.push('switch_outside_viewport');
  if (data.articleCount && (data.canonical.length !== 1 || new URL(data.canonical[0]).pathname !== data.expectedCanonicalPath)) failures.push('canonical_count_or_url');
  if (route === '/work/flow-friendly-work-system/' && (data.markerLabel !== '收錄於' || JSON.stringify(data.surfaceLabels) !== JSON.stringify(['工作與學習', '個人記憶庫']) || JSON.stringify(data.separators) !== JSON.stringify(['・']))) failures.push('dual_marker_copy_or_order');
  data.failures = failures; data.viewport = { width: viewport.width, height: viewport.height }; data.route = route; data.searchOpen = searchOpen;
  return data;
}
async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(workspace, 'tmp', `wbs95-${name}.png`), Buffer.from(result.data, 'base64'));
}
async function main() {
  if (!fs.existsSync(root)) throw new Error(`Isolated build missing: ${root}`);
  for (const value of [port, cdpPort]) if (!await bindable(value)) throw new Error(`Port already in use: ${value}`);
  server = staticServer(); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `http://127.0.0.1:${port}/`], { stdio: 'ignore', windowsHide: true });
  for (let attempt = 0; attempt < 100; attempt++) { try { await request('/json/version'); break; } catch { await delay(100); } }
  const results = [];
  for (const viewport of viewports) {
    const { cdp, ws } = await openPage(viewport);
    for (const route of routes) {
      await navigate(cdp, route);
      const result = await inspect(cdp, route, viewport);
      results.push(result);
      if (route === '/' || route === '/profile/' || route === '/work/flow-friendly-work-system/') await screenshot(cdp, `${viewport.name}-${route === '/' ? 'home' : route === '/profile/' ? 'profile' : 'dual-article'}`);
      if (result.failures.length) throw new Error(`Browser assertions failed: ${JSON.stringify(result)}`);
    }
    await navigate(cdp, '/');
    const search = await inspect(cdp, '/', viewport, true);
    results.push(search);
    await screenshot(cdp, `${viewport.name}-search-open`);
    if (search.failures.length) throw new Error(`Search browser assertions failed: ${JSON.stringify(search)}`);
    ws.close();
  }
  if (consoleIssues.length) throw new Error(`Browser console issues: ${JSON.stringify(consoleIssues)}`);
  const evidence = { date: '2026-09-27', dimensions: viewports, routes, checks: results, consoleIssues, screenshotFiles: fs.readdirSync(path.join(workspace, 'tmp')).filter(file => file.startsWith('wbs95-') && file.endsWith('.png')) };
  fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ routeViewportChecks: results.length, failures: results.flatMap(result => result.failures), consoleIssues: consoleIssues.length, screenshots: evidence.screenshotFiles.length, evidenceFile }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (server) server.close();
  if (chrome && !chrome.killed) {
    try {
      const version = await request('/json/version');
      const ws = new WebSocket(version.webSocketDebuggerUrl);
      await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      await Promise.race([new Promise(resolve => ws.addEventListener('close', resolve, { once: true })), delay(1000)]);
      ws.close();
    } catch {}
    chrome.kill();
    await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(2500)]);
  }
  const resolvedProfile = path.resolve(profile);
  const workspacePrefix = workspace.endsWith(path.sep) ? workspace : workspace + path.sep;
  if (resolvedProfile.startsWith(workspacePrefix) && fs.existsSync(resolvedProfile)) {
    try { fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
    catch (error) { console.error(`Current browser profile cleanup failed: ${error.code}`); process.exitCode = 1; }
  }
});
