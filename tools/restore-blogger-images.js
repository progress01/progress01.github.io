const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');

const DEFAULT_ROOT = path.resolve(__dirname, '..');

function usage() {
  return 'Usage: node tools/restore-blogger-images.js --feed=<feed.json> [--post <source/_posts/file.md> ...|--all] [--write [--overwrite-images]]\n' +
    'Without --write and without a scope, preview the whole feed. With --write, a scope is required.\n' +
    'Selected articles are rebuilt from the Blogger feed body; their frontmatter metadata is preserved.';
}

function parseArgs(argv) {
  const options = { posts: [], all: false, write: false, overwriteImages: false, help: false, feed: '' };
  const errors = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (arg === '--write') { options.write = true; continue; }
    if (arg === '--overwrite-images') { options.overwriteImages = true; continue; }
    if (arg === '--all') { options.all = true; continue; }
    if (arg === '--feed') {
      if (!argv[index + 1] || argv[index + 1].startsWith('-')) errors.push('--feed 缺少檔案路徑。');
      else options.feed = argv[++index];
      continue;
    }
    if (arg.startsWith('--feed=')) {
      if (!arg.slice('--feed='.length)) errors.push('--feed 缺少檔案路徑。');
      else options.feed = arg.slice('--feed='.length);
      continue;
    }
    if (arg === '--post') {
      if (!argv[index + 1] || argv[index + 1].startsWith('-')) errors.push('--post 缺少文章路徑。');
      else options.posts.push(argv[++index]);
      continue;
    }
    if (arg.startsWith('--post=')) {
      if (!arg.slice('--post='.length)) errors.push('--post 缺少文章路徑。');
      else options.posts.push(arg.slice('--post='.length));
      continue;
    }
    errors.push(`未知參數：${arg}`);
  }
  if (!options.feed && !options.help) errors.push('必須指定 --feed。');
  if (options.all && options.posts.length) errors.push('--all 與 --post 不能同時使用。');
  if (options.write && !options.all && !options.posts.length) errors.push('--write 必須搭配 --all 或至少一個 --post。');
  if (options.overwriteImages && !options.write) errors.push('--overwrite-images 必須搭配 --write。');
  if (errors.length) { const error = new Error(errors.join('\n')); error.usage = usage(); throw error; }
  return options;
}

function prop(value) { return value && typeof value === 'object' && '$t' in value ? String(value.$t) : String(value || ''); }
function getTitle(entry) { return prop(entry?.title).trim(); }
function getUrl(entry) { return (entry?.link || []).find(link => link.rel === 'alternate')?.href || ''; }
function getHtml(entry) { return prop(entry?.content) || prop(entry?.summary); }
function safeSegment(value) { return String(value || '').replace(/[<>:"/\\|?*#]/g, '-').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/[. ]+$/g, '').trim() || 'blogger-import'; }

function markerInfo(raw) {
  const match = raw.match(/<!--\s*Blogger 原文\s*[:：]\s*(.*?)\s*-->/);
  return match ? { url: match[1].trim(), text: match[0], marker: match[0] } : null;
}

function getImportedFiles(root) {
  const sourceRoot = path.join(root, 'source', '_posts');
  const files = [];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) {
        const raw = fs.readFileSync(absolute, 'utf8');
        const marker = markerInfo(raw);
        if (marker) files.push({ file: absolute, raw, ...marker });
      }
    }
  }
  walk(sourceRoot);
  return files;
}

function getImportedFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const marker = markerInfo(raw);
  if (!marker) throw new Error(`選定文章不是 Blogger 匯入文章：${file}`);
  return { file, raw, ...marker };
}

function resolveSelectedPost(input, root) {
  const postsRoot = fs.realpathSync(path.join(root, 'source', '_posts'));
  const candidate = path.resolve(root, input);
  if (path.extname(candidate).toLowerCase() !== '.md') throw new Error(`--post 必須指向 .md 文章：${input}`);
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) throw new Error(`--post 文章不存在：${input}`);
  const real = fs.realpathSync(candidate);
  if (real !== postsRoot && !real.startsWith(postsRoot + path.sep)) throw new Error(`--post 超出 source/_posts：${input}`);
  if (fs.lstatSync(candidate).isSymbolicLink()) throw new Error(`--post 不接受 symbolic link：${input}`);
  return real;
}

