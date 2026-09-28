'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkSource, checkOutput } = require('../surface-responsive-check');

function sources(css = `.main-inner{min-width:0;overflow-wrap:anywhere}.profile-page .profile-article-list{grid-template-columns:minmax(0,1fr)}.profile-calendar-scroll{overflow-x:auto}.profile-calendar-day-control:focus-visible{outline:2px solid}@media (max-width:767px){.profile-page .profile-article-list{grid-template-columns:minmax(0,1fr)}.index .home-landing-entry-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.surface-switch{position:static}}@media (max-width:430px){.index .home-landing-entry-grid{grid-template-columns:minmax(0,1fr)}}.surface-switch-link{min-width:0;overflow-wrap:anywhere}.profile-list-link{min-height:44px}`) {
  return {
    css, mainCss: "@import '_custom/surface-responsive';", profile: '.profile-page .profile-article-list{}.profile-page .profile-list-link{grid-template-columns:100px minmax(0,1fr)}', home: '.home-landing-entry-grid{}',
    homeTemplate: '<nav class="home-landing-entry-grid"></nav>',
    switchCss: '.surface-switch-link{}', accessCss: '.skip-link:focus-visible{}',
    profileTemplate: '<section class="profile-article-calendar"></section>',
    articlesTemplate: '<section class="profile-article-library"></section>',
    profileCalendarTemplate: '<section class="profile-calendar-scroll"><div id="profile-calendar-chart"></div><div data-profile-calendar-controls></div></section>',
    profileCalendarJs: "document.addEventListener('pjax:success', boot)",
    profileLibraryTemplate: '<div data-profile-tag-filters></div><ul data-profile-article-list></ul>',
    postTemplate: '<nav class="post-surface-marker"></nav>'
  };
}
function outputPages() {
  const frame = content => `<html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/css/main.css"></head><body><main><div class="main-inner">${content}</div></main></body></html>`;
  return {
    'index.html': frame('<nav class="surface-switch"></nav><section class="profile-article-calendar"><div class="profile-calendar-scroll"><div id="profile-calendar-chart"></div><div data-profile-calendar-controls></div></div></section>'),
    'profile/index.html': frame('<nav class="surface-switch"></nav><section class="profile-article-calendar"><div class="profile-calendar-scroll"><div id="profile-calendar-chart"></div><div data-profile-calendar-controls></div></div></section>'),
    'profile/articles/index.html': frame('<nav class="surface-switch"></nav><ul data-profile-article-list><li><a class="profile-list-link"></a></li></ul>'),
    'memory/index.html': frame('<nav class="surface-switch"></nav><nav class="home-landing-entry-grid"></nav><section class="home-random-card"><div class="home-archive-rail-main"></div><div class="home-profile-bridge"></div></section>'),
    'work/flow-friendly-work-system/index.html': frame('<article class="post-content-single"><nav class="post-surface-marker"></nav></article>')
  };
}
const codes = result => result.map(error => error.code);

test('accepts the source responsive safety contract and five route outputs', () => {
  assert.deepEqual(checkSource(sources()), []);
  const result = checkOutput({ pages: outputPages() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.pageCount, 5);
});

test('rejects hidden overflow, clamping, fixed cards, and nowrap', () => {
  const css = `${sources().css}.post-body{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2}.profile-list-link{height:150px}.surface-switch-link{white-space:nowrap}`;
  const found = codes(checkSource(sources(css)));
  for (const code of ['overflow_hidden_forbidden', 'text_clamp_forbidden', 'fixed_card_height_forbidden', 'switch_nowrap_forbidden']) assert.ok(found.includes(code), code);
});

test('rejects missing mobile single-column flow and overlay switch positioning', () => {
  const css = `.profile-page .profile-article-list{grid-template-columns:repeat(2,minmax(0,1fr))}@media (max-width:767px){.surface-switch{position:fixed}}.main-inner{min-width:0;overflow-wrap:anywhere}`;
  const found = codes(checkSource(sources(css)));
  assert.ok(found.includes('mobile_single_column_missing'));
  assert.ok(found.includes('switch_overlay_position_forbidden'));
});

test('requires the real homepage entry selector and preserves the 430px single-column rule', () => {
  const typo = sources().css.replaceAll('.home-landing-entry-grid', '.home-landing-grid');
  const found = codes(checkSource(sources(typo)));
  assert.ok(found.includes('home_entry_selector_mismatch'));
  assert.ok(found.includes('home_entry_767_selector_or_grid_missing'));
  assert.ok(found.includes('home_entry_430_single_column_missing'));
  assert.ok(codes(checkSource({ ...sources(), homeTemplate: '<nav class="not-the-entry-grid"></nav>' })).includes('home_entry_template_hook_missing'));
});

test('rejects missing viewport metadata, switch/article hooks, and empty template hooks', () => {
  const pages = outputPages(); pages['profile/index.html'] = pages['profile/index.html'].replace(/<meta name="viewport"[^>]*>/, '').replace('class="surface-switch"', 'class="different"');
  const out = codes(checkOutput({ pages }).errors);
  assert.ok(out.includes('viewport_meta_missing'));
  assert.ok(out.includes('surface_switch_hook_missing'));
  assert.ok(codes(checkSource({ ...sources(), articlesTemplate: '<div></div>' })).includes('profile_library_template_hooks_missing'));
});
