'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkHtml, checkSource } = require('../surface-accessibility-check');

function page(extra = '', { article = false } = {}) {
  return `<body><a class="skip-link" href="#main-content">跳到主要內容</a><header><a href="/">首頁</a></header><main><div class="main-inner" id="main-content" tabindex="-1"><nav class="surface-switch" aria-label="雙面導覽"><a class="surface-switch-link" href="/profile/">SIDE A／看工作與學習</a></nav><header><h1>工作與學習</h1></header>${extra}${article ? '<nav class="post-surface-marker" aria-label="文章收錄面向"><a href="/">個人記憶庫</a></nav><aside class="post-thinking-status" aria-labelledby="post-thinking-status-title"><h2 id="post-thinking-status-title">🚧 當前假設／探索中</h2><span>最近校準</span><span>目前適用邊界</span></aside><article class="post-content-single"><div class="post-body">正文</div></article>' : ''}</div></main></body>`;
}

test('accepts core page semantics and neutral article ordering', () => {
  assert.deepEqual(checkHtml(page('<section aria-labelledby="section-title"><h2 id="section-title">入口</h2><a href="/one/">第一篇文章</a></section>'), 'profile/index.html'), []);
  assert.deepEqual(checkHtml(page('', { article: true }), 'post.html', { article: true }), []);
});

test('rejects duplicate IDs and missing aria label targets', () => {
  const errors = checkHtml(page('<h2 id="section">標題</h2><p id="section">重複</p><section aria-labelledby="absent">內容</section>'), 'profile/index.html');
  assert.ok(errors.includes('duplicate_id'));
  assert.ok(errors.includes('missing_label_target'));
});

test('rejects empty accessible names, positive tabindex, and small switch targets', () => {
  const html = page().replace('SIDE A／看工作與學習', '').replace('href="/profile/"', 'href="/profile/" tabindex="2"');
  assert.ok(checkHtml(html, 'profile/index.html').includes('empty_name'));
  assert.ok(checkHtml(html, 'profile/index.html').includes('positive_tabindex'));
  const source = { switch: '.surface-switch-link { min-height: 36px; min-width: 44px; }', home: '', layout: '', accessibility: '', transition: '', transitionJs: '', mainCss: '', boot: '' };
  assert.ok(checkSource(source).includes('surface_switch_target_too_small'));
});

test('profile heatmap exposes named scroll, chart, date controls, and article links', () => {
  const calendar = '<section data-profile-article-calendar><div class="profile-calendar-scroll" tabindex="0" aria-label="全年熱力圖，可水平捲動"><div id="profile-calendar-chart" role="img" aria-label="2026 工作與學習文章活動熱力圖"></div><div data-profile-calendar-controls role="group" aria-label="選擇有文章的日期"><button class="profile-calendar-day-control" type="button" aria-label="2026-09-27，1 次工作與學習文章活動"></button></div></div><p data-profile-calendar-fallback>熱力圖載入中<a href="/profile/articles/">文章庫</a></p><a class="profile-calendar-article" href="/work/sample/"><span class="profile-calendar-event-label">發表</span><span class="profile-calendar-article-title">測試文章</span></a></section>';
  assert.deepEqual(checkHtml(page(calendar), 'profile/index.html'), []);
  const invalid = calendar.replace('aria-label="選擇有文章的日期"', '').replace('aria-label="2026-09-27，1 次工作與學習文章活動"', '');
  const errors = checkHtml(page(invalid), 'profile/index.html');
  assert.ok(errors.includes('profile_calendar_controls_name_invalid'));
  assert.ok(errors.includes('profile_calendar_day_button_name_invalid'));
});

test('rejects missing reduced motion and anchor interception contracts', () => {
  const sources = { layout: '<body><a class="skip-link" href="#main-content">跳到主要內容</a><div class="main-inner" id="main-content" tabindex="-1">', switch: '.surface-switch-link { min-height: 44px; min-width: 44px; } .surface-switch-link:focus-visible { outline: 3px solid; }', home: '.index .home-profile-bridge a { min-width: 44px; min-height: 44px; } .home-profile-bridge a:focus-visible {}', accessibility: '.skip-link:focus-visible {} [role="button"][tabindex="0"]:focus-visible {}', transition: '@media (prefers-reduced-motion: reduce) { animation-duration: 0s; transform: none; }', transitionJs: "if (reduced()) return; win.sessionStorage.setItem('x', 'y'); if (reduced()) return; main.classList.add('x');", mainCss: "@import '_custom/accessibility';", boot: "[role=\"button\"][tabindex=\"0\"] event.key === 'Enter' button.click() event.key === ' ' button.click() dataset.spacePressed" };
  assert.deepEqual(checkSource(sources), []);
  sources.transition = '@media (prefers-reduced-motion: reduce) { animation: none; transform: none; }';
  sources.transitionJs += 'event.preventDefault();';
  const errors = checkSource(sources);
  assert.ok(errors.includes('reduced_motion_css_incomplete'));
  assert.ok(errors.includes('surface_anchor_navigation_intercepted'));
});

test('rejects article marker or thinking block after article body', () => {
  const original = '<nav class="post-surface-marker" aria-label="文章收錄面向"><a href="/">個人記憶庫</a></nav><aside class="post-thinking-status" aria-labelledby="post-thinking-status-title"><h2 id="post-thinking-status-title">🚧 當前假設／探索中</h2><span>最近校準</span><span>目前適用邊界</span></aside><article class="post-content-single"><div class="post-body">正文</div></article>';
  const reordered = '<article class="post-content-single"><div class="post-body">正文</div></article><nav class="post-surface-marker" aria-label="文章收錄面向"><a href="/">個人記憶庫</a></nav><aside class="post-thinking-status" aria-labelledby="post-thinking-status-title"><h2 id="post-thinking-status-title">🚧 當前假設／探索中</h2><span>最近校準</span><span>目前適用邊界</span></aside>';
  const html = page('', { article: true }).replace(original, reordered);
  assert.ok(checkHtml(html, 'post.html', { article: true }).includes('article_marker_order_invalid'));
  const thinkingOriginal = original;
  const thinkingReordered = '<nav class="post-surface-marker" aria-label="文章收錄面向"><a href="/">個人記憶庫</a></nav><article class="post-content-single"><div class="post-body">正文</div></article><aside class="post-thinking-status" aria-labelledby="post-thinking-status-title"><h2 id="post-thinking-status-title">🚧 當前假設／探索中</h2><span>最近校準</span><span>目前適用邊界</span></aside>';
  const thinkingRegression = page('', { article: true }).replace(thinkingOriginal, thinkingReordered);
  assert.ok(checkHtml(thinkingRegression, 'post.html', { article: true }).includes('article_thinking_order_invalid'));
});
