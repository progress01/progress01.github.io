'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = path.resolve('.');
const root = path.resolve('tmp/wbs73-public-20260927');
const profile = path.resolve('tmp/wbs73-chrome-profile-final2');
const evidencePath = path.resolve('tmp/wbs73-browser-qa-final3-evidence.json');
const base = 'http://127.0.0.1:8901';
const browserPort = 9349;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const evidence = { browser: 'Chrome headless via CDP', checks: [], failures: [], console: [], ports: { http: 8901, cdp: 9349 } };
const index = JSON.parse(fs.readFileSync(path.join(root, 'navigation-index.json'), 'utf8'));
const randomData = JSON.parse(fs.readFileSync(path.join(root, 'random.json'), 'utf8'));
const dual = index.records.find(item => item.kind === 'article' && item.surfaces.includes('profile') && item.surfaces.includes('memory'));
const profileOnly = index.records.find(item => item.kind === 'article' && item.surfaces.length === 1 && item.surfaces[0] === 'profile');
if (!dual || !profileOnly) throw new Error('Missing dual/profile-only sample');
const allowed = new Set(randomData.map(item => item.url));
const assert = (condition, label, detail) => (condition ? evidence.checks : evidence.failures).push({ label, ...(detail === undefined ? {} : { detail }) });
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

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
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
  async wait(expression, timeout = 9000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expression)) return true; } catch {}
      await delay(75);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }
  async go(url) {
    await this.send('Page.navigate', { url: base + url });
    await this.wait("document.readyState === 'complete' && document.querySelector('.random-filter') || document.readyState === 'complete' && document.querySelector('#home-random-title')", 12000);
    await delay(150);
  }
  async reload() { await this.send('Page.reload', { ignoreCache: true }); await this.wait("document.readyState === 'complete'"); await delay(120); }
  async enter() {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  }
}

async function cdpHttp(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: browserPort, path: pathname, method }, res => {
      let data = ''; res.setEncoding('utf8'); res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
    });
    req.on('error', reject); req.end();
  });
}

