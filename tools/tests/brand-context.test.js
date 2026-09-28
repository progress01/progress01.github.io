'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveBrandContext } = require('../lib/brand-context');

const page = (path, surfaces, source = 'source/_posts/sample.md') => {
  const record = { path, source };
  if (surfaces !== undefined) record.surfaces = surfaces;
  return record;
};

test('profile namespace pages, including article-like paths, render in A context', () => {
  assert.equal(resolveBrandContext(page('index.html', undefined, 'source/index.md')), 'profile');
  assert.equal(resolveBrandContext(page('profile/index.html')), 'profile');
  assert.equal(resolveBrandContext(page('profile/articles/index.html')), 'profile');
  assert.equal(resolveBrandContext(page('profile/work-knowledge/index.html', ['profile'])), 'profile');
});

test('article front matter does not override the existing URL navigation context', () => {
  assert.equal(resolveBrandContext(page('memory/index.html', undefined, 'generated index')), 'memory');
  assert.equal(resolveBrandContext(page('2026/sample/index.html', ['memory'])), 'memory');
  assert.equal(resolveBrandContext(page('work/from-solving-problems/', ['profile'])), 'memory');
  assert.equal(resolveBrandContext(page('work/flow-friendly-work-system/index.html', ['profile', 'memory'])), 'memory');
});

test('header server-renders the existing context helper on every direct/PJAX page load', () => {
  const root = path.resolve(__dirname, '../..');
  const template = fs.readFileSync(path.join(root, 'themes/next/layout/_partials/header/brand.njk'), 'utf8');
  const registration = fs.readFileSync(path.join(root, 'scripts/post-surface.js'), 'utf8');
  assert.match(template, /brand_surface_context\(page\)/);
  assert.match(template, /url_for\('\/' if brand_surface === 'profile' else '\/memory\/'\)/);
  assert.match(registration, /helper\.register\('brand_surface_context'/);
  assert.doesNotMatch(template, /location\.|document\.referrer|addEventListener/);
});
