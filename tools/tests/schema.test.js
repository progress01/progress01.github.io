const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const nunjucks = require('nunjucks');
const test = require('node:test');
const schemaJson = require('../../themes/next/scripts/helpers/schema-json');
const { checkDocument } = require('../site-check');

const template = fs.readFileSync(
  path.join(__dirname, '../../themes/next/layout/_partials/head/head-unique.njk'),
  'utf8'
);
const env = nunjucks.configure({ autoescape: false });
const base = {
  theme: { open_graph: { enable: false } },
  config: { permalink: '/:year/:month/:day/:title/', title: 'Blog', description: 'Description', language: 'zh-TW', root: '/', author: 'Author', url: 'https://example.test' },
  url: 'https://example.test/',
  page: { path: 'index.html', title: 'Blog', date: new Date('2026-01-01T04:00:00Z'), categories: [], tags: [] },
  is_home: () => true,
  schema_json: schemaJson,
  full_url_for: value => value === '/' ? 'https://example.test/' : 'https://example.test' + value,
  moment: value => ({ format: () => new Date(value).toISOString() }),
  open_graph: () => '',
  next_data: () => '',
  next_config_unique: () => ''
};

function render(overrides = {}) {
  const context = { ...base, ...overrides, config: { ...base.config, ...(overrides.config || {}) }, page: { ...base.page, ...(overrides.page || {}) } };
  const pagePath = context.page.path || 'index.html';
  const route = pagePath === 'index.html' ? '/' : '/' + pagePath.replace(/\/index\.html$/, '/');
  context.url = 'https://example.test' + route;
  const $ = cheerio.load(env.renderString(template, context));
  return JSON.parse($('script[type="application/ld+json"]').text());
}

test('schema helper escapes script terminators without changing JSON values', () => {
  const value = schemaJson('</script><img src="x">');
  assert(!value.includes('</script>'));
  assert.deepEqual(JSON.parse(value), '</script><img src="x">');
});

test('JSON-LD types and IDs distinguish root, pagination, collections, pages and articles', () => {
  const root = render();
  assert.equal(root['@type'], 'WebSite');
  assert.equal(root['@id'], 'https://example.test/#website');

  const page2 = render({ page: { path: 'page/2/index.html', title: 'Blog' } });
  assert.equal(page2['@type'], 'CollectionPage');
  assert.match(page2.name, /第 2 頁/);
  assert.equal(page2['@id'], page2.url + '#collectionpage');

  const category = render({ page: { path: 'categories/閱讀/page/2/index.html', layout: 'category', category: '閱讀', current: 2 } });
  assert.equal(category['@type'], 'CollectionPage');
  assert.match(category.name, /閱讀/);
  assert.match(category.name, /第 2 頁/);

  const tag = render({ page: { path: 'tags/foo/index.html', layout: 'tag', tag: 'foo' } });
  assert.equal(tag['@type'], 'CollectionPage');
  assert.match(tag.name, /foo/);

  const page = render({ page: { path: 'calendar/index.html', title: 'Calendar', layout: 'page' } });
  assert.equal(page['@type'], 'WebPage');
  const customPage = render({ page: { path: 'page/about/index.html', title: 'About', layout: 'page' } });
  assert.equal(customPage['@type'], 'WebPage');
  assert.equal(customPage['@id'], customPage.url + '#webpage');
});

