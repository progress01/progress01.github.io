'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSurfaceHistory } = require('../surface-history-output-check');

const sources = {
  pjax: `const pjax = new Pjax({ selectors: ['.site-nav', '.main-inner'] });\ndocument.addEventListener('pjax:success', () => { NexT.boot.refresh(); });`,
  menu: `const use_profile_menu = page_path.indexOf('profile/') === 0;`,
  control: `<a href="/profile/">A</a>`,
  post: `const canonicalPostUrl = post.permalink;`,
  head: `{% set canonical = url %}<link rel="canonical" href="{{ canonical }}">`
};
const article = { id: 'article:/dual/', kind: 'article', url: '/dual/', surfaces: ['profile', 'memory'] };
const index = { records: [article] };

function menu(surface) { return `<nav class="site-nav"><ul class="main-menu" data-navigation-surface="${surface}"></ul></nav>`; }
function entries() {
  return {
    'index.html': `${menu('memory')}<script src="/js/next-boot.js"></script>`,
    'profile/index.html': `${menu('profile')}<section data-profile-article-home><a class="profile-home-article-link" href="/work/sample/">文章</a></section>`,
    'profile/articles/index.html': `${menu('profile')}<section data-profile-article-library><ul data-profile-article-list><li data-profile-article-row><a class="profile-list-link" href="/dual/">dual</a></li></ul></section>`,
    'archives/index.html': `${menu('memory')}<a class="archive-article-link" href="/dual/">dual</a>`,
    'dual/index.html': `${menu('memory')}<link rel="canonical" href="https://example.test/dual/"><article><nav class="post-surface-marker" data-surfaces="profile memory"></nav></article>`
  };
}
function errors(options = {}) {
  return validateSurfaceHistory({ root: '.', index, pages: entries(), sources, ...options }).errors.map(error => error.code);
}

test('accepts a shared ordinary article link from A and B with one neutral canonical route', () => {
  const result = validateSurfaceHistory({ root: '.', index, pages: entries(), sources });
  assert.deepEqual(result.errors, []);
  assert.equal(result.targetUrl, '/dual/');
});

test('uses the A article homepage and article library to find dual history links', () => {
  const pages = entries();
  pages['profile/articles/index.html'] = pages['profile/articles/index.html'].replace('href="/dual/"', 'href="/profile/articles/"');
  const codes = validateSurfaceHistory({ root: '.', index, pages, sources }).errors.map(error => error.code);
  assert.ok(codes.includes('surface_history_dual_article_not_linked_from_profile'));
});

test('rejects stale PJAX menu selectors and missing refresh integration', () => {
  const changed = { ...sources, pjax: `const pjax = new Pjax({ selectors: ['.main-inner'] });` };
  const codes = errors({ sources: changed });
  assert.ok(codes.includes('surface_history_pjax_menu_selector_missing'));
  assert.ok(codes.includes('surface_history_pjax_refresh_missing'));
});

test('rejects surface memory, referrer inference and forced navigation state', () => {
  const changed = { ...sources, control: `<script>sessionStorage.setItem('surface', document.referrer); location.assign('/profile/');</script>` };
  assert.ok(errors({ sources: changed }).includes('surface_history_state_or_redirect_forbidden'));
});

test('rejects duplicate article canonical URLs and non-ordinary entry links', () => {
  const pages = entries();
  pages['dual/index.html'] = pages['dual/index.html'].replace('href="https://example.test/dual/"', 'href="https://example.test/profile/"');
  pages['archives/index.html'] = pages['archives/index.html'].replace('<a class="archive-article-link"', '<a onclick="openArticle()" class="archive-article-link"');
  const codes = errors({ pages });
  assert.ok(codes.includes('surface_history_article_canonical_invalid'));
  assert.ok(codes.includes('surface_history_entry_link_invalid'));
});

test('rejects a second output route for the same article', () => {
  const changed = { records: [article, { ...article, id: 'article:/dual-copy/', url: '/dual/' }] };
  const result = validateSurfaceHistory({ root: '.', index: changed, pages: entries(), sources });
  assert.ok(result.errors.some(error => error.code === 'surface_history_article_route_duplicate'));
});
