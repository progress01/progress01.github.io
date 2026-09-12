const test = require('node:test');
const assert = require('node:assert/strict');

const { SITEMAP_EXCLUDED_DATA, excludeFrontendDataFromSitemap } = require('../../scripts/sitemap-filter');

test('only frontend data endpoints are marked out of sitemap while output paths remain', async () => {
  const pages = [
    { path: 'reading-desk.json', sitemap: undefined },
    { path: 'microblog.json', sitemap: undefined },
    { source: 'life-index.json', path: 'life-index.json', sitemap: undefined },
    { path: 'content-categories.json', sitemap: undefined },
    { path: 'learning/example/index.html', sitemap: undefined }
  ];

  const returned = await excludeFrontendDataFromSitemap(pages);

  assert.strictEqual(returned, pages);
  assert.equal(SITEMAP_EXCLUDED_DATA.size, 3);
  assert.deepEqual(pages.map(page => page.sitemap), [false, false, false, undefined, undefined]);
  assert.deepEqual(pages.map(page => page.path), [
    'reading-desk.json',
    'microblog.json',
    'life-index.json',
    'content-categories.json',
    'learning/example/index.html'
  ]);
});

test('supports Hexo collection pages without changing unrelated page metadata', async () => {
  const pages = [
    { path: 'reading-desk.json', sitemap: true },
    { path: 'learning/example/index.html', sitemap: false }
  ];
  const collection = { toArray: () => pages };

  await excludeFrontendDataFromSitemap(collection);

  assert.equal(pages[0].sitemap, false);
  assert.equal(pages[1].sitemap, false);
});

test('persists the exclusion on real Hexo Warehouse Page documents', async () => {
  const Hexo = require('hexo');
  const sitemapGenerator = require('hexo-generator-sitemap/lib/generator');
  const hexo = new Hexo(process.cwd(), { silent: true });
  await hexo.init();
  await hexo.source.process();

  const pages = hexo.locals.get('pages');
  await excludeFrontendDataFromSitemap(pages);

  hexo.locals.invalidate();
  assert.deepEqual(
    hexo.locals.get('pages').toArray()
      .filter(page => SITEMAP_EXCLUDED_DATA.has(page.path))
      .map(page => page.sitemap),
    [false, false, false]
  );

  // Match Hexo's _runGenerators() sequence: it invalidates locals before
  // passing the freshly queried collection to the sitemap generator.
  const result = sitemapGenerator.call(hexo, {
    posts: hexo.locals.get('posts'),
    pages: hexo.locals.get('pages'),
    tags: hexo.locals.get('tags'),
    categories: hexo.locals.get('categories')
  });
  const sitemap = result.find(item => item.path === 'sitemap.xml').data;
  for (const endpoint of SITEMAP_EXCLUDED_DATA) assert.ok(!sitemap.includes(endpoint));
  assert.match(sitemap, /https:\/\/progress01\.github\.io\//);
});
