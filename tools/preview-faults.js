// 本機驗收用：只讀 public，故障僅套用到 HTTP 回應，不改建置產物。
// node tools/preview-faults.js [normal|animation|search-once] [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'normal';
const port = Number(process.argv[3] || 4003);
const modes = new Set(['normal', 'animation', 'search-once']);
if (!modes.has(mode) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Usage: node tools/preview-faults.js [normal|animation|search-once] [port >= 1024]');
}
const root = path.resolve(__dirname, '../public');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('請先建置網站。');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
let searchFailuresLeft = mode === 'search-once' ? 1 : 0;
http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__fault/anime.js' || (pathname === '/search.xml' && searchFailuresLeft-- > 0)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Intentional local verification failure');
      return;
    }
    let filename = path.resolve(root, '.' + pathname);
    if (filename !== root && !filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    let body = fs.readFileSync(filename);
    if (mode === 'animation' && filename.endsWith('.html')) {
      body = Buffer.from(body.toString('utf8').replace(
        /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/animejs\/[^"']+\/anime\.min\.js/g,
        '/__fault/anime.js'
      ));
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(400).end('Invalid request');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Local verification (${mode}): http://127.0.0.1:${port}/`);
});
