'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePostSurfaces } = require('../post-surface-output-check');

const index = {
  records: [
    { id: 'article:/a/', kind: 'article', url: '/a/', surfaces: ['profile'] },
    { id: 'article:/b/', kind: 'article', url: '/b/', surfaces: ['memory'] },
    { id: 'article:/dual/', kind: 'article', url: '/dual/', surfaces: ['profile', 'memory'] }
  ]
};

function marker(surfaces) {
  const items = {
    profile: '<a class="post-surface-marker-link post-surface-marker-link--profile" href="/" data-surface="profile">工作與學習</a>',
    memory: '<a class="post-surface-marker-link post-surface-marker-link--memory" href="/memory/" data-surface="memory">個人記憶庫</a>'
  };
  return `<nav class="post-surface-marker" aria-label="文章收錄面向" data-surfaces="${surfaces.join(' ')}"><span class="post-surface-marker-label">收錄於</span>${surfaces.map(key => items[key]).join('<span class="post-surface-marker-separator" aria-hidden="true">・</span>')}</nav>`;
}

function page(surfaces) {
  return `<article class="post-content post-content-single"><header class="post-header"></header>${marker(surfaces)}<div class="post-body"></div></article>`;
}

function fixtures() {
  return {
    'a/index.html': page(['profile']),
    'b/index.html': page(['memory']),
    'dual/index.html': page(['profile', 'memory'])
  };
}

function codes(result) { return result.errors.map(error => error.code); }

test('accepts one data-driven marker between each article header and body', () => {
  const result = validatePostSurfaces({ index, pages: fixtures() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 3);
  assert.deepEqual(result.counts, { profile: 1, memory: 1, dual: 1 });
});

test('rejects wrong links, labels and duplicated markers', () => {
  const pages = fixtures();
  pages['a/index.html'] = pages['a/index.html'].replace('href="/"', 'href="/profile/"');
  pages['b/index.html'] = pages['b/index.html'].replace('個人記憶庫', '私人內容');
  pages['dual/index.html'] = pages['dual/index.html'].replace('</article>', `${marker(['profile', 'memory'])}</article>`);
  const result = validatePostSurfaces({ index, pages });
  assert.equal(codes(result).filter(code => code === 'post_surface_marker_links_invalid').length, 2);
  assert.ok(codes(result).includes('post_surface_marker_count_invalid'));
});

test('rejects script-dependent or misplaced markers', () => {
  const pages = fixtures();
  pages['a/index.html'] = pages['a/index.html'].replace('data-surface="profile"', 'data-surface="profile" onclick="flip()"');
  pages['b/index.html'] = `<article class="post-content post-content-single">${marker(['memory'])}<header class="post-header"></header><div class="post-body"></div></article>`;
  const result = validatePostSurfaces({ index, pages });
  assert.ok(codes(result).includes('post_surface_marker_script_dependency'));
  assert.ok(codes(result).includes('post_surface_marker_position_invalid'));
});

test('rejects duplicate article routes and unsupported surface values', () => {
  const changed = JSON.parse(JSON.stringify(index));
  changed.records[1].url = '/a/';
  changed.records[2].surfaces = ['unknown'];
  const result = validatePostSurfaces({ index: changed, pages: fixtures() });
  assert.ok(codes(result).includes('post_surface_article_route_invalid'));
  assert.ok(codes(result).includes('post_surface_index_value_invalid'));
});
