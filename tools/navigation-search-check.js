'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const Search = require('../themes/next/source/js/third-party/search/navigation-search');
const records = Search.parse(fs.readFileSync('public/navigation-index.json', 'utf8'));
let passages = 0;
for (const record of records) {
  const html = fs.readFileSync(path.join('public', record.url, 'index.html'), 'utf8');
  const $ = cheerio.load(html), byId = new Map();
  $('[id]').each((_, node) => {
    const id = $(node).attr('id');
    byId.set(id, [...(byId.get(id) || []), node]);
  });
  for (const passage of record.passages || []) {
    const nodes = byId.get(passage.id) || [];
    assert.equal(nodes.length, 1, record.url + '#' + passage.id + ' must exist exactly once');
    assert.equal($(nodes[0]).text().replace(/\s+/g, ' ').trim(), passage.text);
    passages++;
  }
}
const cases = JSON.parse(fs.readFileSync('docs/personal-navigation-acceptance.json')).cases.map(example => {
  const hits = Search.search(records, example.query);
  const expected = hits.filter(hit => example.expectedUrl ? hit.record.url === example.expectedUrl : hit.record.kind === example.expectedType);
  assert.equal(expected.length, 1, example.id);
  const hit = expected[0];
  if (example.expectedType === 'microblog') assert.ok(hit.href.startsWith('/status/#micro-'));
  if (example.expectedLearningId) assert.equal(hit.learning.id, example.expectedLearningId);
  return { id: example.id, query: example.query, resultCount: hits.length, target: hit.href, learningId: hit.learning?.id || null };
});
let rebuildStable = null;
if (process.argv[2]) {
  const previous = Search.parse(fs.readFileSync(process.argv[2], 'utf8'));
  assert.equal(previous.length, records.length);
  const byId = new Map(previous.map(record => [record.id, record]));
  // Hexo source processing order may vary; record identity and content must not.
  for (const record of records) assert.deepEqual(record, byId.get(record.id));
  rebuildStable = true;
}
const result = { records: records.length, verifiedPassageAnchors: passages, rebuildStable, cases, status: 'passed' };
fs.writeFileSync('docs/personal-navigation-step3-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
