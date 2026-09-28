'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = path.resolve('.');
const publicRoot = path.resolve('tmp/wbs82-public-20260927');
const fixture = path.resolve('tmp/wbs82-thinking-fixture.html');
const profile = path.resolve('tmp/wbs82-chrome-profile');
const evidencePath = path.resolve('tmp/wbs82-browser-qa-evidence.json');
const httpPort = 8916;
const cdpPort = 9356;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence = { fixture: 'synthetic only; no author article was modified', ports: { http: httpPort, cdp: cdpPort }, viewports: {}, checks: [], console: [], profile };
const assert = (condition, label, detail) => evidence.checks.push({ label, passed: Boolean(condition), ...(detail === undefined ? {} : { detail }) });
let server;
let chrome;
let browser;

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown') evidence.console.push({ type: 'exception', text: message.params.exceptionDetails.text });
        if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
          evidence.console.push({ type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
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
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
}

function assertInsideTmp(targetPath) {
  const tmpRoot = path.resolve('tmp') + path.sep;
  if (!targetPath.startsWith(tmpRoot)) throw new Error(`Refusing out-of-workspace temporary path: ${targetPath}`);
}

function available(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()));
  });
}

function requestJson(port, route) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: route }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', part => { body += part; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on('error', reject);
  });
}

async function waitForCdp() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { return await requestJson(cdpPort, '/json/version'); } catch { await delay(100); }
  }
  throw new Error('Chrome CDP did not become ready');
}

async function main() {
  assertInsideTmp(profile);
  assertInsideTmp(evidencePath);
  if (!fs.existsSync(fixture) || !fs.existsSync(path.join(publicRoot, 'css', 'main.css'))) throw new Error('Fixture or built stylesheet is missing');
  await Promise.all([available(httpPort), available(cdpPort)]);

  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${httpPort}`).pathname);
    const target = pathname === '/synthetic.html' ? fixture : path.resolve(publicRoot, `.${pathname}`);
    const resolvedRoot = publicRoot + path.sep;
    if (target !== fixture && !target.startsWith(resolvedRoot)) {
      response.writeHead(403); response.end(); return;
    }
    fs.readFile(target, (error, data) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'Content-Type': target.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
      response.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(httpPort, '127.0.0.1', resolve); });

  chrome = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-extensions',
    '--disable-background-networking', '--no-sandbox', `http://127.0.0.1:${httpPort}/synthetic.html`
  ], { stdio: 'ignore', windowsHide: true });
  await waitForCdp();
  let pageTargets;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      pageTargets = await requestJson(cdpPort, '/json/list');
      if (Array.isArray(pageTargets) && pageTargets.some(target => target.type === 'page')) break;
    } catch {}
    await delay(100);
  }
  const pageTarget = pageTargets?.find(target => target.type === 'page');
  if (!pageTarget?.webSocketDebuggerUrl) throw new Error('Chrome page target did not become ready');
  browser = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { browser.addEventListener('open', resolve, { once: true }); browser.addEventListener('error', reject, { once: true }); });
  const cdp = new CDP(browser);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/synthetic.html` });
  await delay(700);
  for (const viewport of [{ key: 'desktop1280', width: 1280 }, { key: 'mobile390', width: 390 }]) {
    if (viewport.key !== 'desktop1280') {
      await cdp.send('Page.setDeviceMetricsOverride', { width: viewport.width, height: 844, deviceScaleFactor: 1, mobile: true });
      await delay(200);
    }
    const metrics = await cdp.evaluate(`(() => {
      const block = document.querySelector('.post-thinking-status');
      const time = block.querySelector('time');
      const title = block.querySelector('h2');
      const body = document.querySelector('.post-body');
      const cards = [...document.querySelectorAll('.profile-thinking-label')];
      return {
        viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
        blockWidth: block.clientWidth, blockScrollWidth: block.scrollWidth, blockText: block.innerText,
        time: time.textContent, datetime: time.getAttribute('datetime'), title: title.textContent,
        articleOrder: block.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING ? 'status-before-body' : 'invalid',
        hasInjectedImage: Boolean(block.querySelector('img')), scriptCount: document.scripts.length,
        inlineHandlers: [...document.querySelectorAll('*')].flatMap(element => [...element.attributes].filter(attribute => /^on/i.test(attribute.name)).map(attribute => attribute.name)),
        cardLabels: cards.map(card => card.textContent.trim()),
        cardOrder: cards.every(card => card.previousElementSibling?.matches('h2,h3')),
        computedDisplay: getComputedStyle(block).display, stylesheetLoaded: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/css/main.css'))
      };
    })()`);
    evidence.viewports[viewport.key] = metrics;
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const screenshotPath = path.resolve(`tmp/wbs82-${viewport.key}.png`);
    assertInsideTmp(screenshotPath);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    evidence.viewports[viewport.key].screenshot = screenshotPath;
    assert(metrics.viewport === viewport.width, `${viewport.key}: viewport applied`, metrics.viewport);
    assert(metrics.documentWidth <= metrics.viewport && metrics.bodyWidth <= metrics.viewport, `${viewport.key}: no horizontal page overflow`, { document: metrics.documentWidth, body: metrics.bodyWidth });
    assert(metrics.blockScrollWidth <= metrics.blockWidth, `${viewport.key}: long boundary fits`, { content: metrics.blockScrollWidth, box: metrics.blockWidth });
    assert(metrics.title === '🚧 當前假設／探索中' && metrics.datetime === '2026-09-27' && metrics.time === '2026-09-27', `${viewport.key}: semantic heading and calibration date`);
    assert(metrics.blockText.includes('目前適用邊界') && metrics.articleOrder === 'status-before-body', `${viewport.key}: boundary and article reading order`);
    assert(!metrics.hasInjectedImage && metrics.scriptCount === 0 && metrics.inlineHandlers.length === 0, `${viewport.key}: escaped text and no script/handlers`);
    assert(metrics.cardLabels.length === 3 && metrics.cardLabels.every(label => label === '探索中・校準 2026-09-27') && metrics.cardOrder, `${viewport.key}: all three A card variants are compact`);
    assert(metrics.stylesheetLoaded, `${viewport.key}: compiled site stylesheet loaded`);
  }
}

main().catch(error => { evidence.failure = error.stack || String(error); }).finally(async () => {
  try { browser?.close(); } catch {}
  if (chrome && !chrome.killed) {
    chrome.kill();
    await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(4000)]);
  }
  if (server) await new Promise(resolve => server.close(resolve));
  if (fs.existsSync(profile)) {
    const resolved = path.resolve(profile);
    assertInsideTmp(resolved);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  evidence.teardown = { chromeExited: Boolean(chrome?.exitCode !== null || chrome?.signalCode), httpServerClosed: !server?.listening, profileRemoved: !fs.existsSync(profile) };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  const failed = evidence.failure || evidence.checks.some(check => !check.passed) || evidence.console.length || !evidence.teardown.chromeExited || !evidence.teardown.httpServerClosed || !evidence.teardown.profileRemoved;
  process.stdout.write(JSON.stringify({ evidencePath, failures: evidence.checks.filter(check => !check.passed), failure: evidence.failure, console: evidence.console, teardown: evidence.teardown }, null, 2) + '\n');
  process.exitCode = failed ? 1 : 0;
});
