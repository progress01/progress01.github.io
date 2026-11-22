'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sortPhotoWall } = require('../../scripts/photo-wall-order');

function card(name, href = `/listen/${name}/`, src = `/images/${name}.webp`) {
  return `<div class="ig-card"><a href="${href}" target="_blank"><img loading="lazy" src="${src}" alt="${name}"></a></div>`;
}
function section(key, cards) {
  return `<section data-photo-wall-section="${key}"><header>${key}</header><div data-photo-wall-grid="${key}">${cards.join('\n')}</div></section>`;
}
function post(name, date, updated = '2030-01-01') {
  return { path: `listen/${name}/`, cover: `/images/${name}.webp`, date: new Date(`${date}T04:00:00Z`), updated };
}

test('sorts each category by publication date, preserving card markup, comments, controls and ties', () => {
  const old = card('old', 'https://open.spotify.com/track/old');
  const first = card('first');
  const second = card('second');
  const film = card('film');
  const input = '<nav>filters</nav>' + section('music', [old, '<!-- import -->', first, second]) + section('films', [film]) + '<script>filters()</script>';
  const posts = [post('old', '2020-01-01'), post('first', '2026-01-01'), post('second', '2026-01-01'), post('film', '2027-01-01')];
  posts[2].date = new Date('2026-01-01T15:00:00Z'); // Later time, same Taipei publication day.
  const result = sortPhotoWall(input, posts);
  const expected = '<nav>filters</nav>' + section('music', [first, '<!-- import -->', second, old]) + section('films', [film]) + '<script>filters()</script>';
  assert.equal(result.content, expected);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(result.sections, [{key: 'music', count: 3, dated: 3}, {key: 'films', count: 1, dated: 1}]);
  assert.equal(sortPhotoWall(result.content, posts).content, result.content);
});

test('uses decoded article links when a cover is absent or shared, without using updated dates', () => {
  const old = card('old', '/listen/%E8%88%8A/', '/images/shared.webp');
  const newer = card('newer', '/listen/newer/', '/images/shared.webp');
  const posts = [
    { ...post('old', '2020-01-01', '2030-01-01'), path: 'listen/舊/', cover: '/images/shared.webp' },
    { ...post('newer', '2026-01-01'), cover: '/images/shared.webp' }
  ];
  assert.equal(sortPhotoWall(section('books', [old, newer]), posts).content, section('books', [newer, old]));
  delete posts[1].cover;
  assert.equal(sortPhotoWall(section('books', [old, newer]), posts).content, section('books', [newer, old]));
});

test('keeps unknown and ambiguous cards in their slots and reorders after adding or changing a date', () => {
  const old = card('old');
  const unknown = card('unknown');
  const newer = card('newer');
  const input = section('music', [old, unknown, newer]);
  const posts = [post('old', '2020-01-01'), post('newer', '2026-01-01')];
  const result = sortPhotoWall(input, posts);
  assert.equal(result.content, section('music', [newer, unknown, old]));
  assert.equal(result.unmatched.length, 1);
  posts.push(post('unknown', '2027-01-01'));
  assert.equal(sortPhotoWall(input, posts).content, section('music', [unknown, newer, old]));
  posts[0].date = new Date('2028-01-01T04:00:00Z');
  assert.equal(sortPhotoWall(input, posts).content, section('music', [old, unknown, newer]));
  const ambiguous = { ...post('other', '2029-01-01'), cover: '/images/unknown.webp' };
  const coverOnly = section('music', [card('unknown', 'https://open.spotify.com/track/unknown')]);
  assert.equal(sortPhotoWall(coverOnly, [...posts, ambiguous]).unmatched.length, 1);
});
