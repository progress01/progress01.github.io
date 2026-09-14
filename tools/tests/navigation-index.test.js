const test = require('node:test');
const assert = require('node:assert/strict');
const { assignMicroblogIds, buildIndex } = require('../lib/navigation-index');
const post = overrides => ({ path: '/learning/one/', title: '文章', date: '2026-08-29', published: true,
  content: '<p>本文</p><script>秘密腳本</script><style>樣式</style><pre>console.log(1)</pre>', ...overrides });
const input = overrides => ({ origin: 'https://progress01.github.io', posts: [post()],
  microblog: assignMicroblogIds([{ date: '2026-09-13', tag: '💭', content: '沒有被使用' }]),
  desk: { topics: [{ name: '題組', items: [{ id: 'reading-topic-01', date: '2026-09-04', title: '另一個名稱', url: '/learning/one/', note: '早段拉臂時機' }] }] }, ...overrides });

test('article and learning note merge while preserving source text and date meanings', () => {
  const result = buildIndex(input());
  assert.equal(result.records.length, 2);
  const article = result.records.find(item => item.kind === 'article');
  assert.deepEqual(article.sources, ['article', 'learning']);
  assert.match(article.text, /早段拉臂時機/);
  assert.match(article.text, /console.log\(1\)/);
  assert.doesNotMatch(article.text, /秘密腳本|樣式/);
  assert.equal(article.url, '/learning/one/');
  assert.deepEqual(article.events.map(e => e.date), ['2026-08-29', '2026-09-04']);
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
  const result = buildIndex(source);
  assert.equal(result.records[0].date, '2026-09-01');
  const independent = result.records.find(r => r.kind === 'learning');
  assert.equal(independent.url, '/reading/'); assert.equal(independent.date, null);
});
test('updated input changes the generated index without stale or duplicate records', () => {
  const source = input(); const first = buildIndex(source);
  source.posts[0].content = '<p>新文字 &amp; 中文</p>';
  source.microblog.push(...assignMicroblogIds([{ date: '2026-09-14', content: 'new record' }]));
  const second = buildIndex(source);
  assert.equal(second.records.length, first.records.length + 1);
  assert.match(second.records[0].text, /新文字 & 中文/);
  assert.doesNotMatch(second.records[0].text, /本文/);
});
