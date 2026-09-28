'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve('tmp/wbs91-public-20260927');
const profile = path.resolve('tmp/wbs91-chrome-profile');
const evidencePath = path.resolve('tmp/wbs91-browser-evidence.json');
const httpPort = 8921;
const cdpPort = 9361;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence = { viewports: {}, routes: {}, screenshots: [], console: [], ports: { http: httpPort, cdp: cdpPort } };
let server;
let chrome;
let ws;

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown') evidence.console.push({
          type: 'exception',
          text: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text,
          url: message.params.exceptionDetails.url
        });
        if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
          evidence.console.push({ type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
        }
        if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) {
          evidence.console.push({ type: message.params.entry.level, text: message.params.entry.text });
        }
        if (message.method === 'Fetch.requestPaused') {
          const url = message.params.request.url;
          const local = url.startsWith(`http://127.0.0.1:${httpPort}/`);
          if (local) this.send('Fetch.continueRequest', { requestId: message.params.requestId }).catch(() => {});
          else {
            const animeShim = url.includes('/animejs/')
              ? 'window.anime=Object.assign(function(){return {finished:Promise.resolve()};},{timeline:function(){return {add:function(){return this;}};}});'
              : '';
            this.send('Fetch.fulfillRequest', {
              requestId: message.params.requestId,
              responseCode: 200,
              responseHeaders: [{ name: 'content-type', value: message.params.resourceType === 'Stylesheet' ? 'text/css' : 'application/javascript' }],
              body: Buffer.from(animeShim).toString('base64')
            }).catch(() => {});
          }
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  send(method, params = {}, timeoutMs = 10000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}

function assertTmp(file) {
  if (!file.startsWith(path.resolve('tmp') + path.sep)) throw new Error(`Unsafe QA output path: ${file}`);
}

function request(port, route) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: route }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on('error', reject);
  });
}

function portAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()));
  });
}

function waitForServer() {
  return new Promise(resolve => server.listen(httpPort, '127.0.0.1', resolve));
}

function contentType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.xml': 'application/xml' })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function createServer() {
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
      let output = data;
      if (path.extname(target).toLowerCase() === '.html') {
        output = Buffer.from(data.toString('utf8')
          .replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^>]*>\s*<\/script>/gi, '')
          .replace(/<link\b(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, '')
          .replace('</head>', '<script src="/search.js"></script></head>'));
      }
      res.writeHead(200, { 'content-type': contentType(target), 'cache-control': 'no-store', 'access-control-allow-origin': '*' }).end(output);
    });
  });
}

async function waitCdp() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { return await request(cdpPort, '/json/version'); } catch { await delay(100); }
  }
  throw new Error('Chrome CDP did not become ready');
}

