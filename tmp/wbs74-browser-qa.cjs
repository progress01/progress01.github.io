'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve('tmp/wbs74-public-20260927');
const profile = path.resolve('tmp/wbs74-chrome-profile');
const evidencePath = path.resolve('tmp/wbs74-browser-qa-evidence.json');
const base = 'http://127.0.0.1:8914';
const httpPort = 8914;
const cdpPort = 9354;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence = { browser: 'Chrome headless via CDP', viewports: {}, checks: [], failures: [], console: [], ports: { http: httpPort, cdp: cdpPort }, profile };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
let server;
let chrome;
let browser;
let newTab;
const assert = (condition, label, detail) => (condition ? evidence.checks : evidence.failures).push({ label, ...(detail === undefined ? {} : { detail }) });

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown') evidence.console.push({ type: 'exception', text: message.params.exceptionDetails.text, detail: message.params.exceptionDetails.exception?.description || '', url: message.params.exceptionDetails.url || '', line: message.params.exceptionDetails.lineNumber });
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  send(method, params = {}, timeout = 8000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = true) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async wait(expression, timeout = 10000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try { if (await this.eval(expression)) return true; } catch {}
      await delay(80);
    }
    throw new Error(`Timed out: ${expression}`);
  }
  async go(url) {
    await this.send('Page.navigate', { url: base + url });
    await this.wait("document.readyState === 'complete' && location.pathname === '/'");
  }
}

function request(port, route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', part => body += part);
      response.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForCdp() {
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    try { return await request(cdpPort, '/json/version'); } catch { await delay(150); }
  }
  throw new Error('Chrome CDP did not become ready within 12 seconds');
}

