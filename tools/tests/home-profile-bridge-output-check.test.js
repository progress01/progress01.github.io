'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateHomeProfileBridge } = require('../home-profile-bridge-output-check');

const memoryControl = { target: 'profile', href: '/', label: 'SIDE A／看工作與學習' };

function markup({ href = '/', linkText = '翻到 A 面 ↗', script = '', extraBridge = '', reverse = false } = {}) {
  const bridge = `<section class="home-profile-bridge" aria-labelledby="home-profile-bridge-title"><span class="home-profile-bridge-label">SIDE A</span><h2 id="home-profile-bridge-title">工作與學習</h2><p>看整理過的經驗與方法</p><a href="${href}" data-target-surface="profile" aria-label="SIDE A／看工作與學習">${linkText}</a>${script}</section>${extraBridge}`;
  const children = reverse
    ? `<div class="home-outro"></div>${bridge}<nav class="home-landing-entry-grid"></nav><section class="home-random-feature"></section>`
    : `<section class="home-random-feature"></section><nav class="home-landing-entry-grid"><a class="home-landing-entry" href="/archives/">全部文章</a><a class="home-landing-entry" href="/reading-log/">生活索引</a><a class="home-landing-entry" href="/reading/">草稿夾</a><a class="home-landing-entry" href="/photos/">記憶圖牆</a></nav>${bridge}<div class="home-outro"></div>`;
  return `<main><section class="home-landing">${children}</section></main>`;
}

function codes(options) {
  return validateHomeProfileBridge({ html: markup(options), memoryControl }).errors.map(error => error.code);
}

test('accepts the short, keyboard-ready bridge after the four B-side entries and before outro', () => {
  assert.deepEqual(codes(), []);
});

test('rejects a changed destination, copy, duplicate bridge, or placement', () => {
  assert.ok(codes({ href: '/profile/' }).includes('home_profile_bridge_link_invalid'));
  assert.ok(codes({ linkText: '開啟完整履歷與工作成果' }).includes('home_profile_bridge_copy_invalid'));
  assert.ok(codes({ extraBridge: '<section class="home-profile-bridge"></section>' }).includes('home_profile_bridge_count_invalid'));
  assert.ok(codes({ reverse: true }).includes('home_profile_bridge_position_invalid'));
});

test('rejects inline script dependency and keeps destination bound to shared control data', () => {
  assert.ok(codes({ script: '<script>window.flip()</script>' }).includes('home_profile_bridge_script_dependency'));
  const changedControl = validateHomeProfileBridge({ html: markup(), memoryControl: { ...memoryControl, href: '/other/' } });
  assert.ok(changedControl.errors.some(error => error.code === 'home_profile_bridge_link_invalid'));
  const missingEntry = markup().replace(/<a class="home-landing-entry" href="\/photos\/">記憶圖牆<\/a>/, '');
  assert.ok(validateHomeProfileBridge({ html: missingEntry, memoryControl }).errors
    .some(error => error.code === 'home_profile_bridge_position_invalid'));
  assert.ok(validateHomeProfileBridge({ html: markup(), memoryControl, otherHtml: ['<section class="home-profile-bridge"></section>'] }).errors
    .some(error => error.code === 'home_profile_bridge_outside_home'));
});