async function main() {
  let serverListening = false, chrome, ws;
  if (!fs.existsSync(chromePath)) throw new Error('Chrome executable not found');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error('Isolated build missing');
  if (fs.existsSync(profile) || fs.existsSync(evidencePath)) throw new Error('Refusing to overwrite existing WBS 7.3 QA artifacts');
  fs.mkdirSync(profile, { recursive: false });
  try {
    await new Promise((resolve, reject) => server.listen(8901, '127.0.0.1', error => error ? reject(error) : resolve())); serverListening = true;
    chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${browserPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    const deadline = Date.now() + 10000;
    let tab;
    while (!tab && Date.now() < deadline) { try { tab = await cdpHttp('/json/new?about:blank', 'PUT'); } catch { await delay(100); } }
    if (!tab) throw new Error('CDP endpoint unavailable');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true });
    });
    const c = new CDP(ws);
    await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'].map(method => c.send(method)));
    await c.send('Network.setCacheDisabled', { cacheDisabled: true });
    await c.send('Network.setBlockedURLs', { urls: ['https://*/*'] });
    const localSearch = fs.readFileSync('node_modules/hexo-generator-searchdb/dist/search.js', 'utf8');
    const bootstrap = `globalThis.Math.random = () => 0;
      const reveal = selectors => { if (typeof selectors === 'string') document.querySelectorAll(selectors).forEach(el => { el.style.visibility='visible';el.style.opacity='1';el.style.top='initial'; }); };
      const anime = options => { reveal(options?.targets); options?.complete?.(); return { finished: Promise.resolve() }; };
      anime.timeline = () => ({ add(options) { reveal(options?.targets); options?.complete?.(); return this; } }); globalThis.anime = anime;
      globalThis.Pjax = class OfflinePjax { constructor(options) { this.options=options; } refresh(){} executeScripts(){} };`;
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `${localSearch}\n${bootstrap}` });
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        evidence.console.push({ type: message.params.type, text: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
      }
      if (message.method === 'Runtime.exceptionThrown') {
        evidence.console.push({ type: 'exception', text: message.params.exceptionDetails.text, description: message.params.exceptionDetails.exception?.description });
      }
      if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) {
        const text = message.params.entry.text || '';
        if (!text.includes('net::ERR_BLOCKED_BY_CLIENT')) evidence.console.push({ type: message.params.entry.level, text });
      }
    });

    await c.go('/');
    await c.wait("document.querySelector('#home-random-title') && document.querySelector('#home-random-open')?.getAttribute('href')");
    let homeUrl = await c.eval("document.querySelector('#home-random-open').getAttribute('href')");
    assert(allowed.has(homeUrl), 'home initial card is memory eligible', homeUrl);
    await c.wait("document.querySelector('#home-dj-status')?.textContent.includes('NEW SET')");
    const djPicks = await c.eval("({audio:{href:document.querySelector('#home-dj-audio').getAttribute('href'),meta:document.querySelector('#home-dj-audio [data-dj-meta]').textContent},book:{href:document.querySelector('#home-dj-book').getAttribute('href'),meta:document.querySelector('#home-dj-book [data-dj-meta]').textContent}})");
    assert(allowed.has(djPicks.audio.href) && djPicks.audio.meta.startsWith('REC /'), 'DJ audio pick still uses a playable memory article', djPicks.audio);
    assert(allowed.has(djPicks.book.href) && djPicks.book.meta.startsWith('REC /'), 'DJ book pick still uses a playable memory article', djPicks.book);
    await c.eval("document.querySelector('#home-random-again').click()");
    let changedHomeUrl = await c.eval("document.querySelector('#home-random-open').getAttribute('href')");
    assert(allowed.has(changedHomeUrl) && changedHomeUrl !== homeUrl, 'home change selects another memory article', { homeUrl, changedHomeUrl });
    await c.reload();
    let restoredHomeUrl = await c.eval("document.querySelector('#home-random-open').getAttribute('href')");
    assert(restoredHomeUrl === changedHomeUrl, 'home reload restores the same card', { changedHomeUrl, restoredHomeUrl });
    await c.eval("document.querySelector('#home-random-open').click()");
    await c.wait("location.pathname !== '/' && document.querySelector('.post')", 12000);
    await c.eval('history.back()'); await c.wait("location.pathname === '/' && document.querySelector('#home-random-open')"); await delay(180);
    const backHomeUrl = await c.eval("document.querySelector('#home-random-open').getAttribute('href')");
    assert(backHomeUrl === changedHomeUrl, 'home article Back restores the same card', { changedHomeUrl, backHomeUrl });

    await c.go('/random/');
    await c.wait("document.querySelector('#random-open')?.getAttribute('href') && !document.querySelector('#random-card').hidden");
    let randomUrl = await c.eval("document.querySelector('#random-open').getAttribute('href')");
    assert(allowed.has(randomUrl), 'random initial card is memory eligible', randomUrl);
    const categoryButton = await c.eval("[...document.querySelectorAll('.random-filter')].find(button=>button.dataset.category==='音樂')?.outerHTML || ''");
    assert(Boolean(categoryButton), 'real memory category button exists', categoryButton);
    await c.eval("[...document.querySelectorAll('.random-filter')].find(button=>button.dataset.category==='音樂').click()");
    let music = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href'),meta:document.querySelector('#random-meta').textContent})");
    assert(music.category === '音樂' && music.meta.includes('音樂'), 'category change selects within memory category', music);
    await c.eval("document.querySelector('#random-again').click()");
    let changedMusic = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href'),meta:document.querySelector('#random-meta').textContent})");
    assert(changedMusic.category === '音樂' && changedMusic.url !== music.url && changedMusic.meta.includes('音樂'), 'change card stays in category and avoids current article', changedMusic);
    await c.reload();
    let restoredRandom = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href')})");
    assert(restoredRandom.category === '音樂' && restoredRandom.url === changedMusic.url, 'random reload restores category and card', restoredRandom);
    await c.eval("document.querySelector('#random-open').click()");
    await c.wait("location.pathname !== '/random/' && document.querySelector('.post')", 12000);
    await c.eval('history.back()'); await c.wait("location.pathname === '/random/' && document.querySelector('#random-open')"); await delay(180);
    let backRandom = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href')})");
    assert(backRandom.category === '音樂' && backRandom.url === changedMusic.url, 'random article Back restores category and card', backRandom);

    await c.eval(`sessionStorage.setItem('random-tape-selection-v1', JSON.stringify({category:'all',url:${JSON.stringify(profileOnly.url)}}))`);
    await c.reload();
    let rejectedProfile = await c.eval("document.querySelector('#random-open').getAttribute('href')");
    assert(allowed.has(rejectedProfile) && rejectedProfile !== profileOnly.url, 'profile-only stale state cannot be restored', { profileOnly: profileOnly.url, restored: rejectedProfile });
    await c.eval(`sessionStorage.setItem('random-tape-selection-v1', JSON.stringify({category:'all',url:${JSON.stringify(dual.url)}}))`);
    await c.reload();
    let restoredDual = await c.eval("document.querySelector('#random-open').getAttribute('href')");
    assert(restoredDual === dual.url && allowed.has(restoredDual), 'dual-surface article can be presented', restoredDual);
    await c.eval("sessionStorage.setItem('random-tape-selection-v1', JSON.stringify({category:'__removed_category__',url:'/gone/'}))");
    await c.reload();
    let invalidFallback = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href'),valid:JSON.parse(sessionStorage.getItem('random-tape-selection-v1')||'null')})");
    assert(invalidFallback.category === 'all' && allowed.has(invalidFallback.url) && invalidFallback.valid.category === 'all', 'invalid category and stale URL fall back to all with valid card', invalidFallback);
    await c.eval("sessionStorage.setItem('random-tape-selection-v1', JSON.stringify({category:'音樂',url:'/gone/'}))");
    await c.reload();
    let staleUrlFallback = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href')})");
    assert(staleUrlFallback.category === 'all' && allowed.has(staleUrlFallback.url), 'stale category record safely falls back to all', staleUrlFallback);

    await c.eval("Object.defineProperty(window,'sessionStorage',{configurable:true,get(){throw new Error('storage blocked')}});document.querySelector('#random-again').click()");
    const noStorage = await c.eval("({url:document.querySelector('#random-open').getAttribute('href'),hidden:document.querySelector('#random-card').hidden})");
    assert(allowed.has(noStorage.url) && !noStorage.hidden, 'random draw remains usable when sessionStorage is unavailable', noStorage);

    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await c.wait('document.readyState === "complete"'); await delay(100);
    const mobile = await c.eval('({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})');
    assert(mobile.doc <= mobile.width && mobile.body <= mobile.width, 'random page 390px has no horizontal overflow', mobile);
    await c.send('Emulation.clearDeviceMetricsOverride');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const desktop = await c.eval('({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})');
    assert(desktop.doc <= desktop.width && desktop.body <= desktop.width, 'random page desktop has no horizontal overflow', desktop);

    const keyboardTarget = await c.eval("(()=>{const b=[...document.querySelectorAll('.random-filter')].find(x=>x.dataset.category==='音樂');b.focus();return {tag:document.activeElement.tagName,focus:document.activeElement===b,visible:getComputedStyle(b).outlineStyle!=='none'}})()");
    assert(keyboardTarget.focus, 'category button can receive keyboard focus', keyboardTarget);
    const beforeKeyboard = await c.eval("document.querySelector('#random-open').getAttribute('href')");
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await delay(160);
    const afterKeyboard = await c.eval("({category:document.querySelector('.random-filter.is-active')?.dataset.category,url:document.querySelector('#random-open').getAttribute('href')})");
    assert(afterKeyboard.category === '音樂' && afterKeyboard.url !== beforeKeyboard, 'keyboard Enter activates category filter', afterKeyboard);
    await c.eval("document.querySelector('#random-open').focus()");
    const focusLink = await c.eval("({focused:document.activeElement.id==='random-open',href:document.activeElement.getAttribute('href')})");
    assert(focusLink.focused && allowed.has(focusLink.href), 'random article link is keyboard focusable', focusLink);
    await c.enter();
    await c.wait("location.pathname !== '/random/' && document.querySelector('.post')", 12000);
    const keyboardArticle = await c.eval('location.pathname');
    const keyboardTargetMatches = await c.eval(`new URL(${JSON.stringify(focusLink.href)}, location.origin).pathname === location.pathname`);
    assert(keyboardTargetMatches, 'keyboard Enter opens the focused random article', { keyboardArticle, href: focusLink.href });
    await c.eval('history.back()'); await c.wait("location.pathname === '/random/' && document.querySelector('#random-open')");

    await c.go('/');
    const isolatedHomeUrl = await c.eval("document.querySelector('#home-random-open').getAttribute('href')");
    assert(isolatedHomeUrl === changedHomeUrl, 'random page session state does not change home selection', { changedHomeUrl, isolatedHomeUrl });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const homeMobile = await c.eval('({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})');
    assert(homeMobile.doc <= homeMobile.width && homeMobile.body <= homeMobile.width, 'home 390px has no horizontal overflow', homeMobile);
    await c.send('Emulation.clearDeviceMetricsOverride');
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `const nativeFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url)==='/random.json'?Promise.reject(new Error('controlled random data failure')):nativeFetch(url,options);` });
    await c.go('/random/?wbs73-failure=1');
    await c.wait("document.querySelector('#random-empty') && !document.querySelector('#random-empty').hidden");
    const fallback = await c.eval("({status:document.querySelector('#random-status').textContent,empty:document.querySelector('#random-empty').textContent,cardHidden:document.querySelector('#random-card').hidden})");
    assert(fallback.cardHidden && fallback.status.includes('故障') && fallback.empty.includes('隨機資料尚未準備好'), 'random data failure fallback remains visible and usable', fallback);
    const finalConsole = evidence.console.filter(item => !(item.text || '').includes('net::ERR_BLOCKED_BY_CLIENT'));
    assert(finalConsole.length === 0, 'no unexpected browser console warnings/errors/exceptions', finalConsole);
    evidence.console = finalConsole;
  } finally {
    if (ws) { try { ws.close(); } catch {} }
    if (chrome && chrome.pid) {
      try {
        const killer = spawn('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        await Promise.race([new Promise(resolve => killer.once('exit', resolve)), delay(2500)]);
      } catch {}
      if (!chrome.killed) { try { chrome.kill(); } catch {} }
      await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(2500)]);
    }
    if (serverListening) await new Promise(resolve => server.close(() => resolve()));
    if (fs.existsSync(profile)) {
      const resolved = path.resolve(profile);
      if (!resolved.startsWith(workspace + path.sep)) throw new Error(`Unsafe profile cleanup target: ${resolved}`);
      try { fs.rmSync(resolved, { recursive: true, force: true }); }
      catch (error) { evidence.failures.push({ label: 'profile cleanup', detail: error.message }); }
    }
    evidence.process = { chromeStopped: !chrome || chrome.exitCode !== null, serverStopped: !serverListening || !server.listening, profileRemoved: !fs.existsSync(profile) };
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  }
}

main()
  .then(() => {
    console.log(`WBS 7.3 browser QA: ${evidence.checks.length} checks, ${evidence.failures.length} failures, ${evidence.console.length} console issues`);
    if (evidence.failures.length) process.exitCode = 1;
  })
  .catch(error => {
    evidence.failures.push({ label: 'runner', detail: error.message });
    try { fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n'); } catch {}
    console.error(error.stack); process.exitCode = 1;
  });
