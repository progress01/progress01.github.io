'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfilePage, formatDiagnostics } = require('../profile-page-output-check');
const { validateProfileLibrary } = require('../profile-library-output-check');
const { index, page, config } = require('./helpers/profile-library');

const codes = result => result.errors.map(error => error.code);

test('profile cover renders latest-year heatmap data and a dynamic archive link', () => {
  const result = validateProfilePage({ html: page('home'), config, navigationIndex: index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
  assert.equal(result.tagCount, 3);
  assert.equal(result.eventTotal, 3);
  assert.equal(result.calendarYear, 2026);
  assert.equal(result.calendarCount, 2);
  assert.equal(result.activeDateCount, 2);
});

test('heatmap keeps latest year, omits month ledger, and excludes filters/cards', () => {
  let html = page().replace('class="profile-calendar-year">2026 更新日曆', 'class="profile-calendar-year">2025 更新日曆');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_calendar_heatmap_markup_invalid'));
  html = page().replace('<section class="profile-article-calendar" data-profile-article-calendar', '<section class="profile-article-calendar" data-profile-article-calendar><div data-profile-tag-filters></div>');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_cover_root_invalid'));
  html = page().replace('<section class="profile-article-calendar" data-profile-article-calendar', '<section class="profile-article-calendar" data-profile-article-calendar><article class="profile-cover-main">old card</article>');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_calendar_heatmap_markup_invalid'));
  html = page().replace('"articleTotal":3', '"articleTotal":99');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_calendar_data_invalid'));
});

test('rejects old curated path UI and internal curation text on cover', () => {
  let html = page().replace('</section></body>', '<section class="profile-path">old path</section></section></body>');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_cover_legacy_curation_rendered'));
  html = page().replace('</section></body>', '<p>internal curation</p></section></body>');
  const result = validateProfilePage({ html, config, navigationIndex: index });
  assert.ok(codes(result).includes('profile_library_internal_curation_leaked'));
  assert.doesNotMatch(formatDiagnostics(result).join(' '), /internal curation|secret reason/);
});

test('cover and article library are distinct; archive keeps all profile article URLs', () => {
  const result = validateProfileLibrary({ route: 'compatibility', html: page('compatibility'), config, navigationIndex: index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
});
