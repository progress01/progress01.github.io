const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const moment = require('moment-timezone');
const { loadTaxonomy } = require('../scripts/tag-taxonomy');

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

function validateReadingDesk(root, errors) {
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
      if (url && (!url.startsWith('/learning/') || url.includes('://'))) errors.push(`${itemLabel} 的 url 必須是 /learning/ 開頭的 root-relative 路徑。`);
      if (item.state != null && !['collected', 'learning', 'published'].includes(textValue(item.state))) errors.push(`${itemLabel} 的 state 只能是 collected、learning 或 published。`);
    });
  });
}

function checkContent({ root = path.resolve(__dirname, '..') } = {}) {
  const errors = []; const warnings = [];
  const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const categoryNames = validateCategoriesConfig(root, errors);
  let taxonomy;
  try { taxonomy = loadTaxonomy(path.join(root, 'source', '_data', 'content-tags.yml')); errors.push(...taxonomy.errors); }
  catch (error) { errors.push(`content-tags.yml 無法讀取：${error.message}`); taxonomy = { aliases: new Map(), canonicalNames: new Set() }; }
  const allowedCategories = new Set([...categoryNames, '站務']);
  const files = [];
  function walk(directory) { fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => { const currentPath = path.join(directory, entry.name); if (entry.isDirectory()) walk(currentPath); else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(currentPath); }); }
  walk(path.join(root, 'source', '_posts'));
  files.forEach(file => {
    const relativePath = path.relative(root, file); const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'), relativePath);
    if (parsed.error) { errors.push(parsed.error); return; }
    const frontmatter = parsed.value; const title = textValue(frontmatter.title);
    if (!title) errors.push(`${relativePath} 缺少有效 title。`);
    const date = validatePostDate(frontmatter.date);
    if (!date) errors.push(`${relativePath} 的 date 必須是有效日期。`);
    if (frontmatter.updated != null) { const updated = validatePostDate(frontmatter.updated); if (!updated) errors.push(`${relativePath} 的 updated 必須是有效日期。`); else if (date && updated.timestamp < date.timestamp) errors.push(`${relativePath} 的 updated 不得早於 date。`); }
    const postCategories = asList(frontmatter.categories).map(textValue).filter(Boolean);
    if (!postCategories.length) errors.push(`${relativePath} 沒有設定 categories。`);
    postCategories.forEach(category => { if (!allowedCategories.has(category)) errors.push(`${relativePath} 使用未設定的分類「${category}」。`); });
    validateCover(frontmatter.cover, relativePath, root, errors);
    if (Object.prototype.hasOwnProperty.call(frontmatter, 'tags')) {
      const tags = asList(frontmatter.tags).map(textValue).filter(Boolean); let validTag = false;
      tags.forEach(tag => { if (taxonomy.aliases.has(tag)) validTag = true; else warnings.push(`${relativePath} 忽略未註冊標籤「${tag}」。`); });
      if (!validTag) errors.push(`${relativePath} 缺少有效主標籤。`);
    } else errors.push(`${relativePath} 缺少 tags，必須設定有效主標籤。`);
  });
  let lifeIndex; try { lifeIndex = JSON.parse(read('source/life-index.json')); } catch (error) { errors.push(`source/life-index.json 不是有效的 JSON：${error.message}`); }
  if (lifeIndex == null || typeof lifeIndex !== 'object' || Array.isArray(lifeIndex)) errors.push('life-index.json 頂層必須是物件。');
  else ['listen', 'watch'].forEach(key => { const item = lifeIndex.current && lifeIndex.current[key]; if (!item || typeof item !== 'object' || Array.isArray(item) || !textValue(item.title) || !textValue(item.url)) errors.push(`life-index.json 的 current.${key} 缺少有效 title 或 url。`); });
  let microblog; try { microblog = JSON.parse(read('source/microblog.json')); } catch (error) { errors.push(`source/microblog.json 不是有效的 JSON：${error.message}`); }
  if (microblog !== undefined) {
    if (!Array.isArray(microblog)) errors.push('microblog.json 必須是陣列。');
    else microblog.forEach((item, index) => { if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`microblog.json 第 ${index + 1} 筆必須是物件。`); return; } if (!validateReadingDate(item.date)) errors.push(`microblog.json 第 ${index + 1} 筆日期格式錯誤。`); if (!textValue(item.tag)) errors.push(`microblog.json 第 ${index + 1} 筆缺少 tag。`); if (typeof item.content !== 'string') errors.push(`microblog.json 第 ${index + 1} 筆 content 必須是文字。`); });
  }
  validateReadingDesk(root, errors);
  const photoWall = read('source/photos/index.md'); const imageReferences = [...photoWall.matchAll(/src=["'](\/images\/[^"']+)["']/g)].map(match => match[1]);
  imageReferences.forEach(reference => validateCover(reference, '圖牆', root, errors));
  return { errors, warnings, categories: categoryNames, microblogCount: Array.isArray(microblog) ? microblog.length : 0, imageCount: imageReferences.length };
}

if (require.main === module) {
  const result = checkContent();
  if (result.errors.length) { console.error('內容檢查失敗：'); result.errors.forEach(error => console.error(`- ${error}`)); result.warnings.forEach(warning => console.error(`警告：${warning}`)); process.exitCode = 1; }
  else { console.log(`內容檢查通過：${result.categories.length} 個分類、${result.microblogCount} 則碎碎念、${result.imageCount} 個圖牆圖片路徑。`); result.warnings.forEach(warning => console.warn(`內容檢查警告：${warning}`)); }
}

module.exports = { DATE_ONLY, POST_DATE, parseFrontmatter, parseCalendarDate, validatePostDate, validateReadingDate, validateReadingDesk, checkContent };
