const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { assignMicroblogIds, buildIndex } = require('../lib/navigation-index');
const post = overrides => ({ path: '/learning/one/', source: '_posts/fixture.md', title: '文章', date: '2026-08-29', published: true,
  content: '<p>本文</p><script>秘密腳本</script><style>樣式</style><pre>console.log(1)</pre>', ...overrides });
const input = overrides => {
  const microblog = assignMicroblogIds([{ date: '2026-09-13', tag: '💭', content: '沒有被使用' }]);
  return { origin: 'https://progress01.github.io', posts: [post()], microblog,
    desk: { topics: [{ name: '題組', items: [{ id: 'reading-topic-01', date: '2026-09-04', title: '另一個名稱', url: '/learning/one/', note: '早段拉臂時機' }] }] },
    legacySurfaceManifest: { schemaVersion: 1, posts: ['source/_posts/fixture.md'], microblogIds: microblog.map(item => item.id), readingDeskItemIds: ['reading-topic-01'] },
    ...overrides };
};

test('article and learning note merge while preserving source text and date meanings', () => {
  const result = buildIndex(input());
  assert.equal(result.records.length, 2);
  const article = result.records.find(item => item.kind === 'article');
  assert.deepEqual(article.sources, ['article', 'learning']);
  assert.match(article.text, /早段拉臂時機/);
  assert.match(article.text, /console.log\(1\)/);
  assert.doesNotMatch(article.text, /秘密腳本|樣式/);
  assert.equal(article.url, '/learning/one/');
  assert.deepEqual(article.surfaces, ['memory']);
  assert.deepEqual(article.learningItems[0].surfaces, ['memory']);
  assert.deepEqual(article.events.map(e => e.date), ['2026-08-29', '2026-09-04']);
  assert.equal(result.records.filter(item => item.url === '/learning/one/').length, 1);
  assert.deepEqual(result.records.find(item => item.kind === 'microblog').surfaces, ['memory']);
});
test('persisted microblog IDs survive text edits, reordering and insertion', () => {
  const original = assignMicroblogIds([{ date: '2026-09-13', content: 'A' }, { date: '2026-09-12', content: 'B' }]);
  const updated = assignMicroblogIds([{ date: '2026-09-14', content: 'new' }, { ...original[1], content: 'edited' }, original[0]]);
  assert.equal(updated[1].id, original[1].id); assert.equal(updated[2].id, original[0].id);
  assert.deepEqual(assignMicroblogIds(updated), updated);
  assert.throws(() => assignMicroblogIds([original[0], original[0]]), /duplicate/);
  assert.throws(() => buildIndex(input({ microblog: [{ content: 'A' }] })), /persisted/);
});
test('unpublished and unsafe learning targets are excluded, with warnings', () => {
  const source = input({ posts: [post({ published: false })] });
  source.desk.topics[0].items.push({ id: 'bad', url: 'javascript:alert(1)' });
  const result = buildIndex(source);
  assert.equal(result.records.length, 1);
  assert.equal(result.warnings.length, 2);
  assert.doesNotMatch(JSON.stringify(result.records), /早段拉臂|javascript/);
});
test('empty inputs, unknown dates, malformed dates and missing optional fields', () => {
  assert.deepEqual(buildIndex(input({ posts: [], microblog: [], desk: { topics: [] } })).records, []);
  const source = input({ posts: [post({ date: undefined })] });
  source.desk.topics[0].items[0].date = undefined;
  assert.equal(buildIndex(source).records[0].date, null);
  source.desk.topics[0].items[0].date = '2026-02-30';
  assert.throws(() => buildIndex(source), /Invalid date/);
});
test('timezone and independent external learning record keep safe page-level targets', () => {
  const source = input({ posts: [post({ date: '2026-08-31T17:00:00Z' })] });
  source.desk.topics[0].items.push({ id: 'external', title: '外部題目', url: 'https://example.com/paper' });
  source.desk.topics[0].items.at(-1).surfaces = ['profile'];
  const result = buildIndex(source);
  assert.equal(result.records[0].date, '2026-09-01');
  const independent = result.records.find(r => r.kind === 'learning');
  assert.equal(independent.url, '/reading/'); assert.equal(independent.date, null);
  assert.deepEqual(independent.surfaces, ['profile']);
  assert.deepEqual(independent.learningItems[0].surfaces, ['profile']);
});
test('updated input changes the generated index without stale or duplicate records', () => {
  const source = input(); const first = buildIndex(source);
  source.posts[0].content = '<p>新文字 &amp; 中文</p>';
  source.microblog.push(...assignMicroblogIds([{ date: '2026-09-14', content: 'new record', surfaces: ['memory'] }]));
  const second = buildIndex(source);
  assert.equal(second.records.length, first.records.length + 1);
  assert.match(second.records[0].text, /新文字 & 中文/);
  assert.doesNotMatch(second.records[0].text, /本文/);
});

test('explicit article surfaces normalize canonically, while new missing fields fail with source context', () => {
  const both = input({ posts: [post({ surfaces: ['memory', 'profile'] })], microblog: [], desk: { topics: [] } });
  const record = buildIndex(both).records[0];
  assert.deepEqual(record.surfaces, ['profile', 'memory']);
  assert.throws(() => buildIndex({ ...both, posts: [post({ source: '_posts/new.md' })], legacySurfaceManifest: { schemaVersion: 1, posts: [], microblogIds: [], readingDeskItemIds: [] } }), /source\/\_posts\/new\.md \[missing_surfaces\]/);
});

