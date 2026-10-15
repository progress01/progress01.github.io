'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkSavedPages } = require('../check-pages');

test('Pages check without a deployed state reports unavailable without querying GitHub', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-pages-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let queried = false;
  const result = checkSavedPages({ root, query: () => { queried = true; return { status: 'confirmed' }; } });
  assert.equal(result.status, 'unavailable');
  assert.match(result.reason, /找不到/);
  assert.equal(queried, false);
});
