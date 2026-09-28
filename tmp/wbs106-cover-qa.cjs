'use strict';
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const workspace = process.cwd();
const root = path.resolve(workspace, 'public');
const base = 'http://127.0.0.1:8974';
const port = 8974, cdpPort = 9374;
const profile = path.resolve(workspace, 'tmp/wbs106-cover-chrome-profile');
const evidencePath = path.resolve(workspace, 'tmp/wbs106-cover-browser-evidence.json');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let server, chrome, socket;
const issues = [];

function bindable(value) { return new Promise(resolve => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(value, '127.0.0.1', () => s.close(() => resolve(true))); }); }
function staticServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, base).pathname); } catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const searchScript = pathname === '/search.js';
    const target = searchScript ? path.resolve(workspace, 'node_modules/hexo-generator-searchdb/dist/search.js') : path.resolve(root, `.${pathname}`);
    if (!searchScript && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      if (!searchScript && path.extname(target) === '.html') data = Buffer.from(data.toString().replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^>]*>\s*<\/script>/gi, '').replace(/<link\b(?=[^>]*rel=["'](?:stylesheet|preconnect|dns-prefetch)["'])(?=[^>]*href=["']https?:\/\/)[^>]*>/gi, '').replace('</head>', '<script src="/search.js"></script></head>'));
      res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
    });
  });
}
function request(route, method = 'GET') { return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port: cdpPort, path: route, method }, response => { let body = ''; response.setEncoding('utf8'); response.on('data', x => body += x); response.on('end', () => resolve(JSON.parse(body))); }).on('error', reject).end()); }
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (!msg.id) { if (msg.method === 'Runtime.exceptionThrown') issues.push({text:msg.params.exceptionDetails.text, detail:msg.params.exceptionDetails.exception?.description||''}); return; } const item = this.pending.get(msg.id); if (!item) return; clearTimeout(item.timer); this.pending.delete(msg.id); msg.error ? item.reject(new Error(msg.error.message)) : item.resolve(msg.result); }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 10000); this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async evaluate(expression) { const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${result.exceptionDetails.exception?.description || ''}`); return result.result.value; }
}
async function waitFor(cdp, expression) { for (let i=0;i<150;i++) { try { if (await cdp.evaluate(expression)) return; } catch {} await delay(40); } throw new Error(`wait timeout: ${expression}`); }
async function navigate(cdp, route) { await cdp.send('Page.navigate', { url: `${base}${route}` }); await waitFor(cdp, `location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete'`); await delay(180); }
async function clickAndWait(cdp, selector, predicate) { await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`); await waitFor(cdp, predicate); await delay(120); }
async function screenshot(cdp, name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(workspace, 'tmp', `wbs106-${name}.png`), Buffer.from(data, 'base64')); }
async function metrics(cdp, viewport, label) { return cdp.evaluate(`(() => { const rect = selector => { const el=document.querySelector(selector); if(!el)return null; const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; }; const rows=[...document.querySelectorAll('[data-profile-article-row]')]; return {label:${JSON.stringify(label)}, pathname:location.pathname, hash:location.hash, viewport:${JSON.stringify(viewport)}, h1:document.querySelector('h1')?.innerText.trim(), mainHref:document.querySelector('.profile-cover-main a')?.getAttribute('href'), coverLinks:[...document.querySelectorAll('.profile-cover-main a,.profile-cover-secondary a')].map(a=>a.getAttribute('href')), coverCount:document.querySelectorAll('.profile-cover-main,.profile-cover-secondary').length, filters:document.querySelectorAll('[data-profile-tag-filters]').length, rows:rows.length, visibleRows:rows.filter(row=>!row.hidden).length, allText:document.querySelector('.profile-navigation a')?.innerText.trim(), menu:[...document.querySelectorAll('[data-navigation-surface="profile"] a')].map(a=>({text:a.innerText.trim(),href:a.getAttribute('href'),current:a.getAttribute('aria-current')||null})), scrollWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, main:rect('.profile-cover-main'), secondary:rect('.profile-cover-secondary'), archiveList:rect('[data-profile-article-list]')}; })()`); }
async function main() {
  for (const p of [port, cdpPort]) if (!await bindable(p)) throw new Error(`Port already in use: ${p}`);
  server = staticServer(); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  chrome = spawn(chromePath, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking','--disable-extensions',`--user-data-dir=${profile}`,`--remote-debugging-port=${cdpPort}`,'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`${base}/profile/`], {stdio:'ignore',windowsHide:true});
  for (let i=0;i<100;i++) { try { await request('/json/version'); break; } catch { await delay(100); } }
  const target = await request('/json/new?about:blank','PUT'); socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  const cdp = new CDP(socket);
  for (const method of ['Page.enable','Runtime.enable','Log.enable']) await cdp.send(method);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await navigate(cdp,'/profile/');
  const evidence = { date:'2026-09-27', browser:'Chrome headless via CDP', publicRoot:root, ports:{http:port,cdp:cdpPort}, checks:[], screenshots:[], consoleIssues:issues };
  let state = await metrics(cdp,{width:1280,height:900},'desktop-cover');
  if (state.mainHref !== '/work/from-solving-problems-to-choosing-what-matters/' || state.coverCount !== 3 || state.filters !== 0 || state.allText !== '查看全部 9 篇' || state.menu.length !== 2 || state.menu[0].current !== 'page' || state.menu[1].current) throw new Error(`desktop cover assertion: ${JSON.stringify(state)}`);
  evidence.checks.push(state); await screenshot(cdp,'desktop-cover'); evidence.screenshots.push('tmp/wbs106-desktop-cover.png');
  await clickAndWait(cdp,'a[href="/profile/articles/"]',`location.pathname === '/profile/articles/' && document.readyState === 'complete'`);
  state = await metrics(cdp,{width:1280,height:900},'desktop-archive');
  if (state.rows !== 9 || state.filters !== 1 || state.menu[1].current !== 'page' || state.menu[0].current) throw new Error(`archive assertion: ${JSON.stringify(state)}`);
  evidence.checks.push(state);
  await cdp.evaluate('history.back()'); await waitFor(cdp,`location.pathname === '/profile/' && document.readyState === 'complete'`);
  state = await metrics(cdp,{width:1280,height:900},'desktop-back-to-cover');
  if (state.coverCount !== 3 || state.filters || state.menu[0].current !== 'page') throw new Error(`archive back assertion: ${JSON.stringify(state)}`);
  evidence.checks.push(state);
  await clickAndWait(cdp,'a[href="/profile/articles/"]',`location.pathname === '/profile/articles/' && document.readyState === 'complete'`);
  const tag = await cdp.evaluate(`document.querySelector('button[data-profile-tag]')?.dataset.profileTag`);
  if (!tag) throw new Error('archive tag buttons missing');
  await clickAndWait(cdp,`button[data-profile-tag="${tag.replaceAll('"','\\"')}"]`,`location.hash.startsWith('#tag=')`);
  state = await metrics(cdp,{width:1280,height:900},'desktop-filter');
  if (!state.hash.startsWith('#tag=') || state.visibleRows >= 9) throw new Error(`filter assertion: ${JSON.stringify(state)}`);
  evidence.checks.push(state); await screenshot(cdp,'desktop-filter'); evidence.screenshots.push('tmp/wbs106-desktop-filter.png');
  await cdp.evaluate('history.back()'); await waitFor(cdp,`location.hash === ''`);
  await cdp.evaluate(`document.querySelector('button[data-profile-tag="${tag.replaceAll('"','\\"')}"]')?.click()`); await waitFor(cdp,`location.hash.startsWith('#tag=')`);
  await cdp.send('Page.reload'); await waitFor(cdp,`location.pathname === '/profile/articles/' && document.readyState === 'complete' && document.querySelector('[data-profile-tag-filters]:not([hidden])')`);
  state = await metrics(cdp,{width:1280,height:900},'desktop-filter-reload');
  if (state.visibleRows >= 9 || !state.hash.startsWith('#tag=')) throw new Error(`filter reload assertion: ${JSON.stringify(state)}`);
  await clickAndWait(cdp,'.surface-switch-link',`location.pathname === '/' && document.readyState === 'complete'`);
  state = await cdp.evaluate(`({path:location.pathname, aFilters:document.querySelectorAll('[data-profile-tag-filters]').length, nav:document.querySelectorAll('[data-navigation-surface="memory"] > li.menu-item').length, profileCurrent:document.querySelector('[data-navigation-surface="profile"] [aria-current="page"]')?.getAttribute('href')||null})`);
  if (state.path !== '/' || state.aFilters || state.nav < 7) throw new Error(`B output assertion: ${JSON.stringify(state)}`);
  evidence.checks.push({label:'A-to-B',...state});
  await clickAndWait(cdp,'.surface-switch-link',`location.pathname === '/profile/' && document.readyState === 'complete'`);
  state = await cdp.evaluate(`({path:location.pathname, coverCount:document.querySelectorAll('.profile-cover-main,.profile-cover-secondary').length, aFilters:document.querySelectorAll('[data-profile-tag-filters]').length, current:[...document.querySelectorAll('[data-navigation-surface="profile"] a[aria-current="page"]')].map(a=>a.getAttribute('href'))})`);
  if (state.path !== '/profile/' || state.coverCount !== 3 || state.aFilters || JSON.stringify(state.current) !== JSON.stringify(['/profile/'])) throw new Error(`B-to-A output assertion: ${JSON.stringify(state)}`);
  evidence.checks.push({label:'B-to-A',...state});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await navigate(cdp,'/profile/'); state = await metrics(cdp,{width:375,height:812},'mobile-cover');
  if (state.mainHref !== '/work/from-solving-problems-to-choosing-what-matters/' || state.coverCount !== 3 || state.filters || state.allText !== '查看全部 9 篇' || state.scrollWidth > 375 || state.bodyWidth > 375 || state.menu[0].current !== 'page') throw new Error(`mobile cover assertion: ${JSON.stringify(state)}`);
  if (!state.main || !state.secondary || state.main.height <= state.secondary.height || state.main.width < state.secondary.width) throw new Error(`mobile cover hierarchy assertion: ${JSON.stringify(state)}`);
  evidence.checks.push(state); await screenshot(cdp,'mobile-cover'); evidence.screenshots.push('tmp/wbs106-mobile-cover.png');
  await clickAndWait(cdp,'a[href="/profile/articles/"]',`location.pathname === '/profile/articles/' && document.readyState === 'complete'`);
  state = await metrics(cdp,{width:375,height:812},'mobile-archive');
  if (state.rows !== 9 || state.filters !== 1 || state.scrollWidth > 375 || state.bodyWidth > 375 || state.menu[1].current !== 'page') throw new Error(`mobile archive assertion: ${JSON.stringify(state)}`);
  evidence.checks.push(state); await screenshot(cdp,'mobile-archive'); evidence.screenshots.push('tmp/wbs106-mobile-archive.png');
  if (issues.length) throw new Error(`browser console/runtime issues: ${JSON.stringify(issues)}`);
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({checks:evidence.checks.length,screenshots:evidence.screenshots,issues:issues.length,evidencePath}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{
  if(server) server.close();
  if(socket) socket.close();
  if(chrome){ try { const version=await request('/json/version'); const ws=new WebSocket(version.webSocketDebuggerUrl); await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true})); ws.send(JSON.stringify({id:1,method:'Browser.close'})); ws.close(); } catch {} chrome.kill(); await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),delay(2000)]); }
  const prefix=path.resolve(workspace,'tmp')+path.sep;
  if(profile.startsWith(prefix)&&fs.existsSync(profile)) { try { fs.rmSync(profile,{recursive:true,force:true}); } catch {} }
});
