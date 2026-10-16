'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const { main, run, usage } = require('../record');

function fixture(t, { microblog, desk = '# keep this comment\nyear: 2026\nsample: false\ntopics: []\n', posts = [] } = {}) {
  const tempPrefix = path.join(os.tmpdir(), 'blog-record-test-');
  const root = fs.mkdtempSync(tempPrefix);
  fs.mkdirSync(path.join(root, 'source'), { recursive: true });
  fs.mkdirSync(path.join(root, 'source/_posts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tools/data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(root, 'source/microblog.json'), microblog ?? '[]\n');
  fs.writeFileSync(path.join(root, 'source/reading-desk.yml'), desk);
  posts.forEach((post, index) => fs.writeFileSync(path.join(root, `source/_posts/post-${index}.md`), `---\ntitle: ${JSON.stringify(post.title || 'fixture')}\npermalink: ${JSON.stringify(post.url)}\nsurfaces: ${JSON.stringify(post.surfaces || ['memory'])}\n---\n`));
  fs.writeFileSync(path.join(root, 'tools/data/legacy-surfaces.v1.json'), JSON.stringify({ schemaVersion: 1, posts: [], microblogIds: [], readingDeskItemIds: [] }));
  fs.writeFileSync(path.join(root, 'tools/data/microblog-boundary-migration.v1.json'), JSON.stringify({ retiredIds: ['micro-retired'] }));
  t.after(() => {
    assert.ok(root.startsWith(tempPrefix), 'record fixture directory must stay inside its test prefix');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('microblog dry-run previews an ID without changing source or making a backup', t => {
  const root = fixture(t);
  const file = path.join(root, 'source/microblog.json');
  const before = fs.readFileSync(file, 'utf8');
  const result = run({ type: 'microblog', text: '一則測試紀錄', dryRun: true }, { root });
  assert.equal(result.written, false);
  assert.match(result.id, /^micro-[a-f0-9]{16}$/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
});

test('record dry-run CLI shows a concise date and content summary without writing', t => {
  const root = fixture(t);
  const output = [];
  main(['microblog', '--text', '今天散步完成', '--date', '2026-02-03', '--dry-run'], {
    root, stdout: message => output.push(message), stderr: assert.fail
  });
  assert.deepEqual(output, ['預覽新增本機碎碎念：2026-02-03｜💭｜今天散步完成（未寫入來源）']);
  assert.equal(fs.readFileSync(path.join(root, 'source/microblog.json'), 'utf8'), '[]\n');
  assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
});

test('microblog write adds newest memory item and preserves previous entries and IDs', t => {
  const old = [{ id: 'micro-old', date: '2026-01-02', tag: '🏃', content: '舊內容', surfaces: ['memory'], extra: 'keep' }];
  const root = fixture(t, { microblog: JSON.stringify(old, null, 2) + '\n' });
  const result = run({ type: 'microblog', text: '新內容', date: '2026-02-03' }, { root });
  const now = JSON.parse(fs.readFileSync(path.join(root, 'source/microblog.json'), 'utf8'));
  assert.equal(now[0].content, '新內容');
  assert.equal(now[0].tag, '💭');
  assert.deepEqual(now[0].surfaces, ['memory']);
  assert.deepEqual(now[1], old[0]);
  assert.equal(result.written, true);
  assert.equal(fs.existsSync(result.backup), true);
});

test('invalid dates and duplicate IDs fail without changing source', t => {
  const root = fixture(t, { microblog: '[{"id":"micro-x","date":"2026-01-01","tag":"💭","content":"a","surfaces":["memory"]},{"id":"micro-x","date":"2026-01-01","tag":"💭","content":"b","surfaces":["memory"]}]\n' });
  const file = path.join(root, 'source/microblog.json');
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => run({ type: 'microblog', text: '不寫入', date: '2026-02-30' }, { root }), /有效的 YYYY-MM-DD/);
  assert.throws(() => run({ type: 'microblog', text: '不寫入' }, { root }), /duplicate/i);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
});

test('malformed JSON/YAML fails without writing or backing up', t => {
  const root = fixture(t, { microblog: '{bad\n', desk: 'topics: [\n' });
  assert.throws(() => run({ type: 'microblog', text: 'x' }, { root }), /JSON 格式錯誤/);
  assert.throws(() => run({ type: 'reading', title: 'x', url: '/learning/x/' }, { root }), /YAML/);
  assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
});

test('reading write appends into existing topic while preserving comments and metadata', t => {
  const desk = '# 保留註解\nyear: 2026\nsample: false\ntopics:\n  - id: t-one\n    code: A-01\n    name: 測試主題\n    description: 主題說明\n    items:\n      - id: reading-old\n        date: 2026-01-01\n        title: 舊題目\n        source: 舊來源\n        url: /learning/old/\n        state: learning\n        note: 舊備註\n        surfaces: [memory]\n';
  const root = fixture(t, { desk, posts: [{ url: '/work/new-topic/' }] });
  const result = run({ type: 'reading', title: '新題目', url: '/work/new-topic/', topic: 't-one', date: '2026-02-01' }, { root });
  const changed = fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8');
  const parsed = yaml.load(changed, { schema: yaml.FAILSAFE_SCHEMA });
  assert.match(changed, /^# 保留註解/m);
  assert.equal(parsed.topics[0].items.length, 2);
  assert.equal(parsed.topics[0].items[1].id, 'reading-old');
  assert.equal(parsed.topics[0].items[0].state, 'learning');
  assert.deepEqual(parsed.topics[0].items[0].surfaces, ['memory']);
  assert.equal(parsed.topics[0].items[0].source, '待補來源');
  assert.equal(result.written, true);
});

test('reading can add a topic with title and URL only, and supports an external URL', t => {
  const root = fixture(t);
  run({ type: 'reading', title: '新主題題目', url: 'https://example.test/reading' }, { root });
  const parsed = yaml.load(fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8'), { schema: yaml.FAILSAFE_SCHEMA });
  assert.equal(parsed.topics[0].id, 'topic-' + require('node:crypto').createHash('sha256').update('新主題題目').digest('hex').slice(0, 10));
  assert.equal(parsed.topics[0].name, '新主題題目');
  assert.equal(parsed.topics[0].code, 'A-01');
  assert.equal(parsed.topics[0].items[0].url, 'https://example.test/reading');
  assert.equal(parsed.topics[0].items[0].note, '待整理');
});

test('reading rejects missing local targets and targets without memory surface', t => {
  const root = fixture(t, { posts: [{ url: '/learning/profile-only/', surfaces: ['profile'] }] });
  assert.throws(() => run({ type: 'reading', title: '題目', url: '/learning/missing/' }, { root }), /找不到對應文章/);
  assert.throws(() => run({ type: 'reading', title: '題目', url: '/learning/profile-only/' }, { root }), /不含 memory/);
});

test('reading preserves 8-space item indentation, CRLF, no final newline, and escaped multiline scalars', t => {
  const desk = 'year: 2026\r\ntopics:\r\n  - id: t-one\r\n    name: T\r\n    items:\r\n        - id: old\r\n          date: 2026-01-01\r\n          title: Old\r\n          source: S\r\n          url: https://example.test/old\r\n          state: learning\r\n          note: N\r\n          surfaces: [memory]';
  const root = fixture(t, { desk });
  run({ type: 'reading', title: '新題目: "引用"\n第二行', url: 'https://example.test/new', topic: 't-one', note: '多行\n保留: "字串"' }, { root });
  const changed = fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8');
  assert.ok(changed.includes('\r\n'));
  assert.ok(!changed.endsWith('\n'));
  const parsed = yaml.load(changed, { schema: yaml.FAILSAFE_SCHEMA });
  assert.equal(parsed.topics[0].items[0].title, '新題目: "引用"\n第二行');
  assert.equal(parsed.topics[0].items[0].note, '多行\n保留: "字串"');
  assert.equal(parsed.topics[0].items[1].id, 'old');
});

test('source change during preparation aborts without overwriting the newer contents', t => {
  const root = fixture(t);
  const file = path.join(root, 'source/microblog.json');
  assert.throws(() => run({ type: 'microblog', text: 'new' }, { root, beforeWrite: () => fs.writeFileSync(file, '[{"newer":true}]') }), /來源在預覽後已改變/);
  assert.equal(fs.readFileSync(file, 'utf8'), '[{"newer":true}]');
});

test('rename-time source changes survive failed writes, and pre-existing temp files are left alone', t => {
  const root = fixture(t);
  const file = path.join(root, 'source/microblog.json');
  const newer = '[{"newer":true}]';
  assert.throws(() => run({ type: 'microblog', text: 'new' }, { root, beforeRename: () => fs.writeFileSync(file, newer) }), /來源在準備寫入時已改變/);
  assert.equal(fs.readFileSync(file, 'utf8'), newer);

  fs.writeFileSync(file, '[]\n');
  const nonce = 'known-temp-collision';
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.record-${nonce}.tmp`);
  fs.writeFileSync(temporary, 'belongs to another process');
  assert.throws(() => run({ type: 'microblog', text: 'new' }, { root, nonce }), /EEXIST/);
  assert.equal(fs.readFileSync(temporary, 'utf8'), 'belongs to another process');

  assert.throws(() => run({ type: 'microblog', text: 'new' }, { root, rename: () => { throw new Error('injected rename failure'); } }), /injected rename failure/);
  assert.equal(fs.readFileSync(file, 'utf8'), '[]\n');
});

test('argument parser rejects type-specific flags, conflicting topic options, and blank tags', t => {
  const { parseArgs } = require('../record');
  assert.throws(() => parseArgs(['microblog', '--title', 'x']), /不適用/);
  assert.throws(() => parseArgs(['reading', '--title', 'x', '--url', '/learning/x/', '--topic', 'a', '--topic-id', 'b']), /重複|不可同時/);
  const root = fixture(t);
  assert.throws(() => run({ type: 'microblog', text: 'x', tag: ' ' }, { root }), /不可空白/);
});

test('duplicate reading item IDs in source fail without writes', t => {
  const desk = 'topics:\n  - id: t\n    name: T\n    items:\n      - id: same\n      - id: same\n';
  const root = fixture(t, { desk });
  const file = path.join(root, 'source/reading-desk.yml');
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => run({ type: 'reading', title: 'x', url: '/learning/x/', topic: 't' }, { root }), /重複/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
});

test('record CLI keeps help complete and routine success or errors concise', t => {
  const root = fixture(t);
  const output = [];
  const errors = [];
  const originalExitCode = process.exitCode;
  try {
    process.exitCode = undefined;
    main(['microblog', '--text', '簡短輸出測試', '--date', '2026-02-03'], {
      root, stdout: message => output.push(message), stderr: message => errors.push(message)
    });
    assert.deepEqual(output, ['已新增本機碎碎念（尚未發布）']);
    assert.deepEqual(errors, []);
    assert.ok(fs.existsSync(path.join(root, 'source/microblog.json')));
    const backupFiles = fs.readdirSync(path.join(root, 'node_modules/.cache/record-backups'));
    assert.equal(backupFiles.length, 1);
    assert.ok(!output.join('\n').includes(backupFiles[0]));
    assert.ok(!output.join('\n').match(/micro-[a-f0-9]{16}/));

    output.length = 0;
    main(['--help'], { root, stdout: message => output.push(message), stderr: message => errors.push(message) });
    assert.deepEqual(output, [usage]);

    output.length = 0;
    process.exitCode = undefined;
    main(['microblog', '--text'], { root, stdout: message => output.push(message), stderr: message => errors.push(message) });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /新增失敗：--text 後面需要一個值。/);
    assert.match(errors[0], /npm run record -- --help/);
    assert.notEqual(errors[0], usage);
    assert.equal(errors[0].split(/\r?\n/).length, 2);
  } finally {
    process.exitCode = originalExitCode;
  }
});
