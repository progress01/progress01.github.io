'use strict';
const fs = require('fs');
const path = require('path');
const { assignMicroblogIds } = require('./lib/navigation-index');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== '--write')) throw new Error('Usage: node tools/assign-microblog-ids.js [--write]');
const file = path.resolve(__dirname, '../source/microblog.json');
const raw = fs.readFileSync(file, 'utf8');
const original = JSON.parse(raw), updated = assignMicroblogIds(original);
const count = original.filter(item => !item.id).length;
if (args[0] === '--write' && count) {
  const folder = path.resolve(__dirname, '../tmp/navigation');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'microblog-before-ids-' + Date.now() + '.json'), raw);
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(file, (JSON.stringify(updated, null, 2) + '\n').replace(/\n/g, newline));
}
console.log(`${args[0] === '--write' ? 'Assigned' : 'Would assign'} ${count} IDs; existing IDs, values and entry order preserved.`);
