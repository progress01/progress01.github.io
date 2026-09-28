const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const moment = require('moment-timezone');
const { loadTaxonomy } = require('../scripts/tag-taxonomy');
const { normalizeSurfaces, isSurfaceSubset } = require('./lib/content-surfaces');
const { resolveThinkingStatus } = require('./lib/thinking-status');

const LEGACY_SURFACE_MANIFEST = 'tools/data/legacy-surfaces.v1.json';
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const POST_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:(?:[ T])(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function readYaml(text, label) {
  try { return { value: yaml.load(text, { schema: yaml.FAILSAFE_SCHEMA }) }; }
  catch (error) { return { error: `${label} 不是有效的 YAML：${error.message}` }; }
}

function parseFrontmatter(content, label) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { error: `${label} 找不到 frontmatter。` };
  const parsed = readYaml(match[1], `${label} 的 frontmatter`);
  if (parsed.error) return parsed;
  if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) return { error: `${label} 的 frontmatter 必須是 YAML 物件。` };
  return { value: parsed.value };
}

function asList(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function textValue(value) { return typeof value === 'string' ? value.trim() : ''; }

function parseCalendarDate(value, pattern = POST_DATE, timeZone = 'Asia/Taipei') {
  const text = textValue(value);
  const match = text.match(pattern);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const hour = Number(match[4] || 0); const minute = Number(match[5] || 0); const second = Number(match[6] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const milliseconds = Number((match[7] || '').padEnd(3, '0')) || 0;
  let timestamp;
  if (match[8]) {
    const offsetMatch = match[8].match(/^([+-])(\d{2}):?(\d{2})$/);
    if (match[8] !== 'Z' && (!offsetMatch || Number(offsetMatch[2]) > 23 || Number(offsetMatch[3]) > 59)) return null;
    timestamp = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds);
    if (offsetMatch) timestamp -= (offsetMatch[1] === '+' ? 1 : -1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * 60000;
  } else {
    timestamp = moment.tz({ year, month: month - 1, date: day, hour, minute, second, millisecond: milliseconds }, timeZone).valueOf();
  }
  const isoDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { text, year, month, day, timestamp, isoDate };
}
function validatePostDate(value) { return parseCalendarDate(value, POST_DATE); }
function validateReadingDate(value) { return parseCalendarDate(value, DATE_ONLY); }

function validateCover(cover, relativePath, root, errors) {
  if (cover == null) return;
  const coverText = textValue(cover);
  if (!coverText) { errors.push(`${relativePath} 的 cover 必須是有效的 /images/ 路徑。`); return; }
  let decoded;
  try { decoded = decodeURIComponent(coverText); }
  catch (error) { errors.push(`${relativePath} 的 cover 路徑編碼無效：${coverText}`); return; }
  const sourceRoot = path.resolve(root, 'source');
  const sourceCoverPath = path.resolve(sourceRoot, decoded.replace(/^\/+/, '').replaceAll('/', path.sep));
  const imageRoot = path.resolve(sourceRoot, 'images') + path.sep;
  if (!decoded.startsWith('/images/') || !sourceCoverPath.startsWith(imageRoot) || !fs.existsSync(sourceCoverPath)) errors.push(`${relativePath} 的 cover 圖片不存在或不是 /images/ 路徑：${coverText}`);
}

function validateCategoriesConfig(root, errors) {
  const configPath = path.join(root, 'source', '_data', 'content-categories.yml');
  const parsed = readYaml(fs.readFileSync(configPath, 'utf8'), 'content-categories.yml');
  if (parsed.error) { errors.push(parsed.error); return []; }
  const categories = Array.isArray(parsed.value) ? parsed.value : [];
  const names = categories.map(category => textValue(category?.name)).filter(Boolean);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (!categories.length) errors.push('content-categories.yml 沒有分類設定。');
  if (duplicateNames.length) errors.push(`分類名稱重複：${[...new Set(duplicateNames)].join('、')}`);
  categories.forEach(category => {
    const name = textValue(category?.name);
    ['name', 'code', 'icon', 'url'].forEach(key => { if (!textValue(category?.[key])) errors.push(`分類「${name || '(未命名)'}」缺少 ${key}。`); });
  });
  return names;
}

function validateReadingDesk(root, errors, options = {}) {
  const parsed = readYaml(fs.readFileSync(path.join(root, 'source', 'reading-desk.yml'), 'utf8'), 'reading-desk.yml');
  if (parsed.error) { errors.push(parsed.error); return; }
  const desk = parsed.value;
  if (!desk || typeof desk !== 'object' || Array.isArray(desk)) { errors.push('reading-desk.yml 頂層必須是物件。'); return; }
  if (!Array.isArray(desk.topics)) { errors.push('reading-desk.yml 的 topics 必須是陣列。'); return; }
  const topicIds = new Set(); const itemIds = new Set();
  desk.topics.forEach((topic, topicIndex) => {
    const label = `reading-desk.yml topic 第 ${topicIndex + 1} 筆`;
    if (!topic || typeof topic !== 'object' || Array.isArray(topic)) { errors.push(`${label} 必須是物件。`); return; }
    const topicId = textValue(topic.id);
    if (!topicId) errors.push(`${label} 缺少有效 id。`);
    else if (topicIds.has(topicId)) errors.push(`reading-desk topic id 重複：${topicId}`);
    else topicIds.add(topicId);
    if (!textValue(topic.name)) errors.push(`${label} 缺少有效 name。`);
    if (!Array.isArray(topic.items)) { errors.push(`${label} 的 items 必須是陣列。`); return; }
    topic.items.forEach((item, itemIndex) => {
      const itemLabel = `${label} item 第 ${itemIndex + 1} 筆`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`${itemLabel} 必須是物件。`); return; }
      ['id', 'title', 'source', 'url', 'state', 'note'].forEach(key => { if (!textValue(item[key])) errors.push(`${itemLabel} 缺少有效 ${key}。`); });
      const itemId = textValue(item.id);
      if (itemId) { if (itemIds.has(itemId)) errors.push(`reading-desk item id 重複：${itemId}`); else itemIds.add(itemId); }
      const date = validateReadingDate(item.date);
      if (!date) errors.push(`${itemLabel} 的 date 必須是有效 YYYY-MM-DD 日期。`);
      const resolvedDate = item.resolved_date == null || !textValue(item.resolved_date) ? null : validateReadingDate(item.resolved_date);
      if (item.resolved_date != null && !resolvedDate) errors.push(`${itemLabel} 的 resolved_date 必須是有效 YYYY-MM-DD 日期。`);
      if (date && resolvedDate && resolvedDate.timestamp < date.timestamp) errors.push(`${itemLabel} 的 resolved_date 不得早於 date。`);
      const url = textValue(item.url);
      const externalUrl = /^https?:\/\//i.test(url);
      if (url && !externalUrl && ((!url.startsWith('/learning/') && !url.startsWith('/work/')) || url.includes('://'))) errors.push(`${itemLabel} 的 url 必須是 /learning/ 或 /work/ 開頭的 root-relative 路徑，或 HTTP(S) 外部連結。`);
      if (externalUrl) {
        try {
          const parsedUrl = new URL(url);
          if (!parsedUrl.hostname || parsedUrl.username || parsedUrl.password) errors.push(`${itemLabel} 的外部 url 必須有主機名稱且不可包含帳密。`);
        } catch (error) { errors.push(`${itemLabel} 的外部 url 格式無效。`); }
      }
      if (item.state != null && !['collected', 'learning', 'published'].includes(textValue(item.state))) errors.push(`${itemLabel} 的 state 只能是 collected、learning 或 published。`);

      if (options.legacyReadingDeskIds && options.postsByUrl) {
        const itemSource = `source/reading-desk.yml#${itemId || `topic-${topicId || topicIndex + 1}-item-${itemIndex + 1}`}`;
        const isLocalUrl = url.startsWith('/');
        const postPath = isLocalUrl ? normalizePostUrl(url) : null;
        const target = postPath == null ? null : options.postsByUrl.get(postPath);
        if (isLocalUrl && !target) {
          errors.push(`${itemSource} target: linked learning item URL ${url || '(empty)'} does not match a published post permalink.`);
        } else if (target && !target.published) {
          errors.push(`${itemSource} target: linked learning item URL ${url} points to an unpublished post (${target.source}).`);
        }

        const linked = isLocalUrl;
        const hasOwnSurfaces = Object.prototype.hasOwnProperty.call(item, 'surfaces');
        const isLegacy = Boolean(itemId && options.legacyReadingDeskIds.has(itemId));
        const canInherit = linked && target && target.published && isLegacy;
        const missingPolicy = hasOwnSurfaces ? 'error' : canInherit ? 'inherit' : !linked && isLegacy ? 'legacy' : 'error';
        const context = canInherit && !hasOwnSurfaces
          ? { inheritedSurfaces: target.surfaces }
          : {};
        const surfaces = validateSurfaceRecord(item, itemSource, missingPolicy, errors, options.warnings, context);
        if (linked && surfaces && target.surfaces && !isSurfaceSubset(surfaces, target.surfaces, { source: itemSource })) {
          errors.push(`${itemSource}.surfaces must be a subset of target post ${target.source} surfaces (${target.surfaces.join(', ')}).`);
        }
      }
    });
  });
}

function normalizePostUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname || pathname.includes('\\') || pathname.split('/').includes('..')) return null;
  try {
    const decoded = decodeURI(pathname);
    return decoded.endsWith('/') ? decoded : `${decoded}/`;
  } catch (error) { return null; }
}

function loadLegacySurfaceManifest(root, errors) {
  const manifestPath = path.join(root, LEGACY_SURFACE_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    if (path.resolve(root) === PROJECT_ROOT) errors.push(`${LEGACY_SURFACE_MANIFEST} 不存在，無法判定舊資料相容集合。`);
    return { posts: new Set(), microblogIds: new Set(), readingDeskIds: new Set() };
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (error) { errors.push(`${LEGACY_SURFACE_MANIFEST} 不是有效 JSON：${error.message}`); return { posts: new Set(), microblogIds: new Set(), readingDeskIds: new Set() }; }
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.posts) || !Array.isArray(manifest.microblogIds) || !Array.isArray(manifest.readingDeskItemIds)) {
    errors.push(`${LEGACY_SURFACE_MANIFEST} 必須是 schemaVersion 1 且包含 posts、microblogIds、readingDeskItemIds 陣列。`);
    return { posts: new Set(), microblogIds: new Set(), readingDeskIds: new Set() };
  }
  const validateIds = (values, field) => {
    const seen = new Set();
    values.forEach((value, index) => {
      if (typeof value !== 'string' || !value.trim()) errors.push(`${LEGACY_SURFACE_MANIFEST} 的 ${field}[${index}] 必須是非空字串。`);
      else if (seen.has(value)) errors.push(`${LEGACY_SURFACE_MANIFEST} 的 ${field} 有重複識別：${value}`);
      else seen.add(value);
    });
    return seen;
  };
  return {
    posts: validateIds(manifest.posts, 'posts'),
    microblogIds: validateIds(manifest.microblogIds, 'microblogIds'),
    readingDeskIds: validateIds(manifest.readingDeskItemIds, 'readingDeskItemIds')
  };
}

