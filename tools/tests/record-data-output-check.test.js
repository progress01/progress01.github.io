'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const { expectedData, checkRecordDataOutput } = require('../record-data-output-check');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'record-output-'));
  fs.mkdirSync(path.join(root, 'source'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source/life-index.json'), JSON.stringify({ current: { listen: { title: 'A', url: '/a/' }, watch: { title: 'B', url: '/b/' } } }, null, 2));
  fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), [
    'year: 2026', 'topics:', '  - id: first', '    name: First', '    items:', '      - id: item-a', '        date: 2026-02-03', '        resolved_date: 2026-02-05', '        title: A', '        url: /learning/a/', '        state: learning', '        source: S', '        note: N', '  - id: second', '    name: Second', '    items:', '      - id: item-b', '        date: 2026-02-04', '        title: B', '        url: /learning/b/', '        state: learning', '        source: S', '        note: N', ''
  ].join('\n'));
  return root;
}

function generateExpectedFiles(root) {
  const expected = expectedData(root);
  fs.writeFileSync(path.join(root, 'public/life-index.json'), JSON.stringify(expected.life));
  fs.writeFileSync(path.join(root, 'public/reading-desk.json'), JSON.stringify(expected.reading));
}

test('generated outputs match source fields, topic/item ordering, and generator date normalization', t => {
  const root = fixture(t);
  generateExpectedFiles(root);
  const outputDesk = JSON.parse(fs.readFileSync(path.join(root, 'public/reading-desk.json'), 'utf8'));
  assert.equal(outputDesk.topics[0].items[0].date, '2026-02-03');
  assert.equal(outputDesk.topics[0].items[0].resolved_date, '2026-02-05T00:00:00.000Z');
  assert.deepEqual(checkRecordDataOutput({ root }).errors, []);
});

test('object key ordering is immaterial but array ordering must match', t => {
  const root = fixture(t);
  generateExpectedFiles(root);
  const life = JSON.parse(fs.readFileSync(path.join(root, 'public/life-index.json'), 'utf8'));
  life.current = { watch: life.current.watch, listen: life.current.listen };
  fs.writeFileSync(path.join(root, 'public/life-index.json'), JSON.stringify(life));
  assert.deepEqual(checkRecordDataOutput({ root }).errors, []);

  const desk = JSON.parse(fs.readFileSync(path.join(root, 'public/reading-desk.json'), 'utf8'));
  desk.topics.reverse();
  fs.writeFileSync(path.join(root, 'public/reading-desk.json'), JSON.stringify(desk));
  assert.ok(checkRecordDataOutput({ root }).errors.some(error => error.includes('reading-desk.json')));
});

test('source add/change/delete/order operations route through the content receipt category', t => {
  const root = fixture(t);
  generateExpectedFiles(root);
  const variants = [
    source => { source.current.extra = { title: 'C', url: '/c/' }; },
    source => { source.current.listen.title = 'Changed'; },
    source => { delete source.current.watch; },
    source => { source.current = { watch: source.current.watch, listen: source.current.listen }; }
  ];
  for (const change of variants) {
    const source = JSON.parse(fs.readFileSync(path.join(root, 'source/life-index.json'), 'utf8'));
    change(source);
    fs.writeFileSync(path.join(root, 'source/life-index.json'), JSON.stringify(source));
    assert.ok(checkRecordDataOutput({ root }).errors.some(error => error.includes('life-index.json')));
    generateExpectedFiles(root);
    assert.deepEqual(checkRecordDataOutput({ root }).errors, []);
  }
  const deskSource = yaml.load(fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8'));
  const deskChanges = [
    desk => desk.topics.push({ id: 'third', name: 'Third', items: [] }),
    desk => { desk.topics[0].name = 'Changed'; },
    desk => { desk.topics.pop(); },
    desk => { desk.topics.reverse(); }
  ];
  for (const change of deskChanges) {
    change(deskSource);
    fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), yaml.dump(deskSource));
    assert.ok(checkRecordDataOutput({ root }).errors.some(error => error.includes('reading-desk.json')));
    generateExpectedFiles(root);
  }
  assert.deepEqual(checkRecordDataOutput({ root }).errors, []);
});

test('invalid source and missing or invalid outputs are rejected', t => {
  const root = fixture(t);
  generateExpectedFiles(root);
  fs.writeFileSync(path.join(root, 'source/life-index.json'), '{bad');
  assert.throws(() => expectedData(root), /JSON/);
  fs.writeFileSync(path.join(root, 'source/life-index.json'), '{}');
  fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), 'topics: [\n');
  assert.throws(() => expectedData(root), /YAML/);
  fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), 'topics: []\n');
  fs.rmSync(path.join(root, 'public/life-index.json'));
  assert.ok(checkRecordDataOutput({ root }).errors.some(error => error.includes('life-index.json')));
  fs.writeFileSync(path.join(root, 'public/life-index.json'), 'not-json');
  assert.ok(checkRecordDataOutput({ root }).errors.some(error => error.includes('不是有效 JSON')));
});
