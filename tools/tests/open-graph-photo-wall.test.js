'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const openGraphHelper = require('hexo/dist/plugins/helper/open_graph');
const openGraphPage = require('../../themes/next/scripts/helpers/open-graph-page');

function makeContext(pagePath, content, photos = []) {
  const context = {
    config: {
      url: 'https://progress01.github.io',
      pretty_urls: { trailing_index: true, trailing_html: true },
      title: '網站名稱',
      description: '網站描述',
      language: 'zh-TW',
      author: '作者'
    },
    page: { path: pagePath, content, photos, title: '記憶圖牆' },
    url: `https://progress01.github.io/${pagePath.replace(/index\.html$/, '')}`,
    is_post: () => false
  };
  context.open_graph = options => openGraphHelper.call(context, options);
  return context;
}

function imageUrls(output) {
  return [...output.matchAll(/<meta property="og:image" content="([^"]+)">/g)].map(([, url]) => url);
}

function withoutOgImages(output) {
  return output.replace(/<meta property="og:image"[^>]*>\n?/g, '');
}

test('photo wall keeps only the native helper’s first image and preserves all other metadata', () => {
  const content = '<img src="/first.webp"><img src="/second.webp"><img src="/third.webp">';
  const context = makeContext('photos/index.html', content);
  const original = openGraphHelper.call(context, {});
  const limited = openGraphPage.call(context, {});

  assert.deepEqual(imageUrls(original), [
    'https://progress01.github.io/first.webp',
    'https://progress01.github.io/second.webp',
    'https://progress01.github.io/third.webp'
  ]);
  assert.deepEqual(imageUrls(limited), [imageUrls(original)[0]]);
  assert.equal(withoutOgImages(limited), withoutOgImages(original));
  assert.equal(context.page.content, content);
});

test('photo wall respects native image, images, and page.photos selection', () => {
  const cases = [
    [{ image: '/configured-image.webp' }, '<img src="/content-image.webp">', [], 'configured-image.webp'],
    [{ images: ['/configured-first.webp', '/configured-second.webp'] }, '<img src="/content-image.webp">', [], 'configured-first.webp'],
    [{}, '<img src="/content-image.webp">', ['/photo-first.webp', '/photo-second.webp'], 'photo-first.webp']
  ];

  for (const [options, content, photos, expected] of cases) {
    const context = makeContext('photos/index.html', content, photos);
    const before = JSON.stringify(options);
    const original = openGraphHelper.call(context, options);
    const limited = openGraphPage.call(context, options);
    assert.deepEqual(imageUrls(limited), [imageUrls(original)[0]]);
    assert.match(imageUrls(limited)[0], new RegExp(`${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    assert.equal(JSON.stringify(options), before);
  }
});

test('pages without images and non-photo pages retain the native helper output', () => {
  const emptyContext = makeContext('photos/index.html', '<p>No image</p>');
  const emptyNative = openGraphHelper.call(emptyContext, {});
  assert.equal(openGraphPage.call(emptyContext, {}), emptyNative);
  assert.deepEqual(imageUrls(emptyNative), []);

  const articleContext = makeContext('2026/01/21/song/index.html', '<img src="/first.webp"><img src="/second.webp">');
  const options = Object.freeze({ title: '文章標題', images: Object.freeze(['/share-one.webp', '/share-two.webp']) });
  const articleNative = openGraphHelper.call(articleContext, options);
  assert.equal(openGraphPage.call(articleContext, options), articleNative);
  assert.equal(imageUrls(articleNative).length, 2);
});
