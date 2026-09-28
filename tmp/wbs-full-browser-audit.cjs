'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const cheerio = require('cheerio');

const workspace = process.cwd();
const root = path.resolve(workspace, 'public');
const tmp = path.resolve(workspace, 'tmp');
const port = 8979;
const cdpPort = 9379;
const base = `http://127.0.0.1:${port}`;
const profile = path.resolve(tmp, 'wbs-full-browser-audit-profile');
const evidencePath = path.resolve(tmp, 'wbs-full-browser-audit-evidence.json');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const failures = [];
const runtimeErrors = [];
const requestFailures = [];
const httpErrors = [];
let server, chrome, targets = [], socket;

function assert(label, condition, evidence = null) {
  if (!condition) failures.push({ label, evidence });
}
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
    if (pathname === '/__qa/search.js') {
      const dependency = path.resolve(workspace, 'node_modules/hexo-generator-searchdb/dist/search.js');
      fs.readFile(dependency, (error, data) => error ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }).end(data));
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (error, raw) => {
      if (error) { res.writeHead(404).end(); return; }
      let data = raw;
      const ext = path.extname(target);
      if (ext === '.html') data = Buffer.from(raw.toString()
        .replace(/<head([^>]*)>/i, '<head$1><script>window.anime=window.anime||function(){};</script>')
        .replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/hexo-generator-searchdb\/1\.5\.0\/search\.js/g, '/__qa/search.js')
        .replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^>]*>\s*<\/script>/gi, '')
        .replace(/<link\b(?=[^>]*rel=["'](?:stylesheet|preconnect|dns-prefetch)["'])(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, ''));
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
}
function request(route, method = 'GET') {
  return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port: cdpPort, path: route, method }, response => {
    let data = ''; response.setEncoding('utf8'); response.on('data', chunk => { data += chunk; });
    response.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
  }).on('error', reject).end());
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        runtimeErrors.push({ text: d.text, description: d.exception?.description, url: d.url, line: d.lineNumber });
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') runtimeErrors.push({ type: 'console.error', args: m.params.args?.map(a => a.value || a.description) });
      if (m.method === 'Network.loadingFailed') requestFailures.push({ requestId: m.params.requestId, errorText: m.params.errorText, blockedReason: m.params.blockedReason });
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) httpErrors.push({ status: m.params.response.status, url: m.params.response.url });
      if (m.method === 'Page.javascriptDialogOpening') { m.params.accept = false; }
      if (!m.id) return;
      const pending = this.pending.get(m.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(m.id);
      m.error ? pending.reject(Error(m.error.message)) : pending.resolve(m.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(`timeout ${method}`)), 12000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async wait(expression, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expression)) return true; } catch {}
      await delay(60);
    }
    throw Error(`wait timeout: ${expression}`);
  }
  async navigate(route) {
    await this.send('Page.navigate', { url: `${base}${route}` });
    await this.wait(`decodeURIComponent(location.pathname)===${JSON.stringify(route)}&&document.readyState==='complete'`);
  }
  async click(selector) {
    const box = await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,disabled:e.disabled}})()`);
    if (!box || !box.w || !box.h || box.disabled) throw Error(`unclickable selector: ${selector}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  async clickSearch() {
    const selector = await this.eval(`(()=>{const e=[...document.querySelectorAll('.popup-trigger')].find(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0});return e?.tagName==='A'?'a.popup-trigger':'.site-nav-right .popup-trigger'})()`);
    return this.click(selector);
  }
  async openSearch() {
    try { await this.clickSearch(); }
    catch {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
    }
  }
  async screenshot(name) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(tmp, name), Buffer.from(shot.data, 'base64'));
  }
}

