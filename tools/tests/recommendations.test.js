const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizedPath,
  renderRecommendations,
  selectRecommendations
} = require('../../scripts/popular-posts-fixed');

function post(path, overrides = {}) {
  return {
    path,
    title: path,
    published: true,
    tags: ['tag'],
    categories: ['category'],
    ...overrides
  };
}

test('explicit related paths are first, deduplicated, and invalid or self links are ignored', () => {
  const source = post('/source/', {
    related_posts: ['/missing/', '/source/', '/draft/', '/explicit/', '/explicit/']
  });
  const selected = selectRecommendations(source, [
    source,
    post('/draft/', { published: false }),
    post('/explicit/', { tags: [], categories: [] }),
    post('/tag-match/')
  ], { limit: 3 });

  assert.deepEqual(selected.map(item => item.path), ['/explicit/', '/tag-match/']);
});

test('same topic, tag, and category candidates are ranked and capped by limit', () => {
  const source = post('/source/', {
    recommendation_topics: ['workflow'],
    tags: ['tag'],
    categories: ['category']
  });
  const selected = selectRecommendations(source, [
    source,
    post('/topic/', { recommendation_topics: ['workflow'], tags: [], categories: [] }),
    post('/tag/', { tags: ['tag'], categories: [] }),
    post('/category/', { tags: [], categories: ['category'] }),
    post('/unrelated/', { tags: [], categories: [] })
  ], { limit: 2 });

  assert.deepEqual(selected.map(item => item.path), ['/topic/', '/tag/']);
});

test('stable source/candidate hash changes tie order by source without random state', () => {
  const candidates = Array.from({ length: 12 }, (_, index) => post(`/candidate-${index}/`));
  const sourceA = post('/source-a/');
  const sourceB = post('/source-b/');
  const first = selectRecommendations(sourceA, [sourceA, ...candidates], { limit: 5 }).map(item => item.path);
  const repeat = selectRecommendations(sourceA, [sourceA, ...candidates], { limit: 5 }).map(item => item.path);
  const reversed = selectRecommendations(sourceA, [sourceA, ...candidates].reverse(), { limit: 5 }).map(item => item.path);
  const other = selectRecommendations(sourceB, [sourceB, ...candidates], { limit: 5 }).map(item => item.path);

  assert.deepEqual(repeat, first);
  assert.deepEqual(reversed, first);
  assert.notDeepEqual(other, first);
});

test('rendering escapes titles and supports Windows-style candidate references', () => {
  assert.equal(normalizedPath('\\learning\\candidate\\index.html'), '/learning/candidate/');
  assert.equal(normalizedPath('/learning/%E5%80%99%E9%81%B8/'), '/learning/候選/');
  assert.equal(normalizedPath('//evil.example/a'), '');
  const source = post('/source/', { related_posts: ['\\learning\\candidate\\'] });
  const candidate = post('/learning/candidate/', { title: '<b>unsafe</b> & "quoted"' });
  const html = renderRecommendations({}, source, {
    config: { popular_posts: { enable: true, limit: 5 } },
    locals: { get: () => [source, candidate] },
    extend: { helper: { get: () => value => value } }
  });

  assert.match(html, /&lt;b&gt;unsafe&lt;\/b&gt; &amp; &quot;quoted&quot;/);
  assert.doesNotMatch(html, /<b>unsafe<\/b>/);
  assert.match(html, /href="\/learning\/candidate\/"/);
});

test('disabled or empty recommendations render no list', () => {
  const source = post('/source/', { tags: [], categories: [] });
  const candidate = post('/candidate/');
  const context = { config: { popular_posts: { enable: true, limit: 5 } }, locals: { get: () => [source, candidate] } };
  assert.equal(renderRecommendations({}, source, context), '');

  const relatedSource = post('/related-source/');
  const relatedCandidates = [post('/candidate-one/'), post('/candidate-two/')];
  const relatedContext = () => ({
    config: { popular_posts: { enable: true, limit: 5 } },
    locals: { get: () => [relatedSource, ...relatedCandidates] }
  });
  assert.equal(renderRecommendations({}, relatedSource, { ...relatedContext(), config: { popular_posts: { enable: false, limit: 5 } } }), '');
  assert.equal(renderRecommendations({}, relatedSource, { ...relatedContext(), config: { popular_posts: { enable: true, limit: 0 } } }), '');
  const limited = renderRecommendations({}, relatedSource, { ...relatedContext(), config: { popular_posts: { enable: true, limit: 1 } } });
  assert.equal((limited.match(/popular-posts-item/g) || []).length, 1);
});

test('duplicate candidate paths are emitted only once', () => {
  const source = post('/source/');
  const selected = selectRecommendations(source, [source, post('/candidate/'), post('/candidate/')], { limit: 5 });
  assert.deepEqual(selected.map(item => item.path), ['/candidate/']);
});
