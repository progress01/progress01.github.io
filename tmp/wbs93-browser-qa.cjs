'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve('tmp/wbs93-public-20260927');
const profile = path.resolve('tmp/wbs93-chrome-profile');
const evidencePath = path.resolve('tmp/wbs93-browser-evidence.json');
const screenshots = {
  desktop: path.resolve('tmp/wbs93-desktop-focus.png'),
  mobile: path.resolve('tmp/wbs93-mobile-focus.png')
};
const httpPort = 8923;
const cdpPort = 9363;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const errors = [];
let server;
let chrome;

function safeTmp(file) {
  const tmpRoot = path.resolve('tmp') + path.sep;
  if (!file.startsWith(tmpRoot)) throw new Error(`Unsafe QA output path: ${file}`);
}
function request(port, route, method = 'GET') {
  return new Promise((resolve, reject) => http.request({ hostname: '127.0.0.1', port, path: route, method }, response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
    response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  }).on('error', reject).end());
}
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
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
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
function canBind(port) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}
async function waitUntil(cdp, expression, timeout = 9000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await cdp.evaluate(expression)) return; } catch {}
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
class CDP {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown') errors.push({ type: 'exception', message: message.params.exceptionDetails.text });
        if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) errors.push({ type: message.params.type, message: message.params.args.map(arg => arg.value || arg.description || '').join(' ') });
        if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) errors.push({ type: message.params.entry.level, message: message.params.entry.text });
        if (message.method === 'Fetch.requestPaused') {
          const { requestId, request: intercepted, resourceType } = message.params;
          const local = intercepted.url.startsWith(`http://127.0.0.1:${httpPort}/`);
          const command = local ? this.send('Fetch.continueRequest', { requestId }) : this.send('Fetch.fulfillRequest', {
            requestId, responseCode: 200,
            responseHeaders: [{ name: 'content-type', value: resourceType === 'Stylesheet' ? 'text/css' : 'application/javascript' }, { name: 'access-control-allow-origin', value: '*' }],
            body: Buffer.from('').toString('base64')
          });
          command.catch(() => {});
        }
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
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
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
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const cdp = new CDP(socket);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Network.enable'); await cdp.send('Accessibility.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 500 });
  return { cdp, socket };
}
async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}${route}` });
  const expected = new URL(route, `http://127.0.0.1:${httpPort}`).pathname;
  await waitUntil(cdp, `location.pathname === ${JSON.stringify(expected)} && document.readyState === "complete"`);
  await delay(80);
}
async function key(cdp, name, code, keyCode) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
  await delay(30);
}
async function tabTo(cdp, selector, max = 90) {
  const sequence = [];
  for (let i = 0; i < max; i += 1) {
    await key(cdp, 'Tab', 'Tab', 9);
    const state = await cdp.evaluate(`(() => { const e=document.activeElement; const s=getComputedStyle(e); return {tag:e.tagName, text:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,90), href:e.href||'', className:String(e.className||''), matches:e.matches(${JSON.stringify(selector)}), outline:s.outlineStyle+' '+s.outlineWidth+' '+s.outlineColor, rect:(()=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()}; })()`);
    sequence.push(state);
    if (state.matches) return { sequence, focus: state };
  }
  throw new Error(`Keyboard Tab did not reach ${selector}`);
}
async function focusTarget(cdp, selector, viewport, route = '/') {
  await navigate(cdp, route);
  await key(cdp, 'Tab', 'Tab', 9);
  const first = await cdp.evaluate(`(() => {const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();return {className:e.className,text:e.innerText,href:e.getAttribute('href'),outline:s.outlineStyle+' '+s.outlineWidth+' '+s.outlineColor,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`);
  if (!String(first.className).includes('skip-link')) throw new Error(`First Tab did not focus skip link: ${JSON.stringify(first)}`);
  if (viewport.name === 'desktop' || viewport.name === 'mobile') {
    const shot = await cdp.send('Page.captureScreenshot', { captureBeyondViewport: false });
    fs.writeFileSync(screenshots[viewport.name], Buffer.from(shot.data, 'base64'));
  }
  await key(cdp, 'Enter', 'Enter', 13);
  await waitUntil(cdp, 'location.hash === "#main-content"');
  const entered = await cdp.evaluate(`({activeId:document.activeElement.id,hash:location.hash})`);
  const next = await tabTo(cdp, selector);
  return { first, afterSkip: entered, ...next };
}
async function axSnapshot(cdp, route, viewport) {
  const result = await cdp.send('Accessibility.getFullAXTree');
  const nodes = result.nodes.map(node => ({
    role: node.role?.value || '', name: node.name?.value || '', level: node.properties?.find(property => property.name === 'level')?.value?.value || null,
    ignored: node.ignored
  })).filter(node => !node.ignored && (['main', 'navigation', 'heading', 'link', 'button', 'complementary', 'banner', 'contentinfo'].includes(node.role)));
  return { viewport, route, orderedCoreNodes: nodes.slice(0, 120), headingCount: nodes.filter(node => node.role === 'heading').length, mainCount: nodes.filter(node => node.role === 'main').length };
}
async function pageMetrics(cdp) {
  return cdp.evaluate(`(() => {
    const root=document.documentElement, parse=c=>{const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const v=m[1].split(',').map(x=>parseFloat(x.trim()));return v.length>3&&v[3]===0?null:v.slice(0,3)};
    const lum=c=>{const x=c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*x[0]+.7152*x[1]+.0722*x[2]};
    const bg=e=>{for(let n=e;n&&n!==document;n=n.parentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c)return c}return [255,255,255]};
    const contrast=(f,b)=>{if(!f||!b)return null;const a=lum(f),z=lum(b);return Number(((Math.max(a,z)+.05)/(Math.min(a,z)+.05)).toFixed(2))};
    const sels=['.surface-switch-link','.home-profile-bridge a','.home-profile-bridge h2','.home-profile-bridge p','.home-profile-bridge-label','.profile-home-header h1','.profile-path h2','.profile-article-link h3','.profile-article-link time','.profile-navigation a','.post-surface-marker','.post-thinking-status h2','.post-thinking-status p'];
    const samples=[];for(const sel of sels){for(const e of document.querySelectorAll(sel)){const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height)continue;const color=parse(s.color),back=bg(e),size=parseFloat(s.fontSize),large=size>=24||(size>=18.66&&parseInt(s.fontWeight)>=700);samples.push({selector:sel,text:(e.innerText||'').trim().slice(0,70),fontSize:size,fontWeight:s.fontWeight,ratio:contrast(color,back),required:large?3:4.5,passes:(contrast(color,back)||0)>=(large?3:4.5),fg:s.color,bg:'rgb('+back.join(', ')+')'})}}
    const boxes={};for(const sel of ['.surface-switch-link','.home-profile-bridge a','.profile-article-link']){const e=document.querySelector(sel);if(e){const r=e.getBoundingClientRect();boxes[sel]={width:r.width,height:r.height,passes:r.width>=44&&r.height>=44}}}
    const refs=[];for(const e of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]'))for(const name of ['aria-labelledby','aria-describedby','aria-controls'])for(const id of (e.getAttribute(name)||'').split(/\\s+/).filter(Boolean))if(!document.getElementById(id))refs.push({name,id});
    return {pathname:location.pathname,viewport:innerWidth,scrollWidth:root.scrollWidth,bodyScrollWidth:document.body.scrollWidth,overflow:root.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth,duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,all)=>all.indexOf(id)!==i),invalidAriaRefs:refs,boxes,contrast:samples,roleButtons:[...document.querySelectorAll('[role=button]')].map(e=>{const name=e.getAttribute('aria-label')||e.innerText||'';const tabindex=e.getAttribute('tabindex');return {name,tabindex,passes:Boolean(name.trim())&&tabindex==='0'}})};
  })()`);
}
async function findArticle() {
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { const found = walk(file); if (found) return found; }
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        const html = fs.readFileSync(file, 'utf8');
        if (html.includes('post-surface-marker') && html.includes('post-content-single')) return `/${path.relative(root, file).split(path.sep).join('/').replace(/index\.html$/, '')}`;
      }
    }
    return null;
  };
  return walk(root);
}

