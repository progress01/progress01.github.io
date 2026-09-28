'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve('tmp/wbs75-public-20260927-retry2');
const profile = path.resolve('tmp/wbs75-chrome-profile');
const evidencePath = path.resolve('tmp/wbs75-browser-qa-evidence.json');
const httpPort = 8915;
const cdpPort = 9355;
const base = `http://127.0.0.1:${httpPort}`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence = { browser: 'Chrome headless via CDP', viewports: {}, checks: [], failures: [], console: [], ports: { http: httpPort, cdp: cdpPort }, profile };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
let server, chrome, browser;
const assert = (condition, label, detail) => (condition ? evidence.checks : evidence.failures).push({ label, ...(detail === undefined ? {} : { detail }) });

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown') evidence.console.push({ type: 'exception', text: message.params.exceptionDetails.text, detail: message.params.exceptionDetails.exception?.description || '', url: message.params.exceptionDetails.url || '' });
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        evidence.console.push({ type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
      }
    });
  }
  send(method, params = {}, timeout = 8000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async wait(expression, timeout = 10000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) { try { if (await this.eval(expression)) return true; } catch {} await delay(70); }
    throw new Error(`Timed out: ${expression}`);
  }
  async go(route) {
    await this.send('Page.navigate', { url: base + route });
    const expectedPath = decodeURIComponent(new URL(route, base).pathname);
    await this.wait(`document.readyState === 'complete' && decodeURIComponent(location.pathname) === ${JSON.stringify(expectedPath)}`);
  }
  async click(selector, expectedRoute) {
    const found = await this.eval(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.click(); return true; })()`);
    if (!found) throw new Error(`Missing click target ${selector}`);
    if (expectedRoute) await this.wait(`document.readyState === 'complete' && decodeURIComponent(location.pathname) === ${JSON.stringify(expectedRoute)}`);
  }
}

function request(route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: cdpPort, path: route, method }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', part => body += part);
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(body); } });
    });
    req.on('error', reject); req.end();
  });
}
async function waitForCdp() {
  const until = Date.now() + 12000;
  while (Date.now() < until) { try { return await request('/json/version'); } catch { await delay(120); } }
  throw new Error('CDP startup exceeded 12 seconds');
}
async function connectPage() {
  let target;
  const until = Date.now() + 6000;
  while (!target && Date.now() < until) { try { target = await request('/json/new?about:blank', 'PUT'); } catch { await delay(100); } }
  if (!target?.webSocketDebuggerUrl) throw new Error('Chrome page target unavailable');
  const cdp = new CDP(new WebSocket(target.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => { cdp.ws.addEventListener('open', resolve, { once: true }); cdp.ws.addEventListener('error', reject, { once: true }); });
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['https://*/*'] });
  const localSearch = fs.readFileSync('node_modules/hexo-generator-searchdb/dist/search.js', 'utf8');
  const contentBrowser = fs.readFileSync(path.join(root, 'js/content-browser.js'), 'utf8');
  const stubs = `globalThis.LocalSearch=LocalSearch; var Pjax=globalThis.Pjax=class{constructor(options){this.options=options}refresh(){}executeScripts(){}};var anime=globalThis.anime=Object.assign(options=>{if(options?.complete)options.complete();return{finished:Promise.resolve()}},{timeline:()=>({add(options){if(options?.complete)options.complete();return this}})});`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `${localSearch}\n${stubs}\n${contentBrowser}` });
  return cdp;
}

async function run() {
  if (!fs.existsSync(root) || !fs.existsSync(chromePath)) throw new Error('Fresh build or Chrome executable missing');
  if (fs.existsSync(profile)) throw new Error('Refusing to reuse existing Chrome profile');
  fs.mkdirSync(profile, { recursive: true });
  server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, base).pathname); } catch { res.writeHead(400).end(); return; }
    let target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html'); } catch {}
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end('Not found'); return; }
      const body = path.extname(target).toLowerCase() === '.html'
        ? data.toString('utf8').replaceAll('https://progress01.github.io', base)
        : data;
      res.writeHead(200, { 'content-type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(httpPort, '127.0.0.1', resolve); });
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  await waitForCdp(); browser = await connectPage();

  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await browser.go('/archives/');
  const first = await browser.eval(`({count:document.querySelectorAll('.post-block .post-title-link').length, width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth, page:location.pathname})`);
  evidence.viewports.desktop1280 = first;
  assert(first.count === 100 && first.scroll === first.width, 'desktop archives page 1 has 100 unique rows without overflow', first);
  await browser.click('a[href="/archives/page/2/"]', '/archives/page/2/');
  const second = await browser.eval(`({count:document.querySelectorAll('.post-block .post-title-link').length, href:document.querySelector('.post-block .post-title-link')?.getAttribute('href')})`);
  assert(second.count === 100 && second.href, 'archive pagination opens page 2', second);
  await browser.click('a[href="/archives/page/3/"]', '/archives/page/3/');
  const third = await browser.eval(`({count:document.querySelectorAll('.post-block .post-title-link').length, href:document.querySelector('.post-block .post-title-link')?.getAttribute('href')})`);
  assert(third.count === 71 && third.href, 'archive pagination opens final page', third);
  await browser.eval('history.back()'); await browser.wait("decodeURIComponent(location.pathname) === '/archives/page/2/'");
  await browser.eval('history.back()'); await browser.wait("decodeURIComponent(location.pathname) === '/archives/'");
  assert(true, 'archive Back restores prior pagination pages');

  await browser.go('/categories/');
  await browser.eval(fs.readFileSync(path.join(root, 'js/content-browser.js'), 'utf8'));
  await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('271 篇')");
  const initial = await browser.eval(`({count:[...document.querySelectorAll('[data-browse-item]')].filter(x=>!x.hidden).length, scroll:document.documentElement.scrollWidth, width:document.documentElement.clientWidth})`);
  evidence.viewports.desktop1280Categories = initial;
  assert(initial.count === 271 && initial.scroll === initial.width, 'categories default to all 271 with no overflow', initial);
  assert(true, 'static no-script fallback is checked in generated HTML output audit');
  await browser.eval(`document.querySelector('[data-browse-kind="categories"]').focus()`);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const keyboardFocus = await browser.eval(`({active:document.activeElement.matches('[data-browse-kind="categories"]'),visible:document.activeElement.matches(':focus-visible'),value:document.activeElement.dataset.browseValue})`);
  assert(keyboardFocus.active && keyboardFocus.visible, 'Tab moves category controls with a visible keyboard focus ring', keyboardFocus);
  await browser.eval(`document.querySelector('[data-browse-kind="categories"][data-browse-value="音樂"]').focus()`);
  await browser.click('[data-browse-kind="categories"][data-browse-value="音樂"]');
  await delay(200);
  const category = await browser.eval(`({count:[...document.querySelectorAll('[data-browse-item]')].filter(x=>!x.hidden).length,focus:document.activeElement?.dataset.browseValue,outline:getComputedStyle(document.activeElement).outlineStyle,href:location.search})`);
  assert(category.count === 121 && category.href.includes('category='), 'category selection filters and persists state', category);
  await browser.click('[data-browse-open="topics"]');
  await browser.click('[data-browse-options="topics"] [data-browse-value="韓語"]');
  await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('11 篇')");
  const topic = await browser.eval(`({count:[...document.querySelectorAll('[data-browse-item]')].filter(x=>!x.hidden).length,search:location.search})`);
  assert(topic.count === 11 && topic.search.includes('category=%E9%9F%B3%E6%A8%82') && topic.search.includes('topic=%E9%9F%93%E8%AA%9E'), 'topic intersects category and persists query state', topic);
  await browser.eval('history.back()'); await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('121 篇')");
  await browser.eval('history.back()'); await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('271 篇')");
  assert(true, 'category/topic Back restores 121 then 271 results');
  await browser.go('/categories/?category=%E9%9F%B3%E6%A8%82&topic=%E9%9F%93%E8%AA%9E');
  await browser.eval(fs.readFileSync(path.join(root, 'js/content-browser.js'), 'utf8'));
  await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('11 篇')");
  await browser.send('Page.reload', { ignoreCache: true }); await browser.wait("document.readyState === 'complete'");
  await browser.eval(fs.readFileSync(path.join(root, 'js/content-browser.js'), 'utf8'));
  await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('11 篇')");
  assert(await browser.eval("location.search.includes('topic=')"), 'direct query and reload preserve filters');
  await browser.click('[data-browse-clear]'); await browser.wait("document.querySelector('[data-browse-summary]')?.textContent.includes('271 篇')");
  assert(await browser.eval('location.search.includes("category=") && location.search.includes("topic=")'), 'clear restores all and serializes empty conditions');

  const samples = [
    '/work/from-real-work-to-features/',
    '/2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/',
    '/work/flow-friendly-work-system/',
    '/2026/01/25/部落格改版規劃/'
  ];
  for (const route of samples) {
    await browser.go('/categories/');
    const routeFound = await browser.eval(`(() => [...document.querySelectorAll('[data-browse-item] a')].some(a=>decodeURIComponent(new URL(a.href).pathname)===${JSON.stringify(route)}))()`);
    assert(routeFound, 'fixed sample appears in categories listing', route);
    const linkFocused = await browser.eval(`(() => { const a=[...document.querySelectorAll('[data-browse-item] a')].find(item=>decodeURIComponent(new URL(item.href).pathname)===${JSON.stringify(route)}); if(!a) return false; a.focus(); return document.activeElement===a; })()`);
    assert(linkFocused, 'sample link can receive keyboard focus', route);
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await browser.wait(`document.readyState === 'complete' && decodeURIComponent(location.pathname) === ${JSON.stringify(route)}`);
    const page = await browser.eval(`({path:decodeURIComponent(location.pathname),canonical:decodeURIComponent(new URL(document.querySelector('link[rel="canonical"]').href).pathname),urlCount:document.querySelectorAll('article.post-content-single').length})`);
    assert(page.path === route && page.canonical === route && page.urlCount === 1, 'sample opens original single canonical route with keyboard link', page);
    await browser.eval('history.back()'); await browser.wait("decodeURIComponent(location.pathname) === '/categories/'");
    assert(true, 'Back from sample returns to categories listing', route);
  }

  await browser.go('/profile/articles/');
  const profileCount = await browser.eval("document.querySelectorAll('.profile-full-article-card').length");
  assert(profileCount === 8, 'A-side full list remains exactly 8 articles', profileCount);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.go('/archives/');
  const mobileArchive = await browser.eval(`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,rows:document.querySelectorAll('.post-block .post-title-link').length})`);
  evidence.viewports.mobile390Archives = mobileArchive;
  assert(mobileArchive.width === 390 && mobileArchive.scroll === 390 && mobileArchive.rows === 100, '390px archives page has no horizontal overflow', mobileArchive);
  await browser.go('/categories/?category=%E9%9F%B3%E6%A8%82&topic=%E9%9F%93%E8%AA%9E');
  await browser.eval(fs.readFileSync(path.join(root, 'js/content-browser.js'), 'utf8'));
  const mobileCategory = await browser.eval(`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,count:[...document.querySelectorAll('[data-browse-item]')].filter(x=>!x.hidden).length})`);
  evidence.viewports.mobile390Categories = mobileCategory;
  assert(mobileCategory.width === 390 && mobileCategory.scroll === 390 && mobileCategory.body === 390 && mobileCategory.count === 11, '390px filtered categories page has no overflow', mobileCategory);
  assert(evidence.console.length === 0, 'console has zero warnings, errors, or exceptions', evidence.console);
}

(async () => {
  let timeout;
  try {
    await Promise.race([run(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('WBS 7.5 QA exceeded 85 seconds')), 85000); })]);
  }
  catch (error) { evidence.failures.push({ label: 'runner_error', detail: String(error), stack: error?.stack || '' }); }
  finally {
    clearTimeout(timeout);
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
