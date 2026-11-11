const assert = require('assert');
const { updatePhotoWallCounts } = require('../../scripts/photo-wall-counts.js');

const fixture = [
  '<nav>',
  '  <button data-photo-wall-filter="all">全部 <span>0</span></button>',
  '  <button data-photo-wall-filter="music">歌曲推薦 <span>0</span></button>',
  '  <button data-photo-wall-filter="books">閱讀心得 <span>0</span></button>',
  '  <button data-photo-wall-filter="films">觀影心得 <span>0</span></button>',
  '</nav>',
  '<section data-photo-wall-section="music"><div class="ig-grid">',
  '  <div class="ig-card"></div><div class="ig-card"></div>',
  '</div></section>',
  '<section data-photo-wall-section="books"><div class="ig-card"></div></section>',
  '<section data-photo-wall-section="films"></section>'
].join('\n');
const counted = updatePhotoWallCounts(fixture);
assert.match(counted, /data-photo-wall-filter="all"[^>]*>全部 <span>3<\/span>/);
assert.match(counted, /data-photo-wall-filter="music"[^>]*>歌曲推薦 <span>2<\/span>/);
assert.match(counted, /data-photo-wall-filter="books"[^>]*>閱讀心得 <span>1<\/span>/);
assert.match(counted, /data-photo-wall-filter="films"[^>]*>觀影心得 <span>0<\/span>/);
assert.strictEqual(updatePhotoWallCounts(counted), counted, 'photo counters must be idempotent');
const withNewCard = updatePhotoWallCounts(counted.replace('<div class="ig-grid">', '<div class="ig-grid"><div class="ig-card"></div>'));
assert.match(withNewCard, /data-photo-wall-filter="all"[^>]*>全部 <span>4<\/span>/);
assert.match(withNewCard, /data-photo-wall-filter="music"[^>]*>歌曲推薦 <span>3<\/span>/);

console.log('custom page logic tests passed: photo counts');
