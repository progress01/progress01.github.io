const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'source', '_posts');
const imageRoot = path.join(repoRoot, 'source', 'images', 'blogger-import');
const args = process.argv.slice(2);
const feedPathArg = args.find((arg) => arg.startsWith('--feed='));
const feedPath = feedPathArg ? path.resolve(feedPathArg.slice('--feed='.length)) : '';
const shouldWrite = args.includes('--write');

if (!feedPath) {
  console.error('Usage: node tools/restore-blogger-images.js --feed=<feed.json> [--write]');
  process.exit(1);
}

async function main() {
const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
const entries = Array.isArray(feed?.feed?.entry) ? feed.feed.entry : [];

function prop(value) {
  return value && typeof value === 'object' && '$t' in value ? String(value.$t) : String(value || '');
}

function getTitle(entry) {
  return prop(entry.title).trim();
}

function getUrl(entry) {
  const alternate = (entry.link || []).find((link) => link.rel === 'alternate');
  return alternate?.href || '';
}

function getHtml(entry) {
  return prop(entry.content) || prop(entry.summary);
}

function safeSegment(value) {
  return String(value || '')
    .replace(/[<>:"/\\|?*#]/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[. ]+$/g, '')
    .trim() || 'blogger-import';
}

function getImportedFiles() {
  const files = [];
  const walk = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) walk(absolute);
      if (!item.isFile() || !item.name.toLowerCase().endsWith('.md')) continue;
      const raw = fs.readFileSync(absolute, 'utf8');
      const marker = raw.match(/<!-- Blogger 原文：(.*?) -->/);
      if (marker) files.push({ file: absolute, raw, url: marker[1].trim() });
    }
  };
  walk(sourceRoot);
  return files;
}

function resizeUrl(url) {
  // s1600 is a reasonable ceiling for article images and still leaves room for mobile scaling.
  return String(url || '').replace(/\/s\d+\//i, '/s1600/');
}

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
  const children = (node.children || []).map((child) => renderNode(child, $)).join('');
  const inline = children.replace(/[ \t]+\n/g, '\n');

  if (tag === 'br') return '\n';
  if (tag === 'hr') return '\n\n---\n\n';
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `\n\n${'#'.repeat(level)} ${inline.trim()}\n\n`;
  }
  if (tag === 'li') return `\n- ${inline.trim()}\n`;
  if (tag === 'blockquote') {
    const quote = inline.trim().split('\n').map((line) => `> ${line.trim()}`).join('\n');
    return `\n\n${quote}\n\n`;
  }
  if (tag === 'pre') return `\n\n    ${inline.trim().replace(/\n/g, '\n    ')}\n\n`;
  if (tag === 'a') {
    const href = $(node).attr('href');
    const text = inline.trim();
    return href && text ? `[${text}](${href})` : text || href || '';
  }
  if (tag === 'strong' || tag === 'b') return inline.trim() ? `**${inline.trim()}**` : '';
  if (tag === 'em' || tag === 'i') return inline.trim() ? `*${inline.trim()}*` : '';
  if (tag === 'del' || tag === 's') return inline.trim() ? `~~${inline.trim()}~~` : '';
  if (['p', 'div', 'section', 'article', 'header', 'footer', 'center', 'ul', 'ol', 'table', 'tr'].includes(tag)) {
    return `\n\n${inline.trim()}\n\n`;
  }
  if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tag)) return '';
  return inline;
}

function htmlToMarkdownWithMarkers(html) {
  const $ = cheerio.load(`<div id="blogger-import-root">${html}</div>`, { decodeEntities: false });
  const root = $('#blogger-import-root');
  const images = [];
  const imageNodes = root.find('img').toArray();

  imageNodes.forEach((image, index) => {
    const url = chooseImageUrl($, image);
    const width = Number($(image).attr('data-original-width') || $(image).attr('width')) || 0;
    const height = Number($(image).attr('data-original-height') || $(image).attr('height')) || 0;
    const marker = `BLOGGER_IMAGE_${index}`;
    images.push({ marker, url, width, height });

    const container = $(image).closest('.separator');
    const anchor = $(image).closest('a');
    const target = container.length ? container : (anchor.length ? anchor : $(image));
    target.replaceWith(`\n\n${marker}\n\n`);
  });

  root.find('script, style, noscript, iframe, object, embed').remove();
  let markdown = root.contents().toArray().map((node) => renderNode(node, $)).join('');
  markdown = markdown
    .replace(/^\s*https?:\/\/blogger\.googleusercontent\.com\/\S+\s*$/gim, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { markdown, images };
}

function getExtension(contentType, sourceUrl) {
  const type = String(contentType || '').split(';')[0].toLowerCase();
  const byType = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  };
  if (byType[type]) return byType[type];
  const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(extension) ? extension : '.jpg';
}

