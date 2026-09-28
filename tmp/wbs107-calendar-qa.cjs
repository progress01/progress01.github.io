'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = process.cwd();
const root = path.resolve(workspace, 'public');
const port = 8976;
const cdpPort = 9376;
const base = `http://127.0.0.1:${port}`;
const profile = path.resolve(workspace, 'tmp/wbs107-calendar-chrome-profile');
const evidencePath = path.resolve(workspace, 'tmp/wbs107-calendar-browser-evidence.json');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let server;
let chrome;
let socket;
const runtimeErrors = [];

function free(portNumber) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(portNumber, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

function serve() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, base).pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      const ext = path.extname(target);
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      if (ext === '.html') data = Buffer.from(data.toString()
        .replace(/<head([^>]*)>/i, '<head$1><script>window.anime=window.anime||function(){};</script>')
        .replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^>]*>\s*<\/script>/gi, '')
        .replace(/<script\b[^>]*\bsrc=["']\/js\/third-party\/search\/local-search\.js["'][^>]*>\s*<\/script>/gi, '')
        .replace(/<link\b(?=[^>]*rel=["'](?:stylesheet|preconnect|dns-prefetch)["'])(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, ''));
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
}

function request(route, method = 'GET') {
  return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port: cdpPort, path: route, method }, response => {
    let data = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { data += chunk; });
    response.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject).end());
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        runtimeErrors.push({ text: details.text, description: details.exception?.description, url: details.url, line: details.lineNumber });
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        runtimeErrors.push({ type: 'console.error', args: message.params.args?.map(arg => arg.value || arg.description) });
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      message.error ? pending.reject(Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(`timeout ${method}`)), 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}

async function wait(cdp, expression) {
  for (let i = 0; i < 150; i++) {
    try { if (await cdp.eval(expression)) return; } catch { }
    await delay(40);
  }
  throw Error(`wait timeout ${expression}`);
}

async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `${base}${route}` });
  await wait(cdp, `decodeURIComponent(location.pathname)===${JSON.stringify(route)}&&document.readyState==='complete'`);
}

async function screenshot(cdp, filename) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.resolve(workspace, 'tmp', filename), Buffer.from(shot.data, 'base64'));
}

