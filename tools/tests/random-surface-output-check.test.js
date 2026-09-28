'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateRandomSurfaceOutput } = require('../random-surface-output-check');

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'random-surface-'));
  fs.mkdirSync(path.join(root, 'random'), { recursive: true });
  return root;
}

function writeFixture(root, randomUrls = ['/memory/', '/dual/']) {
  const records = [
    { kind: 'article', url: '/memory/', categories: ['生活'], surfaces: ['memory'] },
    { kind: 'article', url: '/profile/', categories: ['工作'], surfaces: ['profile'] },
    { kind: 'article', url: '/dual/', categories: ['工作'], surfaces: ['profile', 'memory'] },
    { kind: 'article', url: '/admin/', categories: ['站務'], surfaces: ['memory'] }
  ];
  fs.writeFileSync(path.join(root, 'navigation-index.json'), JSON.stringify({ records }));
  fs.writeFileSync(path.join(root, 'random.json'), JSON.stringify(randomUrls.map(url => ({ url, title: url }))));
  fs.mkdirSync(path.join(root, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(root, 'memory', 'index.html'), "fetch('/random.json')");
  fs.writeFileSync(path.join(root, 'random', 'index.html'), "<script>var dataUrl = '/random.json'; fetch(dataUrl); var key = 'random-tape-selection-v1'; function restoreSelection() {}</script>");
}

{
  const root = fixtureRoot();
  writeFixture(root);
  assert.deepStrictEqual(validateRandomSurfaceOutput(root).errors, [], 'memory and dual articles should pass while profile-only and station articles stay out');
  fs.rmSync(root, { recursive: true, force: true });
}

{
  const root = fixtureRoot();
  writeFixture(root, ['/memory/', '/profile/', '/dual/', '/dual/']);
  const errors = validateRandomSurfaceOutput(root).errors;
  assert(errors.includes('random_set_mismatch'));
  assert(errors.includes('random_urls_not_unique'));
  assert(errors.includes('profile_only_in_random'));
  assert(errors.includes('dual_article_not_single'));
  fs.rmSync(root, { recursive: true, force: true });
}
