const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { updatePhotoWallCounts } = require('../../scripts/photo-wall-counts.js');

const fixture = [
  '<nav>',
  '  <button data-photo-wall-filter="all">全部 <span>0</span></button>',
  '  <button data-photo-wall-filter="music">音樂推薦 <span>0</span></button>',
  '  <button data-photo-wall-filter="books">書籍閱讀 <span>0</span></button>',
  '  <button data-photo-wall-filter="films">觀影紀錄 <span>0</span></button>',
  '</nav>',
  '<section data-photo-wall-section="music"><div class="ig-grid">',
  '  <div class="ig-card"></div><div class="ig-card"></div>',
  '</div></section>',
  '<section data-photo-wall-section="books"><div class="ig-card"></div></section>',
  '<section data-photo-wall-section="films"></section>'
].join('\n');
const counted = updatePhotoWallCounts(fixture);
assert.match(counted, /data-photo-wall-filter="all"[^>]*>全部 <span>3<\/span>/);
assert.match(counted, /data-photo-wall-filter="music"[^>]*>音樂推薦 <span>2<\/span>/);
assert.match(counted, /data-photo-wall-filter="books"[^>]*>書籍閱讀 <span>1<\/span>/);
assert.match(counted, /data-photo-wall-filter="films"[^>]*>觀影紀錄 <span>0<\/span>/);
assert.strictEqual(updatePhotoWallCounts(counted), counted, 'photo counters must be idempotent');
const withNewCard = updatePhotoWallCounts(counted.replace('<div class="ig-grid">', '<div class="ig-grid"><div class="ig-card"></div>'));
assert.match(withNewCard, /data-photo-wall-filter="all"[^>]*>全部 <span>4<\/span>/);
assert.match(withNewCard, /data-photo-wall-filter="music"[^>]*>音樂推薦 <span>3<\/span>/);

const readingSource = fs.readFileSync(
  path.join(__dirname, '../..', 'source', 'reading', 'index.md'),
  'utf8'
);
const functionMatch = readingSource.match(/function getAddedRecords\(key\) \{[\s\S]*?\n    \}/);
assert(functionMatch, 'getAddedRecords function is missing');
const getAddedRecords = vm.runInNewContext(`(${functionMatch[0]})`, {
  allItems: () => [
    { item: { date: '2026-08-29', state: 'learning' } },
    { item: { date: '2026-08-29', state: 'published' } },
    { item: { date: '2026-08-29', state: 'published', resolved_date: '2026-09-01' } },
    { item: { date: '2026-08-30', state: 'learning' } }
  ]
});
assert.strictEqual(
  getAddedRecords('2026-08-29').length,
  3,
  'published items must remain in their original added-date history'
);

console.log('custom page logic tests passed: photo counts and reading history');