function validateSurfaceRecord(record, source, missingPolicy, errors, warnings, extra = {}) {
  try {
    const result = normalizeSurfaces(record, { source, missingPolicy, ...extra });
    result.warnings.forEach(warning => warnings.push(warning.message));
    return result.surfaces;
  } catch (error) {
    const remedies = {
      missing_surfaces: '請在 front matter 加上 surfaces: [memory]、surfaces: [profile] 或 surfaces: [profile, memory]。',
      empty_surfaces: '請將空陣列改成 surfaces: [memory]、surfaces: [profile] 或 surfaces: [profile, memory]。',
      invalid_surfaces_type: '請將 surfaces 改為只含允許值的 YAML 陣列，例如 surfaces: [profile]。',
      invalid_surface_type: '請將 surfaces 的每個項目改成字串 profile 或 memory。',
      unknown_surface: '請將 surfaces 項目改成精確的 profile 或 memory。',
      invalid_record: '請將來源記錄改成物件，並在其中設定有效的 surfaces 陣列。'
    };
    const code = error.code || error.name;
    const field = error.field || 'surfaces';
    const remedy = remedies[code] || '請將 surfaces 修正為非空陣列 [profile]、[memory] 或 [profile, memory]。';
    errors.push(`${error.source || source} [${code}, ${field}]: ${remedy}`);
    return null;
  }
}

