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
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try { jsonLd.push(JSON.parse($(element).text())); } catch (error) {
      errors.push(`JSON-LD 格式錯誤：${error.message}`);
    }
  });
  if (options.checkStructuredData) {
    const pagePath = String(from).replace(/\\/g, '/');
    const isRoot = pagePath === 'index.html';
    const isCollection = /^(?:page\/\d+(?:\/|$)|categories\/|tags\/|archives\/)/.test(pagePath);
    const isArticle = $('article.post-content-single').length > 0;
    if (jsonLd.length !== 1) {
      errors.push(`JSON-LD 應恰有一個區塊，目前為 ${jsonLd.length} 個。`);
    } else {
      const data = jsonLd[0];
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`${pagePath} 的 JSON-LD 必須是物件。`);
      } else {
        const canonicalLinks = $('link[rel="canonical"]');
        const canonical = canonicalLinks.length === 1 ? canonicalLinks.attr('href') : null;
        const absoluteHttp = value => {
          if (typeof value !== 'string' || !value.trim()) return null;
          try {
            const parsed = new URL(value);
            return /^https?:$/.test(parsed.protocol) ? parsed : null;
          } catch { return null; }
        };
        const canonicalUrl = absoluteHttp(canonical);
        const dataUrlObject = absoluteHttp(data.url);
        const outputRoute = pagePath === 'index.html'
          ? '/'
          : '/' + pagePath.replace(/\/index\.html$/, '/');
        const outputUrl = new URL(outputRoute, options.origin + '/');
        if (canonicalLinks.length !== 1 || !canonicalUrl) errors.push(`${pagePath} 必須有唯一的絕對 HTTP(S) canonical。`);
        if (canonicalUrl && canonicalUrl.href !== outputUrl.href) errors.push(`${pagePath} 的本站 canonical 應對齊目前頁面：${canonical} ≠ ${outputUrl.href}`);
        if (!dataUrlObject) errors.push(`${pagePath} 的 JSON-LD url 必須是絕對 HTTP(S) 網址。`);
        if (canonicalUrl && dataUrlObject && canonicalUrl.href !== dataUrlObject.href) {
          errors.push(`JSON-LD url 未對齊 canonical：${data.url} ≠ ${canonical}`);
        }
        if (data['@context'] !== 'https://schema.org') errors.push(`${pagePath} 的 JSON-LD @context 不正確。`);
        const type = data['@type'];
        const expectedType = isRoot ? 'WebSite' : (isArticle ? 'BlogPosting' : (isCollection ? 'CollectionPage' : 'WebPage'));
        if (!['WebSite', 'CollectionPage', 'BlogPosting', 'WebPage'].includes(type)) errors.push(`${pagePath} 使用不支援的 JSON-LD 類型：${type || '缺少'}。`);
        if (type !== expectedType) errors.push(`${pagePath} 的 JSON-LD 類型應為 ${expectedType}，目前為 ${type || '缺少'}。`);
        for (const field of ['@id', 'url', 'name', 'inLanguage']) {
          if (typeof data[field] !== 'string' || !data[field].trim()) errors.push(`${pagePath} 的 JSON-LD ${field} 不得為空。`);
        }
        if (dataUrlObject) {
          const idSuffix = {
            WebSite: '#website',
            CollectionPage: '#collectionpage',
            BlogPosting: '#article',
            WebPage: '#webpage'
          }[expectedType];
          if (idSuffix && data['@id'] !== dataUrlObject.href + idSuffix) {
            errors.push(`${pagePath} 的 ${expectedType} @id 應為 canonical+${idSuffix}。`);
          }
        }
        const validIsoDate = value => {
          if (typeof value !== 'string') return false;
          const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
          if (!match || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) return false;
          const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
          return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) && !Number.isNaN(Date.parse(value));
        };
        if (type === 'BlogPosting') {
          if (typeof data.headline !== 'string' || !data.headline.trim()) errors.push(`${pagePath} 的 BlogPosting 缺少 headline。`);
          if (!data.mainEntityOfPage || data.mainEntityOfPage['@id'] !== data.url) errors.push(`${pagePath} 的 mainEntityOfPage 應指向 canonical。`);
          if (!data.isPartOf || data.isPartOf['@id'] !== new URL('/', options.origin + '/').href + '#website') errors.push(`${pagePath} 的 isPartOf 應引用首頁 #website。`);
          const validPerson = value => value && typeof value === 'object' && value['@type'] === 'Person' && typeof value.name === 'string' && value.name.trim();
          if (!validPerson(data.author)) errors.push(`${pagePath} 的 author 應是有名稱的 Person。`);
          if (!validPerson(data.publisher)) errors.push(`${pagePath} 的 publisher 應是有名稱的 Person。`);
          if (options.authorName) {
            if (data.author?.name !== options.authorName) errors.push(`${pagePath} 的 author 未對齊本站作者。`);
            if (data.publisher?.name !== options.authorName) errors.push(`${pagePath} 的 publisher 未對齊本站作者。`);
          }
          if (!validIsoDate(data.datePublished)) errors.push(`${pagePath} 的 datePublished 不是有效 ISO 日期。`);
          if (!validIsoDate(data.dateModified)) errors.push(`${pagePath} 的 dateModified 不是有效 ISO 日期。`);
          if (validIsoDate(data.datePublished) && validIsoDate(data.dateModified) && Date.parse(data.dateModified) < Date.parse(data.datePublished)) errors.push(`${pagePath} 的 dateModified 早於 datePublished。`);
          const article = $('article[itemtype*="BlogPosting"]').filter((_, element) => $(element).hasClass('post-content-single')).first();
          const visibleHeadline = article.find('[itemprop~="headline"]').first().text().replace(/\s+/g, ' ').trim();
          if (!visibleHeadline || typeof data.headline !== 'string' || visibleHeadline !== data.headline.replace(/\s+/g, ' ').trim()) errors.push(`${pagePath} 的 headline 未對齊可見文章標題。`);
          const visibleDate = article.find('[itemprop~="datePublished"]').first().attr('datetime');
          if (!visibleDate || !validIsoDate(visibleDate) || Date.parse(visibleDate) !== Date.parse(data.datePublished)) errors.push(`${pagePath} 的 datePublished 未對齊可見文章日期。`);
          const microdataAuthorElement = article.find('[itemprop="author"] [itemprop="name"]').first();
          const microdataAuthor = microdataAuthorElement.attr('content') || microdataAuthorElement.text().replace(/\s+/g, ' ').trim();
          if (!microdataAuthor || microdataAuthor !== data.author?.name) errors.push(`${pagePath} 的 Microdata author 未對齊 JSON-LD author。`);
          const visibleLanguage = article.attr('lang') || $('html').attr('lang');
          if (visibleLanguage && visibleLanguage !== data.inLanguage) errors.push(`${pagePath} 的 inLanguage 未對齊可見文章語言。`);
          const itemId = article.attr('itemid');
          if (article.attr('itemtype') !== 'https://schema.org/BlogPosting') errors.push(`${pagePath} 的 Microdata type 應為 https://schema.org/BlogPosting。`);
          let resolvedItemId = null;
          try { resolvedItemId = itemId ? new URL(itemId, outputUrl).href : null; } catch {}
          if (!resolvedItemId || resolvedItemId !== data['@id']) errors.push(`${pagePath} 的 Microdata itemid 應對齊 BlogPosting @id。`);
          for (const property of ['author', 'publisher']) {
            const scope = article.find(`[itemprop="${property}"][itemscope]`).first();
            const nameElement = scope.find('[itemprop="name"]').first();
            const name = nameElement.attr('content') || nameElement.text().replace(/\s+/g, ' ').trim();
            if (scope.attr('itemtype') !== 'https://schema.org/Person' || name !== data[property]?.name) {
              errors.push(`${pagePath} 的 Microdata ${property} 應與 JSON-LD Person 對齊。`);
            }
          }
        }
        if (data.image) {
          const images = Array.isArray(data.image) ? data.image : [data.image];
          images.forEach(image => {
            const imageUrl = absoluteHttp(image);
            if (!imageUrl) return errors.push(`${pagePath} 的 image 必須是絕對 HTTP(S) 網址：${image}`);
            if (imageUrl.origin === options.origin) {
              const error = checkUrl(imageUrl.href, 'index.html', options);
              if (error) errors.push(`${pagePath} 的 image：${error}`);
            }
          });
        }
      }
    }
  }
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
  const options = { origin: new URL(config.url).origin, authorName: config.author, files, checkStructuredData: true, ...settings };
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
