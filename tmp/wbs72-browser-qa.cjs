const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve('tmp/wbs72-public-20260926');
const profile = path.resolve('tmp/wbs72-chrome-profile-acceptance');
const evidencePath = path.resolve('tmp/wbs72-browser-qa-acceptance-evidence.json');
const base = 'http://127.0.0.1:8897';
const browserPort = 9345;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence = { browser: 'Chrome headless via CDP', checks: [], failures: [], expectedErrors: [], anchors: {} };
let chromeProcess;
let ws;
const index = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8'));
const record = (predicate, label) => {
  const found = index.records.find(predicate);
  if (!found) throw new Error(`Missing real index sample: ${label}`);
  return found;
};
const dual = record(x => x.kind === 'article' && x.surfaces.includes('profile') && x.surfaces.includes('memory'), 'dual article');
const profileOnly = record(x => x.kind === 'article' && x.surfaces.length === 1 && x.surfaces[0] === 'profile', 'profile-only article');
const memoryOnly = record(x => x.kind === 'article' && x.surfaces.length === 1 && x.surfaces[0] === 'memory', 'memory-only article');
const microblog = record(x => x.kind === 'microblog', 'microblog');
const learningArticle = record(x => x.learningItems?.length, 'learning note fallback');
const articlePassage = record(x => x.kind === 'article' && x.passages?.length, 'article passage');
const sampleQuery = value => String(value).slice(0, 48);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, base).pathname); } catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  let file = target;
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
});
const assert = (condition, label, detail) => (condition ? evidence.checks : evidence.failures).push({ label, ...(detail === undefined ? {} : { detail }) });
const cdpHttp = (pathname, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port: browserPort, path: pathname, method }, res => {
    let data = ''; res.setEncoding('utf8'); res.on('data', chunk => data += chunk);
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
  });
  req.on('error', reject); req.end();
});
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expression, awaitPromise = true) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async wait(expression, timeout = 7000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expression)) return true; } catch {}
      await delay(80);
    }
    throw new Error(`Timed out: ${expression}`);
  }
  async go(url) {
    await this.send('Page.navigate', { url: base + url });
    await this.wait("document.readyState === 'complete' && document.querySelector('.popup-trigger')");
    await delay(180);
  }
  async open() { await this.eval("document.querySelector('.popup-trigger').click()"); await this.wait("document.querySelector('[data-search-retry]') || document.querySelector('[data-navigation-filter=surface]') && !document.querySelector('[data-navigation-filter=surface]').disabled"); }
  async search(query) {
    await this.eval(`(()=>{const input=document.querySelector('.search-input');input.value=${JSON.stringify(query)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await delay(50);
    return this.eval("[...document.querySelectorAll('.search-result-title')].map(a=>({title:a.innerText,href:a.getAttribute('href'),label:a.closest('li')?.querySelector('.search-result-surfaces')?.innerText}))");
  }
  async setFilter(name, value) {
    await this.eval(`(()=>{const select=document.querySelector('[data-navigation-filter=${JSON.stringify(name)}]');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await delay(40);
  }
}
const press = async (cdp, key, code, windowsVirtualKeyCode) => {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
};

(async () => {
  if (!fs.existsSync(chromePath)) throw new Error('Chrome executable not found');
  if (fs.existsSync(profile) || fs.existsSync(evidencePath)) throw new Error('Refusing to overwrite pre-existing QA artifacts');
  fs.mkdirSync(profile, { recursive: false });
  await new Promise((resolve, reject) => server.listen(8897, '127.0.0.1', error => error ? reject(error) : resolve()));
  chromeProcess = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${browserPort}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  try {
    await serverReady(browserPort);
    const tab = await cdpHttp('/json/new?about:blank', 'PUT');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    const c = new CDP(ws);
    await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable'].map(method => c.send(method)));
    await c.send('Network.setCacheDisabled', { cacheDisabled: true });
    await c.send('Network.setBlockedURLs', { urls: ['https://cdn.jsdelivr.net/*', 'https://cdnjs.cloudflare.com/*', 'https://www.googletagmanager.com/*', 'https://www.google-analytics.com/*'] });
    const localSearch = fs.readFileSync('node_modules/hexo-generator-searchdb/dist/search.js', 'utf8');
    const bootstrap = `(${(() => {
      const reveal = selectors => { if (typeof selectors === 'string') document.querySelectorAll(selectors).forEach(el => { el.style.visibility = 'visible'; el.style.opacity = '1'; el.style.top = 'initial'; }); };
      const anime = options => { reveal(options?.targets); options?.complete?.(); return { finished: Promise.resolve() }; };
      anime.timeline = () => ({ add(options) { reveal(options?.targets); options?.complete?.(); return this; } }); globalThis.anime = anime;
      globalThis.Pjax = class OfflinePjax { constructor(options) { this.options = options; } refresh() {} executeScripts() {} };
      const nativeFetch = globalThis.fetch.bind(globalThis); globalThis.__qaFailIndex = false; globalThis.__qaIndexRequests = 0;
      globalThis.fetch = (url, options) => {
        if (String(url).includes('/navigation-index.json')) {
          globalThis.__qaIndexRequests++;
          if (globalThis.__qaFailIndex) return new Promise(resolve => setTimeout(() => resolve(new Response('unavailable', { status: 503 })), 300));
        }
        return nativeFetch(url, options);
      };
    }).toString()})();`;
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `${localSearch}\n${bootstrap}` });
    const consoleEvents = [];
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        const detail = { type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') };
        if (detail.text.includes('search index request failed')) evidence.expectedErrors.push(detail);
        else consoleEvents.push(detail);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        consoleEvents.push({ type: 'exception', text: details.text, description: details.exception?.description, url: details.url, lineNumber: details.lineNumber, columnNumber: details.columnNumber });
      }
    });

    // Search state and single-record behavior across all three scopes.
    await c.go('/profile/'); await c.open();
    for (const surface of ['profile', 'memory', 'all']) {
      await c.setFilter('surface', surface);
      const hits = await c.search(sampleQuery(dual.title));
      assert(hits.filter(hit => hit.href === dual.url).length === 1, `dual article appears once in ${surface}`, hits);
    }
    for (const [item, expected] of [[profileOnly, '工作與學習'], [memoryOnly, '個人記憶'], [dual, '工作與學習・個人記憶']]) {
      await c.setFilter('surface', 'all');
      const hits = await c.search(sampleQuery(item.title));
      const hit = hits.find(candidate => candidate.href === item.url);
      assert(hit?.label === `收錄於：${expected}`, `${item.surfaces.join('+')} result surface label`, hit);
    }
    const keywordMiss = await c.search('wbs72-不存在的關鍵字');
    assert(keywordMiss.length === 0 && await c.eval("Boolean(document.querySelector('[data-search-empty-kind=keyword]'))"), 'keyword empty state is distinct', null);
    const categories = await c.eval("[...document.querySelector('[data-navigation-filter=category]').options].map(option=>option.value).filter(Boolean)");
    const months = await c.eval("[...document.querySelector('[data-navigation-filter=month]').options].map(option=>option.value).filter(Boolean)");
    const sourceOptions = ['article', 'microblog', 'learning'];
    let emptyFilter = null;
    for (const source of sourceOptions) for (const category of categories) for (const month of months) {
      const candidate = index.records.filter(item => item.sources.includes(source) && item.categories.includes(category) && item.events.some(event => (month === 'all' || event.date.startsWith(month)) && (source === 'article' ? event.kind === 'published' : source === 'microblog' ? event.kind === 'recorded' : event.kind === 'learning-added')));
      if (!candidate.length) { emptyFilter = { source, category, month }; break; }
    }
    if (emptyFilter) {
      await c.setFilter('source', emptyFilter.source); await c.setFilter('category', emptyFilter.category); await c.setFilter('month', emptyFilter.month); await c.search('');
      assert(await c.eval("Boolean(document.querySelector('[data-search-empty-kind=filters]'))"), 'filter-only empty state is distinct', emptyFilter);
    } else assert(false, 'real index has a filter-only empty combination', null);

    // Failure → retry success. Two quick retry triggers while loading must remain one request.
    await c.go('/profile/');
    await c.eval(`globalThis.__qaFailIndex = true;document.querySelector('.search-input').value=${JSON.stringify(sampleQuery(dual.title))}`);
    await c.open();
    await c.wait("document.querySelector('[data-search-retry]')");
    const beforeRetry = await c.eval('globalThis.__qaIndexRequests');
    await c.eval("globalThis.__qaFailIndex=false;document.querySelector('[data-search-retry]').click();document.querySelector('[data-search-retry]')?.click()");
    await delay(80);
    assert(await c.eval('globalThis.__qaIndexRequests') === beforeRetry + 1, 'rapid retry clicks send one request', await c.eval('globalThis.__qaIndexRequests'));
    await c.wait("!document.querySelector('[data-search-retry]') && !document.querySelector('[data-navigation-filter=surface]').disabled");
    const retryState = await c.eval("({query:document.querySelector('.search-input').value,surface:document.querySelector('[data-navigation-filter=surface]').value,hrefs:[...document.querySelectorAll('.search-result-title')].map(a=>a.getAttribute('href'))})");
    assert(retryState.query === sampleQuery(dual.title) && retryState.surface === 'profile' && retryState.hrefs.includes(dual.url), 'successful retry retains query and scope results', retryState);

    // Direct-load and reload each stable target shape: article passage, microblog ID, learning note.
    const passage = articlePassage.passages[0];
    const targets = [
      { name: 'article paragraph', url: `${articlePassage.url}#${encodeURIComponent(passage.id)}`, id: passage.id },
      { name: 'microblog persistent ID', url: `${microblog.url}#${encodeURIComponent(microblog.id)}`, id: microblog.id },
      { name: 'learning note ID', url: `/reading/#${encodeURIComponent(learningArticle.learningItems[0].id)}`, id: learningArticle.learningItems[0].id }
    ];
    for (const target of targets) {
      await c.go(target.url);
      const direct = await c.eval(`({hash:location.hash,found:!!document.getElementById(${JSON.stringify(target.id)})})`);
      await c.send('Page.reload', { ignoreCache: true }); await c.wait("document.readyState === 'complete'"); await delay(150);
      const reload = await c.eval(`({hash:location.hash,found:!!document.getElementById(${JSON.stringify(target.id)})})`);
      assert(direct.hash === `#${encodeURIComponent(target.id)}` && direct.found, `${target.name} opens directly`, direct);
      assert(reload.hash === direct.hash && reload.found, `${target.name} survives reload`, reload);
      evidence.anchors[target.name] = { direct, reload };
    }

    // Page defaults, PJAX state reset, Back/reload isolation, and keyboard layout.
    await c.go(dual.url); await c.open();
    assert(await c.eval("document.querySelector('[data-navigation-filter=surface]').value") === 'all', 'article page defaults to all', null);
    await c.setFilter('surface', 'profile');
    await c.eval("NexT.boot.refresh=()=>{};CONFIG.sidebar.display='remove';document.dispatchEvent(new Event('pjax:success'))");
    assert(await c.eval("document.querySelector('[data-navigation-filter=surface]').value") === 'all', 'pjax success recalculates article scope', null);

    await c.go('/profile/'); await c.open();
    assert(await c.eval("document.querySelector('[data-navigation-filter=surface]').value") === 'profile', 'profile page defaults to profile', null);
    const profileEntry = await c.send('Page.getNavigationHistory');
    const profileHistoryId = profileEntry.entries[profileEntry.currentIndex].id;
    await c.setFilter('surface', 'all');
    const profileHit = await c.search(sampleQuery(profileOnly.title));
    assert(profileHit.some(hit => hit.href === profileOnly.url), 'profile view-state test has a result target', profileHit);
    await c.eval("document.querySelector('.search-result-title').click()");
    await c.wait(`location.pathname === ${JSON.stringify(new URL(profileOnly.url, base).pathname)} && document.readyState === 'complete'`);
    const crossUrl = await c.eval("({query:document.querySelector('.search-input')?.value,surface:document.querySelector('[data-navigation-filter=surface]')?.value,open:document.body.classList.contains('search-active')})");
    assert(crossUrl.query === '' && crossUrl.surface === 'all' && !crossUrl.open, 'search state does not leak to another URL', crossUrl);
    await c.send('Page.navigateToHistoryEntry', { entryId: profileHistoryId });
    await c.wait("location.pathname === '/profile/' && document.readyState === 'complete'"); await delay(180);
    const backState = await c.eval("({query:document.querySelector('.search-input')?.value,surface:document.querySelector('[data-navigation-filter=surface]')?.value,open:document.body.classList.contains('search-active')})");
    assert(backState.query === sampleQuery(profileOnly.title) && backState.surface === 'all' && backState.open, 'same-URL Back restores search state', backState);
    await c.send('Page.reload', { ignoreCache: true });
    await c.wait("document.readyState === 'complete' && document.querySelector('.search-input')?.value"); await delay(120);
    const reloadState = await c.eval("({query:document.querySelector('.search-input')?.value,surface:document.querySelector('[data-navigation-filter=surface]')?.value,open:document.body.classList.contains('search-active')})");
    assert(reloadState.query === backState.query && reloadState.surface === backState.surface && reloadState.open, 'same-URL reload restores search state', reloadState);

    await c.go('/'); await c.open();
    assert(await c.eval("document.querySelector('[data-navigation-filter=surface]').value") === 'memory', 'B default scope is memory', null);
    await c.setFilter('surface', 'profile'); await c.eval("document.querySelector('[data-navigation-reset]').click()");
    assert(await c.eval("document.querySelector('[data-navigation-filter=surface]').value") === 'memory', 'clear restores B default', null);
    await c.eval("document.querySelector('.popup-btn-close').click();document.querySelector('.popup-trigger').focus()");
    await press(c, 'Enter', 'Enter', 13); await c.wait("document.activeElement.classList.contains('search-input')");
    const firstFocus = await c.eval("({className:document.activeElement.className,visible:document.activeElement.matches(':focus-visible')})");
    await press(c, 'Tab', 'Tab', 9);
    const nextFocus = await c.eval("({tag:document.activeElement.tagName,filter:document.activeElement.dataset.navigationFilter,visible:document.activeElement.matches(':focus-visible')})");
    assert(firstFocus.className === 'search-input' && firstFocus.visible, 'keyboard opens search with visible input focus', firstFocus);
    assert(nextFocus.tag === 'BUTTON' && nextFocus.visible, 'keyboard reaches close control with visible focus', nextFocus);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const desktop = await c.eval("({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})");
    assert(desktop.document <= desktop.width && desktop.body <= desktop.width, 'desktop viewport has no horizontal overflow', desktop);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const mobile = await c.eval("({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})");
    assert(mobile.document <= mobile.width && mobile.body <= mobile.width, '390px viewport has no horizontal overflow', mobile);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    evidence.console = consoleEvents;
    assert(consoleEvents.length === 0, 'console has no unexpected warning/error/exception', consoleEvents);
  } finally {
    if (ws) ws.close();
    if (chromeProcess && !chromeProcess.killed) chromeProcess.kill();
    await new Promise(resolve => server.close(resolve));
    await delay(400);
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ checks: evidence.checks.length, failures: evidence.failures, expectedErrors: evidence.expectedErrors, console: evidence.console, evidencePath }, null, 2) + '\n');
    if (!evidence.failures.length) process.exitCode = 0;
    else process.exitCode = 1;
  }
})().catch(error => {
  evidence.failures.push({ label: 'runner', detail: String(error.stack || error) });
  if (ws) ws.close();
  if (server.listening) server.close();
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill();
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  process.stderr.write(String(error.stack || error) + '\n');
  process.exitCode = 1;
});

async function serverReady(port) {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    try { await new Promise((resolve, reject) => { const req = http.request({ hostname: '127.0.0.1', port, path: '/json/version' }, res => { res.resume(); res.statusCode === 200 ? resolve() : reject(new Error('CDP not ready')); }); req.on('error', reject); req.end(); }); return; }
    catch { await delay(100); }
  }
  throw new Error(`Chrome CDP failed to start on ${port}`);
}
