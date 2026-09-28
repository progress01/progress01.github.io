'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve('tmp/wbs92-public-20260927');
const profile = path.resolve('tmp/wbs92-chrome-profile');
const evidencePath = path.resolve('tmp/wbs92-browser-evidence.json');
const httpPort = 8922;
const cdpPort = 9362;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const errors = [];
let server;
let chrome;

function safeTmp(file) {
  if (!file.startsWith(path.resolve('tmp') + path.sep)) throw new Error(`Unsafe QA output path: ${file}`);
}
function request(port, route, method = 'GET') {
  return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port, path: route, method }, response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
    response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  }).on('error', reject).end());
}
function listen(port) { return new Promise(resolve => server.listen(port, '127.0.0.1', resolve)); }
function staticServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${httpPort}`).pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const searchScript = pathname === '/search.js';
    const target = searchScript
      ? path.resolve('node_modules/hexo-generator-searchdb/dist/search.js')
      : path.resolve(root, `.${pathname}`);
    if (!searchScript && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
      let output = data;
      if (!searchScript && path.extname(target) === '.html') {
        output = Buffer.from(data.toString('utf8')
          .replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^>]*>\s*<\/script>/gi, '')
          .replace(/<link\b(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, '')
          .replace('</head>', '<style>.use-motion .post-block,.use-motion .post-header,.use-motion .post-body{visibility:visible!important;opacity:1!important}</style><script>window.anime=Object.assign(function(){return {finished:Promise.resolve()};},{timeline:function(){return {add:function(){return this;}};}});</script><script src="/search.js"></script></head>'));
      }
      res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(output);
    });
  });
}
async function waitUntil(cdp, expression, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await cdp.evaluate(expression)) return; } catch {}
    await delay(30);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
class CDP {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map(); this.events = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        this.events.push({ at: Date.now(), method: message.method });
        if (message.method === 'Fetch.requestPaused') {
          const { requestId, request, resourceType } = message.params;
          const local = request.url.startsWith(`http://127.0.0.1:${httpPort}/`);
          const command = local ? this.send('Fetch.continueRequest', { requestId }) : this.send('Fetch.fulfillRequest', {
            requestId, responseCode: 200,
            responseHeaders: [
              { name: 'content-type', value: resourceType === 'Stylesheet' ? 'text/css' : 'application/javascript' },
              { name: 'access-control-allow-origin', value: '*' }
            ],
            body: Buffer.from(request.url.includes('/animejs/') ? 'window.anime=Object.assign(function(){return {finished:Promise.resolve()};},{timeline:function(){return {add:function(){return this;}};}});' : '').toString('base64')
          });
          command.catch(() => {});
          return;
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push({ type: 'exception', message: message.params.exceptionDetails.text });
        if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) errors.push({ type: message.params.type, message: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
        if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) errors.push({ type: message.params.entry.level, message: message.params.entry.text });
        return;
      }
      const entry = this.pending.get(message.id); if (!entry) return;
      this.pending.delete(message.id); clearTimeout(entry.timer);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
      this.pending.set(id, { resolve, reject, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}
async function newPage(viewport) {
  const target = await request(cdpPort, `/json/new?${encodeURIComponent('about:blank')}`, 'PUT');
  console.log(`CDP target ${target.id} ${target.webSocketDebuggerUrl}`);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('close', event => console.log(`CDP websocket closed ${event.code} ${event.reason}`));
  socket.addEventListener('error', event => console.log(`CDP websocket error ${event.message || ''}`));
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const cdp = new CDP(socket);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Network.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `new MutationObserver(()=>{const m=document.querySelector('.main-inner');if(m&&m.classList.contains('surface-transition-enter')){const s=getComputedStyle(m);window.__surfaceTransitionSample={mainClass:m.className,duration:s.animationDuration,opacity:s.opacity,transform:s.transform,at:performance.now()};}}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});` });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 500 });
  return { cdp, socket, target };
}
async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}${route}` });
  await waitUntil(cdp, `location.pathname === ${JSON.stringify(route)} && document.readyState === "complete"`);
  await delay(60);
}
async function collectRoute(evidence, cdp, name, route, viewport) {
  await navigate(cdp, route);
  const data = await cdp.evaluate(`(() => { const root=document.documentElement; const main=document.querySelector('.main-inner'); return { pathname:location.pathname, mainClass:main.className, scrollWidth:root.scrollWidth, viewport:innerWidth, linkCount:document.querySelectorAll('a[data-target-surface]').length }; })()`);
  evidence.routes[name] = data;
  return data;
}
async function transitionCheck(evidence, viewport, from, target, to) {
  const { cdp, socket } = await newPage(viewport);
  await navigate(cdp, from);
  const before = await cdp.evaluate('location.pathname');
  const stamp = Date.now();
  await cdp.evaluate(`document.querySelector('a[data-target-surface="${target}"]').click()`);
  await waitUntil(cdp, `location.pathname === ${JSON.stringify(to)} && document.querySelector('.main-inner')`);
  const arrivedAt = Date.now();
  await waitUntil(cdp, 'document.readyState === "complete"');
  const animation = await cdp.evaluate(`(() => { const main=document.querySelector('.main-inner'); const style=getComputedStyle(main); return { pathname:location.pathname, ...(window.__surfaceTransitionSample || {mainClass:main.className,duration:style.animationDuration,opacity:style.opacity,transform:style.transform}), intent:sessionStorage.getItem('surface-transition-intent'), scrollWidth:document.documentElement.scrollWidth, viewport:innerWidth }; })()`);
  await delay(260);
  const ended = await cdp.evaluate(`document.querySelector('.main-inner').className`);
  evidence.transitions.push({ viewport: viewport.name, from: before, to, urlElapsedMs: arrivedAt - stamp, ...animation, finalClass: ended });
  await cdp.send('Page.captureScreenshot').then(result => {
    const file = path.resolve(`tmp/wbs92-${viewport.name}-${target}.png`); safeTmp(file); fs.writeFileSync(file, Buffer.from(result.data, 'base64')); evidence.screenshots.push(file);
  });
  await cdp.send('Page.reload', { ignoreCache: true }); await waitUntil(cdp, 'document.readyState === "complete"'); await delay(30);
  evidence.reloads.push(await cdp.evaluate(`({pathname:location.pathname, mainClass:document.querySelector('.main-inner').className})`));
  await cdp.send('Runtime.evaluate', { expression: 'history.back()' }); await waitUntil(cdp, `location.pathname === ${JSON.stringify(from)}`); await delay(30);
  evidence.back.push(await cdp.evaluate(`({pathname:location.pathname, mainClass:document.querySelector('.main-inner').className})`));
  await cdp.send('Page.close').catch(() => {});
  socket.close();
}

(async () => {
  const evidence = { viewports: { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } }, routes: {}, transitions: [], reloads: [], back: [], reducedMotion: [], noJs: [], keyboard: [], modifier: [], screenshots: [], console: errors };
  safeTmp(profile); safeTmp(evidencePath);
  server = staticServer(); await listen(httpPort);
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `http://127.0.0.1:${httpPort}/`], { stdio: 'ignore', windowsHide: true });
  let ready = false;
  for (let i = 0; i < 100; i += 1) { try { await request(cdpPort, '/json/version'); ready = true; break; } catch { await delay(100); } }
  if (!ready) throw new Error('Chrome CDP not ready');
  for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const { cdp, socket } = await newPage(viewport);
    await collectRoute(evidence, cdp, `${viewport.name}:/`, '/', viewport);
    await collectRoute(evidence, cdp, `${viewport.name}:/profile/`, '/profile/', viewport);
    await cdp.send('Page.close').catch(() => {}); socket.close();
    await transitionCheck(evidence, viewport, '/', 'profile', '/profile/');
    await transitionCheck(evidence, viewport, '/profile/', 'memory', '/');
  }
  {
    const { cdp, socket } = await newPage(evidence.viewports.desktop);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await navigate(cdp, '/');
    evidence.reducedMotion.push({ beforeClickIntent: await cdp.evaluate("sessionStorage.getItem('surface-transition-intent')") });
    await cdp.evaluate("document.querySelector('a[data-target-surface=profile]').click()");
    await waitUntil(cdp, 'location.pathname === "/profile/" && document.querySelector(".main-inner")');
    evidence.reducedMotion.push(await cdp.evaluate("({pathname:location.pathname, className:document.querySelector('.main-inner').className, duration:getComputedStyle(document.querySelector('.main-inner')).animationDuration, intent:sessionStorage.getItem('surface-transition-intent')})"));
    await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  {
    const { cdp, socket } = await newPage(evidence.viewports.desktop);
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: true }); await navigate(cdp, '/');
    await cdp.evaluate("document.querySelector('a[data-target-surface=profile]').click()").catch(() => {});
    await waitUntil(cdp, 'location.pathname === "/profile/"');
    evidence.noJs.push(await cdp.evaluate('location.pathname')); await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  {
    const { cdp, socket } = await newPage(evidence.viewports.desktop);
    await navigate(cdp, '/'); await cdp.evaluate("document.querySelector('a[data-target-surface=profile]').focus()");
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitUntil(cdp, 'location.pathname === "/profile/" && document.querySelector(".main-inner")'); evidence.keyboard.push(await cdp.evaluate('location.pathname')); await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  {
    const { cdp, socket } = await newPage(evidence.viewports.desktop);
    await navigate(cdp, '/');
    const before = (await request(cdpPort, '/json/list')).filter(target => target.type === 'page').map(target => target.id);
    const rect = await cdp.evaluate("(() => {const r=document.querySelector('a[data-target-surface=profile]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await cdp.evaluate('document.addEventListener("click",event=>window.__lastClick={button:event.button,ctrlKey:event.ctrlKey,target:event.target.tagName},{once:true})');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y, modifiers: 2 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1, modifiers: 2 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 0, clickCount: 1, modifiers: 2 });
    await delay(250);
    const pages = (await request(cdpPort, '/json/list')).filter(target => target.type === 'page');
    const opened = pages.filter(page => !before.includes(page.id));
    evidence.modifier.push({ current: await cdp.evaluate('({pathname:location.pathname,intent:sessionStorage.getItem("surface-transition-intent"),lastClick:window.__lastClick})'), pagesBefore: before.length, pagesAfter: pages.length, pageUrls: pages.map(page => page.url), openedProfileTab: opened.some(page => page.url.endsWith('/profile/')) });
    await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  evidence.consoleCount = errors.length;
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  if (errors.length) throw new Error(`Browser console diagnostics: ${JSON.stringify(errors)}`);
  console.log(`Browser QA evidence: ${evidencePath}; ${evidence.transitions.length} transitions; ${evidence.routes ? Object.keys(evidence.routes).length : 0} viewport routes; console ${errors.length}.`);
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  if (server) server.close();
  if (chrome && !chrome.killed) chrome.kill();
});
