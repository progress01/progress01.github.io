'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const moment = require('moment-timezone');
const { assignMicroblogIds } = require('./lib/navigation-index');
const { validateReadingDate, parseFrontmatter, normalizePostUrl } = require('./content-check');
const { normalizeSurfaces, isSurfaceSubset } = require('./lib/content-surfaces');

const ROOT = path.resolve(__dirname, '..');
const usage = `新增本機紀錄（不會發布）\n\n用法：\n  npm run record -- microblog --text "今天想記下的事" [--tag 💭] [--date YYYY-MM-DD] [--dry-run]\n  npm run record -- reading --title "題目" --url "/learning/slug/" [--topic TOPIC_ID] [--source "來源"] [--note "整理備註"] [--date YYYY-MM-DD] [--dry-run]\n\n不指定 --topic 時會依題目自動建立主題；也可選填 --topic-id、--topic-name、--topic-code、--description 覆寫主題欄位。\n日期預設台北今日；碎碎念標籤預設 💭，面向固定為 memory。閱讀項目 state 固定為 learning。`;

function parseArgs(args) {
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  const type = args.shift();
  if (!['microblog', 'reading'].includes(type)) throw new Error('請指定 microblog 或 reading。');
  const allowed = type === 'microblog' ? new Set(['--text', '--tag', '--date']) : new Set(['--title', '--url', '--date', '--source', '--note', '--topic', '--topic-id', '--topic-name', '--topic-code', '--description']);
  const values = { type, dryRun: false };
  while (args.length) {
    const flag = args.shift();
    if (flag === '--dry-run') { values.dryRun = true; continue; }
    if (!allowed.has(flag)) throw new Error(`選項 ${flag} 不適用於 ${type}。`);
    const key = ({ '--text': 'text', '--tag': 'tag', '--date': 'date', '--title': 'title', '--url': 'url', '--source': 'source', '--note': 'note', '--topic': 'topic', '--topic-id': 'topicId', '--topic-name': 'topicName', '--topic-code': 'topicCode', '--description': 'description' })[flag];
    if (!key) throw new Error(`不認得的選項：${flag}`);
    if (values[key] !== undefined) throw new Error(`選項重複：${flag}`);
    if (!args.length || args[0].startsWith('--')) throw new Error(`${flag} 後面需要一個值。`);
    values[key] = args.shift();
  }
  if (type === 'reading' && values.topic && (values.topicId || values.topicName || values.topicCode || values.description)) throw new Error('--topic 與新主題欄位不可同時使用。');
  return values;
}

