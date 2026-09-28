'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getProfileArticles, getProfileArticleLibrary, getProfileArticleCalendar, readTagNames, summarizeTagCounts } = require('../lib/profile-articles');

const post = (url, date, surfaces = ['profile'], extra = {}) => ({
  source: `source/_posts${url.slice(0, -1)}.md`, path: url, title: `Title ${url}`,
  date: new Date(`${date}T12:00:00Z`), published: true, surfaces, ...extra
});

test('returns every eligible profile post newest-first with stable ties', () => {
  const posts = [
    post('/profile/older/', '2025-01-01'),
    post('/profile/newer-b/', '2026-09-01'),
    post('/profile/newer-a/', '2026-09-01'),
    post('/memory-only/', '2026-10-01', ['memory']),
    post('/draft/', '2026-11-01', ['profile'], { draft: true })
  ];
  assert.deepEqual(getProfileArticles({ posts }).map(item => item.path), [
    '/profile/newer-a/', '/profile/newer-b/', '/profile/older/'
  ]);
});

test('legacy records stay memory-only; missing new surfaces and invalid dates fail with source', () => {
  const legacy = post('/legacy/', '2024-01-01', undefined);
  delete legacy.surfaces;
  assert.deepEqual(getProfileArticles({ posts: [legacy], legacyPostSources: new Set([legacy.source]) }), []);
  const missing = post('/new/', '2024-01-01', undefined);
  delete missing.surfaces;
  assert.throws(() => getProfileArticles({ posts: [missing] }), /surface/);
  assert.throws(() => getProfileArticles({ posts: [post('/bad-date/', 'invalid')] }), /profile_articles_date_invalid/);
});

test('library tags are unique per article, overlapping across posts, and deterministically sorted', () => {
  const posts = [
    post('/a/', '2026-09-03', ['profile'], { tags: [{ name: '常見' }, { name: '常見' }, { name: 'Ａ&B' }] }),
    post('/b/', '2026-09-02', ['profile'], { tags: [{ name: '常見' }, { name: '<特殊>' }] }),
    post('/c/', '2026-09-01', ['profile'], { tags: ['Ａ&B', '<特殊>'] }),
    post('/memory/', '2026-09-04', ['memory'], { tags: ['不應出現'] })
  ];
  const library = getProfileArticleLibrary({ posts });
  assert.equal(library.total, 3);
  assert.deepEqual(library.articles.map(article => article.path), ['/a/', '/b/', '/c/']);
  assert.deepEqual(library.tags, [
    { name: '<特殊>', count: 2 },
    { name: '常見', count: 2 },
    { name: 'Ａ&B', count: 2 }
  ]);
  assert.deepEqual(readTagNames({ tags: [{ name: ' a ' }, { name: '' }, 'a'] }), ['a']);
  assert.deepEqual(summarizeTagCounts([{ tags: ['x', 'x'] }, { tags: ['x', 'y'] }]), [
    { name: 'x', count: 2 }, { name: 'y', count: 1 }
  ]);
});

test('calendar counts publication events and groups same-day records deterministically', () => {
  const posts = [post('/older/', '2025-01-01'), post('/newest/', '2026-09-03'), post('/same-day-b/', '2026-09-02'), post('/same-day-a/', '2026-09-02'), post('/same-day-early/', '2026-09-02'), post('/february/', '2026-02-01'), post('/july/', '2026-07-08'), post('/memory/', '2026-10-01', ['memory'])];
  const calendar = getProfileArticleCalendar({ posts });
  assert.equal(calendar.latestYear, '2026');
  assert.equal(calendar.latestDate, '2026-09-03');
  assert.equal(calendar.articleTotal, 7);
  assert.equal(calendar.eventTotal, 7);
  assert.equal(calendar.activeDateCount, 4);
  assert.deepEqual(calendar.counts, { '2026-02-01': 1, '2026-07-08': 1, '2026-09-02': 3, '2026-09-03': 1 });
  assert.deepEqual(calendar.postsByDate['2026-09-02'], [
    { title: 'Title /same-day-a/', url: '/same-day-a/', eventType: 'published', eventLabel: '發表' },
    { title: 'Title /same-day-b/', url: '/same-day-b/', eventType: 'published', eventLabel: '發表' },
    { title: 'Title /same-day-early/', url: '/same-day-early/', eventType: 'published', eventLabel: '發表' }
  ]);
  assert.equal(calendar.postsByDate['2025-01-01'], undefined);
});

test('calendar date keys can follow configured local calendar dates rather than UTC instants', () => {
  const posts = [post('/taipei-new-year/', '2025-12-31', ['profile'])];
  const calendar = getProfileArticleCalendar({ posts, formatDate: () => '2026-01-01' });
  assert.equal(calendar.latestYear, '2026');
  assert.equal(calendar.latestDate, '2026-01-01');
  assert.deepEqual(calendar.counts, { '2026-01-01': 1 });
});

test('calendar records publication plus a distinct-day update, but no duplicate event for same-day or invalid updated', () => {
  const posts = [
    post('/edited/', '2026-09-01', ['profile'], { updated: new Date('2026-09-17T15:00:00Z') }),
    post('/same-day/', '2026-09-17', ['profile'], { updated: new Date('2026-09-17T04:00:00Z') }),
    post('/no-updated/', '2026-09-27'),
    post('/bad-updated/', '2026-09-14', ['profile'], { updated: new Date('invalid') })
  ];
  const calendar = getProfileArticleCalendar({
    posts,
    formatDate: value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
  });
  assert.equal(calendar.articleTotal, 4);
  assert.equal(calendar.eventTotal, 5);
  assert.equal(calendar.latestDate, '2026-09-27');
  assert.equal(calendar.activeDateCount, 4);
  assert.deepEqual(calendar.counts, { '2026-09-01': 1, '2026-09-14': 1, '2026-09-17': 2, '2026-09-27': 1 });
  assert.deepEqual(calendar.postsByDate['2026-09-01'].map(article => [article.url, article.eventType]), [['/edited/', 'published']]);
  assert.deepEqual(calendar.postsByDate['2026-09-17'].map(article => [article.url, article.eventType]), [['/same-day/', 'published'], ['/edited/', 'updated']]);
  assert.deepEqual(calendar.postsByDate['2026-09-27'].map(article => [article.url, article.eventType]), [['/no-updated/', 'published']]);
  assert.deepEqual(calendar.postsByDate['2026-09-14'].map(article => [article.url, article.eventType]), [['/bad-updated/', 'published']]);
  assert.throws(() => getProfileArticleCalendar({ posts: [post('/invalid-both/', 'invalid', ['profile'], { updated: new Date('invalid') })] }), /profile_articles_date_invalid/);
});