const THINKING_REMEDIES = Object.freeze({
  THINKING_INVALID_RECORD: '請確認文章 front matter 是 YAML 物件。',
  THINKING_ORPHAN_FIELD: '請補上 thinking_status: exploring 與另一個 thinking 欄位，或移除這個孤立欄位。',
  THINKING_STATUS_INVALID_TYPE: '請將 thinking_status 設為未加引號的 exploring。',
  THINKING_STATUS_UNSUPPORTED: '請將 thinking_status 改為精確值 exploring，或移除整組 thinking 欄位。',
  THINKING_UPDATED_REQUIRED: '請補上 thinking_updated: YYYY-MM-DD，使用實際校準日期。',
  THINKING_BOUNDARY_REQUIRED: '請補上簡短的 thinking_boundary，說明目前適用範圍。',
  THINKING_UPDATED_INVALID_TYPE: '請將 thinking_updated 改成 YYYY-MM-DD 日期字串。',
  THINKING_UPDATED_INVALID_DATE: '請將 thinking_updated 改成真實存在的 YYYY-MM-DD 日期。',
  THINKING_BOUNDARY_INVALID_TYPE: '請將 thinking_boundary 改成非空文字。',
  THINKING_BOUNDARY_EMPTY: '請在 thinking_boundary 填入簡短且非空的適用範圍。'
});

function formatThinkingError(error) {
  const code = error.code || 'THINKING_INVALID_RECORD';
  const field = error.field || 'front matter';
  return `${error.source} [${code}, ${field}]: ${THINKING_REMEDIES[code] || '請依成熟度欄位契約修正 front matter。'}`;
}

function validateThinkingRecord(frontmatter, source, postDate, postUpdated, today) {
  const errors = [];
  let thinking;
  try { thinking = resolveThinkingStatus(frontmatter, { source }); }
  catch (error) {
    errors.push(formatThinkingError(error));
    return errors;
  }
  if (!thinking.isExploring) return errors;

  const updatedDate = thinking.updated;
  if (postDate && updatedDate < postDate.isoDate) {
    errors.push(`${source} [THINKING_UPDATED_BEFORE_POST_DATE, thinking_updated]: 請將日期改為不早於文章 date 的日曆日期（${postDate.isoDate}），再確認這是實際校準日。`);
  }
  if (postUpdated && updatedDate > postUpdated.isoDate) {
    errors.push(`${source} [THINKING_UPDATED_AFTER_POST_UPDATED, thinking_updated]: 請將日期改為不晚於文章 updated 的日曆日期（${postUpdated.isoDate}），或修正文章 updated。`);
  }
  if (updatedDate > today) {
    errors.push(`${source} [THINKING_UPDATED_AFTER_TODAY, thinking_updated]: 請將日期改為不晚於台北今日（${today}）的實際校準日期。`);
  }
  return errors;
}