async function main() {
  for (const n of [port, cdpPort]) if (!await free(n)) throw Error(`port in use: ${n}`);
  if (!fs.existsSync(chromePath)) throw Error(`Chrome not found: ${chromePath}`);
  server = serve(); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, `${base}/`], { stdio: 'ignore', windowsHide: true });
  let version;
  for (let i = 0; i < 100; i++) { try { version = await request('/json/version'); break; } catch { await delay(100); } }
  if (!version) throw Error('Chrome DevTools endpoint did not start');
  const target = await request('/json/new?about:blank', 'PUT'); targets.push(target.id);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const cdp = new CDP(socket);
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await cdp.send(method);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const evidence = { date: '2026-09-28', browser: 'Chrome headless via CDP', viewport: { desktop: '1280x900', mobile: '375x812' }, harness: 'local static server on 127.0.0.1; no-op anime stub; external CDN script/styles removed; local assets used; no production files changed', journeys: {}, findings: [], runtimeErrors, requestFailures, httpErrors };

  // B homepage: seven destinations plus explicit search; random content and bridge/switch.
  await cdp.navigate('/');
  await cdp.wait(`document.querySelector('#home-random-again')&&!document.querySelector('#home-random-again').disabled`);
  const bHome = await cdp.eval(`(()=>{const items=[...document.querySelectorAll('.site-nav .main-menu .menu-item a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')}));const open=document.querySelector('#home-random-open');const idx=JSON.parse(document.querySelector('script[type="application/json"][data-navigation-index]')?.textContent||'null');return {nav:items,brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),switch:document.querySelector('.surface-switch-link')?.getAttribute('href'),bridge:[...document.querySelectorAll('a')].find(a=>a.textContent.includes('翻到 A 面'))?.getAttribute('href'),searchTrigger:!!document.querySelector('.site-nav-right .popup-trigger'),random:{title:document.querySelector('#home-random-title')?.textContent.trim(),href:open?.getAttribute('href'),enabled:!document.querySelector('#home-random-again')?.disabled},widths:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth}}})()`);
  const navDestinations = bHome.nav.filter(x => x.href && x.text !== '搜尋');
  assert('B home has seven main destinations', navDestinations.length === 7, bHome.nav);
  assert('B brand/switch/bridge/search are correct', bHome.brand === '/' && bHome.switch === '/profile/' && bHome.bridge === '/profile/' && bHome.searchTrigger, bHome);
  assert('B random initial selection is ready', bHome.random.enabled && bHome.random.title && bHome.random.href, bHome.random);
  await cdp.screenshot('wbs-full-browser-audit-desktop.png');
  const randomSet = JSON.parse(fs.readFileSync(path.join(root, 'random.json'), 'utf8'));
  const beforeRandom = bHome.random.href;
  for (let i = 0; i < 5 && bHome.random.href === beforeRandom; i++) {
    await cdp.click('#home-random-again'); await delay(180);
    Object.assign(bHome.random, await cdp.eval(`({title:document.querySelector('#home-random-title')?.textContent.trim(),href:document.querySelector('#home-random-open')?.getAttribute('href'),enabled:!document.querySelector('#home-random-again')?.disabled})`));
  }
  const randomAllowed = new Set(randomSet.map(x => x.url));
  const randomNav = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8'));
  const randomCandidate = randomNav.records.find(r => r.kind === 'article' && r.url === bHome.random.href);
  assert('B home random can change and article candidate is memory-eligible', bHome.random.href !== beforeRandom && (!randomCandidate || (randomCandidate.surfaces.includes('memory') && !randomCandidate.categories.includes('站務') && randomAllowed.has(bHome.random.href))), { beforeRandom, after: bHome.random, candidate: randomCandidate && { url: randomCandidate.url, surfaces: randomCandidate.surfaces, categories: randomCandidate.categories }, allowedDataCount: randomSet.length });
  const bridgeObserved = await cdp.eval(`(()=>{const e=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('翻到 A 面'));return !!e && e.getAttribute('href')==='/profile/'})()`);
  assert('A bridge remains present after random interaction', bridgeObserved);
  await cdp.click('a.popup-trigger');
  await cdp.wait(`document.body.classList.contains('search-active')`);
  await cdp.wait(`!document.querySelector('[data-navigation-filter="surface"]')?.disabled`);
  const homeSearch = await cdp.eval(`({scope:document.querySelector('[data-navigation-filter="surface"]')?.value,enabled:!document.querySelector('[data-navigation-filter="surface"]')?.disabled})`);
  assert('B search opens in memory scope', homeSearch.scope === 'memory' && homeSearch.enabled, homeSearch);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp.wait(`!document.body.classList.contains('search-active')`);
  evidence.journeys.bHome = { ...bHome, randomDataEligibleRecords: randomSet.length, search: homeSearch, searchClosedByEscape: true };

  // A cover, event selection by keyboard/click, reload, sidebar, switch and brand.
  await cdp.navigate('/profile/');
  try { await cdp.wait(`!!window.echarts?.getInstanceByDom?.(document.querySelector('#profile-calendar-chart'))`); }
  catch (error) { console.log('profile-chart-debug', await cdp.eval(`({ready:document.readyState,echarts:typeof window.echarts,Calendar:typeof window.Calendar,init:typeof window.Calendar?.init,installed:window.__profileArticleCalendarInstalled,heading:document.querySelector('[data-profile-calendar-detail-heading]')?.textContent,status:document.querySelector('[data-profile-calendar-status]')?.textContent,chart:{width:document.querySelector('#profile-calendar-chart')?.clientWidth,height:document.querySelector('#profile-calendar-chart')?.clientHeight,html:document.querySelector('#profile-calendar-chart')?.innerHTML.slice(0,180),instance:!!window.echarts?.getInstanceByDom?.(document.querySelector('#profile-calendar-chart'))},scripts:[...document.scripts].map(s=>s.src).filter(Boolean)})`), runtimeErrors); throw error; }
  const profileData = await cdp.eval(`(()=>{const p=JSON.parse(document.querySelector('[data-profile-calendar-data]').textContent);return {h1:document.querySelector('#profile-title')?.textContent.trim(),total:p.articleTotal,events:p.eventTotal,activeDates:p.activeDateCount,counts:p.counts,heading:document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.trim(),links:[...document.querySelectorAll('[data-profile-calendar-updates] a')].map(a=>({href:a.getAttribute('href'),label:a.querySelector('.profile-calendar-event-label')?.textContent.trim(),title:a.querySelector('.profile-calendar-article-title')?.textContent.trim()})),sidebar:[...document.querySelectorAll('[data-profile-site-state] .site-state-item')].map(e=>({count:e.querySelector('.site-state-item-count')?.textContent.trim(),name:e.querySelector('.site-state-item-name')?.textContent.trim()})),brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),switch:document.querySelector('.surface-switch-link')?.getAttribute('href'),filters:document.querySelectorAll('[data-profile-tag-filters]').length,width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth}}})()`);
  assert('A cover event payload and default 9/27 event', profileData.h1 === '工作與學習' && profileData.total === 9 && profileData.events === 15 && profileData.activeDates === 8 && profileData.heading?.startsWith('2026-09-27') && profileData.links.length === 1 && profileData.links[0].label === '發表', profileData);
  assert('A cover sidebar, brand, switch, and no filter controls', profileData.brand === '/profile/' && profileData.switch === '/' && profileData.filters === 0 && profileData.sidebar.some(item => item.count === '9' && item.name.includes('文章')) && profileData.sidebar.some(item => item.count === '6' && item.name.includes('標籤')), profileData);
  const dateButton = await cdp.eval(`(()=>[...document.querySelectorAll('[data-profile-calendar-date]')].find(b=>b.dataset.profileCalendarDate==='2026-09-17')?.getAttribute('aria-label'))()`);
  assert('9/17 heatmap has accessible control', !!dateButton, dateButton);
  await cdp.eval(`document.querySelector('[data-profile-calendar-date="2026-09-17"]').focus()`);
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  const selected = await cdp.eval(`({heading:document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.trim(),events:[...document.querySelectorAll('[data-profile-calendar-updates] .profile-calendar-event-label')].map(e=>e.textContent.trim()),focused:document.activeElement?.dataset.profileCalendarDate,pressed:document.querySelector('[data-profile-calendar-date="2026-09-17"]')?.getAttribute('aria-pressed')})`);
  assert('Keyboard 9/17 selects 8 rows with 2 publish and 6 update labels', selected.heading?.startsWith('2026-09-17') && selected.events.length === 8 && selected.events.filter(x=>x==='發表').length === 2 && selected.events.filter(x=>x==='更新').length === 6 && selected.focused === '2026-09-17' && selected.pressed === 'true', selected);
  const oldDate = await cdp.eval(`Object.keys(JSON.parse(document.querySelector('[data-profile-calendar-data]').textContent).postsByDate).find(d=>d<'2026-09-17')`);
  await cdp.click(`[data-profile-calendar-date="${oldDate}"]`);
  await cdp.wait(`document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.startsWith(${JSON.stringify(oldDate)})`);
  const oldSelection = await cdp.eval(`({heading:document.querySelector('[data-profile-calendar-detail-heading]').textContent,labels:[...document.querySelectorAll('[data-profile-calendar-updates] .profile-calendar-event-label')].map(e=>e.textContent)})`);
  await cdp.send('Page.reload'); await cdp.wait(`location.pathname==='/profile/'&&document.readyState==='complete'`); await cdp.wait(`document.querySelector('[data-profile-calendar-detail-heading]')?.textContent.startsWith('2026-09-27')`);
  await cdp.click('.surface-switch-link'); await cdp.wait(`location.pathname==='/'&&document.readyState==='complete'`);
  const aToB = await cdp.eval(`({brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),profile:!!document.querySelector('[data-profile-article-calendar]')})`);
  assert('A switch reaches B and brand remains B', aToB.brand === '/' && !aToB.profile, aToB);
  await cdp.click('.site-meta>a.brand'); await cdp.wait(`location.pathname==='/'&&document.readyState==='complete'`);
  evidence.journeys.profileCover = { ...profileData, keyboardSelection: selected, oldSelection, reloadRestoredLatest: true };
  evidence.journeys.aToB = aToB;

  // Archive filtering and browser history.
  await cdp.navigate('/profile/');
  await cdp.click('.profile-navigation a'); await cdp.wait(`location.pathname==='/profile/articles/'&&document.readyState==='complete'`);
  const archive = await cdp.eval(`(()=>({rows:[...document.querySelectorAll('[data-profile-article-row]')].map(r=>r.querySelector('.profile-list-link')?.getAttribute('href')),tagCount:document.querySelectorAll('[data-profile-tag]').length,menu:[...document.querySelectorAll('.site-nav .main-menu .menu-item')].map(e=>({label:e.textContent.trim(),current:!!e.querySelector('[aria-current="page"]')})),brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),sidebar:document.querySelector('.site-overview')?.innerText.trim(),filterVisible:!document.querySelector('[data-profile-tag-filters]')?.hidden}))()`);
  assert('A archive has 9 unique canonical rows, 6 tags, correct nav/brand', archive.rows.length === 9 && new Set(archive.rows).size === 9 && archive.tagCount === 6 && archive.brand === '/profile/' && archive.menu.some(x=>x.current&&x.label.includes('全部文章')) && archive.menu.every((x,i)=>i===0?!x.current:x.current), archive);
  const filterSelector = '[data-profile-tag]';
  await cdp.click(filterSelector); await cdp.wait(`location.hash.startsWith('#tag=')`);
  const filtered = await cdp.eval(`({hash:location.hash,visible:document.querySelectorAll('[data-profile-article-row]:not([hidden])').length,total:document.querySelectorAll('[data-profile-article-row]').length})`);
  await cdp.eval('history.back()'); await cdp.wait(`location.hash===''&&document.querySelectorAll('[data-profile-article-row]:not([hidden])').length===9`);
  await cdp.eval('history.forward()'); await cdp.wait(`location.hash.startsWith('#tag=')`);
  await cdp.send('Page.reload'); await cdp.wait(`location.pathname==='/profile/articles/'&&location.hash.startsWith('#tag=')&&document.readyState==='complete'`); await cdp.wait(`document.querySelector('[data-profile-tag-filters]')?.hidden===false`);
  const reloadFilter = await cdp.eval(`({visible:document.querySelectorAll('[data-profile-article-row]:not([hidden])').length,hash:location.hash})`);
  await cdp.send('Page.navigate', { url: `${base}/profile/articles/` }); await cdp.wait(`location.pathname==='/profile/articles/'&&location.hash===''&&document.readyState==='complete'`);
  await cdp.click('.site-nav .main-menu a[rel="section"][href="/profile/"]'); await cdp.wait(`location.pathname==='/profile/'&&document.readyState==='complete'`);
  evidence.journeys.profileArchive = { archive, filtered, reloadFilter, coverRoundTrip: true };

  // Surface-specific direct articles; all retain a neutral B navigation context.
  const routeCases = [
    ['/work/from-solving-problems-to-choosing-what-matters/', ['profile'], 'N+7 A-only'],
    ['/work/flow-friendly-work-system/', ['profile','memory'], 'dual flow-friendly'],
    ['/2026/01/25/部落格改版規劃/', ['memory'], 'memory-only planning']
  ];
  evidence.journeys.articleRoutes = [];
  for (const [route, surfaces, label] of routeCases) {
    await cdp.navigate(route);
    const article = await cdp.eval(`(()=>{const c=[...document.querySelectorAll('link[rel="canonical"]')];return {canonicalCount:c.length,canonical:c[0]?.href,marker:document.querySelector('.post-surface-marker')?.getAttribute('data-surfaces'),markerLinks:[...document.querySelectorAll('.post-surface-marker-link')].map(a=>a.textContent.trim()),menu:document.querySelector('.site-nav .main-menu')?.getAttribute('data-navigation-surface'),brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href'),search:document.querySelector('[data-navigation-filter="surface"]')?.value,title:document.querySelector('.post-title')?.textContent.trim()}})()`);
    const marker = article.marker?.split(' ') || [];
    assert(`${label} surface marker`, JSON.stringify(marker) === JSON.stringify(surfaces), article);
    assert(`${label} canonical and navigation context`, article.canonicalCount === 1 && decodeURIComponent(new URL(article.canonical).pathname) === route && article.menu === 'memory' && article.brand === '/' && article.search === 'all', article);
    evidence.journeys.articleRoutes.push({ route, expected: surfaces, ...article });
  }

  // Search overlays on A, B and canonical article contexts; source scope and dedupe.
  async function searchAt(route, query) {
    await cdp.navigate(route);
    await cdp.openSearch(); await cdp.wait(`document.body.classList.contains('search-active')`);
    await cdp.wait(`!document.querySelector('[data-navigation-filter="surface"]')?.disabled`);
    const initial = await cdp.eval(`document.querySelector('[data-navigation-filter="surface"]').value`);
    await cdp.eval(`(()=>{const i=document.querySelector('.search-input');i.focus();i.value=${JSON.stringify(query)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await delay(500);
    const state = await cdp.eval(`({scope:document.querySelector('[data-navigation-filter="surface"]')?.value,results:[...document.querySelectorAll('.search-result-title')].map(a=>({href:a.getAttribute('href'),title:a.textContent.trim(),surfaces:a.closest('li')?.querySelector('.search-result-surfaces')?.textContent.trim()})),status:document.querySelector('.search-result-container')?.innerText.trim().slice(0,240)})`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cdp.wait(`!document.body.classList.contains('search-active')`);
    return { initial, ...state, closed: true };
  }
  const searchAOnlyA = await searchAt('/profile/', '從解決問題');
  const searchAOnlyB = await searchAt('/', '從解決問題');
  const searchBOnlyA = await searchAt('/profile/', '部落格改版規劃');
  const searchBOnlyB = await searchAt('/', '部落格改版規劃');
  const searchDualB = await searchAt('/', '讓工具服務心流');
  const searchArticleAll = await searchAt('/work/flow-friendly-work-system/', '讓工具服務心流');
  assert('A search returns A-only article in profile scope', searchAOnlyA.initial === 'profile' && searchAOnlyA.results.some(r=>r.href.startsWith('/work/from-solving-problems-to-choosing-what-matters/')), searchAOnlyA);
  assert('B search excludes A-only article in memory scope', searchAOnlyB.initial === 'memory' && !searchAOnlyB.results.some(r=>r.href.startsWith('/work/from-solving-problems-to-choosing-what-matters/')), searchAOnlyB);
  assert('A search excludes memory-only article', searchBOnlyA.initial === 'profile' && !searchBOnlyA.results.some(r=>r.href.startsWith('/2026/01/25/')), searchBOnlyA);
  assert('B search returns memory-only article', searchBOnlyB.initial === 'memory' && searchBOnlyB.results.some(r=>r.href.startsWith('/2026/01/25/')), searchBOnlyB);
  assert('B search retains one deduplicated dual record', searchDualB.initial === 'memory' && searchDualB.results.filter(r=>r.href.startsWith('/work/flow-friendly-work-system/')).length === 1, searchDualB);
  assert('Article route search defaults all and closes', searchArticleAll.initial === 'all' && searchArticleAll.results.length === 1 && searchArticleAll.closed, searchArticleAll);
  evidence.journeys.search = { searchAOnlyA, searchAOnlyB, searchBOnlyA, searchBOnlyB, searchDualB, searchArticleAll };

  // B random route and direct data eligibility checks.
  const nav = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8'));
  const profileOnly = new Set(nav.records.filter(r=>r.kind==='article'&&r.surfaces.length===1&&r.surfaces[0]==='profile').map(r=>r.url));
  const dual = nav.records.filter(r=>r.kind==='article'&&r.surfaces.length===2);
  assert('random data excludes A-only and retains dual exactly once', !randomSet.some(r=>profileOnly.has(r.url)) && dual.every(r=>randomSet.filter(x=>x.url===r.url).length===1), { aOnly: profileOnly.size, random: randomSet.length, dual: dual.map(r=>r.url) });
  await cdp.navigate('/random/'); await cdp.wait(`document.querySelector('#random-again')&&!document.querySelector('#random-again').disabled`);
  const randomUi = await cdp.eval(`(()=>({title:document.querySelector('#random-title')?.textContent.trim(),href:document.querySelector('#random-open')?.getAttribute('href'),filters:[...document.querySelectorAll('.random-filter')].map(b=>b.textContent.trim()),brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href')}))()`);
  await cdp.click('#random-again'); await delay(200);
  const randomUiAfter = await cdp.eval(`({title:document.querySelector('#random-title')?.textContent.trim(),href:document.querySelector('#random-open')?.getAttribute('href')})`);
  assert('Random portal loads and can pick another result', !!randomUi.title && !!randomUi.href && !!randomUiAfter.title && randomUi.brand === '/', { randomUi, randomUiAfter });
  evidence.journeys.random = { randomUi, randomUiAfter, dataCount: randomSet.length, aOnlyCount: profileOnly.size, dualCount: dual.length };

  // B calendar actual exposure test for A-only N+7.
  await cdp.navigate('/calendar/'); await cdp.wait(`document.querySelector('#calendar')&&document.readyState==='complete'`); await cdp.wait(`document.querySelector('#calendar')?.querySelector('canvas')`, 12000);
  const calendarLeakBeforeClick = await cdp.eval(`({status:document.querySelector('#calendar-status')?.textContent.trim(),heading:document.querySelector('#calendar-detail-title')?.textContent.trim(),leakLinks:[...document.querySelectorAll('#calendar-updates a')].filter(a=>a.href.includes('from-solving-problems-to-choosing-what-matters')).map(a=>({href:a.getAttribute('href'),title:a.querySelector('.calendar-update-title')?.textContent.trim()})),control:[...document.querySelectorAll('#calendar-grid-controls button')].find(b=>b.getAttribute('aria-label')?.includes('2026-09-27'))?.getAttribute('aria-label')})`);
  if (!calendarLeakBeforeClick.leakLinks.length && calendarLeakBeforeClick.control) {
    await cdp.click(`#calendar-grid-controls button[aria-label*="2026-09-27"]`); await delay(300);
  }
  const calendarLeak = await cdp.eval(`({heading:document.querySelector('#calendar-detail-title')?.textContent.trim(),links:[...document.querySelectorAll('#calendar-updates a')].map(a=>({href:a.getAttribute('href'),title:a.querySelector('.calendar-update-title')?.textContent.trim()})),n7:[...document.querySelectorAll('#calendar-updates a')].some(a=>a.getAttribute('href')==='/work/from-solving-problems-to-choosing-what-matters/')})`);
  if (calendarLeak.n7) {
    await cdp.click('#calendar-updates a[href="/work/from-solving-problems-to-choosing-what-matters/"]');
    await cdp.wait(`decodeURIComponent(location.pathname)==='/work/from-solving-problems-to-choosing-what-matters/'&&document.readyState==='complete'`);
  }
  assert('B calendar does not expose profile-only N+7', !calendarLeak.n7, { initial: calendarLeakBeforeClick, selected: calendarLeak });
  evidence.journeys.bCalendar = { initial: calendarLeakBeforeClick, selected: calendarLeak, clickedThroughToAOnly: calendarLeak.n7 };

  // Mobile UI and overflow checks.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await cdp.navigate('/profile/'); await cdp.wait(`!!window.echarts?.getInstanceByDom?.(document.querySelector('#profile-calendar-chart'))`);
  const mobileCover = await cdp.eval(`(()=>{const s=document.querySelector('.profile-calendar-scroll');return {viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,chartScroll:s?.scrollWidth,chartClient:s?.clientWidth,chartInnerScroll:(s?.scrollWidth||0)>(s?.clientWidth||0),switch:document.querySelector('.surface-switch-link')?.getAttribute('href'),focusStyle:getComputedStyle(document.querySelector('.profile-calendar-scroll')).outlineStyle}})()`);
  assert('Mobile heatmap scrolls internally without body overflow', mobileCover.doc <= 375 && mobileCover.body <= 375 && mobileCover.chartInnerScroll, mobileCover);
  await cdp.click('.site-nav-toggle .toggle'); const menuToggle = await cdp.eval(`({menuOpen:document.body.classList.contains('site-nav-on'),navWidth:document.querySelector('.site-nav .main-menu')?.scrollWidth,brand:document.querySelector('.site-meta>a.brand')?.getAttribute('href')})`);
  await cdp.navigate('/profile/articles/');
  const mobileArchive = await cdp.eval(`({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,rows:document.querySelectorAll('[data-profile-article-row]').length,title:document.querySelector('[data-profile-article-row] .profile-list-title')?.textContent.trim(),tags:document.querySelectorAll('[data-profile-tag]').length})`);
  await cdp.click('[data-profile-tag]'); await cdp.wait(`location.hash.startsWith('#tag=')`);
  await cdp.openSearch(); await cdp.wait(`document.body.classList.contains('search-active')`);
  const mobileOverlay = await cdp.eval(`({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,visible:document.body.classList.contains('search-active'),scope:document.querySelector('[data-navigation-filter="surface"]')?.value})`);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cdp.wait(`!document.body.classList.contains('search-active')`);
  await cdp.navigate('/profile/'); await cdp.screenshot('wbs-full-browser-audit-mobile.png');
  evidence.journeys.mobile = { cover: mobileCover, menuToggle, archive: mobileArchive, searchOverlay: mobileOverlay };

  // Keyboard focus-visible check using actual Tab navigation from document start.
  await cdp.navigate('/profile/');
  await cdp.eval('document.activeElement.blur()');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const focus = await cdp.eval(`(()=>({tag:document.activeElement?.tagName,href:document.activeElement?.getAttribute('href'),focusVisible:document.activeElement?.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle}))()`);
  evidence.journeys.keyboardFocus = focus;

  // Real browser no-JS navigation on a separate target; DOM snapshots do not execute page scripts.
  const noJsTarget = await request('/json/new?about:blank', 'PUT'); targets.push(noJsTarget.id);
  const noJsWs = new WebSocket(noJsTarget.webSocketDebuggerUrl); await new Promise(resolve=>noJsWs.addEventListener('open',resolve,{once:true}));
  const noJs = new CDP(noJsWs); await noJs.send('Page.enable'); await noJs.send('DOM.enable'); await noJs.send('Emulation.setScriptExecutionDisabled',{value:true});
  const noJsRoutes = ['/','/profile/','/profile/articles/','/work/from-solving-problems-to-choosing-what-matters/']; evidence.journeys.noJs = [];
  for (const route of noJsRoutes) {
    await noJs.send('Page.navigate',{url:`${base}${route}`});
    await noJs.wait(`location.pathname===${JSON.stringify(new URL(route,base).pathname)}&&document.readyState==='complete'`);
    const doc = await noJs.send('DOM.getDocument',{depth:-1,pierce:true});
    const body = await noJs.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'body'});
    const outer = await noJs.send('DOM.getOuterHTML',{nodeId:body.nodeId});
    const $ = cheerio.load(outer.outerHTML);
    const record = { route, h1:$('h1').first().text().trim(), links:$('a[href]').length, articleRows:$('[data-profile-article-row]').length, noScript:$('noscript').text().trim(), fallback:$('[data-profile-calendar-fallback]').text().trim(), defaultDetails:$('[data-profile-calendar-updates] a').map((i,a)=>$(a).attr('href')).get(), archiveLink:$('a[href="/profile/articles/"]').length, articleBody:$('article.post-content-single .post-body').text().replace(/\s+/g,' ').trim().slice(0,400), bodyText:$('body').text().replace(/\s+/g,' ').trim().slice(0,240) };
    if (route === '/') assert('No-JS B home retains navigation and archive/random fallback links', record.links > 15 && /全部文章/.test(record.noScript), record);
    if (route === '/profile/') assert('No-JS A cover retains latest article link and archive fallback', record.links >= 4 && /前往文章庫/.test(record.fallback) && record.defaultDetails.some(href=>href.includes('from-solving-problems-to-choosing-what-matters')) && record.archiveLink > 0, record);
    if (route === '/profile/articles/') assert('No-JS A archive retains nine article rows', record.articleRows === 9, record);
    if (route.includes('from-solving')) assert('No-JS article content remains readable', record.articleBody.length > 100, record);
    evidence.journeys.noJs.push(record);
  }
  noJsWs.close();

  evidence.runtimeErrors = runtimeErrors;
  evidence.requestFailures = requestFailures;
  evidence.httpErrors = httpErrors;
  evidence.findings = failures;
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ evidencePath, findings: failures, bHome: evidence.journeys.bHome, profile: evidence.journeys.profileCover, archive: evidence.journeys.profileArchive, articles: evidence.journeys.articleRoutes, search: evidence.journeys.search, random: evidence.journeys.random, bCalendar: evidence.journeys.bCalendar, mobile: evidence.journeys.mobile, noJs: evidence.journeys.noJs, runtimeErrors, requestFailures, httpErrors }, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (server) server.close();
  if (socket) socket.close();
  if (chrome) {
    try { const v = await request('/json/version'); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true})); ws.send(JSON.stringify({id:1,method:'Browser.close'})); ws.close(); } catch {}
    chrome.kill(); await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),delay(2000)]);
  }
  const tempRoot = path.resolve(workspace, 'tmp') + path.sep;
  if (profile.startsWith(tempRoot) && fs.existsSync(profile)) try { fs.rmSync(profile,{recursive:true,force:true}); } catch {}
});