async function withTimeout(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

async function run() {
  if (!fs.existsSync(root) || !fs.existsSync(chromePath)) throw new Error('Expected fresh build or Chrome executable is missing');
  fs.mkdirSync(profile, { recursive: true });
  server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, base).pathname); } catch { res.writeHead(400).end(); return; }
    let target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html'); } catch {}
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, { 'content-type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(httpPort, '127.0.0.1', resolve); });
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  chrome.on('error', error => evidence.failures.push({ label: 'chrome_spawn', detail: error.message }));
  await waitForCdp();
  let target;
  const targetDeadline = Date.now() + 7000;
  while (!target && Date.now() < targetDeadline) {
    try { target = await request(cdpPort, '/json/new?about:blank', 'PUT'); }
    catch { await delay(100); }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target');
  browser = new CDP(new WebSocket(target.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => { browser.ws.addEventListener('open', resolve, { once: true }); browser.ws.addEventListener('error', reject, { once: true }); });
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Network.enable');
  await browser.send('Network.setBlockedURLs', { urls: ['https://*/*'] });
  const localSearch = fs.readFileSync('node_modules/hexo-generator-searchdb/dist/search.js', 'utf8');
  const offlineBootstrap = `globalThis.LocalSearch = LocalSearch; var Pjax = globalThis.Pjax = class OfflinePjax { constructor(options) { this.options = options; } refresh() {} executeScripts() {} }; var anime = globalThis.anime = Object.assign(options => { if (options?.complete) options.complete(); return { finished: Promise.resolve() }; }, { timeline: () => ({ add(options) { if (options?.complete) options.complete(); return this; } }) });`;
  const injection = await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `${localSearch}\n${offlineBootstrap}` });
  evidence.injection = injection;
  browser.ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
      evidence.console.push({ type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
    }
  });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await browser.go('/');
  evidence.bootstrapGlobals = await browser.eval("({ LocalSearch: typeof LocalSearch, Pjax: typeof Pjax, anime: typeof anime })");
  await browser.wait("document.querySelector('#home-random-title')?.textContent !== '今天隨機翻到……'");
  const desktop = await browser.eval(`(() => {
    const random = document.querySelector('.home-random-feature').getBoundingClientRect();
    const bridge = document.querySelector('.home-profile-bridge').getBoundingClientRect();
    const link = document.querySelector('.home-profile-bridge a');
    return { viewport: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, randomTop: random.top, randomHeight: random.height, bridgeTop: bridge.top, bridgeHeight: bridge.height, bridgeWidth: bridge.width, href: link.href, target: link.getAttribute('target'), gridCount: document.querySelectorAll('.home-landing-entry-grid > .home-landing-entry').length };
  })()`);
  evidence.viewports.desktop1280 = desktop;
  assert(desktop.scrollWidth === desktop.clientWidth, 'desktop no horizontal overflow', desktop);
  assert(desktop.gridCount === 4 && desktop.bridgeTop > desktop.randomTop + desktop.randomHeight && desktop.bridgeHeight < desktop.randomHeight, 'random feature remains primary and bridge is visually secondary below entries', desktop);
  assert(desktop.href === base + '/profile/' && desktop.target === null, 'bridge is an ordinary same-origin profile link', desktop);

  await browser.eval("document.querySelector('.home-landing-entry-grid a[href=\"/photos/\"]').focus()");
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const focus = await browser.eval(`(() => { const link = document.querySelector('.home-profile-bridge a'); return { active: document.activeElement === link, outline: getComputedStyle(link).outlineStyle, width: getComputedStyle(link).outlineWidth }; })()`);
  assert(focus.active && focus.outline !== 'none' && focus.width !== '0px', 'Tab reaches bridge link with visible focus', focus);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await browser.wait("location.pathname === '/profile/' && document.readyState === 'complete'");
  assert(await browser.eval('location.pathname') === '/profile/', 'Enter opens A side');
  await browser.send('Page.reload', { ignoreCache: true });
  await browser.wait("location.pathname === '/profile/' && document.readyState === 'complete'");
  assert(await browser.eval("document.querySelector('.profile-home') !== null"), 'direct A-side reload renders profile page');
  await browser.eval('history.back()');
  await browser.wait("location.pathname === '/' && document.readyState === 'complete'");
  assert(await browser.eval("document.querySelector('.home-profile-bridge a')?.getAttribute('href') === '/profile/'"), 'Back returns to B homepage with bridge intact');

  const created = await browser.send('Target.createTarget', { url: 'about:blank' });
  const newTargetList = await request(cdpPort, '/json/list');
  const tabTarget = newTargetList.find(item => item.id === created.targetId);
  if (tabTarget?.webSocketDebuggerUrl) {
    newTab = new CDP(new WebSocket(tabTarget.webSocketDebuggerUrl));
    await new Promise((resolve, reject) => { newTab.ws.addEventListener('open', resolve, { once: true }); newTab.ws.addEventListener('error', reject, { once: true }); });
    await newTab.send('Page.enable');
    await newTab.send('Runtime.enable');
    await newTab.send('Page.addScriptToEvaluateOnNewDocument', { source: `${localSearch}\n${offlineBootstrap}` });
    newTab.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') evidence.console.push({ type: 'exception', text: message.params.exceptionDetails.text, detail: message.params.exceptionDetails.exception?.description || '', url: message.params.exceptionDetails.url || '' });
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) evidence.console.push({ type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
    });
    await newTab.send('Page.navigate', { url: base + '/profile/' });
    await newTab.wait("location.pathname === '/profile/' && document.readyState === 'complete'");
    assert(await newTab.eval("document.querySelector('.profile-home') !== null"), 'fresh tab opens stable A-side URL');
  } else assert(false, 'fresh tab target available');

  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.go('/');
  const mobile = await browser.eval(`(() => {
    const bridge = document.querySelector('.home-profile-bridge').getBoundingClientRect();
    const link = document.querySelector('.home-profile-bridge a').getBoundingClientRect();
    const random = document.querySelector('.home-random-feature').getBoundingClientRect();
    return { viewport: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, randomTop: random.top, randomHeight: random.height, bridgeTop: bridge.top, bridgeHeight: bridge.height, bridgeWidth: bridge.width, linkRight: link.right, linkTop: link.top };
  })()`);
  evidence.viewports.mobile390 = mobile;
  assert(mobile.scrollWidth === mobile.clientWidth && mobile.bodyScrollWidth === mobile.clientWidth, '390px phone has no horizontal overflow', mobile);
  assert(mobile.bridgeTop > mobile.randomTop + mobile.randomHeight && mobile.bridgeWidth <= 390 && mobile.linkRight <= 390, 'mobile bridge wraps within viewport below random feature', mobile);
  assert(evidence.console.length === 0, 'browser console has no warnings, errors, or exceptions', evidence.console);
}

(async () => {
  try {
    await withTimeout(run(), 75000, 'WBS 7.4 browser QA');
  } catch (error) {
    evidence.failures.push({ label: 'runner_error', detail: String(error), stack: error?.stack || '' });
  } finally {
    try { if (newTab?.ws.readyState === WebSocket.OPEN) newTab.ws.close(); } catch {}
    try { if (browser?.ws.readyState === WebSocket.OPEN) browser.ws.close(); } catch {}
    try { if (chrome && !chrome.killed) chrome.kill(); } catch {}
    if (server) await new Promise(resolve => server.close(resolve));
    await delay(250);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 }); evidence.profileCleaned = !fs.existsSync(profile); }
    catch (error) { evidence.profileCleaned = false; evidence.profileCleanupError = error.code || error.message; }
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ pass: evidence.failures.length === 0, checks: evidence.checks.length, failures: evidence.failures, console: evidence.console.length, ports: evidence.ports, profileCleaned: evidence.profileCleaned, evidencePath }, null, 2));
    if (evidence.failures.length) process.exitCode = 1;
  }
})();
