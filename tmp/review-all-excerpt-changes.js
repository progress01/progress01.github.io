'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const checker = require('../tools/excerpt-check');
const before = require('./excerpt-all-before.json');
const normalize = s => s.replace(/\r\n/g, '\n');
const split = s => {
  s = normalize(s);
  const fm = s.match(/^---\n[\s\S]*?\n---\n/);
  assert(fm, 'front matter exists');
  const body = s.slice(fm[0].length);
  const marker = body.match(/<!-- ?more ?-->/i);
  return { fm: fm[0], intro: marker ? body.slice(0, marker.index) : body,
    tail: marker ? body.slice(marker.index + marker[0].length).trim() : null };
};
const changes = [];
const failures = [];
for (const [file, oldSource] of Object.entries(before.posts)) {
  const source = fs.readFileSync(file, 'utf8');
  if (source === oldSource) continue;
  const old = split(oldSource), current = split(source);
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');
  if (old.fm !== current.fm) failures.push(relative + ': front matter changed');
  if (old.tail && !current.tail.includes(old.tail)) failures.push(relative + ': original body no longer intact');
  const report = checker.inspectExcerpt(source, relative);
  changes.push({ file: relative, before: checker.inspectExcerpt(oldSource, relative).visibleCharacters,
    after: report.visibleCharacters, old: old.intro.trim(), new: current.intro.trim(),
    addedBody: current.tail?.replace(old.tail || '', '').trim(), ok: report.ok, warnings: report.warnings });
}
const final = checker.run({ root: process.cwd(), all: true });
fs.writeFileSync('tmp/excerpt-all-review.json', JSON.stringify({ changes, failures, reports: final.reports }, null, 2));
console.log(JSON.stringify({ changed: changes.length, preservationFailures: failures,
  remainingFailures: final.reports.filter(r => !r.ok).map(r => ({file:r.filename, errors:r.errors})),
  warnings: final.reports.filter(r => r.ok && r.warnings.length).length }, null, 2));
if (failures.length) process.exitCode = 1;
