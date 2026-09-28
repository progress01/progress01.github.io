'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditPublicOutput, formatReport } = require('../public-output-audit');

const plan = {
  source: 'source/microblog.json', expectedPublicCount: 3,
  records: [
    { id: 'fixture-d1', decision: 'D', publicContent: 'approved public alpha' },
    { id: 'fixture-d2', decision: 'D', publicContent: 'approved public beta' },
    { id: 'fixture-v1', decision: 'V' }
  ], retiredIds: ['fixture-v1']
};
const baselineRecords = [
  { id: 'fixture-d1', content: 'fixture-original-alpha' },
  { id: 'fixture-d2', content: 'fixture-original-beta' },
  { id: 'fixture-v1', content: 'fixture-original-vanish' },
  { id: 'fixture-p1', content: 'published unchanged' }
];
const sourceRecords = [
  { id: 'fixture-d1', content: 'approved public alpha' },
  { id: 'fixture-d2', content: 'approved public beta' },
  { id: 'fixture-p1', content: 'published unchanged' }
];

function put(root, relative, content) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

function makeFixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-output-audit-'));
  const projectRoot = path.join(root, 'project');
  const outputRoot = path.join(root, 'public');
  const sourceImageRoot = path.join(projectRoot, 'source', 'images');
  fs.mkdirSync(outputRoot, { recursive: true });
  const publicRecords = overrides.publicRecords || sourceRecords;
  const navRecords = overrides.navRecords || sourceRecords.map(record => ({ id: record.id, kind: 'microblog', text: record.content }));
  put(outputRoot, 'microblog.json', JSON.stringify(publicRecords));
  put(outputRoot, 'navigation-index.json', JSON.stringify({ records: navRecords }));
  put(outputRoot, 'status/index.html', '<html><body><script>fetch("/microblog.json")</script></body></html>');
  put(outputRoot, 'photos/index.html', '<section class="photo-wall-section"><div class="ig-card"><img src="/images/photo.png"></div></section>');
  put(outputRoot, '2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/index.html', '<article class="post-content-single"><img src="/images/cover.png"></article>');
  put(sourceImageRoot, 'photo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
  put(sourceImageRoot, 'cover.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
  put(outputRoot, 'images/photo.png', fs.readFileSync(path.join(sourceImageRoot, 'photo.png')));
  put(outputRoot, 'images/cover.png', fs.readFileSync(path.join(sourceImageRoot, 'cover.png')));
  for (const [relative, value] of Object.entries(overrides.files || {})) put(outputRoot, relative, value);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, projectRoot, outputRoot, sourceImageRoot };
}

function audit(fixture, options = {}) {
  return auditPublicOutput({
    root: fixture.outputRoot, projectRoot: fixture.projectRoot, plan, baselineRecords,
    sourceRecords: options.sourceRecords || sourceRecords, expectedImageFiles: 2, expectedThemeImages: new Set(),
    origin: 'https://example.test'
  });
}

test('accepts approved public sources, stable IDs, required image files, and binary assets', t => {
  const fixture = makeFixture(t, { files: {
    'reading-desk.json': '{"topics":[]}',
    'reading/index.html': '<main>Public learning note</main>',
    'work/approved-public-article/index.html': '<article class="post-content-single">Public article</article>'
  } });
  const report = audit(fixture);
  assert.equal(report.ok, true, formatReport(report));
  assert.equal(report.oldTextHits, 0);
  assert.equal(report.retiredIdHits, 0);
  assert.equal(report.replacementPresent, true);
  assert.equal(report.images.sourceImageFiles, 2);
  assert.equal(report.images.publicImageFiles, 2);
  assert.ok(report.inventory.otherBinary >= 0);
});

test('scans decodable HTML, JSON, XML, JS, CSS and map outputs for approved fingerprints', t => {
  for (const relative of ['leak.html', 'leak.json', 'leak.xml', 'leak.js', 'leak.css', 'leak.map']) {
    const fixture = makeFixture(t, { files: { [relative]: 'fixture-original-alpha' } });
    const report = audit(fixture);
    assert.ok(report.errors.some(error => error.code === 'approved_private_fingerprint_in_output'), relative);
  }
});

