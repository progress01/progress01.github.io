const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'source', '_posts');
const args = process.argv.slice(2);
const feedPathArg = args.find((arg) => arg.startsWith('--feed='));
const feedPath = feedPathArg ? path.resolve(feedPathArg.slice('--feed='.length)) : '';
const shouldWrite = args.includes('--write');

if (!feedPath) {
  console.error('Usage: node tools/import-blogger-missing.js --feed=<feed.json> [--write]');
  process.exit(1);
}

const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
const entries = Array.isArray(feed?.feed?.entry) ? feed.feed.entry : [];

function prop(value) {
  return value && typeof value === 'object' && '$t' in value ? String(value.$t) : String(value || '');
}

function getTitle(entry) {
  return prop(entry.title).trim();
}

function getDate(entry) {
  const raw = prop(entry.published);
  const datePrefix = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (datePrefix) return datePrefix[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getUrl(entry) {
  const alternate = (entry.link || []).find((link) => link.rel === 'alternate');
  return alternate?.href || '';
}

function getHtml(entry) {
  return prop(entry.content) || prop(entry.summary);
}

function normalizeTitle(value) {
  let text = String(value || '').trim().toLowerCase();
  text = text.replace(/^歌曲推薦[-－]/, '');
  text = text.replace(/[（(](?:書籍閱讀紀錄|書籍紀錄|觀影紀錄|影片紀錄|網路小說閱讀紀錄|輕小說閱讀紀錄|閱讀紀錄)(?:[-—－]短)?[）)]$/, '');
  text = text.replace(/[-—－](?:書籍閱讀紀錄|書籍紀錄|觀影紀錄|影片紀錄|網路小說閱讀紀錄|輕小說閱讀紀錄|閱讀紀錄)(?:[-—－]短)?$/, '');
  return text.replace(/[\s「」『』（）()：:，,、！？!?【】［］\[\]—－_\-]/g, '');
}

function readLocalTitles() {
  const titles = [];
  const walk = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) walk(absolute);
      if (!item.isFile() || !item.name.toLowerCase().endsWith('.md')) continue;
      const raw = fs.readFileSync(absolute, 'utf8');
      const match = raw.match(/^title:\s*(?:"((?:\\.|[^"\\])*)"|'([^']*)'|(.+))\s*$/m);
      if (!match) continue;
      let title = match[1] || match[2] || match[3] || '';
      if (match[1]) {
        try { title = JSON.parse(`"${match[1]}"`); } catch (_) { /* keep the raw value */ }
      }
      titles.push({ title: title.trim(), file: absolute, key: normalizeTitle(title) });
    }
  };
  walk(sourceRoot);
  return titles;
}

function isKnownDuplicate(title, localTitles) {
  const key = normalizeTitle(title);
  if (localTitles.some((item) => item.key === key)) return true;

  const aliases = [
    ['歌曲推薦-Plastic Love', /プラスティック[・ ]?ラブ/i],
    ['地獄法官(觀影紀錄)', /來自地獄的法官/],
    ['若草物語(觀影紀錄)', /^若草物語/],
  ];
  const alias = aliases.find(([source]) => source === title);
  return Boolean(alias && localTitles.some((item) => alias[1].test(item.title)));
}

function classify(title) {
  if (/^歌曲推薦[-－]/.test(title)) {
    return { folder: '歌曲推薦', category: '音樂', tags: ['歌曲推薦'] };
  }
  if (/^有工作的/.test(title)) {
    return { folder: '隨筆', category: '生活紀錄', tags: ['工作', '心情'] };
  }
  if (/^台中獨旅記$/.test(title)) {
    return { folder: '隨筆', category: '生活紀錄', tags: ['旅行'] };
  }
  if (/觀影紀錄/.test(title)) {
    return { folder: '閱讀影評', category: '閱讀與影視', tags: ['觀影紀錄'] };
  }
  if (/網路小說/.test(title)) {
    return { folder: '閱讀影評', category: '閱讀與影視', tags: ['網路小說', '閱讀紀錄'] };
  }
  if (/輕小說/.test(title)) {
    return { folder: '閱讀影評', category: '閱讀與影視', tags: ['輕小說', '閱讀紀錄'] };
  }
  return { folder: '閱讀影評', category: '閱讀與影視', tags: ['書籍', '閱讀紀錄'] };
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

function htmlToMarkdown(html) {
  const $ = cheerio.load(`<div id="blogger-import-root">${html}</div>`, { decodeEntities: false });
  const root = $('#blogger-import-root');
  const images = [];
  root.find('img').each((_, image) => {
    const src = $(image).attr('src') || $(image).attr('data-src') || $(image).attr('data-original');
    if (src) images.push(src);
    $(image).remove();
  });
  root.find('script, style, noscript, iframe, object, embed').remove();
  let markdown = root.contents().toArray().map((node) => renderNode(node, $)).join('');
  markdown = markdown
    .replace(/\r/g, '')
    .replace(/^\s*https?:\/\/blogger\.googleusercontent\.com\/\S+\s*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (images.length) {
    const note = images.map((src, index) => `<!-- 圖片待補 ${index + 1}：${src} -->`).join('\n');
    markdown = `${markdown}\n\n${note}`.trim();
  }
  return { markdown, images };
}

function safeStem(title) {
  return title
    .replace(/[<>:"/\\|?*#]/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[. ]+$/g, '')
    .trim() || 'blogger-import';
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

const localTitles = readLocalTitles();
const seenKeys = new Set(localTitles.map((item) => item.key));
const duplicates = [];
const missing = [];

for (const entry of entries) {
  const title = getTitle(entry);
  if (!title) continue;
  if (isKnownDuplicate(title, localTitles)) {
    duplicates.push({ title, date: getDate(entry), reason: '已有或明確同篇' });
    continue;
  }
  const classification = classify(title);
  const date = getDate(entry);
  const rendered = htmlToMarkdown(getHtml(entry));
  let filename = `${safeStem(title)}.md`;
  let target = path.join(sourceRoot, classification.folder, filename);
  if (fs.existsSync(target) || seenKeys.has(normalizeTitle(title))) {
    filename = `${safeStem(title)}-${date}.md`;
    target = path.join(sourceRoot, classification.folder, filename);
  }
  seenKeys.add(normalizeTitle(title));
  missing.push({
    entry,
    title,
    date,
    url: getUrl(entry),
    ...classification,
    ...rendered,
    target,
  });
}

function frontMatter(item) {
  return [
    '---',
    `categories: [${item.category}]`,
    `title: ${yamlString(item.title)}`,
    `date: ${item.date} 12:00:00`,
    `tags: ${JSON.stringify(item.tags)}`,
    '---',
    '',
    item.markdown || '（原文沒有可匯入的文字內容。）',
    '',
    `<!-- Blogger 原文：${item.url} -->`,
    '',
  ].join('\n');
}

if (shouldWrite) {
  for (const item of missing) {
    fs.mkdirSync(path.dirname(item.target), { recursive: true });
    fs.writeFileSync(item.target, frontMatter(item), 'utf8');
  }
}

const counts = missing.reduce((result, item) => {
  result[item.category] = (result[item.category] || 0) + 1;
  return result;
}, {});

console.log(JSON.stringify({
  mode: shouldWrite ? 'write' : 'preview',
  total: entries.length,
  duplicateCount: duplicates.length,
  missingCount: missing.length,
  missingByCategory: counts,
  duplicates,
  missing: missing.map((item) => ({
    date: item.date,
    title: item.title,
    category: item.category,
    imageCount: item.images.length,
    target: path.relative(repoRoot, item.target),
  })),
}, null, 2));