test('BlogPosting keeps article ID separate from canonical page entity and stable website', () => {
  const article = render({
    page: { path: 'post/index.html', layout: 'post', title: '</script> title', date: new Date('2026-01-01T04:00:00Z'), updated: new Date('2026-02-01T04:00:00Z'), cover: '/images/cover.webp', categories: { length: 1, toArray: () => [{ name: '分類' }] }, tags: { length: 1, toArray: () => [{ name: '標籤' }] } }
  });
  assert.equal(article['@type'], 'BlogPosting');
  assert.equal(article['@id'], article.url + '#article');
  assert.equal(article.mainEntityOfPage['@id'], article.url);
  assert.equal(article.isPartOf['@id'], 'https://example.test/#website');
  assert.deepEqual(article.publisher, { '@type': 'Person', name: 'Author' });
  assert.equal(article.headline, '</script> title');
  assert.equal(article.image, 'https://example.test/images/cover.webp');
  const sharedWorkCard = render({ page: { path: 'work/post/index.html', layout: 'post', title: 'Work', date: new Date('2026-01-01T04:00:00Z'), cover: '/images/work-knowledge-card.svg' } });
  assert.equal(sharedWorkCard.image, undefined);
  const articleSvg = render({ page: { path: 'post/svg/index.html', layout: 'post', title: 'SVG', date: new Date('2026-01-01T04:00:00Z'), cover: '/images/article-diagram.svg' } });
  assert.equal(articleSvg.image, 'https://example.test/images/article-diagram.svg');
});

test('沒有 updated 時 dateModified 回退 date，有明確 updated 時才使用更新日期', () => {
  const fallback = render({ page: { path: 'post/index.html', layout: 'post', title: 'Fallback', date: new Date('2026-01-02T04:00:00Z') } });
  assert.equal(fallback.dateModified, fallback.datePublished);
  const explicit = render({ page: { path: 'post/index.html', layout: 'post', title: 'Explicit', date: new Date('2026-01-02T04:00:00Z'), updated: new Date('2026-03-03T04:00:00Z') } });
  assert.notEqual(explicit.dateModified, explicit.datePublished);
  assert.equal(explicit.dateModified, '2026-03-03T04:00:00.000Z');
});

test('site checker validates structured data semantics', () => {
  const html = '<link rel="canonical" href="https://example.test/page/2/">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': 'https://example.test/page/2/', url: 'https://example.test/page/2/' }) + '</script>';
  const result = checkDocument(html, 'page/2/index.html', { origin: 'https://example.test', files: new Set(['page/2/index.html']), checkStructuredData: true });
  assert(result.errors.some(error => error.includes('CollectionPage')));
  assert(result.errors.some(error => error.includes('name')));
});

test('site checker rejects null data, missing canonical and invalid article dates without crashing', () => {
  const nullResult = checkDocument('<script type="application/ld+json">null</script>', 'page/2/index.html', {
    origin: 'https://example.test', files: new Set(['page/2/index.html']), checkStructuredData: true
  });
  assert(nullResult.errors.some(error => error.includes('物件')));

  const article = '<link rel="canonical" href="https://example.test/post/">' +
    '<article class="post-content-single" itemtype="https://schema.org/BlogPosting" itemid="https://example.test/post/#article" lang="zh-TW"></article>' +
    '<script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': 'https://example.test/post/#article',
      url: 'https://example.test/post/', name: 'Post', headline: 'Post',
      datePublished: '2026-02-02T00:00:00+08:00', dateModified: '2026-02-01T00:00:00+08:00',
      inLanguage: 'zh-TW', author: { '@type': 'Person', name: 'Author' }, publisher: { '@type': 'Person', name: 'Author' },
      mainEntityOfPage: { '@id': 'https://example.test/post/' }, isPartOf: { '@id': 'https://example.test/#website' }
    }) + '</script>';
  const articleResult = checkDocument(article, 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html']), checkStructuredData: true
  });
  assert(articleResult.errors.some(error => error.includes('dateModified 早於')));
  const invalidResult = checkDocument(article.replace('2026-02-02T00:00:00+08:00', '2026-02-31T00:00:00+08:00'), 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html']), checkStructuredData: true
  });
  assert(invalidResult.errors.some(error => error.includes('datePublished')));
  const wrongType = checkDocument(article.replace('"@type":"BlogPosting"', '"@type":"WebPage"'), 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html']), checkStructuredData: true
  });
  assert(wrongType.errors.some(error => error.includes('BlogPosting')));
  const nullHeadline = checkDocument(article.replace('"headline":"Post"', '"headline":null'), 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html']), checkStructuredData: true
  });
  assert(nullHeadline.errors.some(error => error.includes('headline')));
  const invalidItemId = checkDocument(article.replace('itemid="https://example.test/post/#article"', 'itemid="%"'), 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html']), checkStructuredData: true
  });
  assert(invalidItemId.errors.some(error => error.includes('itemid')));
});