async function fetchImage(url) {
  const attempts = [url];
  if (/\/s1600\//i.test(url)) {
    attempts.push(url.replace(/\/s1600\//i, '/s1024/'));
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().startsWith('image/')) throw new Error(`not an image: ${contentType}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error('empty response');
      return { buffer, contentType, sourceUrl: attempt };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url}: ${lastError?.message || 'download failed'}`);
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const importedFiles = getImportedFiles();
const fileByUrl = new Map(importedFiles.map((item) => [item.url, item]));
const matched = [];
const skipped = [];

for (const entry of entries) {
  const url = getUrl(entry);
  const file = fileByUrl.get(url);
  if (!file) {
    skipped.push({ title: getTitle(entry), reason: '不是匯入文章或找不到對應檔案' });
    continue;
  }
  const rendered = htmlToMarkdownWithMarkers(getHtml(entry));
  if (rendered.images.some((image) => !image.url)) {
    throw new Error(`找不到圖片網址：${getTitle(entry)}`);
  }
  const folder = `blogger-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}`;
  matched.push({ entry, ...file, title: getTitle(entry), folder, ...rendered });
}

const imageJobs = [];
for (const article of matched) {
  article.images.forEach((image, index) => {
    imageJobs.push({ article, image, index });
  });
}

const downloaded = await mapWithConcurrency(imageJobs, 6, async (job, index) => {
  const result = await fetchImage(job.image.url);
  const extension = getExtension(result.contentType, result.sourceUrl);
  const filename = `${String(job.index + 1).padStart(2, '0')}${extension}`;
  const stagedPath = path.join(repoRoot, 'tmp', 'blogger-image-migration', 'images', job.article.folder, filename);
  return { ...job, ...result, filename, stagedPath, progress: index + 1 };
});

function imageMarkup(image, filename, width, height) {
  const dimensions = width && height ? ` width="${width}" height="${height}"` : '';
  return `<img class="blogger-import-image" loading="lazy" decoding="async"${dimensions} src="/images/blogger-import/${image.article.folder}/${filename}" alt="圖片 ${image.index + 1}">`;
}

if (shouldWrite) {
  for (const item of downloaded) {
    fs.mkdirSync(path.dirname(item.stagedPath), { recursive: true });
    fs.writeFileSync(item.stagedPath, item.buffer);
  }

  for (const article of matched) {
    const articleDownloads = downloaded
      .filter((item) => item.article.file === article.file)
      .sort((left, right) => right.image.marker.length - left.image.marker.length);
    let body = article.markdown;
    for (const item of articleDownloads) {
      body = body.replaceAll(item.image.marker, imageMarkup(item, item.filename, item.image.width, item.image.height));
    }
    const frontMatter = article.raw.match(/^---\r?\n[\s\S]*?\r?\n---/);
    if (!frontMatter) throw new Error(`找不到 frontmatter：${article.file}`);
    const output = `${frontMatter[0].replace(/\r/g, '')}\n\n${body}\n\n<!-- Blogger 原文：${article.url} -->\n`;
    fs.writeFileSync(article.file, output, 'utf8');
  }

  for (const article of matched) {
    const articleDownloads = downloaded.filter((item) => item.article.file === article.file);
    for (const item of articleDownloads) {
      const destination = path.join(imageRoot, article.folder, item.filename);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(item.stagedPath, destination);
    }
  }
}

const byType = downloaded.reduce((result, item) => {
  const type = String(item.contentType).split(';')[0].toLowerCase();
  result[type] = (result[type] || 0) + 1;
  return result;
}, {});

console.log(JSON.stringify({
  mode: shouldWrite ? 'write' : 'preview',
  importedArticles: matched.length,
  imageCount: imageJobs.length,
  skippedArticles: skipped.length,
  downloadedBytes: downloaded.reduce((total, item) => total + item.buffer.length, 0),
  contentTypes: byType,
  articles: matched.map((article) => ({
    title: article.title,
    images: article.images.length,
    folder: `source/images/blogger-import/${article.folder}`,
  })),
}, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
