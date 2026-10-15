'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function normalizeDate(value) {
  if (value && typeof value.format === 'function') return value.format('YYYY-MM-DD');
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value || '').trim();
  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/);
  return isoDate ? isoDate[0] : text.slice(0, 10);
}

function jsonValue(value) { return JSON.parse(JSON.stringify(value)); }

function expectedData(root) {
  const lifePath = path.join(root, 'source/life-index.json');
  const lifeSource = JSON.parse(fs.readFileSync(lifePath, 'utf8'));
  if (!lifeSource || typeof lifeSource !== 'object' || Array.isArray(lifeSource)) throw new Error('source/life-index.json 頂層必須是 JSON 物件。');
  const readingSource = yaml.load(fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8')) || {};
  if (!readingSource || typeof readingSource !== 'object' || Array.isArray(readingSource) || !Array.isArray(readingSource.topics)) throw new Error('source/reading-desk.yml 必須是含 topics 陣列的 YAML 物件。');
  const reading = {
    ...readingSource,
    topics: readingSource.topics.map(topic => ({
      ...topic,
      items: (topic.items || []).map(item => ({ ...item, date: normalizeDate(item.date) }))
    }))
  };
  return { life: jsonValue(lifeSource), reading: jsonValue(reading) };
}

function checkRecordDataOutput({ root = PROJECT_ROOT, outputRoot = path.join(root, 'public') } = {}) {
  const expected = expectedData(root);
  const files = [
    ['life-index.json', expected.life],
    ['reading-desk.json', expected.reading]
  ];
  const errors = [];
  for (const [filename, serialized] of files) {
    const output = path.join(outputRoot, filename);
    let actual;
    try { actual = JSON.parse(fs.readFileSync(output, 'utf8')); }
    catch (error) { errors.push(`${filename} 無法讀取或不是有效 JSON：${error.message}`); continue; }
    if (!isDeepStrictEqual(actual, serialized)) errors.push(`${filename} 與來源資料不同（欄位、值或陣列順序不一致）。`);
  }
  return { errors };
}

function main(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex !== -1 && !args[rootIndex + 1]) throw new Error('missing_root');
  const root = path.resolve(rootIndex === -1 ? PROJECT_ROOT : args[rootIndex + 1]);
  const report = checkRecordDataOutput({ root });
  if (report.errors.length) {
    console.error('紀錄資料輸出檢查失敗：\n' + report.errors.map(error => '- ' + error).join('\n'));
    process.exitCode = 1;
  } else console.log('紀錄資料輸出檢查通過：life-index.json 與 reading-desk.json 和來源一致。');
}

if (require.main === module) main();
module.exports = { normalizeDate, expectedData, checkRecordDataOutput, main };
