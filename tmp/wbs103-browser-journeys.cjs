'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = process.cwd();
const root = path.resolve(workspace, 'public');
const profile = path.resolve(workspace, 'tmp/wbs103-chrome-profile');
const evidenceFile = path.resolve(workspace, 'tmp/wbs103-browser-evidence.json');
const httpPort = 8963;
const cdpPort = 9363;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = `http://127.0.0.1:${httpPort}`;
const evidence = {
  date: '2026-09-27', timezone: 'Asia/Taipei', wbs: '10.3', publicRoot: root,
  source: 'WBS 10.2 fresh public; no build/clean in this run',
  browser: 'Google Chrome headless Chromium via CDP', ports: { http: httpPort, cdp: cdpPort },
  qaHarness: { anime: 'local deterministic adapter applies each animation step final CSS/style values immediately, including transform/opacity, then calls callbacks', searchEvidence: 'waits for visible overlay and popup, positive computed opacity, positive rect, aria-hidden=false; mobile requires popup fully inside viewport' },
  viewports: [{ width: 1280, height: 900 }, { width: 375, height: 812 }],
  steps: [], console: [], pageErrors: [], requestFailed: [], httpErrors: [], blockedExternal: [], screenshots: []
};
let server;
let chrome;
let ws;
let cdp;

