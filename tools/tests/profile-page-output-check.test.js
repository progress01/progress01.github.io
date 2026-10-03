'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfilePage, formatDiagnostics } = require('../profile-page-output-check');
const { validateProfileLibrary } = require('../profile-library-output-check');
const { index, page, config } = require('./helpers/profile-library');

const codes = result => result.errors.map(error => error.code);

test('profile home lists every article with search', () => {
  const result = validateProfilePage({ html: page('home'), config, navigationIndex: index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
  assert.equal(result.tagCount, 3);
});

test('rejects missing search, changed links, and old heatmap', () => {
  let html = page().replace('id="profile-home-query"', 'id="wrong-query"');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_home_search_invalid'));
  html = page().replace('href="/newest/"', 'href="/wrong/"');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_home_articles_invalid'));
  html = page().replace('</section></body>', '<script src="/lib/echarts.min.js"></script></section></body>');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_home_calendar_rendered'));
});

test('rejects old curated path UI and internal curation text on cover', () => {
  let html = page().replace('</section></body>', '<section class="profile-path">old path</section></section></body>');
  assert.ok(codes(validateProfilePage({ html, config, navigationIndex: index })).includes('profile_cover_legacy_curation_rendered'));
  html = page().replace('</section></body>', '<p>internal curation</p></section></body>');
  const result = validateProfilePage({ html, config, navigationIndex: index });
  assert.ok(codes(result).includes('profile_library_internal_curation_leaked'));
  assert.doesNotMatch(formatDiagnostics(result).join(' '), /internal curation|secret reason/);
});

test('home and article library are distinct; archive keeps all profile article URLs', () => {
  const result = validateProfileLibrary({ route: 'compatibility', html: page('compatibility'), config, navigationIndex: index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
});
