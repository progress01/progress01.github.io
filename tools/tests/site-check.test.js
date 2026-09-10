const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkUrl, checkDocument } = require('../site-check');

const options = {
  origin: 'https://progress01.github.io',
  files: new Set(['index.html', 'learning/roadmap/index.html', 'images/封面.webp']),
  externalProjects: [{ path: '/lifecheck/' }]
};

test('摘要連結依所在頁面解析，能攔截分頁上的相對連結回歸', () => {
  assert.equal(checkUrl('../roadmap/', 'learning/lesson/index.html', options), null);
  assert.match(checkUrl('../roadmap/', 'page/2/index.html', options), /站內目標不存在/);
  assert.equal(checkUrl('/learning/roadmap/', 'page/2/index.html', options), null);
});

test('接受中文路徑、已知獨立專案與外站；仍攔截其他缺檔與大小寫錯誤', () => {
  assert.equal(checkUrl('/images/%E5%B0%81%E9%9D%A2.webp', 'index.html', options), null);
  assert.equal(checkUrl('/lifecheck/', 'index.html', options), null);
  assert.equal(checkUrl('https://example.org/page/', 'index.html', options), null);
  assert.match(checkUrl('/lifecheck-missing/', 'index.html', options), /不存在/);
  assert.match(checkUrl('/learning/Roadmap/', 'index.html', options), /不存在/);
});

test('實際 HTML 中的缺檔與錯誤圖牆數字會讓檢查失敗', () => {
  const html = '<a href="../roadmap/">索引</a>' +
    '<button data-photo-wall-filter="all"><span>1</span></button>' +
    '<button data-photo-wall-filter="music"><span>1</span></button>' +
    '<section data-photo-wall-section="music"><div class="ig-card"></div><div class="ig-card"></div></section>';
  const { errors } = checkDocument(html, 'page/2/index.html', options);
  assert.equal(errors.length, 3);
  assert.ok(errors.some(error => error.includes('all 徽章應為 2')));
  assert.ok(errors.some(error => error.includes('music 徽章應為 2')));
});
