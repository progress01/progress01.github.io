'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CASES, validateBrandContext } = require('../brand-context-output-check');

function page(context, surfaces) {
  const href = context === 'profile' ? '/' : '/memory/';
  const label = context === 'profile' ? ' aria-label="工作與學習封面" title="工作與學習封面"' : '';
  const marker = surfaces ? `<nav class="post-surface-marker" data-surfaces="${surfaces}"></nav>` : '';
  return `<header><div class="site-meta"><a class="brand" href="${href}"${label}><span class="site-title">DON'T COUNT THE DAYS</span></a></div></header>${marker}`;
}

function fixtures() {
  return Object.fromEntries(CASES.map(item => [item.file, page(item.context, item.surfaces)]));
}

test('validates brand href/name across A routes, A-only post, dual post, and B routes', () => {
  assert.deepEqual(validateBrandContext({ pages: fixtures() }).errors, []);
});

test('rejects misdirected A brand, incorrect accessible name, and dual post inferred as A', () => {
  const pages = fixtures();
  pages['profile/index.html'] = pages['profile/index.html'].replace('href="/"', 'href="/memory/"');
  assert.ok(validateBrandContext({ pages }).errors.some(error => error.code === 'brand_href_invalid'));
  const changed = fixtures();
  changed['work/flow-friendly-work-system/index.html'] = page('profile', 'profile memory');
  assert.ok(validateBrandContext({ pages: changed }).errors.some(error => error.path === 'work/flow-friendly-work-system/index.html'));
});
