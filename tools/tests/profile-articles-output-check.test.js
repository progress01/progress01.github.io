'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfileArticles } = require('../profile-articles-output-check');
const { index, page, config } = require('./helpers/profile-library');

test('/profile/articles/ remains a compatible view of the same profile-only list', () => {
  const result = validateProfileArticles({ html: page('compatibility'), config, navigationIndex: index });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
});

test('compatibility route rejects an independently edited subset or changed title', () => {
  let html = page('compatibility').replace('href="/oldest/"', 'href="/memory-only/"');
  assert.ok(validateProfileArticles({ html, config, navigationIndex: index }).errors.length);
  html = page('compatibility').replace('工作與學習</h1>', '全部文章</h1>');
  assert.ok(validateProfileArticles({ html, config, navigationIndex: index }).errors.some(error => error.code === 'profile_library_title_invalid'));
});
