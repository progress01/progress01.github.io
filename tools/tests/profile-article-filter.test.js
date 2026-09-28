'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readTagFilter, serializeTagFilter, articleMatchesTag } = require('../../themes/next/source/js/profile-article-filter');

test('tag hashes safely round-trip Unicode, spaces, ampersands and punctuation', () => {
  const tags = ['工作 與學習', 'A&B', '<特殊>#', '中文/英文'];
  for (const tag of tags) {
    assert.equal(readTagFilter(serializeTagFilter(tag), new Set(tags)), tag);
  }
});

test('unknown, malformed, or unrelated fragments never imply an active filter', () => {
  const tags = new Set(['known']);
  assert.equal(readTagFilter('', tags), null);
  assert.equal(readTagFilter('#section', tags), null);
  assert.equal(readTagFilter('#tag=unknown', tags), null);
  assert.equal(readTagFilter('#tag=%E0%A4%A', tags), null);
});

test('all mode shows every article and a tag selects only matching list entries', () => {
  const posts = [{ tags: ['A', 'B'] }, { tags: ['B'] }, { tags: [] }];
  assert.deepEqual(posts.map(post => articleMatchesTag(post.tags, null)), [true, true, true]);
  assert.deepEqual(posts.map(post => articleMatchesTag(post.tags, 'B')), [true, true, false]);
  assert.deepEqual(posts.map(post => articleMatchesTag(post.tags, 'A')), [true, false, false]);
});