(async () => {
  safeTmp(profile); safeTmp(evidencePath); Object.values(screenshots).forEach(safeTmp);
  for (const port of [httpPort, cdpPort]) if (!(await canBind(port))) throw new Error(`Port ${port} is already in use`);
  if (!fs.existsSync(root)) throw new Error(`Missing isolated build ${root}`);
  server = staticServer(); await new Promise(resolve => server.listen(httpPort, '127.0.0.1', resolve));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `http://127.0.0.1:${httpPort}/`], { stdio: 'ignore', windowsHide: true });
  let ready = false;
  for (let i = 0; i < 100; i += 1) { try { await request(cdpPort, '/json/version'); ready = true; break; } catch { await delay(100); } }
  if (!ready) throw new Error('Chrome CDP not ready');
  const evidence = { viewports: { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } }, routes: [], keyboard: [], reducedMotion: [], noJs: [], screenshots: Object.values(screenshots), console: errors };
  const articleRoute = await findArticle();
  if (!articleRoute) throw new Error('Could not locate a generated ordinary article');
  const articlePathname = new URL(articleRoute, `http://127.0.0.1:${httpPort}`).pathname;
  evidence.articleRoute = articleRoute;
  for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const { cdp, socket } = await newPage(viewport);
    for (const route of ['/', '/profile/', '/profile/articles/', articleRoute]) {
      await navigate(cdp, route);
      evidence.routes.push({ ...(await pageMetrics(cdp)), ax: await axSnapshot(cdp, route, viewport.name) });
    }
    if (viewport.name === 'desktop') {
      const switchFlow = await focusTarget(cdp, '.surface-switch-link', viewport);
      evidence.keyboard.push({ flow: 'skip-to-surface-switch', ...switchFlow });
      await key(cdp, 'Enter', 'Enter', 13); await waitUntil(cdp, 'location.pathname === "/profile/"');
      evidence.keyboard.push({ flow: 'surface-switch-enter', destination: await cdp.evaluate('location.pathname') });
      const card = await focusTarget(cdp, '.profile-article-link', viewport, '/profile/');
      evidence.keyboard.push({ flow: 'skip-to-profile-card', ...card });
      const cardHref = card.focus.href;
      await key(cdp, 'Enter', 'Enter', 13); await waitUntil(cdp, `location.href === ${JSON.stringify(cardHref)}`);
      evidence.keyboard.push({ flow: 'profile-card-enter', destination: await cdp.evaluate('location.pathname') });
      const bridge = await focusTarget(cdp, '.home-profile-bridge a', viewport);
      evidence.keyboard.push({ flow: 'skip-to-home-bridge', ...bridge });
      await key(cdp, 'Enter', 'Enter', 13); await waitUntil(cdp, 'location.pathname === "/profile/"');
      evidence.keyboard.push({ flow: 'home-bridge-enter', destination: await cdp.evaluate('location.pathname') });
    } else {
      await navigate(cdp, '/'); await key(cdp, 'Tab', 'Tab', 9);
      const skip = await cdp.evaluate("({className:document.activeElement.className,text:document.activeElement.innerText,outline:getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth+' '+getComputedStyle(document.activeElement).outlineColor})");
      if (skip.className !== 'skip-link') throw new Error(`Mobile first Tab did not focus skip link: ${JSON.stringify(skip)}`);
      const shot = await cdp.send('Page.captureScreenshot', { captureBeyondViewport: false });
      fs.writeFileSync(screenshots.mobile, Buffer.from(shot.data, 'base64'));
      evidence.keyboard.push({ flow: 'mobile-first-tab-skip', ...skip });
    }
    await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  {
    const { cdp, socket } = await newPage({ width: 390, height: 844 });
    await navigate(cdp, '/');
    evidence.roleButtonKeyboard = [];
    await cdp.evaluate("(() => {const e=document.querySelector('.site-nav-toggle .toggle');window.__buttonClicks=0;e.addEventListener('click',()=>window.__buttonClicks++);})()");
    for (const keyName of ['Enter', ' ']) {
      await cdp.evaluate("document.querySelector('.site-nav-toggle .toggle').focus()");
      const previousClicks = await cdp.evaluate('window.__buttonClicks');
      await key(cdp, keyName, keyName === ' ' ? 'Space' : 'Enter', keyName === ' ' ? 32 : 13);
      evidence.roleButtonKeyboard.push(await cdp.evaluate(`(() => {const e=document.querySelector('.site-nav-toggle .toggle');return {key:${JSON.stringify(keyName)},name:e.getAttribute('aria-label'),tabindex:e.getAttribute('tabindex'),clickCount:window.__buttonClicks-${previousClicks},navOpen:document.body.classList.contains('site-nav-on'),outline:getComputedStyle(e).outlineStyle+' '+getComputedStyle(e).outlineWidth+' '+getComputedStyle(e).outlineColor};})()`));
    }
    await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  {
    const { cdp, socket } = await newPage(evidence.viewports.desktop);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const switchFlow = await focusTarget(cdp, '.surface-switch-link', evidence.viewports.desktop);
    await key(cdp, 'Enter', 'Enter', 13); await waitUntil(cdp, 'location.pathname === "/profile/"');
    evidence.reducedMotion.push({ flow: switchFlow.sequence.map(node => node.className), result: await cdp.evaluate(`({pathname:location.pathname,className:document.querySelector('.main-inner').className,intent:sessionStorage.getItem('surface-transition-intent'),animation:getComputedStyle(document.querySelector('.main-inner')).animationDuration,transition:getComputedStyle(document.querySelector('.main-inner')).transitionDuration,transform:getComputedStyle(document.querySelector('.main-inner')).transform})`) });
    await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  {
    const { cdp, socket } = await newPage(evidence.viewports.desktop);
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: true }); await navigate(cdp, '/');
    await key(cdp, 'Tab', 'Tab', 9);
    const focusedSkip = await cdp.evaluate('document.activeElement.className');
    await key(cdp, 'Enter', 'Enter', 13); await waitUntil(cdp, 'location.hash === "#main-content"');
    await tabTo(cdp, '.surface-switch-link'); await key(cdp, 'Enter', 'Enter', 13); await waitUntil(cdp, 'location.pathname === "/profile/"');
    evidence.noJs.push({ focusedSkip, destination: await cdp.evaluate('location.pathname'), intent: await cdp.evaluate('sessionStorage.getItem("surface-transition-intent")') });
    await cdp.send('Page.close').catch(() => {}); socket.close();
  }
  evidence.consoleCount = errors.length;
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  if (errors.length) throw new Error(`Browser console diagnostics: ${JSON.stringify(errors)}`);
  if (evidence.routes.some(route => route.overflow || route.ax.mainCount !== 1 || route.duplicateIds.length || route.invalidAriaRefs.length || route.contrast.some(sample => !sample.passes) || Object.values(route.boxes).some(box => !box.passes) || route.roleButtons.some(button => !button.passes))) throw new Error('Browser metrics found overflow, landmark/name/target, duplicate ID, ARIA, or contrast failures');
  console.log(`Browser QA passed: ${evidence.routes.length} route/viewports; article ${articleRoute}; keyboard flows ${evidence.keyboard.length}; console ${errors.length}; evidence ${evidencePath}`);
})().catch(error => {
  console.error(error.stack || error); process.exitCode = 1;
}).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (chrome && !chrome.killed) { chrome.kill(); await new Promise(resolve => chrome.once('exit', resolve)); }
  const tmpRoot = path.resolve('tmp') + path.sep;
  if (profile.startsWith(tmpRoot) && fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true });
});
