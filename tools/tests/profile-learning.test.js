'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getRecentProfileLearningPosts } = require('../lib/profile-learning');

const profileHome = { paths: [{ items: [{ url: '/learning/represented-in-path/' }] }] };
const post = (path, options = {}) => ({
  source: `_posts/${path.split('/').filter(Boolean).at(-1)}.md`,
  path,
  title: `Fixture ${path}`,
  date: new Date('2025-01-01T00:00:00Z'),
  published: true,
  learning: true,
  surfaces: ['profile'],
  ...options
});
const select = (posts, options = {}) => getRecentProfileLearningPosts({ posts, profileHome, ...options });

test('selects up to three in-progress profile posts by publication date', () => {
  const records = [
    post('/learning/older/', { learning_status: '進行中' }),
    post('/learning/represented-in-path/', { learning_status: '進行中', date: new Date('2026-01-01T00:00:00Z') }),
    post('/learning/newest/', { learning_status: '進行中', date: new Date('2026-09-01T00:00:00Z'), updated: new Date('2024-01-01T00:00:00Z') }),
    post('/learning/middle/', { learning_status: '進行中', date: new Date('2026-06-01T00:00:00Z') }),
    post('/learning/memory-only/', { surfaces: ['memory'] }),
    post('/work/not-in-progress/', { learning_status: '已完成' })
  ];
  const result = select(records);
  assert.deepEqual(result.map(record => record.path), ['/learning/newest/', '/learning/middle/', '/learning/represented-in-path/']);
  assert.ok(!result.some(record => record.path === '/learning/older/'));
  assert.ok(!result.some(record => record.path === '/learning/memory-only/'));
});

test('only a stable-manifest legacy profile post is treated as memory, never profile', () => {
  const legacy = post('/learning/legacy/', { surfaces: undefined });
  delete legacy.surfaces;
  const result = select([legacy], { legacyPostSources: new Set([`source/${legacy.source}`]) });
  assert.deepEqual(result, []);
});

test('new missing or invalid surfaces fail with source context; explicit empty result is valid', () => {
  const missing = post('/learning/new/'); delete missing.surfaces;
  assert.throws(() => select([missing]), /source\/_posts\/new\.md \[missing_surfaces\]/);
  const invalid = post('/learning/invalid/', { surfaces: ['PROFILE'] });
  assert.throws(() => select([invalid]), /source\/_posts\/invalid\.md \[unknown_surface\]/);
  assert.deepEqual(select([post('/work/not-learning/', { learning: false })]), []);
});

test('rejects an invalid limit or date instead of silently changing selection', () => {
  assert.throws(() => select([], { limit: 4 }), /profile_learning_limit_invalid/);
  assert.throws(() => select([post('/learning/no-date/', { learning_status: '進行中', date: 'invalid' })]), /source\/_posts\/no-date\.md \[profile_learning_date_invalid\]/);
});