async function targetFor(url) {
  const targetUrl = `http://127.0.0.1:${httpPort}${url}`;
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Cannot create CDP page: ${response.status}`);
  const target = await response.json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.anime=Object.assign(function(){return {finished:Promise.resolve()};},{timeline:function(){return {add:function(){return this;}};}});' });
  await cdp.send('Page.navigate', { url: targetUrl });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await cdp.evaluate('document.readyState === "complete"').catch(() => false)) break;
    await delay(100);
  }
  await delay(500);
  return cdp;
}

async function inspect(cdp, route, viewportName) {
  await cdp.evaluate('window.NexT?.motion?.integrator?.reveal?.()').catch(() => {});
  await delay(120);
  const result = await cdp.evaluate(`(() => {
    const main = document.querySelector('.main-inner');
    const css = getComputedStyle(main || document.documentElement);
    const firstCard = document.querySelector('.profile-article-link, .home-landing-entry');
    const card = firstCard ? getComputedStyle(firstCard) : null;
    const switchLink = document.querySelector('.surface-switch-link');
    const switchStyle = switchLink ? getComputedStyle(switchLink) : null;
    const marker = document.querySelector('.post-surface-marker');
    const markerStyle = marker ? getComputedStyle(marker) : null;
    const thinking = document.querySelector('.post-thinking-status');
    const thinkingStyle = thinking ? getComputedStyle(thinking) : null;
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return {
      pathname: location.pathname,
      mainClass: main?.className || '',
      tokens: Object.fromEntries(['paper','base','panel','ink','muted','border','accent','accent-strong','focus','shadow'].map(key => [key, css.getPropertyValue('--surface-' + key).trim()])),
      card: firstCard ? { background: card.backgroundColor, color: card.color, border: card.borderTopColor, shadow: card.boxShadow, rect: rect(firstCard) } : null,
      switch: switchLink ? { visible: switchStyle.display !== 'none' && switchStyle.visibility !== 'hidden' && rect(switchLink).width > 0, color: switchStyle.color, background: switchStyle.backgroundColor, rect: rect(switchLink) } : null,
      marker: marker ? { color: markerStyle.color, background: markerStyle.backgroundColor, hasRouteClass: /profile-page|index/.test(main?.className || '') } : null,
      thinking: thinking ? { color: thinkingStyle.color, background: thinkingStyle.backgroundColor } : null,
      overflow: { innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth },
      pageBackground: getComputedStyle(document.body).backgroundColor
    };
  })()`);
  evidence.routes[`${viewportName}:${route}`] = result;
  if (route === '/' && viewportName === 'desktop') {
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const output = path.resolve('tmp/wbs91-desktop-memory.png'); assertTmp(output);
    fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'));
    evidence.screenshots.push(output);
  }
  if (route === '/profile/' && viewportName === 'desktop') {
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const output = path.resolve('tmp/wbs91-desktop-profile.png'); assertTmp(output);
    fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'));
    evidence.screenshots.push(output);
  }
  return result;
}

async function main() {
  assertTmp(profile); assertTmp(evidencePath);
  if (!fs.existsSync(path.join(root, 'index.html')) || !fs.existsSync(path.join(root, 'profile', 'index.html'))) throw new Error('Isolated build is incomplete');
  await Promise.all([portAvailable(httpPort), portAvailable(cdpPort)]);
  server = createServer();
  await waitForServer();
  chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `http://127.0.0.1:${httpPort}/`
  ], { stdio: 'ignore', windowsHide: true });
  chrome.once('error', error => { evidence.chromeError = error.message; });
  await waitCdp();

  for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    evidence.viewports[viewport.name] = viewport;
    for (const route of ['/', '/profile/', '/profile/articles/']) {
      const cdp = await targetFor(route);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
      await cdp.send('Page.reload', { ignoreCache: true });
      await delay(700);
      await inspect(cdp, route, viewport.name);
      await cdp.send('Page.close').catch(() => {});
      ws.close();
    }
  }
  const articleCdp = await targetFor('/work/flow-friendly-work-system/');
  await articleCdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await articleCdp.send('Page.reload', { ignoreCache: true });
  await delay(700);
  await inspect(articleCdp, '/work/flow-friendly-work-system/', 'desktop');
  await articleCdp.send('Page.close').catch(() => {});
  ws.close();

  const checks = [];
  const record = (condition, name, detail) => checks.push({ name, passed: Boolean(condition), detail });
  const home = evidence.routes['desktop:/'];
  const profileRoute = evidence.routes['desktop:/profile/'];
  const articles = evidence.routes['desktop:/profile/articles/'];
  const article = evidence.routes['desktop:/work/flow-friendly-work-system/'];
  for (const viewportName of ['desktop', 'mobile']) {
    for (const route of ['/', '/profile/', '/profile/articles/']) {
      const page = evidence.routes[`${viewportName}:${route}`];
      record(page?.overflow.scrollWidth <= page?.overflow.innerWidth, `no-horizontal-overflow-${viewportName}-${route}`, page?.overflow);
      record(page?.switch?.visible, `surface-switch-visible-${viewportName}-${route}`, page?.switch);
    }
  }
  record(home.tokens.accent !== profileRoute.tokens.accent && home.tokens.panel !== profileRoute.tokens.panel && home.tokens.ink !== profileRoute.tokens.ink, 'memory-profile-tokens-distinct', { memory: home.tokens, profile: profileRoute.tokens });
  record(home.card?.background !== profileRoute.card?.background, 'memory-profile-card-panel-distinct', { memory: home.card?.background, profile: profileRoute.card?.background, articles: articles.card?.background });
  record(Boolean(article.marker && !article.marker.hasRouteClass && !article.thinking), 'ordinary-article-keeps-neutral-marker', article);
  record(evidence.console.length === 0, 'console-warning-error-exception-zero', evidence.console);
  evidence.checks = checks;
  evidence.summary = { passed: checks.filter(item => item.passed).length, total: checks.length };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  if (chrome && !chrome.killed) chrome.kill();
  await new Promise(resolve => server.close(resolve));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await Promise.all([portAvailable(httpPort), portAvailable(cdpPort)]); evidence.portsReleased = true; break; }
    catch { await delay(100); }
  }
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  if (evidence.summary.passed !== evidence.summary.total || !evidence.portsReleased) process.exitCode = 1;
  console.log(`WBS 9.1 browser QA: ${evidence.summary.passed}/${evidence.summary.total}; console ${evidence.console.length}; ports released=${Boolean(evidence.portsReleased)}; ${evidencePath}`);
}

main().catch(async error => {
  evidence.fatal = error.message;
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  if (chrome && !chrome.killed) chrome.kill();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