async function main() {
  for (const portNumber of [port, cdpPort]) if (!await free(portNumber)) throw Error(`port in use: ${portNumber}`);
  server = serve();
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, `${base}/profile/`], { stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 100; i++) { try { await request('/json/version'); break; } catch { await delay(100); } }
  const target = await request('/json/new?about:blank', 'PUT');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const cdp = new CDP(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate(cdp, '/profile/');
  const desktop = await cdp.eval(`(() => { const root=document.documentElement, calendar=document.querySelector('.profile-article-calendar'); return {h1:document.querySelector('#profile-title')?.textContent.trim(), year:document.querySelector('.profile-calendar-year')?.textContent.trim(), months:[...document.querySelectorAll('.profile-calendar-month h3')].map(node=>node.textContent.trim()), entries:[...document.querySelectorAll('.profile-calendar-entry')].map(node=>({day:node.querySelector('time')?.textContent.trim(), title:node.querySelector('span')?.textContent.trim(), href:node.getAttribute('href')})), cta:document.querySelector('.profile-navigation a')?.textContent.trim(), filterCount:document.querySelectorAll('[data-profile-tag-filters]').length, cards:document.querySelectorAll('.profile-cover-main,.profile-cover-secondary').length, widths:{document:root.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth}, columns:getComputedStyle(document.querySelector('.profile-calendar-months')).gridTemplateColumns.split(' ').length, hasCalendar:!!calendar }; })()`);
  if (desktop.h1 !== '工作與學習' || desktop.year !== '2026 更新日曆' || !desktop.months.length || !desktop.entries.length || desktop.cta !== '查看全部 9 篇' || desktop.filterCount !== 0 || desktop.cards !== 0 || desktop.widths.document > 1280 || desktop.widths.body > 1280 || desktop.columns !== 2) throw Error(`desktop profile assertion failed: ${JSON.stringify(desktop)}`);
  await screenshot(cdp, 'wbs107-calendar-desktop.png');

  await cdp.eval(`document.querySelector('.profile-navigation a').click()`);
  await wait(cdp, `location.pathname==='/profile/articles/'&&document.readyState==='complete'`);
  await wait(cdp, `document.querySelectorAll('[data-profile-article-row]').length===9`);
  const archive = await cdp.eval(`({rows:document.querySelectorAll('[data-profile-article-row]').length,filters:document.querySelectorAll('[data-profile-tag-filters]').length,visibleFilters:document.querySelector('[data-profile-tag-filters]')?.hidden===false,brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href')})`);
  if (archive.rows !== 9 || archive.filters !== 1 || !archive.visibleFilters || archive.brand !== '/profile/') throw Error(`archive assertion failed: ${JSON.stringify(archive)}`);
  await cdp.eval(`document.querySelector('[data-profile-tag]')?.click()`);
  await wait(cdp, `location.hash.startsWith('#tag=')`);
  const filteredRows = await cdp.eval(`document.querySelectorAll('[data-profile-article-row]:not([hidden])').length`);
  if (filteredRows < 1 || filteredRows > 9) throw Error(`tag filtering failed: ${filteredRows}`);
  await cdp.eval('history.back()');
  await wait(cdp, `location.pathname==='/profile/articles/'&&location.hash===''`);
  const backRows = await cdp.eval(`document.querySelectorAll('[data-profile-article-row]:not([hidden])').length`);
  if (backRows !== 9) throw Error(`tag filter history back failed: ${backRows}`);
  await cdp.eval('history.forward()');
  await wait(cdp, `location.pathname==='/profile/articles/'&&location.hash.startsWith('#tag=')`);
  await cdp.send('Page.reload');
  await wait(cdp, `location.pathname==='/profile/articles/'&&document.readyState==='complete'&&location.hash.startsWith('#tag=')`);
  await wait(cdp, `document.querySelector('[data-profile-tag-filters]')?.hidden===false`);
  const reloadFilter = await cdp.eval(`({hash:location.hash,visibleRows:document.querySelectorAll('[data-profile-article-row]:not([hidden])').length})`);
  await cdp.send('Page.navigate', { url: `${base}/profile/` });
  await wait(cdp, `location.pathname==='/profile/'&&document.readyState==='complete'`);
  await cdp.eval(`document.querySelector('.surface-switch-link').click()`);
  await wait(cdp, `location.pathname==='/'&&document.readyState==='complete'`);
  const bSurface = await cdp.eval(`({brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),calendar:document.querySelector('.profile-article-calendar')!==null,search:document.querySelector('.site-nav-right .popup-trigger')!==null})`);
  if (bSurface.brand !== '/' || bSurface.calendar || !bSurface.search) throw Error(`B unchanged assertion failed: ${JSON.stringify(bSurface)}`);

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/profile/');
  const mobile = await cdp.eval(`(() => ({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,grid:getComputedStyle(document.querySelector('.profile-calendar-months')).gridTemplateColumns.split(' ').length,entries:[...document.querySelectorAll('.profile-calendar-entry')].map(node=>node.getAttribute('href')),switch:document.querySelector('.surface-switch-link')?.getAttribute('href')}))()`);
  if (mobile.documentWidth > 375 || mobile.bodyWidth > 375 || mobile.grid !== 1 || !mobile.entries.length || mobile.switch !== '/') throw Error(`mobile profile assertion failed: ${JSON.stringify(mobile)}`);
  await screenshot(cdp, 'wbs107-calendar-mobile.png');
  const targetHref = mobile.entries[0];
  await cdp.eval(`document.querySelector('.profile-calendar-entry').click()`);
  await wait(cdp, `decodeURIComponent(location.pathname)===${JSON.stringify(targetHref)}`);
  const articlePath = await cdp.eval('location.pathname');
  if (articlePath !== targetHref) throw Error(`article link did not reach canonical path: ${articlePath} != ${targetHref}`);
  if (runtimeErrors.length) throw Error(`browser runtime errors: ${JSON.stringify(runtimeErrors)}`);

  const evidence = { date: '2026-09-27', browser: 'Chrome headless via CDP', viewport: { desktop: '1280x900', mobile: '375x812' }, ports: { http: port, cdp: cdpPort }, desktop, archive, tagFilter: { ...reloadFilter, initiallyFilteredRows: filteredRows, rowsAfterHistoryBack: backRows }, bSurface, mobile, articlePath, runtimeErrors };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ evidencePath, desktop, archive, tagFilter: evidence.tagFilter, bSurface, mobile, articlePath, runtimeErrors }));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (server) server.close();
  if (socket) socket.close();
  if (chrome) {
    try {
      const version = await request('/json/version');
      const browserSocket = new WebSocket(version.webSocketDebuggerUrl);
      await new Promise(resolve => browserSocket.addEventListener('open', resolve, { once: true }));
      browserSocket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      browserSocket.close();
    } catch { }
    chrome.kill();
    await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(2000)]);
  }
  const tmpRoot = path.resolve(workspace, 'tmp') + path.sep;
  if (profile.startsWith(tmpRoot) && fs.existsSync(profile)) try { fs.rmSync(profile, { recursive: true, force: true }); } catch { }
});