test('standalone article keeps BlogPosting identity under collection-like URL paths', () => {
  const article = '<link rel="canonical" href="https://example.test/categories/foo/post/">' +
    '<article class="post-content-single" itemid="https://example.test/categories/foo/post/#article" itemtype="https://schema.org/BlogPosting" lang="zh-TW">' +
    '<h1 itemprop="name headline">Post</h1><time itemprop="datePublished" datetime="2026-02-01T00:00:00Z"></time>' +
    '<span itemprop="author" itemscope itemtype="https://schema.org/Person"><meta itemprop="name" content="Author"></span>' +
    '<span itemprop="publisher" itemscope itemtype="https://schema.org/Person"><meta itemprop="name" content="Author"></span></article>' +
    '<script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': 'https://example.test/categories/foo/post/#article',
      url: 'https://example.test/categories/foo/post/', name: 'Post', headline: 'Post', inLanguage: 'zh-TW',
      datePublished: '2026-02-01T00:00:00Z', dateModified: '2026-02-01T00:00:00Z',
      author: { '@type': 'Person', name: 'Author' }, publisher: { '@type': 'Person', name: 'Author' },
      mainEntityOfPage: { '@id': 'https://example.test/categories/foo/post/' }, isPartOf: { '@id': 'https://example.test/#website' }
    }) + '</script>';
  const result = checkDocument(article, 'categories/foo/post/index.html', {
    origin: 'https://example.test', files: new Set(['categories/foo/post/index.html']), checkStructuredData: true
  });
  assert.deepEqual(result.errors, []);
});

test('site checker catches visible article metadata drift and wrong self-canonical', () => {
  const article = '<link rel="canonical" href="https://example.test/post/">' +
    '<article class="post-content-single" itemid="https://example.test/post/#article" itemtype="https://schema.org/BlogPosting" lang="zh-TW">' +
    '<h1 itemprop="name headline">Visible title</h1>' +
    '<time itemprop="datePublished" datetime="2026-01-01T00:00:00Z"></time>' +
    '<span itemprop="author" itemscope><meta itemprop="name" content="Visible author"></span></article>' +
    '<script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': 'https://example.test/post/#article',
      url: 'https://example.test/post/', name: 'Post', headline: 'Wrong title', inLanguage: 'en',
      datePublished: '2026-02-01T00:00:00Z', dateModified: '2026-02-01T00:00:00Z',
      author: { '@type': 'Person', name: 'Wrong author' }, publisher: { '@type': 'Person', name: 'Wrong author' },
      mainEntityOfPage: { '@id': 'https://example.test/post/' }, isPartOf: { '@id': 'https://example.test/#website' }
    }) + '</script>';
  const drift = checkDocument(article, 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html']), checkStructuredData: true
  });
  assert(drift.errors.some(error => error.includes('headline')));
  assert(drift.errors.some(error => error.includes('datePublished')));
  assert(drift.errors.some(error => error.includes('author')));
  assert(drift.errors.some(error => error.includes('inLanguage')));

  const canonical = article.replace('https://example.test/post/', 'https://example.test/other/');
  const wrongCanonical = checkDocument(canonical, 'post/index.html', {
    origin: 'https://example.test', files: new Set(['post/index.html', 'other/index.html']), checkStructuredData: true
  });
  assert(wrongCanonical.errors.some(error => error.includes('本站 canonical')));
});
