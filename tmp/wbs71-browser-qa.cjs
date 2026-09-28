const fs = require('node:fs');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');

const base = 'http://127.0.0.1:8892';
const evidencePath = 'tmp/wbs71-browser-qa-evidence.json';
const browserPort = 9340;
const evidence = { browser: 'Chrome headless via CDP', base, checks: [], failures: [], samples: {} };
const localSearchSource = fs.readFileSync('node_modules/hexo-generator-searchdb/dist/search.js', 'utf8');
const browserBootstrap = () => {
  const revealTargets = targets => {
    if (typeof targets === 'string') {
      document.querySelectorAll(targets).forEach(element => {
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.top = 'initial';
      });
    }
  };
  const animeStub = options => {
    revealTargets(options && options.targets);
    if (options && typeof options.complete === 'function') options.complete();
    return { finished: Promise.resolve() };
  };
  animeStub.timeline = () => ({
    add(options) {
      revealTargets(options && options.targets);
      if (options && typeof options.complete === 'function') options.complete();
      return this;
    }
  });
  globalThis.anime = animeStub;

  class OfflinePjax {
    static switches = {
      outerHTML(oldElement, newElement) {
        oldElement.replaceWith(newElement.cloneNode(true));
        this.onSwitch();
      }
    };
    constructor(options) {
      this.options = options;
      this.loading = false;
      document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || link.closest('.search-result-container') || link.target || link.hasAttribute('download')) return;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || url.pathname === location.pathname && url.search === location.search && url.hash) return;
        event.preventDefault();
        this.navigate(url.href, true);
      });
    }
    async navigate(url, push) {
      if (this.loading) return;
      this.loading = true;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('PJAX request failed (' + response.status + ')');
        const nextDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
        for (const selector of this.options.selectors) {
          const current = [...document.querySelectorAll(selector)];
          const incoming = [...nextDocument.querySelectorAll(selector)];
          current.forEach((element, index) => {
            if (incoming[index]) element.replaceWith(incoming[index].cloneNode(true));
          });
        }
        if (push) history.pushState({}, '', url);
        document.dispatchEvent(new Event('pjax:success'));
      } finally {
        this.loading = false;
      }
    }
    refresh() {}
    executeScripts() {}
    onSwitch() {}
  }
  globalThis.Pjax = OfflinePjax;
};
const bootstrapSource = `${localSearchSource}\n;(${browserBootstrap.toString()})();`;
const assert = (condition, label, detail) => {
  (condition ? evidence.checks : evidence.failures).push({ label, ...(detail === undefined ? {} : { detail }) });
};
const cdpHttp = (path, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port: browserPort, path, method }, res => {
    let data = ''; res.setEncoding('utf8'); res.on('data', chunk => data += chunk);
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
  });
  req.on('error', reject); req.end();
});

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }
    else this.events.push(m);
  }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, {resolve, reject}); this.ws.send(JSON.stringify({id, method, params})); }); }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {expression, awaitPromise, returnByValue:true, userGesture:true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || r.exceptionDetails.exception?.description);
    return r.result.value;
  }
  async waitFor(expression, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        if (await this.eval(expression)) return true;
      } catch (error) {
        // A reload or history traversal can invalidate the previous execution context.
      }
      await delay(100);
    }
    throw new Error('Timed out waiting for ' + expression);
  }
  async navigate(path) { await this.send('Page.navigate', {url:base + path}); await this.waitFor("document.readyState === 'complete' && document.querySelector('.popup-trigger')"); await delay(350); }
  async searchReady() { await this.waitFor("document.querySelector('[data-navigation-filter=surface]') && !document.querySelector('[data-navigation-filter=surface]').disabled"); }
  async openSearch() { await this.eval("document.querySelector('.popup-trigger').click()"); await this.searchReady(); }
  async query(q) { await this.eval(`(()=>{const i=document.querySelector('.search-input');i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await delay(60); return this.eval("[...document.querySelectorAll('.search-result-title')].map(a=>({title:a.innerText,href:a.getAttribute('href')}))"); }
  async surface() { return this.eval("document.querySelector('[data-navigation-filter=surface]').value"); }
  async setSurface(value) { await this.eval(`(()=>{const s=document.querySelector('[data-navigation-filter=surface]');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await delay(50); }
  async clear() { await this.eval("document.querySelector('[data-navigation-reset]').click()"); await delay(50); }
  async recent() { return this.eval("[...document.querySelectorAll('[data-search-recent-item]')].filter(x=>!x.hidden).map(x=>({title:x.querySelector('.search-recent-title')?.innerText,surfaces:x.dataset.searchRecentSurfaces,categories:x.dataset.searchRecentCategories}))"); }
}

(async () => {
  const page = await cdpHttp('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true}); });
  const c = new CDP(ws);
  await Promise.all(['Page.enable','Runtime.enable','Network.enable'].map(method => c.send(method)));
  await c.send('Network.setCacheDisabled', {cacheDisabled:true});
  await c.send('Network.setBlockedURLs', { urls: ['https://cdn.jsdelivr.net/*', 'https://cdnjs.cloudflare.com/*', 'https://www.googletagmanager.com/*', 'https://www.google-analytics.com/*'] });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrapSource });
  const consoleErrors = [];
  ws.addEventListener('message', e => { const m=JSON.parse(e.data); if(m.method==='Runtime.consoleAPICalled' && ['warning','error'].includes(m.params.type)) consoleErrors.push({type:m.params.type,args:m.params.args.map(a=>a.value||a.description||'')}); if(m.method==='Runtime.exceptionThrown') consoleErrors.push({type:'exception',text:m.params.exceptionDetails.text}); });
  await c.navigate('/profile/'); await c.openSearch();
  const profileDefault = await c.surface();
  const profileQuery = await c.query('AI 提問判斷順序');
  assert(profileDefault==='profile','A /profile/ default scope',profileDefault);
  assert(profileQuery.some(x=>x.href.startsWith('/learning/ai-question-judgment-order/')),'A profile-only article found',profileQuery);
  await c.query('System Ready');
  const profileExcludesMemory = await c.eval("document.querySelectorAll('.search-result-title').length");
  assert(profileExcludesMemory===0,'A excludes memory-only result',profileExcludesMemory);
  const dualA = await c.query('讓工具服務心流');
  assert(dualA.some(x=>x.href==='/work/flow-friendly-work-system/'),'A finds dual-surface article',dualA);
  await c.setSurface('all');
  const memoryOnAll = await c.query('System Ready');
  assert(memoryOnAll.some(x=>x.href.startsWith('/2026/01/21/welcome-board/')),'A all-scope finds memory-only result',memoryOnAll);
  await c.clear(); assert(await c.surface()==='profile','A clear restores profile default',await c.surface());

  await c.navigate('/'); await c.openSearch();
  const bDefault=await c.surface();
  const bMemory=await c.query('System Ready');
  assert(bDefault==='memory','B home default scope',bDefault);
  assert(bMemory.some(x=>x.href.startsWith('/2026/01/21/welcome-board/')),'B finds memory-only article',bMemory);
  const bDual=await c.query('讓工具服務心流'); assert(bDual.some(x=>x.href==='/work/flow-friendly-work-system/'),'B finds dual-surface article',bDual);
  const bProfileQuery = await c.query('AI 提問判斷順序');
  assert(!bProfileQuery.some(x=>x.href.startsWith('/learning/ai-question-judgment-order/')),'B excludes profile-only article',bProfileQuery);
  await c.setSurface('all'); const profileOnAll=await c.query('AI 提問判斷順序');
  assert(profileOnAll.some(x=>x.href.startsWith('/learning/ai-question-judgment-order/')),'B all-scope finds profile-only article',profileOnAll);
  await c.clear(); assert(await c.surface()==='memory','B clear restores memory default',await c.surface());

  await c.navigate('/work/flow-friendly-work-system/'); await c.openSearch();
  const articleDefault=await c.surface();
  const articleProfile=await c.query('AI 提問判斷順序');
  const articleMemory=await c.query('System Ready');
  assert(articleDefault==='all','dual article default scope',articleDefault);
  assert(articleProfile.some(x=>x.href.startsWith('/learning/ai-question-judgment-order/')),'article/all finds profile-only',articleProfile);
  assert(articleMemory.some(x=>x.href.startsWith('/2026/01/21/welcome-board/')),'article/all finds memory-only',articleMemory);
  await c.setSurface('profile'); await c.clear(); assert(await c.surface()==='all','article clear restores all default',await c.surface());

  // Real PJAX clicks from A and B routes to the dual article.
  await c.navigate('/profile/');
  const pjaxEvents=[]; await c.eval("window.__qaPjax=[];document.addEventListener('pjax:success',()=>window.__qaPjax.push(location.pathname))");
  await c.eval("(()=>{const a=[...document.querySelectorAll('a[href]')].find(x=>!x.closest('.search-result-container')&&new URL(x.href).pathname==='/work/flow-friendly-work-system/');if(!a)throw Error('profile article link missing');a.click()})()");
  await c.waitFor("location.pathname==='/work/flow-friendly-work-system/' && document.querySelector('.popup-trigger')"); await delay(450);
  let pjaxA=await c.eval("({events:window.__qaPjax,surface:document.querySelector('[data-navigation-filter=surface]')?.value,marker:!!document.querySelector('.post-surface-marker')})");
  assert(pjaxA.events.length>0 && pjaxA.surface==='all' && pjaxA.marker,'PJAX A→article recomputes all scope',pjaxA);
  await c.navigate('/archives/');
  await c.eval("window.__qaPjax=[];document.addEventListener('pjax:success',()=>window.__qaPjax.push(location.pathname))");
  await c.eval("(()=>{const a=[...document.querySelectorAll('a[href]')].find(x=>!x.closest('.search-result-container')&&new URL(x.href).pathname==='/work/flow-friendly-work-system/');if(!a)throw Error('archive article link missing');a.click()})()");
  await c.waitFor("location.pathname==='/work/flow-friendly-work-system/'"); await delay(450);
  const pjaxB=await c.eval("({events:window.__qaPjax,surface:document.querySelector('[data-navigation-filter=surface]')?.value})");
  assert(pjaxB.events.length>0 && pjaxB.surface==='all','PJAX B→article recomputes all scope',pjaxB);

  // Same-URL reload/back restoration and cross-URL isolation.
  await c.navigate('/profile/'); await c.openSearch(); await c.query('AI 提問判斷順序');
  await c.eval("window.dispatchEvent(new Event('pagehide'))");
  await c.send('Page.reload',{ignoreCache:true});
  await c.waitFor("document.readyState==='complete' && document.querySelector('.popup-trigger')"); await delay(800);
  const reloadState=await c.eval("({url:location.pathname,query:document.querySelector('.search-input')?.value,surface:document.querySelector('[data-navigation-filter=surface]')?.value,disabled:document.querySelector('[data-navigation-filter=surface]')?.disabled,open:document.body.classList.contains('search-active'),saved:sessionStorage.getItem('navigation-search-view-state-v1')})");
  assert(reloadState.open && reloadState.query==='AI 提問判斷順序' && reloadState.surface==='profile','same-URL reload restores open search view state',reloadState);
  if (!reloadState.open) { await c.openSearch(); await c.query('AI 提問判斷順序'); }
  await c.eval("document.querySelector('.search-result-title')?.click()");
  await c.waitFor("location.pathname.startsWith('/learning/ai-question-judgment-order/')");
  const history=await c.send('Page.getNavigationHistory');
  await c.send('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex-1].id});
  await c.waitFor("location.pathname==='/profile/' && document.readyState==='complete'"); await delay(800);
  const backState=await c.eval("({url:location.pathname,query:document.querySelector('.search-input')?.value,surface:document.querySelector('[data-navigation-filter=surface]')?.value,disabled:document.querySelector('[data-navigation-filter=surface]')?.disabled,open:document.body.classList.contains('search-active'),saved:sessionStorage.getItem('navigation-search-view-state-v1')})");
  assert(backState.open && backState.query==='AI 提問判斷順序' && backState.surface==='profile','same-URL back restores open search view state',backState);
  await c.navigate('/work/flow-friendly-work-system/'); await c.openSearch();
  const crossState=await c.eval("({query:document.querySelector('.search-input').value,surface:document.querySelector('[data-navigation-filter=surface]').value})");
  assert(crossState.query==='' && crossState.surface==='all','cross-URL search state does not leak',crossState);

  // Recent list respects current scope and category tabs.
  const recentAll=await c.recent();
  await c.setSurface('profile'); const recentA=await c.recent();
  await c.setSurface('memory'); const recentB=await c.recent();
  assert(recentA.every(x=>x.surfaces.split('|').includes('profile')),'recent A contains no memory-only candidates',recentA.map(x=>x.title));
  assert(recentB.every(x=>x.surfaces.split('|').includes('memory')),'recent B contains no profile-only candidates',recentB.map(x=>x.title));
  await c.setSurface('all');
  const tabs=await c.eval("[...document.querySelectorAll('[data-search-category]')].map(x=>({name:x.innerText,selected:x.getAttribute('aria-selected')}))");
  const cats=[...new Set(recentAll.flatMap(x=>x.categories.split('|').filter(Boolean)))];
  assert(tabs.length>=1 && tabs[0].name==='全部' && tabs.every(x=>x.selected==='true'||x.selected==='false'),'recent category tabs retain valid selection state',tabs);
  if(tabs.length>1){ await c.eval("document.querySelectorAll('[data-search-category]')[1].click()"); await delay(50); const cat=await c.recent(); const active=await c.eval("[...document.querySelectorAll('[data-search-category]')].find(x=>x.getAttribute('aria-selected')==='true')?.innerText"); assert(cat.every(x=>x.categories.split('|').includes(active)),'recent category tab filters items', {active,items:cat.map(x=>x.title)}); }

  // Desktop/mobile viewport, keyboard reachability/focus visibility and overflow.
  await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  const desktop=await c.eval("({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth})");
  assert(desktop.scrollWidth<=desktop.innerWidth,'desktop has no horizontal overflow',desktop);
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await delay(250);
  const mobile=await c.eval("({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth})");
  assert(mobile.scrollWidth<=mobile.innerWidth,'390x844 has no horizontal overflow',mobile);
  const pressKey = async (key, code, windowsVirtualKeyCode) => {
    await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode});
    await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
  };
  await c.eval("document.querySelector('.popup-btn-close').click();document.querySelector('.popup-trigger').focus()");
  await pressKey('Enter','Enter',13);
  await c.searchReady();
  await delay(550);
  const focusStart=await c.eval("({active:document.activeElement?.className,visible:document.activeElement?.matches(':focus-visible')})");
  await pressKey('Tab','Tab',9);
  const focusClose=await c.eval("({tag:document.activeElement?.tagName,cls:document.activeElement?.className,visible:document.activeElement?.matches(':focus-visible')})");
  await pressKey('Tab','Tab',9);
  const focusSelect=await c.eval("({tag:document.activeElement?.tagName,filter:document.activeElement?.dataset.navigationFilter,visible:document.activeElement?.matches(':focus-visible'),disabled:document.activeElement?.disabled})");
  assert(focusStart.active==='search-input' && focusStart.visible,'search input receives visible keyboard focus',focusStart);
  assert(focusClose.tag==='BUTTON' && focusClose.cls.includes('popup-btn-close') && focusClose.visible,'search close button is keyboard reachable with visible focus',focusClose);
  assert(focusSelect.tag==='SELECT' && focusSelect.filter==='surface' && focusSelect.visible && !focusSelect.disabled,'scope select is keyboard reachable with visible focus',focusSelect);
  const focusTrace=[];
  for(let i=0;i<8;i++){
    await pressKey('Tab','Tab',9);
    const focused=await c.eval("({tag:document.activeElement?.tagName,cls:document.activeElement?.className,filter:document.activeElement?.dataset.navigationFilter,visible:document.activeElement?.matches(':focus-visible')})");
    focusTrace.push(focused);
    if(focused.cls && focused.cls.includes('search-category-tab')) break;
  }
  const focusResult=focusTrace.at(-1);
  assert(focusResult.tag==='BUTTON' && focusResult.cls.includes('search-category-tab') && focusResult.visible,'recent results remain keyboard reachable with visible focus',focusResult);
  await c.send('Emulation.clearDeviceMetricsOverride');

  await delay(300);
  evidence.samples={recentAll:recentAll.map(x=>x.title),recentA:recentA.map(x=>x.title),recentB:recentB.map(x=>x.title),tabs,consoleErrors};
  assert(consoleErrors.length===0,'browser console warning/error count is zero',consoleErrors);
  fs.writeFileSync(evidencePath, JSON.stringify(evidence,null,2)+'\n');
  await c.send('Page.close').catch(()=>{}); ws.close();
  console.log(JSON.stringify({passed:evidence.checks.length,failed:evidence.failures.length,evidencePath,failures:evidence.failures},null,2));
  process.exitCode=evidence.failures.length?1:0;
})().catch(error=>{ evidence.failures.push({label:'QA runner',detail:error.stack||String(error)}); fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n'); console.error(error.stack||error); process.exitCode=1; });