function resizeUrl(url) { return String(url || '').replace(/\/s\d+\//i, '/s1600/'); }
function chooseImageUrl($, image) {
  const imgUrl = $(image).attr('src') || $(image).attr('data-src') || $(image).attr('data-original');
  const linkUrl = $(image).closest('a').attr('href');
  const candidate = linkUrl && /blogger\.googleusercontent\.com/i.test(linkUrl) ? linkUrl : imgUrl;
  return candidate ? resizeUrl(candidate) : '';
}

function renderNode(node, $) {
  if (node.type === 'text') return (node.data || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  if (node.type !== 'tag') return '';
  const tag = String(node.name || '').toLowerCase();
  const children = (node.children || []).map(child => renderNode(child, $)).join('');
  const inline = children.replace(/[ \t]+\n/g, '\n');
  if (tag === 'br') return '\n';
  if (tag === 'hr') return '\n\n---\n\n';
  if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag.slice(1)))} ${inline.trim()}\n\n`;
  if (tag === 'li') return `\n- ${inline.trim()}\n`;
  if (tag === 'blockquote') return `\n\n${inline.trim().split('\n').map(line => `> ${line.trim()}`).join('\n')}\n\n`;
  if (tag === 'pre') return `\n\n    ${inline.trim().replace(/\n/g, '\n    ')}\n\n`;
  if (tag === 'a') { const href = $(node).attr('href'); const text = inline.trim(); return href && text ? `[${text}](${href})` : text || href || ''; }
  if (tag === 'strong' || tag === 'b') return inline.trim() ? `**${inline.trim()}**` : '';
  if (tag === 'em' || tag === 'i') return inline.trim() ? `*${inline.trim()}*` : '';
  if (tag === 'del' || tag === 's') return inline.trim() ? `~~${inline.trim()}~~` : '';
  if (['p', 'div', 'section', 'article', 'header', 'footer', 'center', 'ul', 'ol', 'table', 'tr'].includes(tag)) return `\n\n${inline.trim()}\n\n`;
  if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tag)) return '';
  return inline;
}

function htmlToMarkdownWithMarkers(html) {
  const $ = cheerio.load(`<div id="blogger-import-root">${html}</div>`, { decodeEntities: false });
  const root = $('#blogger-import-root'); const images = [];
  root.find('img').toArray().forEach((image, index) => {
    const url = chooseImageUrl($, image);
    const width = Number($(image).attr('data-original-width') || $(image).attr('width')) || 0;
    const height = Number($(image).attr('data-original-height') || $(image).attr('height')) || 0;
    const marker = `BLOGGER_IMAGE_${index}`; images.push({ marker, url, width, height });
    const container = $(image).closest('.separator'); const anchor = $(image).closest('a');
    (container.length ? container : anchor.length ? anchor : $(image)).replaceWith(`\n\n${marker}\n\n`);
  });
  root.find('script, style, noscript, iframe, object, embed').remove();
  let markdown = root.contents().toArray().map(node => renderNode(node, $)).join('');
  markdown = markdown.replace(/^\s*https?:\/\/blogger\.googleusercontent\.com\/\S+\s*$/gim, '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { markdown, images };
}

function getExtension(contentType, sourceUrl) {
  const type = String(contentType || '').split(';')[0].toLowerCase();
  const byType = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
  if (byType[type]) return byType[type];
  const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(extension) ? extension : '.jpg';
}

async function fetchImage(url, fetchImpl = globalThis.fetch) {
  const attempts = [url]; if (/\/s1600\//i.test(url)) attempts.push(url.replace(/\/s1600\//i, '/s1024/'));
  let lastError;
  for (const attempt of attempts) {
    try {
      const response = await fetchImpl(attempt, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().startsWith('image/')) throw new Error(`not an image: ${contentType}`);
      const buffer = Buffer.from(await response.arrayBuffer()); if (!buffer.length) throw new Error('empty response');
      return { buffer, contentType, sourceUrl: attempt };
    } catch (error) { lastError = error; }
  }
  throw new Error(`${url}: ${lastError?.message || 'download failed'}`);
}

function imageMarkup(article, image, filename) {
  const dimensions = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
  return `<img class="blogger-import-image" loading="lazy" decoding="async"${dimensions} src="/images/blogger-import/${article.folder}/${filename}" alt="圖片 ${image.index + 1}">`;
}

function assertInside(target, root, label) {
  const rootResolved = path.resolve(root); const targetResolved = path.resolve(target);
  if (targetResolved !== rootResolved && !targetResolved.startsWith(rootResolved + path.sep)) throw new Error(`${label} 超出允許路徑：${target}`);
}

function assertRealpathInsideExistingAncestor(target, repoRoot, label) {
  const rootPath = path.resolve(repoRoot);
  assertInside(target, rootPath, label);
  if (!fs.existsSync(rootPath)) throw new Error(`${label} 的 repo root 不存在：${rootPath}`);
  const rootReal = fs.realpathSync(rootPath);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(rootReal) !== normalize(rootPath)) throw new Error(`${label} 的 repo root 不得是 symbolic link 或 junction：${rootPath}`);
  let current = rootPath;
  const relative = path.relative(rootPath, path.resolve(target));
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    const currentReal = fs.realpathSync(current);
    if (normalize(currentReal) !== normalize(rootReal) && !normalize(currentReal).startsWith(`${normalize(rootReal)}${path.sep}`)) {
      throw new Error(`${label} 的既有父路徑超出 repo root：${current}`);
    }
  }
}

function readFeed(feedPath, root) {
  const resolved = path.isAbsolute(feedPath) ? feedPath : path.resolve(root, feedPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error(`feed 檔案不存在：${feedPath}`);
  let feed; try { feed = JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (error) { throw new Error(`feed 不是有效 JSON：${error.message}`); }
  if (!Array.isArray(feed?.feed?.entry)) throw new Error('feed.feed.entry 必須是陣列。');
  return feed;
}

function selectArticles(feed, importedFiles, options, root) {
  let selectedFiles;
  if (options.posts.length) selectedFiles = options.posts.map(post => resolveSelectedPost(post, root));
  else if (options.all) selectedFiles = importedFiles.map(item => item.file);
  else selectedFiles = importedFiles.map(item => item.file);
  const selectedSet = new Set(selectedFiles);
  const relevantFiles = importedFiles.filter(file => selectedSet.has(file.file));
  const byUrl = new Map();
  relevantFiles.forEach(file => { if (byUrl.has(file.url)) throw new Error(`文章 marker URL 重複：${file.url}`); byUrl.set(file.url, file); });
  const relevantUrls = new Set(relevantFiles.map(file => file.url));
  const entriesByUrl = new Map();
  feed.feed.entry.forEach(entry => {
    const url = getUrl(entry);
    if (!relevantUrls.has(url)) return;
    if (entriesByUrl.has(url)) throw new Error(`feed URL 重複，無法判定選用內容：${url}`);
    entriesByUrl.set(url, entry);
  });
  const matched = [];
  for (const file of relevantFiles) {
    const entry = entriesByUrl.get(file.url);
    if (!entry) throw new Error(`選定文章在 feed 找不到對應資料：${file.file}`);
    const rendered = htmlToMarkdownWithMarkers(getHtml(entry));
    if (rendered.images.some(image => !image.url)) throw new Error(`找不到圖片網址：${getTitle(entry)}`);
    matched.push({ entry, ...file, title: getTitle(entry), folder: `blogger-${crypto.createHash('sha1').update(file.url).digest('hex').slice(0, 10)}`, ...rendered });
  }
  if (options.posts.length) {
    const matchedSet = new Set(matched.map(item => item.file));
    selectedFiles.forEach(file => { if (!matchedSet.has(file)) throw new Error(`選定文章不是 Blogger 匯入文章：${file}`); });
  }
  if (!matched.length) throw new Error('沒有找到可預覽的 Blogger 匯入文章。');
  return matched;
}

function preflightArticles(articles, root, overwriteImages) {
  const sourcePosts = fs.realpathSync(path.join(root, 'source', '_posts'));
  const imageRoot = path.resolve(root, 'source', 'images', 'blogger-import');
  const jobs = [];
  articles.forEach(article => {
    if (!article.marker || !article.url) throw new Error(`找不到 Blogger 原文 marker：${article.file}`);
    if (!/^---\r?\n[\s\S]*?\r?\n---/.test(article.raw)) throw new Error(`找不到 frontmatter：${article.file}`);
    if (article.file !== sourcePosts && !article.file.startsWith(sourcePosts + path.sep)) throw new Error(`文章輸出路徑不安全：${article.file}`);
    article.images.forEach((image, index) => {
      let parsed; try { parsed = new URL(image.url); } catch (error) { throw new Error(`圖片網址無效：${image.url}`); }
      if (!/^https?:$/.test(parsed.protocol)) throw new Error(`圖片網址必須是 HTTP(S)：${image.url}`);
      jobs.push({ article, image: { ...image, index }, index, sourceUrl: image.url });
    });
  });
  return { jobs, imageRoot, overwriteImages };
}

function writeIfChanged(file, data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buffer)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buffer); return true;
}

async function run(options, runtime = {}) {
  const root = path.resolve(runtime.root || DEFAULT_ROOT); const feed = runtime.feed || readFeed(options.feed, root);
  const importedFiles = runtime.importedFiles || (options.posts.length ? options.posts.map(post => getImportedFile(resolveSelectedPost(post, root))) : getImportedFiles(root));
  const articles = selectArticles(feed, importedFiles, options, root);
  const preflight = preflightArticles(articles, root, options.overwriteImages);
  const summary = { mode: options.write ? 'write' : 'preview', selected: articles.map(article => ({ file: path.relative(root, article.file), title: article.title, imageCount: article.images.length, urls: article.images.map(image => image.url) })), imageCount: preflight.jobs.length, fetchCount: 0 };
  if (!options.write) return summary;
  const fetchImpl = runtime.fetch || globalThis.fetch;
  const downloaded = [];
  for (const job of preflight.jobs) downloaded.push({ ...job, ...(await fetchImage(job.sourceUrl, fetchImpl)) });
  summary.fetchCount = downloaded.length;
  const outputs = []; const articleOutputs = [];
  for (const item of downloaded) {
    const filename = `${String(item.index + 1).padStart(2, '0')}${getExtension(item.contentType, item.sourceUrl)}`;
    const destination = path.join(preflight.imageRoot, item.article.folder, filename); assertRealpathInsideExistingAncestor(destination, root, '圖片輸出路徑');
    if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error(`圖片輸出是 symbolic link，拒絕覆寫：${destination}`);
    if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(item.buffer) && !options.overwriteImages) throw new Error(`圖片已存在且內容不同，請使用 --overwrite-images：${destination}`);
    outputs.push({ ...item, filename, destination });
  }
  for (const article of articles) {
    const newline = article.raw.includes('\r\n') ? '\r\n' : '\n';
    const frontMatter = article.raw.match(/^---\r?\n[\s\S]*?\r?\n---/);
    let body = article.markdown;
    outputs.filter(item => item.article.file === article.file).sort((left, right) => right.image.marker.length - left.image.marker.length).forEach(item => { body = body.replaceAll(item.image.marker, imageMarkup(article, item.image, item.filename)); });
    const output = `${frontMatter[0].replace(/\r?\n/g, newline)}${newline}${newline}${body.replace(/\r?\n/g, newline)}${newline}${newline}${article.marker}${newline}`;
    articleOutputs.push({ article, output });
  }
  const writtenImages = outputs.reduce((count, item) => count + (writeIfChanged(item.destination, item.buffer) ? 1 : 0), 0);
  const writtenArticles = articleOutputs.reduce((count, item) => count + (writeIfChanged(item.article.file, item.output) ? 1 : 0), 0);
  return { ...summary, writtenImages, writtenArticles };
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try { options = parseArgs(argv); } catch (error) { console.error(error.message); console.error(error.usage || usage()); process.exitCode = 1; return; }
  if (options.help) { console.log(usage()); return; }
  try { console.log(JSON.stringify(await run(options), null, 2)); }
  catch (error) { console.error(error.stack || error.message || error); process.exitCode = 1; }
}

if (require.main === module) main();

module.exports = { usage, parseArgs, prop, getTitle, getUrl, getHtml, markerInfo, getImportedFiles, getImportedFile, resolveSelectedPost, resizeUrl, chooseImageUrl, htmlToMarkdownWithMarkers, getExtension, fetchImage, readFeed, selectArticles, preflightArticles, assertRealpathInsideExistingAncestor, writeIfChanged, run, main };