function required(value, flag) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${flag} 必填且不可空白。`);
  return value.trim();
}
function dateValue(value) {
  const result = validateReadingDate(value || moment().tz('Asia/Taipei').format('YYYY-MM-DD'));
  if (!result) throw new Error('日期必須是真實有效的 YYYY-MM-DD 日期。');
  return result.isoDate;
}
function itemIdFor(item, ids) {
  const base = 'reading-' + crypto.createHash('sha256').update(JSON.stringify([item.date, item.title, item.url])).digest('hex').slice(0, 12);
  if (ids.has(base)) throw new Error(`產生的閱讀項目 ID 已存在：${base}。請調整日期、題目或網址。`);
  return base;
}
function yamlScalar(value) { return JSON.stringify(value); }
function yamlItem(item, indent = '      ') {
  return `${indent}- id: ${yamlScalar(item.id)}\n${indent}  date: ${yamlScalar(item.date)}\n${indent}  title: ${yamlScalar(item.title)}\n${indent}  source: ${yamlScalar(item.source)}\n${indent}  url: ${yamlScalar(item.url)}\n${indent}  state: learning\n${indent}  note: ${yamlScalar(item.note)}\n${indent}  surfaces: [memory]\n`;
}

function prepareMicroblog(raw, input, projectRoot) {
  let old;
  try { old = JSON.parse(raw); } catch (error) { throw new Error(`microblog.json JSON 格式錯誤：${error.message}`); }
  if (!Array.isArray(old)) throw new Error('microblog.json 頂層必須是陣列。');
  const recordDate = dateValue(input.date);
  const originalIds = assignMicroblogIds(old);
  if (old.some((entry, index) => entry.id !== originalIds[index].id)) throw new Error('現有碎碎念有缺少或無效 ID；請先修復來源。');
  const tag = input.tag === undefined ? '💭' : required(input.tag, '--tag');
  const item = { date: recordDate, tag, content: required(input.text, '--text'), surfaces: ['memory'] };
  normalizeSurfaces(item, { source: 'new microblog record', missingPolicy: 'error' });
  const added = assignMicroblogIds([item])[0];
  const plan = JSON.parse(fs.readFileSync(path.join(projectRoot, 'tools/data/microblog-boundary-migration.v1.json'), 'utf8'));
  if (plan.retiredIds?.includes(added.id)) throw new Error(`新 ID 命中已退役 ID，拒絕重用：${added.id}`);
  const next = assignMicroblogIds([added, ...old]);
  return { value: JSON.stringify(next, null, 2) + '\n', summary: `碎碎念 ${added.id}｜${added.date}｜${added.tag}｜${added.content}`, id: added.id };
}

function validateLocalTarget(root, url) {
  if (!url.startsWith('/')) return;
  const postsDir = path.join(root, 'source/_posts');
  if (!fs.existsSync(postsDir)) throw new Error(`找不到對應已發布文章：${url}`);
  const manifestFile = path.join(root, 'tools/data/legacy-surfaces.v1.json');
  const legacyPosts = fs.existsSync(manifestFile) ? new Set(JSON.parse(fs.readFileSync(manifestFile, 'utf8')).posts || []) : new Set();
  const wanted = normalizePostUrl(url);
  const hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && file.toLowerCase().endsWith('.md')) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'), relative);
        if (!parsed.error && normalizePostUrl(parsed.value.permalink) === wanted) hits.push({ relative, frontmatter: parsed.value });
      }
    }
  }
  walk(postsDir);
  if (hits.length !== 1) throw new Error(hits.length ? `網址對應到多篇文章：${url}` : `找不到對應文章 permalink：${url}`);
  const post = hits[0];
  const fm = post.frontmatter;
  if (fm.published === false || String(fm.published).toLowerCase() === 'false' || fm.draft === true || String(fm.draft).toLowerCase() === 'true') throw new Error(`網址指向未發布文章：${url}`);
  let targetSurfaces;
  try { targetSurfaces = normalizeSurfaces(fm, { source: post.relative, missingPolicy: legacyPosts.has(post.relative) ? 'legacy' : 'error' }).surfaces; }
  catch { throw new Error(`目標文章面向無法驗證：${url}`); }
  if (!isSurfaceSubset(['memory'], targetSurfaces, { source: 'new reading item' })) throw new Error(`目標文章不含 memory 面向，不能新增會升面的閱讀連結：${url}`);
}

function prepareReading(raw, input, projectRoot = ROOT) {
  const desk = yaml.load(raw, { schema: yaml.FAILSAFE_SCHEMA });
  if (!desk || !Array.isArray(desk.topics)) throw new Error('reading-desk.yml 必須包含 topics 陣列。');
  const topicIds = new Set(), itemIds = new Set();
  for (const topic of desk.topics) {
    if (!topic || typeof topic !== 'object' || !Array.isArray(topic.items)) throw new Error('現有 topics 結構無效，未修改來源。');
    if (topicIds.has(topic.id)) throw new Error(`現有 topic ID 重複：${topic.id}`); topicIds.add(topic.id);
    for (const item of topic.items) { if (itemIds.has(item.id)) throw new Error(`現有閱讀項目 ID 重複：${item.id}`); itemIds.add(item.id); }
  }
  const title = required(input.title, '--title');
  const url = required(input.url, '--url');
  const localLearning = /^\/(?:learning|work)\//.test(url) && !url.includes('://');
  let external = false;
  if (/^https?:\/\//i.test(url)) { try { const parsed = new URL(url); external = !!parsed.hostname && !parsed.username && !parsed.password; } catch {} }
  if (!localLearning && !external) throw new Error('--url 須為 /learning/、/work/ 路徑或有效 HTTP(S) 網址。');
  validateLocalTarget(projectRoot, url);
  const item = { date: dateValue(input.date), title, source: input.source?.trim() || '待補來源', url, note: input.note?.trim() || '待整理', surfaces: ['memory'] };
  normalizeSurfaces(item, { source: 'new reading desk item', missingPolicy: 'error' });
  item.id = itemIdFor(item, itemIds);
  if (input.topic && (input.topicId || input.topicName || input.topicCode || input.description)) throw new Error('--topic 與新主題欄位不可同時使用。');
  const existing = input.topic ? desk.topics.find(topic => topic.id === input.topic) : null;
  if (input.topic && !existing) throw new Error(`找不到 topic ID：${input.topic}`);
  if (existing) {
    if (existing.items.some(old => old.url === url)) throw new Error(`topic「${existing.id}」已存在相同網址：${url}`);
    const topicIndex = desk.topics.indexOf(existing);
    const boundaries = [...raw.matchAll(/^  - id:\s*([^\r\n]+).*$/gm)];
    const topicStart = boundaries[topicIndex]?.index;
    const topicEnd = boundaries[topicIndex + 1]?.index ?? raw.length;
    if (topicStart == null) throw new Error('無法在保留註解的前提下定位 topic；未修改來源。');
    const section = raw.slice(topicStart, topicEnd);
    const match = section.match(/(?:^|\n)(\s*)items:\s*\r?\n/);
    if (!match) throw new Error('指定 topic 沒有 items 區塊；未修改來源。');
    const itemsAt = topicStart + match.index + match[0].length;
    const child = section.slice(match.index + match[0].length).match(/(?:^|\n)(\s*)- id:/);
    const itemIndent = child ? child[1] : match[1] + '    ';
    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    const value = raw.slice(0, itemsAt) + yamlItem(item, itemIndent).replace(/\n/g, newline) + raw.slice(itemsAt);
    const nextDesk = yaml.load(value, { schema: yaml.FAILSAFE_SCHEMA });
    const added = nextDesk.topics[topicIndex].items.shift();
    if (!added || added.id !== item.id || JSON.stringify(nextDesk) !== JSON.stringify(desk)) throw new Error('新增後 YAML 結構驗證失敗，未修改來源。');
    return { value, summary: `閱讀題目 ${item.id} → ${existing.name}｜${title}｜${url}`, id: item.id };
  }
  const topicName = required(input.topicName || title, '--topic-name');
  const topicId = input.topicId?.trim() || `topic-${crypto.createHash('sha256').update(topicName).digest('hex').slice(0, 10)}`;
  if (!/^[a-z][a-z0-9-]*$/.test(topicId) || topicIds.has(topicId)) throw new Error(`topic ID 格式錯誤或已存在：${topicId}`);
  const codeNumbers = desk.topics.map(topic => String(topic.code || '').match(/^A-(\d+)$/)?.[1]).filter(Boolean).map(Number);
  const code = input.topicCode?.trim() || `A-${String(Math.max(0, ...codeNumbers) + 1).padStart(2, '0')}`;
  const description = input.description?.trim() || topicName;
  const block = `\n  - id: ${yamlScalar(topicId)}\n    code: ${yamlScalar(code)}\n    name: ${yamlScalar(topicName)}\n    description: ${yamlScalar(description)}\n    items:\n${yamlItem(item, '      ')}`;
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const emptyTopics = /^topics:\s*\[\s*\]\s*$/m;
  const value = emptyTopics.test(raw)
    ? raw.replace(emptyTopics, `topics:${newline}`) + block.replace(/\n/g, newline)
    : raw.replace(/\s*$/, '') + block.replace(/\n/g, newline) + newline;
  const nextDesk = yaml.load(value, { schema: yaml.FAILSAFE_SCHEMA });
  if (JSON.stringify(nextDesk.topics.slice(0, desk.topics.length)) !== JSON.stringify(desk.topics) || nextDesk.topics.at(-1)?.items?.[0]?.id !== item.id) throw new Error('新增後 YAML 結構驗證失敗，未修改來源。');
  return { value, summary: `新增主題 ${topicId} 並加入題目 ${item.id}｜${title}｜${url}`, id: item.id };
}

function run(input, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const isMicroblog = input.type === 'microblog';
  const target = path.join(root, 'source', isMicroblog ? 'microblog.json' : 'reading-desk.yml');
  const raw = fs.readFileSync(target, 'utf8');
  const result = isMicroblog ? prepareMicroblog(raw, input, root) : prepareReading(raw, input, root);
  if (input.dryRun) return { ...result, written: false };
  if (options.beforeWrite) options.beforeWrite();
  if (fs.readFileSync(target, 'utf8') !== raw) throw new Error('來源在預覽後已改變；請重新執行，未寫入。');
  const backupDir = path.join(root, 'node_modules/.cache/record-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const nonce = options.nonce || crypto.randomBytes(10).toString('hex');
  const backup = path.join(backupDir, `${path.basename(target, path.extname(target))}-before-record-${Date.now()}-${nonce}${path.extname(target)}`);
  fs.writeFileSync(backup, raw, { flag: 'wx' });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.record-${nonce}.tmp`);
  let createdTemporary = false;
  try {
    fs.writeFileSync(temporary, result.value, { flag: 'wx' });
    createdTemporary = true;
    if (options.beforeRename) options.beforeRename();
    if (fs.readFileSync(target, 'utf8') !== raw) throw new Error('來源在準備寫入時已改變；請重新執行，未覆蓋新內容。');
    (options.rename || fs.renameSync)(temporary, target);
  }
  catch (error) {
    if (createdTemporary) try { fs.rmSync(temporary); } catch {}
    throw error;
  }
  return { ...result, backup, written: true };
}

function main(args = process.argv.slice(2)) {
  try {
    const input = parseArgs(args);
    if (input.help) { console.log(usage); return; }
    const result = run(input);
    console.log(`${input.dryRun ? '預覽' : '已新增本機紀錄'}：${result.summary}`);
    if (input.dryRun) console.log('未寫入來源；移除 --dry-run 即可新增。');
    else console.log(`來源備份：${path.relative(ROOT, result.backup)}`);
  } catch (error) { console.error(`新增失敗：${error.message}\n\n${usage}`); process.exitCode = 1; }
}

if (require.main === module) main();
module.exports = { usage, parseArgs, prepareMicroblog, prepareReading, run, main };