test('linked learning items inherit legacy target surfaces, accept subsets, and reject expansion', () => {
  const profileTarget = post({ surfaces: ['profile'] });
  const data = input({ posts: [profileTarget] });
  const inherited = buildIndex(data).records[0];
  assert.deepEqual(inherited.surfaces, ['profile']);
  assert.deepEqual(inherited.learningItems[0].surfaces, ['profile']);

  data.desk.topics[0].items[0].surfaces = ['profile'];
  assert.deepEqual(buildIndex(data).records[0].learningItems[0].surfaces, ['profile']);
  data.desk.topics[0].items[0].surfaces = ['memory'];
  assert.throws(() => buildIndex(data), /source\/reading-desk\.yml#reading-topic-01 \[surface_not_subset\]/);
});

test('legacy standalone learning records default to memory while preserving one record per item', () => {
  const data = input();
  data.desk.topics[0].items.push({ id: 'standalone-legacy', date: '2026-09-01', title: '獨立學習紀錄', url: 'https://example.com/learning' });
  data.legacySurfaceManifest.readingDeskItemIds.push('standalone-legacy');
  const index = buildIndex(data);
  const record = index.records.find(item => item.id === 'learning:standalone-legacy');
  assert.ok(record);
  assert.deepEqual(record.surfaces, ['memory']);
  assert.deepEqual(record.learningItems[0].surfaces, ['memory']);
});

test('invalid surfaces fail with source and stable identifier context across record types', () => {
  const article = input({ posts: [post({ surfaces: ['PROFILE'] })], microblog: [], desk: { topics: [] } });
  assert.throws(() => buildIndex(article), /source\/\_posts\/fixture\.md \[unknown_surface\]/);

  const microblog = assignMicroblogIds([{ date: '2026-09-13', content: 'invalid', surfaces: [] }]);
  assert.throws(() => buildIndex(input({ microblog, desk: { topics: [] } })), /source\/microblog\.json#micro-[a-f0-9]+ \[empty_surfaces\]/);

  const newMicroblog = assignMicroblogIds([{ date: '2026-09-13', content: 'new item' }]);
  assert.throws(() => buildIndex(input({ microblog: newMicroblog, desk: { topics: [] },
    legacySurfaceManifest: { schemaVersion: 1, posts: ['source/_posts/fixture.md'], microblogIds: [], readingDeskItemIds: [] } })), /source\/microblog\.json#micro-[a-f0-9]+ \[missing_surfaces\]/);

  const desk = input();
  desk.desk.topics[0].items[0].surfaces = [];
  desk.legacySurfaceManifest.readingDeskItemIds = [];
  assert.throws(() => buildIndex(desk), /source\/reading-desk\.yml#reading-topic-01 \[empty_surfaces\]/);
});

test('real approved profile posts, microblogs, and linked learning samples receive contract surfaces', () => {
  const root = path.resolve(__dirname, '../..');
  const curated = yaml.load(fs.readFileSync(path.join(root, 'source/_data/profile-home.yml'), 'utf8'));
  const wanted = new Set(curated.paths.flatMap(group => group.items.map(item => item.url)));
  const posts = [];
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(file);
    if (!entry.isFile() || !entry.name.endsWith('.md')) return;
    const raw = fs.readFileSync(file, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return;
    const frontmatter = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (!wanted.has(frontmatter?.permalink)) return;
    posts.push({
      ...frontmatter,
      source: path.relative(path.join(root, 'source'), file).split(path.sep).join('/'),
      path: frontmatter.permalink,
      content: raw.slice(match[0].length),
      published: frontmatter.published !== false
    });
  });
  visit(path.join(root, 'source/_posts'));
  assert.equal(posts.length, 8);

  const microblog = JSON.parse(fs.readFileSync(path.join(root, 'source/microblog.json'), 'utf8'));
  const desk = yaml.load(fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
  const index = buildIndex({ posts, microblog, desk, origin: 'https://progress01.github.io' });
  const articles = index.records.filter(record => record.kind === 'article');
  assert.equal(articles.length, 8);
  assert.equal(new Set(articles.map(record => record.url)).size, 8);
  assert.equal(articles.filter(record => record.surfaces.join(',') === 'profile').length, 0);
  assert.equal(articles.filter(record => record.surfaces.join(',') === 'profile,memory').length, 8);
  assert.equal(index.records.filter(record => record.kind === 'microblog').length, microblog.length);
  assert.ok(index.records.filter(record => record.kind === 'microblog').every(record => record.surfaces.join(',') === 'memory'));
  assert.ok(index.records.every(record => Array.isArray(record.surfaces)));
  const linkedSample = articles.find(record => record.url === '/work/from-real-work-to-features/');
  assert.deepEqual(linkedSample.learningItems.find(item => item.id === 'reading-topic-17').surfaces, ['profile', 'memory']);
  assert.ok(index.records.every(record => record.kind !== 'page'));
});
