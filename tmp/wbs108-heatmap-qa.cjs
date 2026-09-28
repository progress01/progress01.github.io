'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = process.cwd();
const root = path.resolve(workspace, 'public');
const port = 8978;
const cdpPort = 9378;
const base = `http://127.0.0.1:${port}`;
const profile = path.resolve(workspace, 'tmp/wbs109-activity-chrome-profile');
const evidencePath = path.resolve(workspace, 'tmp/wbs109-activity-browser-evidence.json');
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
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') runtimeErrors.push({ type: 'console.error', args: message.params.args?.map(arg => arg.value || arg.description) });
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
  await wait(cdp, `!!window.echarts?.getInstanceByDom?.(document.querySelector('#profile-calendar-chart'))`);
  const desktop = await cdp.eval(`(() => { const chart=document.querySelector('#profile-calendar-chart'), root=document.documentElement, payload=JSON.parse(document.querySelector('[data-profile-calendar-data]').textContent); return {h1:document.querySelector('#profile-title')?.textContent.trim(),year:document.querySelector('.profile-calendar-year')?.textContent.trim(),articleTotal:payload.articleTotal,activeDateCount:payload.activeDateCount,months:[...new Set(Object.keys(payload.counts).map(date=>date.slice(5,7)))],latest:document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.trim(),latestLinks:[...document.querySelectorAll('.profile-calendar-updates a')].map(a=>({title:a.textContent,href:a.getAttribute('href')})),cta:document.querySelector('.profile-navigation a')?.textContent.trim(),filterCount:document.querySelectorAll('[data-profile-tag-filters]').length,oldCards:document.querySelectorAll('.profile-cover-main,.profile-cover-secondary').length,canvas:chart.querySelectorAll('canvas').length,widths:{document:root.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth}}; })()`);
  if (desktop.h1 !== '工作與學習' || desktop.year !== '2026 更新日曆' || desktop.articleTotal !== 9 || desktop.activeDateCount !== 2 || desktop.months.join(',') !== '09' || desktop.latest !== '2026-09-27 更新內容' || desktop.latestLinks.length !== 1 || desktop.cta !== '查看全部 9 篇' || desktop.filterCount || desktop.oldCards || desktop.canvas < 1 || desktop.widths.document > 1280 || desktop.widths.body > 1280) throw Error(`desktop profile assertion failed: ${JSON.stringify(desktop)}`);
  await screenshot(cdp, 'wbs109-activity-desktop.png');

  const multi = await cdp.eval(`(() => { const payload=JSON.parse(document.querySelector('[data-profile-calendar-data]').textContent); return Object.keys(payload.postsByDate).find(date=>payload.postsByDate[date].length>1); })()`);
  const controls = await cdp.eval(`([...document.querySelectorAll('[data-profile-calendar-controls] button')].map(button=>button.dataset.profileCalendarDate))`);
  if (!controls.includes(multi)) throw Error(`active date missing keyboard control: ${multi}`);
  await cdp.eval(`document.querySelector('[data-profile-calendar-date="${multi}"]').focus()`);
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  const multiDate = await cdp.eval(`({heading:document.querySelector('[data-profile-calendar-detail-heading]').textContent,links:[...document.querySelectorAll('.profile-calendar-updates a')].map(a=>({title:a.textContent,href:a.getAttribute('href')})),pressed:document.querySelector('[data-profile-calendar-date="${multi}"]').getAttribute('aria-pressed'),focused:document.activeElement.dataset.profileCalendarDate})`);
  if (multiDate.links.length !== 8 || multiDate.pressed !== 'true' || multiDate.focused !== multi || multiDate.heading !== '2026-09-17 更新內容') throw Error(`same-day/keyboard selection failed: ${JSON.stringify(multiDate)}`);
  const alternate = controls.find(date => date !== multi);
  await cdp.eval(`document.querySelector('[data-profile-calendar-date="${alternate}"]').click()`);
  await wait(cdp, `document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.startsWith(${JSON.stringify(alternate)})`);
  await cdp.send('Page.reload');
  await wait(cdp, `location.pathname==='/profile/'&&document.readyState==='complete'`);
  await wait(cdp, `document.querySelector('[data-profile-calendar-detail-heading]')?.textContent==='2026-09-27 更新內容'`);

  await cdp.eval(`document.querySelector('.profile-navigation a').click()`);
  await wait(cdp, `location.pathname==='/profile/articles/'&&document.readyState==='complete'`);
  await wait(cdp, `document.querySelectorAll('[data-profile-article-row]').length===9`);
  const archive = await cdp.eval(`({rows:document.querySelectorAll('[data-profile-article-row]').length,filters:document.querySelectorAll('[data-profile-tag-filters]').length,brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href')})`);
  if (archive.rows !== 9 || archive.filters !== 1 || archive.brand !== '/profile/') throw Error(`archive assertion failed: ${JSON.stringify(archive)}`);
  await cdp.eval(`document.querySelector('[data-profile-tag]')?.click()`);
  await wait(cdp, `location.hash.startsWith('#tag=')`);
  await cdp.eval('history.back()');
  await wait(cdp, `location.hash===''&&document.querySelectorAll('[data-profile-article-row]:not([hidden])').length===9`);
  await cdp.eval('history.forward()');
  await wait(cdp, `location.hash.startsWith('#tag=')`);
  await cdp.send('Page.reload');
  await wait(cdp, `location.pathname==='/profile/articles/'&&document.readyState==='complete'&&location.hash.startsWith('#tag=')`);
  await wait(cdp, `document.querySelector('[data-profile-tag-filters]')?.hidden===false`);

  await navigate(cdp, '/profile/');
  await cdp.eval(`document.querySelector('.surface-switch-link').click()`);
  await wait(cdp, `location.pathname==='/'&&document.readyState==='complete'`);
  const bSurface = await cdp.eval(`({brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),calendar:document.querySelector('.profile-article-calendar')!==null,search:document.querySelector('.site-nav-right .popup-trigger')!==null,calendarPage:document.querySelector('.menu-item a[href="/calendar/"]')!==null})`);
  if (bSurface.brand !== '/' || bSurface.calendar || !bSurface.search || !bSurface.calendarPage) throw Error(`B unchanged assertion failed: ${JSON.stringify(bSurface)}`);

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/profile/');
  const mobile = await cdp.eval(`(() => { const scroll=document.querySelector('.profile-calendar-scroll'); return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,containerWidth:scroll.clientWidth,containerScrollWidth:scroll.scrollWidth,hasOverflow:scroll.scrollWidth>scroll.clientWidth,cta:document.querySelector('.profile-navigation a')?.textContent.trim(),switch:document.querySelector('.surface-switch-link')?.getAttribute('href')}; })()`);
  if (mobile.documentWidth > 375 || mobile.bodyWidth > 375 || !mobile.hasOverflow || mobile.cta !== '查看全部 9 篇' || mobile.switch !== '/') throw Error(`mobile profile assertion failed: ${JSON.stringify(mobile)}`);
  await screenshot(cdp, 'wbs109-activity-mobile.png');
  const firstDate = controls[0];
  await cdp.eval(`document.querySelector('[data-profile-calendar-date="${firstDate}"]').click()`);
  await wait(cdp, `document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.startsWith(${JSON.stringify(firstDate)})`);
  if (runtimeErrors.length) throw Error(`browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  const evidence = { date: '2026-09-28', browser: 'Chrome headless via CDP', viewport: { desktop: '1280x900', mobile: '375x812' }, ports: { http: port, cdp: cdpPort }, desktop, sameDayKeyboard: multiDate, profileReloadDefault: '2026-09-27 更新內容', archive, bSurface, mobile, runtimeErrors };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ evidencePath, desktop, sameDayKeyboard: multiDate, archive, bSurface, mobile, runtimeErrors }));
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