function postIsPublished(frontmatter) {
  const published = frontmatter.published;
  const draft = frontmatter.draft;
  return published !== false && textValue(published).toLowerCase() !== 'false' && draft !== true && textValue(draft).toLowerCase() !== 'true';
}

function checkContent({ root = path.resolve(__dirname, '..'), clock = () => new Date() } = {}) {
  const errors = []; const warnings = [];
  const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const legacySurfaces = loadLegacySurfaceManifest(root, errors);
  const postsByUrl = new Map();
  const categoryNames = validateCategoriesConfig(root, errors);
  let taxonomy;
  try { taxonomy = loadTaxonomy(path.join(root, 'source', '_data', 'content-tags.yml')); errors.push(...taxonomy.errors); }
  catch (error) { errors.push(`content-tags.yml 無法讀取：${error.message}`); taxonomy = { aliases: new Map(), canonicalNames: new Set() }; }
  const allowedCategories = new Set([...categoryNames, '站務']);
  const today = moment(clock()).tz('Asia/Taipei').format('YYYY-MM-DD');
  const files = [];
  function walk(directory) { fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => { const currentPath = path.join(directory, entry.name); if (entry.isDirectory()) walk(currentPath); else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(currentPath); }); }
  walk(path.join(root, 'source', '_posts'));
  files.sort((left, right) => {
    const leftPath = path.relative(root, left).split(path.sep).join('/');
    const rightPath = path.relative(root, right).split(path.sep).join('/');
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
  files.forEach(file => {
    const relativePath = path.relative(root, file); const stablePostPath = relativePath.split(path.sep).join('/'); const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'), relativePath);
    if (parsed.error) { errors.push(parsed.error); return; }
    const frontmatter = parsed.value; const title = textValue(frontmatter.title);
    if (!title) errors.push(`${relativePath} 缺少有效 title。`);
    const date = validatePostDate(frontmatter.date);
    if (!date) errors.push(`${relativePath} 的 date 必須是有效日期。`);
    let updated = null;
    if (frontmatter.updated != null) {
      updated = validatePostDate(frontmatter.updated);
      if (!updated) errors.push(`${relativePath} 的 updated 必須是有效日期。`);
      else {
        if (date && updated.timestamp < date.timestamp) errors.push(`${relativePath} 的 updated 不得早於 date。`);
        const updatedTaipeiDate = moment(updated.timestamp).tz('Asia/Taipei').format('YYYY-MM-DD');
        if (updatedTaipeiDate > today) errors.push(`${relativePath} [POST_UPDATED_AFTER_TODAY, updated]: updated 不得晚於 Asia/Taipei 今日（${today}）。`);
      }
    }
    const postCategories = asList(frontmatter.categories).map(textValue).filter(Boolean);
    if (!postCategories.length) errors.push(`${relativePath} 沒有設定 categories。`);
    postCategories.forEach(category => { if (!allowedCategories.has(category)) errors.push(`${relativePath} 使用未設定的分類「${category}」。`); });
    validateCover(frontmatter.cover, relativePath, root, errors);
    const surfaces = validateSurfaceRecord(frontmatter, stablePostPath, legacySurfaces.posts.has(stablePostPath) ? 'legacy' : 'error', errors, warnings);
    if (date && (frontmatter.updated == null || updated)) errors.push(...validateThinkingRecord(frontmatter, stablePostPath, date, updated, today));
    const postUrl = normalizePostUrl(frontmatter.permalink);
    if (postUrl) {
      if (postsByUrl.has(postUrl)) errors.push(`${stablePostPath} permalink ${frontmatter.permalink} 與 ${postsByUrl.get(postUrl).source} 重複。`);
      else postsByUrl.set(postUrl, { source: stablePostPath, published: postIsPublished(frontmatter), surfaces });
    }
    if (Object.prototype.hasOwnProperty.call(frontmatter, 'tags')) {
      const tags = asList(frontmatter.tags).map(textValue).filter(Boolean); const seenTags = new Set();
      tags.forEach(tag => {
        if (seenTags.has(tag)) errors.push(`${relativePath} 的 tags 有重複標籤「${tag}」。`);
        seenTags.add(tag);
        if (!taxonomy.aliases.has(tag)) errors.push(`${relativePath} 使用未註冊標籤「${tag}」，請改用已登錄主標籤，或在 content-tags.yml 登錄相容別名。`);
      });
      if (tags.length > 2) errors.push(`${relativePath} 的 tags 超過 2 個，請回到逐篇判斷清單檢查。`);
    }
  });
  let lifeIndex; try { lifeIndex = JSON.parse(read('source/life-index.json')); } catch (error) { errors.push(`source/life-index.json 不是有效的 JSON：${error.message}`); }
  if (lifeIndex == null || typeof lifeIndex !== 'object' || Array.isArray(lifeIndex)) errors.push('life-index.json 頂層必須是物件。');
  else ['listen', 'watch'].forEach(key => { const item = lifeIndex.current && lifeIndex.current[key]; if (!item || typeof item !== 'object' || Array.isArray(item) || !textValue(item.title) || !textValue(item.url)) errors.push(`life-index.json 的 current.${key} 缺少有效 title 或 url。`); });
  let microblog; try { microblog = JSON.parse(read('source/microblog.json')); } catch (error) { errors.push(`source/microblog.json 不是有效的 JSON：${error.message}`); }
  if (microblog !== undefined) {
    if (!Array.isArray(microblog)) errors.push('microblog.json 必須是陣列。');
    else {
      const microblogIds = new Set();
      microblog.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`microblog.json 第 ${index + 1} 筆必須是物件。`); return; }
        const id = textValue(item.id);
        const source = `source/microblog.json#${id || `record-${index + 1}`}`;
        if (!id) errors.push(`${source}.id 缺少穩定識別。`);
        else if (microblogIds.has(id)) errors.push(`${source}.id 重複。`);
        else microblogIds.add(id);
        if (!validateReadingDate(item.date)) errors.push(`${source} 的 date 欄位格式錯誤。`);
        if (!textValue(item.tag)) errors.push(`${source} 缺少 tag 欄位。`);
        if (typeof item.content !== 'string') errors.push(`${source} 的 content 欄位必須是文字。`);
        validateSurfaceRecord(item, source, legacySurfaces.microblogIds.has(id) ? 'legacy' : 'error', errors, warnings);
      });
    }
  }
  validateReadingDesk(root, errors, { legacyReadingDeskIds: legacySurfaces.readingDeskIds, postsByUrl, warnings });
  const photoWall = read('source/photos/index.md'); const imageReferences = [...photoWall.matchAll(/src=["'](\/images\/[^"']+)["']/g)].map(match => match[1]);
  imageReferences.forEach(reference => validateCover(reference, '圖牆', root, errors));
  return { errors, warnings, categories: categoryNames, microblogCount: Array.isArray(microblog) ? microblog.length : 0, imageCount: imageReferences.length };
}

if (require.main === module) {
  const result = checkContent();
  if (result.errors.length) { console.error('內容檢查失敗：'); result.errors.forEach(error => console.error(`- ${error}`)); result.warnings.forEach(warning => console.error(`警告：${warning}`)); process.exitCode = 1; }
  else { console.log(`內容檢查通過：${result.categories.length} 個分類、${result.microblogCount} 則碎碎念、${result.imageCount} 個圖牆圖片路徑。`); result.warnings.forEach(warning => console.warn(`內容檢查警告：${warning}`)); }
}

module.exports = { DATE_ONLY, POST_DATE, parseFrontmatter, parseCalendarDate, validatePostDate, validateReadingDate, validateReadingDesk, normalizePostUrl, validateThinkingRecord, checkContent };