function request(route, method = 'GET') {
  return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port: cdpPort, path: route, method }, response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', part => body += part);
    response.on('end', () => resolve(JSON.parse(body)));
  }).on('error', reject).end());
}
function bindable(port) {
  return new Promise(resolve => {
    const socket = net.createServer();
    socket.once('error', () => resolve(false)); socket.listen(port, '127.0.0.1', () => socket.close(() => resolve(true)));
  });
}
function staticServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, base).pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const searchScript = pathname === '/search.js';
    const animeShim = pathname === '/wbs103-anime.js';
    const target = searchScript
      ? path.resolve(workspace, 'node_modules/hexo-generator-searchdb/dist/search.js')
      : animeShim ? '' : path.resolve(root, `.${pathname}`);
    if (!searchScript && !animeShim && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (animeShim) {
      const js = `(() => {
        const apply = o => {
          if (!o) return;
          const targets = typeof o.targets === 'string' ? [...document.querySelectorAll(o.targets)] : o.targets ? (o.targets.length && !o.targets.style ? [...o.targets] : [o.targets]) : [];
          const config = new Set(['targets','duration','delay','endDelay','easing','round','complete','begin','run','update','loop','direction','autoplay','offset']);
          for (const element of targets) {
            if (!element || !element.style) continue;
            const transforms = [];
            for (const [key, raw] of Object.entries(o)) {
              if (config.has(key) || raw === undefined || typeof raw === 'function') continue;
              const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
              if (key === 'scrollTop') { element.scrollTop = Number(value); continue; }
              if (key === 'scale' || key === 'scaleX' || key === 'scaleY' || key === 'rotate' || key === 'translateX' || key === 'translateY' || key === 'translateZ') {
                const unit = typeof value === 'number' && key.startsWith('translate') ? 'px' : '';
                transforms.push(key.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + '(' + value + unit + ')');
                continue;
              }
              const cssKey = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
              element.style.setProperty(cssKey, typeof value === 'number' && !['opacity','z-index','font-weight','line-height','flex-grow','flex-shrink','order'].includes(cssKey) ? value + 'px' : String(value));
            }
            if (transforms.length) element.style.transform = transforms.join(' ');
          }
          o.complete?.();
        };
        window.anime = Object.assign(o => { apply(o); return {finished:Promise.resolve()}; }, {timeline:()=>({add(o){apply(o);return this;}})});
      })();`;
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }).end(js); return;
    }
    fs.readFile(target, (error, data) => {
      if (error) { evidence.httpErrors.push({ path: pathname, status: 404 }); res.writeHead(404).end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2' };
      if (!searchScript && path.extname(target) === '.html') {
        let html = data.toString();
        html = html.replace(/<base\b[^>]*href=["'][^"']+["'][^>]*>/i, `<base href="${base}/">`);
        html = html.replace(/<script\b[^>]*src=["']https?:\/\/[^"']*\/anime\.min\.js["'][^>]*>\s*<\/script>/gi, '<script src="/wbs103-anime.js"></script>');
        html = html.replace(/<script\b[^>]*src=["']https?:\/\/[^"']*\/search\.js["'][^>]*>\s*<\/script>/gi, '<script src="/search.js"></script>');
        html = html.replace(/<script\b[^>]*src=["']https?:\/\/[^"']*gtag\/js[^"']*["'][^>]*>\s*<\/script>/gi, '');
        html = html.replace(/<link\b(?=[^>]*rel=["'](?:stylesheet|preconnect|dns-prefetch)["'])(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, '');
        if (!html.includes('src="/search.js"')) html = html.replace('</head>', '<script src="/search.js"></script></head>');
        res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' }).end(html);
        return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
}
class CDP {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        const p = message.params || {};
        if (message.method === 'Runtime.exceptionThrown') evidence.pageErrors.push({ text: p.exceptionDetails?.exception?.description || p.exceptionDetails?.text, url: p.exceptionDetails?.url || '' });
        if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) evidence.console.push({ type: p.type, text: (p.args || []).map(arg => arg.value || arg.description || '').join(' ') });
        if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry?.level)) evidence.console.push({ type: p.entry.level, text: p.entry.text });
        if (message.method === 'Network.loadingFailed') evidence.requestFailed.push({ url: p.requestId ? (this.urls.get(p.requestId) || '') : '', error: p.errorText, blockedReason: p.blockedReason || '' });
        if (message.method === 'Network.requestWillBeSent') this.urls.set(p.requestId, p.request?.url || '');
        if (message.method === 'Fetch.requestPaused') {
          const local = p.request.url.startsWith(`${base}/`);
          if (local) this.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
          else {
            evidence.blockedExternal.push(p.request.url);
            this.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: p.resourceType === 'Stylesheet' ? 'text/css' : 'application/javascript' }], body: '' }).catch(() => {});
          }
        }
        return;
      }
      const pending = this.pending.get(message.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
    this.urls = new Map();
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}
async function openPage(viewport) {
  const target = await request('/json/new?about:blank', 'PUT');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  cdp = new CDP(ws);
  for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await cdp.send(method);
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await setViewport(viewport);
  return cdp;
}
async function setViewport(v) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.width < 500 });
}
async function navigate(route) {
  await cdp.send('Page.navigate', { url: `${base}${route}` });
  for (let i = 0; i < 300; i++) {
    try { if (await cdp.evaluate(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete'`)) break; } catch {}
    await delay(40);
  }
  await delay(400);
}
async function waitFor(expression, label) {
  for (let i = 0; i < 80; i++) {
    try { if (await cdp.evaluate(expression)) return; } catch {}
    await delay(100);
  }
  let current = '';
  try { current = JSON.stringify(await cdp.evaluate(`(()=>({url:location.href,ready:document.readyState,active:document.activeElement?.outerHTML?.slice(0,240)||'',top:document.elementFromPoint(innerWidth/2,Math.min(innerHeight/2,450))?.outerHTML?.slice(0,240)||''}))()`)); } catch {}
  throw new Error(`Timed out waiting for ${label}; current=${current}; lastClick=${JSON.stringify(evidence.lastClick||null)}`);
}
async function click(selector, label = selector) {
  const box = await cdp.evaluate(`(() => { const all=[...document.querySelectorAll(${JSON.stringify(selector)})]; const e=all.find(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'})||all[0]; if(!e) return null; e.scrollIntoView({block:'center',inline:'nearest'}); const v=e.getBoundingClientRect().width&&e.getBoundingClientRect().height?e:(e.querySelector('h3,button,span')||e); const r=v.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,href:e.href||'',target:e.target||'',hit:hit?.outerHTML?.slice(0,180)||'',pointerEvents:getComputedStyle(e).pointerEvents}; })()`);
  if (!box || box.width < 1) throw new Error(`Cannot click ${label}: ${JSON.stringify(box)}`);
  evidence.lastClick = { selector, label, ...box };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
  return box;
}
async function key(key, code) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
}
async function record(name, input, expected, actual, viewport) {
  const pass = typeof expected === 'function' ? expected(actual) : Boolean(actual?.ok);
  evidence.steps.push({ name, input, expected: typeof expected === 'function' ? actual.expected || 'asserted by named predicates' : expected, actual, pass, viewport, finalUrl: await cdp.evaluate('location.href') });
  if (!pass) throw new Error(`${name} failed: ${JSON.stringify(actual)}`);
}
async function screenshot(name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = `tmp/wbs103-${name}.png`;
  fs.writeFileSync(path.resolve(workspace, file), Buffer.from(result.data, 'base64')); evidence.screenshots.push(file);
}
async function pageFacts() {
  return cdp.evaluate(`(() => ({url:location.href, path:location.pathname, title:document.querySelector('h1, h2')?.innerText.trim()||'', main:!!document.querySelector('#main-content'), mainText:document.querySelector('#main-content')?.innerText.slice(0,500)||'', switch:[...document.querySelectorAll('.surface-switch-link')].map(a=>({text:a.innerText.trim(),href:a.href,target:a.getAttribute('target')})), canonical:[...document.querySelectorAll('link[rel=canonical]')].map(x=>x.href), width:{inner:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}, errors:[] }))()`);
}
async function historyBack(targetPath = '/profile/') {
  const h = await cdp.send('Page.getNavigationHistory');
  await cdp.send('Page.navigateToHistoryEntry', { entryId: h.entries[h.currentIndex - 1].id });
  await waitFor(`location.pathname === ${JSON.stringify(targetPath)} && document.readyState === 'complete'`, `browser history back to ${targetPath}`);
  await delay(350);
}
async function openSearch(scope, query, expectedPath, viewport) {
  const trigger = await click('.popup-trigger', 'open search');
  await waitFor(`document.body.classList.contains('search-active')`, 'search overlay open');
  await waitFor(`(() => { const overlay=document.querySelector('.search-pop-overlay'), popup=document.querySelector('.search-popup'); if(!overlay||!popup)return false;const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0&&r.width>0&&r.height>0};return visible(overlay)&&visible(popup)&&overlay.getAttribute('aria-hidden')==='false';})()`, 'search overlay and popup visibly rendered');
  await waitFor(`!document.querySelector('[data-navigation-filter="surface"]').disabled`, 'search index and filters loaded');
  const enabled = await cdp.evaluate(`!document.querySelector('[data-navigation-filter="surface"]').disabled && !document.querySelector('.search-input').disabled`);
  const initialScope = await cdp.evaluate(`document.querySelector('[data-navigation-filter="surface"]').value`);
  const expectedDefault = await cdp.evaluate(`location.pathname==='/profile/'?'profile':document.querySelector('.post-surface-marker,article.post-content-single[itemtype*="BlogPosting"]')?'all':'memory'`);
  await cdp.evaluate(`(() => { const s=document.querySelector('[data-navigation-filter="surface"]'); s.value=${JSON.stringify(scope)}; s.dispatchEvent(new Event('change',{bubbles:true})); const i=document.querySelector('.search-input'); i.focus(); i.value=${JSON.stringify(query)}; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await delay(900);
  const actual = await cdp.evaluate(`(() => { const normalize=p=>{try{return decodeURIComponent(p)}catch{return p}};const overlay=document.querySelector('.search-pop-overlay'),popup=document.querySelector('.search-popup');const visual=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{display:s.display,visibility:s.visibility,opacity:s.opacity,transform:s.transform,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}};const results=[...document.querySelectorAll('.search-result-item')].map(e=>({text:e.innerText.trim(),links:[...e.querySelectorAll('a[href]')].map(a=>({text:a.innerText.trim(),href:a.href,target:a.target}))})); const all=[...document.querySelectorAll('.search-result-container a[href]')].map(a=>({text:a.innerText.trim(),href:a.href})); const matching=all.filter(x=>normalize(new URL(x.href).pathname)===normalize(${JSON.stringify(expectedPath)})); return {overlay:document.body.classList.contains('search-active'),overlayVisual:visual(overlay),popupVisual:visual(popup),focus:document.activeElement.className||document.activeElement.tagName,scope:document.querySelector('[data-navigation-filter="surface"]').value,query:document.querySelector('.search-input').value,resultText:document.querySelector('.search-result-container')?.innerText.slice(0,800)||'',results,matching,matchingCount:matching.length,visible:!!document.querySelector('.search-result-container')?.innerText.trim()}; })()`);
  actual.enabled = enabled; actual.openHref = trigger.href; actual.expectedPath = expectedPath; actual.initialScope = initialScope; actual.expectedDefault = expectedDefault;
  const visualVisible = ['overlayVisual','popupVisual'].every(key => actual[key].display !== 'none' && actual[key].visibility === 'visible' && Number(actual[key].opacity) > 0 && actual[key].rect.width > 0 && actual[key].rect.height > 0);
  const inViewport = actual.popupVisual.rect.x >= 0 && actual.popupVisual.rect.y >= 0 && actual.popupVisual.rect.right <= viewport.width && actual.popupVisual.rect.bottom <= viewport.height;
  const ok = enabled && initialScope===expectedDefault && actual.overlay && visualVisible && (viewport.width >= 500 || inViewport) && actual.scope === scope && actual.query === query && actual.matchingCount === 1;
  await record(`search ${scope}: ${query}`, { action: 'click search, verify default scope, set scope, type query', scope, query }, `default ${expectedDefault}; one result at ${expectedPath}`, { ...actual, ok }, viewport);
  await screenshot(`search-${scope}-${viewport.width}`);
  return actual;
}

async function desktopJourneys(viewport) {
  await setViewport(viewport); await navigate('/profile/');
  const direct = await pageFacts();
  const cardCount = await cdp.evaluate(`document.querySelectorAll('.profile-path').length`);
  const priorityCard = await cdp.evaluate(`(()=>{const a=[...document.querySelectorAll('.profile-path a[href]')].find(x=>new URL(x.href).pathname==='/work/from-real-work-to-features/');return a?{href:a.href,text:a.innerText.trim()}:null})()`);
  await record('desktop direct A entry', 'direct navigate /profile/', 'profile surface, main, 3 paths, priority article card, switch to memory', { ...direct, cardCount, priorityCard, screenshot:'tmp/wbs103-desktop-profile.png', ok:direct.path==='/profile/'&&direct.main&&cardCount===3&&!!priorityCard&&direct.switch[0]?.href.endsWith('/') }, viewport);
  await screenshot('desktop-profile');
  await cdp.send('Page.reload', { ignoreCache: true }); await waitFor(`location.pathname === '/profile/' && document.readyState === 'complete'`, 'profile reload'); await delay(300);
  await record('desktop profile reload', 'browser reload', 'same A URL and core content', { ...(await pageFacts()), ok:(await cdp.evaluate(`document.querySelectorAll('.profile-path').length===3&&!!document.querySelector('#main-content')`)) }, viewport);
  await screenshot('desktop-profile-reload');
  evidence.afterReloadCard = await cdp.evaluate(`(()=>{const a=document.querySelector('.profile-article-link'),h=a?.querySelector('h3'),r=h?.getBoundingClientRect();return{path:location.pathname,anchorStyle:a?{display:getComputedStyle(a).display,visibility:getComputedStyle(a).visibility,opacity:getComputedStyle(a).opacity,pointer:getComputedStyle(a).pointerEvents}:null,h3:r?{x:r.x,y:r.y,w:r.width,h:r.height,visibility:getComputedStyle(h).visibility,opacity:getComputedStyle(h).opacity}:null,hit:r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML?.slice(0,100):null}})()`);
  const articleLink = await cdp.evaluate(`(() => { const a=[...document.querySelectorAll('.profile-path a[href]')].find(x=>new URL(x.href).pathname==='/work/from-real-work-to-features/'); return a?{href:a.href,text:a.innerText.trim(),target:a.getAttribute('target')}:null; })()`);
  if (!articleLink) throw new Error('Priority A article link missing from profile cards');
  await click('a.profile-article-link[href*="/work/from-real-work-to-features/"]', 'open A article card'); await waitFor(`location.pathname === '/work/from-real-work-to-features/'&&document.readyState==='complete'`, 'A article route'); await delay(350);
  const article = await cdp.evaluate(`(() => ({url:location.href,canonical:[...document.querySelectorAll('link[rel=canonical]')].map(x=>x.href),marker:document.querySelector('.post-surface-marker')?.innerText.trim()||'',main:!!document.querySelector('main#main-content'),articles:document.querySelectorAll('article.post-content-single').length}))()`);
  await record('A article and neutral URL', 'click /work/from-real-work-to-features/ card', 'single neutral article URL/canonical/marker', { ...article, ok:article.articles===1&&article.canonical.length===1&&new URL(article.canonical[0]).pathname==='/work/from-real-work-to-features/'&&article.marker.includes('工作與學習') }, viewport);
  await historyBack();
  const back = await pageFacts();
  await record('browser back to A', 'browser history back', 'back to /profile/ and interactive switch remains', { ...back, ok:back.path==='/profile/'&&!!back.switch.length&&back.main }, viewport);
  const switchA = await cdp.evaluate(`(() => {const a=document.querySelector('.surface-switch-link');return {href:a?.href,target:a?.getAttribute('target'),text:a?.innerText.trim(),rect:(()=>{const r=a?.getBoundingClientRect();return r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom}:null})()}})()`);
  await click('.surface-switch-link', 'A to B official switch'); await waitFor(`location.pathname === '/'&&document.readyState==='complete'`, 'B home'); await delay(700);
  const b = await cdp.evaluate(`(() => ({url:location.href,path:location.pathname,label:document.querySelector('.surface-switch-link')?.innerText.trim(),href:document.querySelector('.surface-switch-link')?.href,randomHref:document.querySelector('#home-random-open')?.href,randomTitle:document.querySelector('#home-random-title')?.innerText.trim(),status:document.querySelector('#home-random-status')?.innerText.trim(),width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,inner:innerWidth}}))()`);
  const randomMembership = await cdp.evaluate(`fetch('/random.json').then(r=>r.json()).then(items=>{const norm=p=>{try{return decodeURIComponent(p)}catch{return p}};const path=norm(new URL(document.querySelector('#home-random-open').href).pathname);return{candidate:items.some(x=>norm(x.url)===path),profileOnlyExcluded:!items.some(x=>norm(x.url)==='/learning/website-quality-testing-roadmap/'),poolSize:items.length}})`);
  await record('A to B and B random', 'click switch; wait for random data', 'native link navigates to /; candidate belongs to memory random.json and profile-only learning is excluded', { ...b, randomMembership, switchHref:switchA.href,switchTarget:switchA.target,switchRect:switchA.rect,ok:b.path==='/'&&b.randomTitle!=='今天隨機翻到……'&&b.status!=='正在翻找一篇紀錄……'&&randomMembership.candidate&&randomMembership.profileOnlyExcluded }, viewport);
  await screenshot('desktop-home-random');
  await click('#home-random-again','reroll B random article');
  await waitFor(`document.querySelector('#home-random-title')&&document.querySelector('#home-random-title').innerText.trim()!==${JSON.stringify(b.randomTitle)}`,'random reroll updates selected title');
  const reroll = await cdp.evaluate(`(()=>({title:document.querySelector('#home-random-title').innerText.trim(),href:document.querySelector('#home-random-open').href,status:document.querySelector('#home-random-status').innerText.trim()}))()`);
  const rerollMembership = await cdp.evaluate(`fetch('/random.json').then(r=>r.json()).then(a=>{const n=p=>{try{return decodeURIComponent(p)}catch{return p}};const path=n(new URL(document.querySelector('#home-random-open').href).pathname);return{candidate:a.some(x=>n(x.url)===path),profileOnlyExcluded:!a.some(x=>n(x.url)==='/learning/website-quality-testing-roadmap/')}})`);
  await record('B random reroll control', 'click 「換一篇」 button', 'selection changes to another eligible memory candidate', { ...reroll, previousTitle:b.randomTitle, previousHref:b.randomHref, rerollMembership, ok:reroll.title!==b.randomTitle&&reroll.href!==b.randomHref&&rerollMembership.candidate&&rerollMembership.profileOnlyExcluded },viewport);
  const randomHref = reroll.href;
  await click('#home-random-open', 'open selected random article'); await waitFor(`location.pathname === ${JSON.stringify(new URL(randomHref).pathname)}&&document.readyState==='complete'`, 'random article route'); await delay(300);
  const randomArticle = await cdp.evaluate(`(() => ({url:location.href,canonical:[...document.querySelectorAll('link[rel=canonical]')].map(x=>x.href),count:document.querySelectorAll('article.post-content-single').length,marker:document.querySelector('.post-surface-marker')?.innerText.trim()||''}))()`);
  await record('random article URL/canonical', 'click selected random card', 'one article and one canonical at the selected URL', { ...randomArticle, ok:randomArticle.count===1&&randomArticle.canonical.length===1&&new URL(randomArticle.canonical[0]).pathname===new URL(randomHref).pathname }, viewport);
  await navigate('/');
  const switchB = await cdp.evaluate(`(()=>{const a=document.querySelector('.surface-switch-link');return{href:a.href,target:a.getAttribute('target'),text:a.innerText.trim()}})()`);
  await click('.surface-switch-link','B to A official switch'); await waitFor(`location.pathname==='/profile/'&&document.readyState==='complete'`,'B to A profile route');
  const bToA = await pageFacts();
  await record('B to A official switch', 'click SIDE A on B home', 'native href to /profile/, SIDE A label, no target override, A page loads', { ...bToA,link:switchB,ok:bToA.path==='/profile/'&&bToA.main&&switchB.href.endsWith('/profile/')&&switchB.target===null&&switchB.text==='SIDE A／看工作與學習' },viewport);
  await navigate('/');
  await openSearch('memory','Sailing Back To You','/2026/09/01/歌曲推薦/歌曲推薦-sailing%20back%20to%20you/',viewport);
  const song = evidence.steps.at(-1).actual;
  if (!song.resultText.includes('個人記憶庫')) throw new Error(`Memory song label missing: ${song.resultText}`);
  await click('.popup-btn-close','close B search'); await waitFor(`!document.body.classList.contains('search-active')`,'close B search'); await waitFor(`getComputedStyle(document.querySelector('.search-pop-overlay')).visibility==='hidden'`,'B search close transition');
  await click('.popup-trigger','reopen B search'); await waitFor(`document.body.classList.contains('search-active')`,'reopen B search'); await waitFor(`!document.querySelector('[data-navigation-filter="surface"]').disabled`,'B search filters reloaded');
  const reopened = await cdp.evaluate(`({active:document.body.classList.contains('search-active'),scope:document.querySelector('[data-navigation-filter="surface"]').value})`);
  await record('search close and reopen', 'close then reopen from B home with mouse', 'search closes and reopens with B memory default', { ...reopened, ok:reopened.active&&reopened.scope==='memory' }, viewport);
  await navigate('/profile/');
  await openSearch('profile','網站品質與軟體測試','/learning/website-quality-testing-roadmap/',viewport);
  const learningResult = evidence.steps.at(-1).actual;
  const learningLabel = learningResult.resultText;
  if (!learningLabel.includes('工作與學習')) throw new Error(`Profile only learning result lacks proper label: ${learningLabel}`);
  await click('.popup-btn-close','close A profile search'); await waitFor(`!document.body.classList.contains('search-active')`,'profile search close'); await waitFor(`getComputedStyle(document.querySelector('.search-pop-overlay')).visibility==='hidden'`,'profile search close transition');
  await navigate('/');
  await openSearch('all','讓工具服務心流','/work/flow-friendly-work-system/',viewport);
  const dual = evidence.steps.at(-1).actual;
  if (dual.matchingCount !== 1) throw new Error('All-public dual article search did not deduplicate to one result');
  await click('.search-result-title[href*="/work/flow-friendly-work-system/"]','open deduplicated dual article search result');
  await waitFor(`location.pathname==='/work/flow-friendly-work-system/'&&document.readyState==='complete'`,'dual article from search');
  const opened = await cdp.evaluate(`(()=>({url:location.href,canonical:[...document.querySelectorAll('link[rel=canonical]')].map(x=>x.href),articles:document.querySelectorAll('article.post-content-single').length,marker:document.querySelector('.post-surface-marker')?.innerText.trim()||''}))()`);
  await record('search result opens dual article', 'click unique result link', 'one neutral article URL and canonical', { ...opened,ok:opened.articles===1&&opened.canonical.length===1&&new URL(opened.canonical[0]).pathname==='/work/flow-friendly-work-system/' },viewport);
  await historyBack('/'); await waitFor(`document.body.classList.contains('search-active')`,'search state restored after browser back');
  await waitFor(`!document.querySelector('[data-navigation-filter="surface"]').disabled`,'restored search index');
  const restored = await cdp.evaluate(`(()=>({url:location.href,active:document.body.classList.contains('search-active'),query:document.querySelector('.search-input').value,scope:document.querySelector('[data-navigation-filter="surface"]').value,resultCount:[...document.querySelectorAll('.search-result-title[href]')].filter(a=>decodeURIComponent(new URL(a.href).pathname)==='/work/flow-friendly-work-system/').length,errors:[]}))()`);
  await record('search and browser back restore state', 'browser Back from search result article', 'B page returns with prior all-public query and single dual result, no errors', { ...restored,ok:restored.active&&restored.scope==='all'&&restored.query==='讓工具服務心流'&&restored.resultCount===1 },viewport);
  await screenshot('desktop-search-restored');
}
async function mobileJourney(viewport) {
  await setViewport(viewport); await navigate('/profile/');
  const p = await pageFacts();
  await record('mobile direct A and layout', 'direct navigate /profile/', 'main, three paths, no horizontal overflow, switch in viewport', { ...p, paths:await cdp.evaluate(`document.querySelectorAll('.profile-path').length`), switchInViewport:await cdp.evaluate(`(()=>{const r=document.querySelector('.surface-switch-link').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`),ok:p.path==='/profile/'&&p.main&&p.width.doc<=viewport.width&&p.width.body<=viewport.width&&await cdp.evaluate(`document.querySelectorAll('.profile-path').length===3&&(()=>{const r=document.querySelector('.surface-switch-link').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`) },viewport);
  await screenshot('mobile-profile');
  await click('.surface-switch-link','mobile A to B switch'); await waitFor(`location.pathname === '/'&&document.readyState==='complete'`,'mobile B home'); await waitFor(`!!document.querySelector('#home-random-title')&&document.querySelector('#home-random-title').innerText.trim()!=='今天隨機翻到……'`,'mobile random ready');
  const b = await cdp.evaluate(`(() => ({url:location.href,title:document.querySelector('#home-random-title').innerText.trim(),href:document.querySelector('#home-random-open').href,width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,inner:innerWidth},focus:document.activeElement.tagName,overlay:!!document.querySelector('.search-pop-overlay[style*="visible"]')}))()`);
  const randomMembership = await cdp.evaluate(`fetch('/random.json').then(r=>r.json()).then(a=>{const norm=p=>{try{return decodeURIComponent(p)}catch{return p}};const path=norm(new URL(document.querySelector('#home-random-open').href).pathname);return{candidate:a.some(x=>norm(x.url)===path),profileOnlyExcluded:!a.some(x=>norm(x.url)==='/learning/website-quality-testing-roadmap/')}})`);
  await record('mobile B random interaction', 'tap official switch; wait for random', 'random candidate visible, in candidate set and no overflow', { ...b, randomMembership,ok:b.title!=='今天隨機翻到……'&&b.width.doc<=viewport.width&&b.width.body<=viewport.width&&randomMembership.candidate&&randomMembership.profileOnlyExcluded },viewport);
  await screenshot('mobile-home-random');
  const searchActual = await openSearch('memory','Sailing Back To You','/2026/09/01/歌曲推薦/歌曲推薦-sailing%20back%20to%20you/',viewport);
  const overlay = await cdp.evaluate(`(()=>{const o=document.querySelector('.search-pop-overlay'),d=document.querySelector('.search-popup'),i=document.querySelector('.search-input'),rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,visibility:s.visibility,opacity:s.opacity,display:s.display,background:s.backgroundColor}},pr=d.getBoundingClientRect();return {overlay:document.body.classList.contains('search-active'),ariaHidden:o.getAttribute('aria-hidden'),overlayVisual:rect(o),popupVisual:rect(d),focus:document.activeElement===i,rect:{x:pr.x,y:pr.y,right:pr.right,bottom:pr.bottom},viewport:{w:innerWidth,h:innerHeight},width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}}})()`);
  const mobilePopupVisible = overlay.popupVisual.display!=='none'&&overlay.popupVisual.visibility==='visible'&&Number(overlay.popupVisual.opacity)>0&&overlay.popupVisual.width>0&&overlay.popupVisual.height>0;
  const mobileOverlayVisible = overlay.overlayVisual.display!=='none'&&overlay.overlayVisual.visibility==='visible'&&Number(overlay.overlayVisual.opacity)>0&&overlay.overlayVisual.width>=viewport.width&&overlay.overlayVisual.height>=viewport.height;
  await record('mobile search focus and overlay', 'open search and enter song query', 'visible, non-transparent overlay/popup, result, focused input, popup fully within viewport and no horizontal overflow', { ...overlay,searchActual,ok:overlay.overlay&&overlay.ariaHidden==='false'&&overlay.focus&&mobilePopupVisible&&mobileOverlayVisible&&overlay.rect.x>=0&&overlay.rect.y>=0&&overlay.rect.right<=overlay.viewport.w&&overlay.rect.bottom<=overlay.viewport.h&&overlay.width.doc<=viewport.width&&overlay.width.body<=viewport.width },viewport);
  await screenshot('mobile-search');
  const closeRect = await cdp.evaluate(`(()=>{const e=document.querySelector('.popup-btn-close'),r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}})()`);
  await click('.popup-btn-close','close mobile search'); await waitFor(`!document.body.classList.contains('search-active')`,'mobile search close');
  await record('mobile search closes', 'tap close button', 'overlay closes and page remains usable', { closeRect,active:await cdp.evaluate(`document.body.classList.contains('search-active')`),ok:!await cdp.evaluate(`document.body.classList.contains('search-active')`) },viewport);
}
async function noJsJourney(viewport) {
  await setViewport(viewport);
  await cdp.send('Emulation.setScriptExecutionDisabled',{value:true});
  await navigate('/profile/');
  let a = await cdp.evaluate(`(()=>({url:location.href,main:!!document.querySelector('#main-content'),switchHtml:document.querySelector('.surface-switch-link')?.outerHTML||'',cardHtml:[...document.querySelectorAll('.profile-path a[href]')].find(x=>x.outerHTML.includes('from-real-work-to-features'))?.outerHTML||'',width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}}))()`);
  await record('no-JS A anchors', 'load /profile/ with script execution disabled', 'profile renders; switch/card have native hrefs', { ...a,ok:a.main&&a.switchHtml.includes('href="/"')&&a.cardHtml.includes('href="/work/from-real-work-to-features/"')&&a.width.doc<=viewport.width&&a.width.body<=viewport.width },viewport);
  await click('.surface-switch-link','no-JS A to B switch'); await waitFor(`location.pathname==='/'&&document.readyState==='complete'`,'no-JS B home');
  const b = await cdp.evaluate(`(()=>({url:location.href,main:!!document.querySelector('#main-content'),bridge:[...document.querySelectorAll('a[href]')].filter(x=>x.innerText.includes('工作與學習')).map(x=>({text:x.innerText.trim(),href:x.href,target:x.getAttribute('target')})),randomLink:document.querySelector('#home-random-open')?.getAttribute('href')||'',archive:[...document.querySelectorAll('a[href]')].find(x=>x.innerText.includes('全部文章'))?.getAttribute('href')||'',switch:document.querySelector('.surface-switch-link')?.getAttribute('href')||'',width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}}))()`);
  await record('no-JS B bridge and navigation', 'activate native switch anchor', 'B page has main and native bridge/archive/card hrefs', { ...b,ok:b.main&&b.bridge.length>0&&b.archive.startsWith('/')&&b.randomLink.startsWith('/')&&b.width.doc<=viewport.width&&b.width.body<=viewport.width },viewport);
  await click('.home-profile-bridge a','no-JS profile bridge'); await waitFor(`location.pathname==='/profile/'&&document.readyState==='complete'`,'no-JS bridge to profile');
  await navigate('/');
  const directB = await cdp.evaluate(`(()=>({url:location.href,main:!!document.querySelector('#main-content'),randomHref:document.querySelector('#home-random-open')?.getAttribute('href')||'',bridge:[...document.querySelectorAll('.home-profile-bridge a[href]')].map(x=>x.getAttribute('href')),switchHtml:document.querySelector('.surface-switch-link')?.outerHTML||'',width:{doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}}))()`);
  await record('no-JS direct B and anchors', 'load / directly with script execution disabled', 'B main renders; switch, home bridge, and random fallback retain hrefs', { ...directB,ok:directB.main&&directB.switchHtml.includes('href="/profile/"')&&directB.bridge.some(h=>h==='/profile/')&&directB.randomHref.startsWith('/')&&directB.width.doc<=viewport.width&&directB.width.body<=viewport.width },viewport);
  await click('.surface-switch-link','no-JS B to A official switch'); await waitFor(`location.pathname==='/profile/'&&document.readyState==='complete'`,'no-JS official switch back to A');
  await record('no-JS B to A switch', 'activate SIDE B switch anchor', 'native link navigates to /profile/', { url:await cdp.evaluate('location.href'),path:await cdp.evaluate('location.pathname'),ok:await cdp.evaluate(`location.pathname==='/profile/'`) },viewport);
  await click(`a[href*="/work/from-real-work-to-features/"]`,'no-JS article card'); await waitFor(`location.pathname==='/work/from-real-work-to-features/'&&document.readyState==='complete'`,'no-JS article open');
  const article = await cdp.evaluate(`(()=>({url:location.href,main:!!document.querySelector('#main-content'),article:!!document.querySelector('article.post-content-single'),canonical:[...document.querySelectorAll('link[rel=canonical]')].map(x=>x.href),bodyText:document.querySelector('.post-body')?.innerText.slice(0,180)||''}))()`);
  await record('no-JS article/card navigation', 'bridge back to profile then click article card', 'article body readable and unique canonical remains', { ...article,ok:article.main&&article.article&&article.bodyText.length>0&&article.canonical.length===1&&new URL(article.canonical[0]).pathname==='/work/from-real-work-to-features/' },viewport);
  await cdp.send('Emulation.setScriptExecutionDisabled',{value:false});
}
async function main() {
  if (!fs.existsSync(root + path.sep + 'index.html')) throw new Error(`WBS 10.2 public output missing: ${root}`);
  for (const port of [httpPort,cdpPort]) if (!await bindable(port)) throw new Error(`Dedicated port already in use: ${port}`);
  server = staticServer(); await new Promise(resolve=>server.listen(httpPort,'127.0.0.1',resolve));
  chrome = spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking','--disable-extensions',`--user-data-dir=${profile}`,`--remote-debugging-port=${cdpPort}`,'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`${base}/profile/`],{stdio:'ignore',windowsHide:true});
  for (let i=0;i<100;i++){try{await request('/json/version');break}catch{await delay(100)}}
  const tab=await request('/json/list');
  const target=tab.find(x=>x.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  cdp=new CDP(ws); for(const method of ['Page.enable','Runtime.enable','Log.enable','Network.enable']) await cdp.send(method);
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'http://*'},{urlPattern:'https://*'}]});
  await setViewport(evidence.viewports[0]); await navigate('/profile/');
  await desktopJourneys(evidence.viewports[0]);
  await mobileJourney(evidence.viewports[1]);
  await noJsJourney(evidence.viewports[1]);
  await delay(500);
  evidence.finalUrl=await cdp.evaluate('location.href');
  evidence.summary={steps:evidence.steps.length,passed:evidence.steps.filter(x=>x.pass).length,failed:evidence.steps.filter(x=>!x.pass).length,console:evidence.console.length,pageErrors:evidence.pageErrors.length,requestFailed:evidence.requestFailed.length,httpErrors:evidence.httpErrors.length,blockedExternal:evidence.blockedExternal.length,screenshots:evidence.screenshots.length};
  evidence.portsReleased=false;
  fs.writeFileSync(evidenceFile,`${JSON.stringify(evidence,null,2)}\n`);
  if(evidence.console.length||evidence.pageErrors.length||evidence.requestFailed.length||evidence.httpErrors.length) throw new Error(`Browser issue(s): ${JSON.stringify(evidence.summary)}`);
  console.log(JSON.stringify({summary:evidence.summary,evidenceFile,finalUrl:evidence.finalUrl}));
}
main().catch(error=>{
  evidence.fatal=error.stack||error.message;
  evidence.summary={steps:evidence.steps.length,passed:evidence.steps.filter(x=>x.pass).length,failed:evidence.steps.filter(x=>!x.pass).length,console:evidence.console.length,pageErrors:evidence.pageErrors.length,requestFailed:evidence.requestFailed.length,httpErrors:evidence.httpErrors.length};
  try{fs.writeFileSync(evidenceFile,`${JSON.stringify(evidence,null,2)}\n`)}catch{}
  console.error(error.stack||error.message);process.exitCode=1;
}).finally(async()=>{
  if(ws&&ws.readyState<WebSocket.CLOSING)ws.close();
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  if(chrome&&!chrome.killed){
    try{chrome.kill();await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),delay(2000)])}catch{}
  }
  const resolved=path.resolve(profile),prefix=workspace.endsWith(path.sep)?workspace:workspace+path.sep;
  if(resolved.startsWith(prefix)&&fs.existsSync(resolved)){try{fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:250})}catch(e){console.error(`Profile cleanup failed: ${e.code}`);process.exitCode=1}}
  const free=await Promise.all([bindable(httpPort),bindable(cdpPort)]);
  evidence.portsReleased=free.every(Boolean); evidence.portCheck={http:free[0],cdp:free[1]};
  if(fs.existsSync(evidenceFile))fs.writeFileSync(evidenceFile,`${JSON.stringify(evidence,null,2)}\n`);
  if(!evidence.portsReleased){console.error('Port cleanup verification failed');process.exitCode=1;}
});
