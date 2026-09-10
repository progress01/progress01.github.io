const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const yaml = require('js-yaml');

// 比對實際檔案清單，連 Windows 上不易發現的大小寫錯誤也能檢出。
function checkUrl(reference, from, { origin, files, externalProjects = [] }) {
  if (!reference || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(reference)) return null;
  let url;
  try {
    url = new URL(reference, new URL(from, origin + '/'));
  } catch {
    return `無效網址：${reference}`;
  }
  if (url.origin !== origin) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return `網址編碼無效：${reference}`;
  }
  if (externalProjects.some(project => pathname === project.path || pathname.startsWith(project.path))) return null;
  const relative = pathname.replace(/^\/+/, '');
  const target = !relative || relative.endsWith('/') ? relative + 'index.html' : relative;
  if (files.has(target) || files.has(target + '/index.html')) return null;
  return `站內目標不存在：${reference} → ${pathname}`;
}

function checkDocument(html, from, options) {
  const $ = cheerio.load(html);
  const errors = [];
  let references = 0;
  $('[href], [src]').each((_, element) => {
    for (const attribute of ['href', 'src']) {
      const reference = $(element).attr(attribute);
      if (!reference) continue;
      references++;
      const error = checkUrl(reference, from, options);
      if (error) errors.push(error);
    }
  });
  $('script[type="application/ld+json"]').each((_, element) => {
    try { JSON.parse($(element).text()); } catch (error) {
      errors.push(`JSON-LD 格式錯誤：${error.message}`);
    }
  });
  const sections = $('[data-photo-wall-section]');
  if (sections.length) {
    const counts = new Map();
    sections.each((_, section) => {
      counts.set($(section).attr('data-photo-wall-section'), $(section).find('.ig-card').length);
    });
    counts.set('all', [...counts.values()].reduce((sum, count) => sum + count, 0));
    counts.forEach((count, category) => {
      const button = $('[data-photo-wall-filter]').filter((_, element) => $(element).attr('data-photo-wall-filter') === category);
      const badge = button.find('span');
      if (button.length !== 1 || badge.length !== 1 || badge.text().trim() !== String(count)) {
        errors.push(`圖牆 ${category} 徽章應為 ${count}，目前為「${badge.text()}」。`);
      }
    });
  }
  const recent = $('[data-search-recent]');
  if (recent.length) {
    const items = recent.find('[data-search-recent-item]');
    const categoryCount = recent.find('[data-search-category]').length;
    if (items.length > categoryCount * 10) errors.push('搜尋近期清單超過各分類最新十篇的上限。');
    if (items.filter((_, item) => !$(item).is('[hidden]')).length > 10) errors.push('搜尋初始畫面顯示超過十篇。');
  }
  return { errors, references };
}

function run() {
  const root = path.resolve(__dirname, '..');
  const config = yaml.load(fs.readFileSync(path.join(root, '_config.yml'), 'utf8'));
  const output = path.resolve(root, config.public_dir || 'public');
  const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'site-check.config.json'), 'utf8'));
  const files = new Set();
  function walk(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else files.add(path.relative(output, filename).split(path.sep).join('/'));
    });
  }
  if (!fs.existsSync(path.join(output, 'index.html'))) throw new Error('找不到首頁產物，請先執行 npm run build。');
  walk(output);
  const options = { origin: new URL(config.url).origin, files, ...settings };
  const errors = new Set();
  let pages = 0;
  let references = 0;
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    pages++;
    const result = checkDocument(fs.readFileSync(path.join(output, file), 'utf8'), file, options);
    references += result.references;
    result.errors.forEach(error => errors.add(`${file}：${error}`));
  }
  // 這些連結由前端建立，不會出現在靜態 HTML 的 href 掃描中。
  for (const file of ['life-index.json', 'reading-desk.json', 'content-categories.json', 'random.json', 'calendar-posts.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(output, file), 'utf8'));
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      Object.entries(value).forEach(([key, item]) => {
        if (key === 'url' && typeof item === 'string') {
          const error = checkUrl(item, 'index.html', options);
          if (error) errors.add(`${file}：${error}`);
        } else visit(item);
      });
    }
    visit(data);
  }
  if (errors.size) {
    console.error('產出網站檢查失敗：\n' + [...errors].map(error => '- ' + error).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`產出網站檢查通過：${pages} 個 HTML、${references} 個 href/src；資料連結、JSON-LD、圖牆計數與搜尋清單通過。`);
  }
}

module.exports = { checkUrl, checkDocument };
if (require.main === module) run();
