'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSurfaceControls } = require('../surface-control-output-check');

const config = {
  version: 1,
  controls: {
    memory: { target: 'profile', href: '/', label: 'SIDE A／看工作與學習' },
    profile: { target: 'memory', href: '/memory/', label: 'SIDE B／翻到個人記憶庫' }
  }
};

function page(surface, content) {
  const item = config.controls[surface];
  return `<div class="main-inner"><nav class="surface-switch surface-switch--${surface}" aria-label="雙面導覽" data-current-surface="${surface}"><a class="surface-switch-link" href="${item.href}" data-target-surface="${item.target}"><span class="surface-switch-cassette" aria-hidden="true"></span>${item.label}</a></nav>${content}</div>`;
}

function fixtures() {
  return {
    'index.html': page('profile', '<div class="profile-home"></div>'),
    'profile/index.html': page('profile', '<div class="profile-home"></div>'),
    'profile/articles/index.html': page('profile', '<div class="profile-home"></div>'),
    'memory/index.html': page('memory', '<section class="home-landing"></section>')
  };
}

function codes(result) { return result.errors.map(error => error.code); }

test('accepts one ordinary, accessible switch before each surface page body', () => {
  const result = validateSurfaceControls({ config, pages: fixtures() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.pageCount, 4);
});

test('rejects changed route truth or visible accessible label', () => {
  const pages = fixtures();
  pages['memory/index.html'] = pages['memory/index.html'].replace('href="/"', 'href="/profile/"');
  pages['profile/index.html'] = pages['profile/index.html'].replace('SIDE B／翻到個人記憶庫', '翻面');
  const result = validateSurfaceControls({ config, pages });
  assert.equal(codes(result).filter(code => code === 'surface_control_link_invalid').length, 2);
});

test('rejects a visible current-side badge that conflicts with destination copy', () => {
  const pages = fixtures();
  pages['profile/index.html'] = pages['profile/index.html'].replace(
    '<span class="surface-switch-cassette"',
    '<span class="surface-switch-current-side" aria-hidden="true"></span><span class="surface-switch-cassette"'
  );
  assert.ok(codes(validateSurfaceControls({ config, pages })).includes('surface_control_decoration_invalid'));
});

test('rejects JavaScript-dependent controls, duplicates and controls placed after content', () => {
  const pages = fixtures();
  pages['index.html'] = pages['index.html'].replace('class="surface-switch-link"', 'class="surface-switch-link" onclick="flip()"');
  pages['profile/index.html'] = pages['profile/index.html'].replace('</div>', '<nav class="surface-switch"></nav></div>');
  const item = config.controls.profile;
  pages['profile/articles/index.html'] = `<div class="main-inner"><div class="profile-home"></div><nav class="surface-switch" aria-label="雙面導覽" data-current-surface="profile"><a class="surface-switch-link" href="${item.href}" data-target-surface="${item.target}">${item.label}</a></nav></div>`;
  const result = validateSurfaceControls({ config, pages });
  assert.ok(codes(result).includes('surface_control_script_dependency'));
  assert.ok(codes(result).includes('surface_control_count_invalid'));
  assert.ok(codes(result).includes('surface_control_position_invalid'));
});

test('rejects unapproved configuration values', () => {
  const changed = JSON.parse(JSON.stringify(config));
  changed.controls.memory.label = '私人模式';
  assert.ok(codes(validateSurfaceControls({ config: changed, pages: fixtures() })).includes('surface_control_value_invalid'));
});