test('detects a retired ID in decodable output without echoing the ID or original text', t => {
  const fixture = makeFixture(t, { files: { 'bundle.js': 'fixture-v1 fixture-original-vanish' } });
  const report = audit(fixture);
  const formatted = formatReport(report);
  assert.ok(report.errors.some(error => error.code === 'retired_microblog_id_in_output'));
  assert.equal(formatted.includes('fixture-v1'), false);
  assert.equal(formatted.includes('fixture-original-vanish'), false);
});

test('rejects raw source extensions and source-copy paths', t => {
  const fixture = makeFixture(t, { files: {
    'article.md': 'safe synthetic body',
    '_data/settings.yml': 'safe: true',
    'source/status.json': '[]'
  } });
  const report = audit(fixture);
  assert.ok(report.errors.some(error => error.code === 'raw_source_extension'));
  assert.ok(report.errors.some(error => error.code === 'source_copy_forbidden_path'));
});

test('rejects backups, private output paths, and a duplicated raw microblog file', t => {
  const fixture = makeFixture(t, { files: {
    'old.backup': 'safe synthetic body',
    'private/notes.json': '{}',
    'microblog-raw.json': '[]'
  } });
  const report = audit(fixture);
  assert.ok(report.errors.some(error => error.code === 'backup_or_private_artifact'));
  assert.ok(report.errors.some(error => error.code === 'source_copy_forbidden_path'));
  assert.ok(report.errors.some(error => error.code === 'microblog_source_duplicate'));
});

test('rejects duplicate or changed source, public, and navigation microblog IDs', t => {
  const fixture = makeFixture(t, { publicRecords: [
    ...sourceRecords, { ...sourceRecords[0] }
  ], navRecords: [
    ...sourceRecords.map(record => ({ id: record.id, kind: 'microblog', text: record.content })),
    { id: 'changed-id', kind: 'microblog', text: 'safe synthetic extra' }
  ] });
  const report = audit(fixture, { sourceRecords: [
    sourceRecords[0], sourceRecords[1], { id: 'changed-id', content: 'safe synthetic replacement' }
  ] });
  assert.ok(report.errors.some(error => error.code === 'public_microblog_id_invalid_or_duplicate'));
  assert.ok(report.errors.some(error => error.code === 'navigation_microblog_count_mismatch'));
  assert.ok(report.errors.some(error => error.code === 'persistent_microblog_id_missing'));
  assert.ok(report.errors.some(error => error.code === 'unexpected_microblog_id'));
});

test('rejects a missing approved D replacement from required generated datasets', t => {
  const fixture = makeFixture(t, { publicRecords: [], navRecords: [] });
  const report = audit(fixture);
  assert.ok(report.errors.some(error => error.code === 'd_replacement_missing_public_json'));
  assert.ok(report.errors.some(error => error.code === 'd_replacement_missing_navigation_index'));
});

test('rejects loss of a fixed song cover or a source image from the public copy', t => {
  const fixture = makeFixture(t);
  fs.writeFileSync(path.join(fixture.outputRoot, '2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/index.html'), '<article class="post-content-single"></article>');
  fs.rmSync(path.join(fixture.outputRoot, 'images/photo.png'));
  const report = audit(fixture);
  assert.ok(report.errors.some(error => error.code === 'fixed_song_cover_missing'));
  assert.ok(report.errors.some(error => error.code === 'published_image_missing'));
});

test('checks local srcset and CSS url references and rejects broken assets', t => {
  const fixture = makeFixture(t, { files: {
    'theme.css': '.x{background-image:url("/images/not-present.webp")}',
    'extra.html': '<img srcset="/images/photo.png 1x, /images/missing.png 2x">'
  } });
  const report = audit(fixture);
  assert.ok(report.errors.some(error => error.code === 'asset_reference_missing'));
  assert.ok(report.assets.checkedCssReferences > 0);
});

test('records decodable text inventory and parses JSON without treating image bytes as text', t => {
  const fixture = makeFixture(t, { files: { 'status.txt': 'safe synthetic text', 'broken.json': '{invalid' } });
  const report = audit(fixture);
  assert.ok(report.inventory.text >= 1);
  assert.ok(report.inventory.images >= 2);
  assert.ok(report.errors.some(error => error.code === 'json_parse_failed'));
  assert.equal(report.oldTextHits, 0);
});
