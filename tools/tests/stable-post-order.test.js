'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Hexo = require('hexo');

const indexGenerator = require('hexo-generator-index/lib/generator');
const archiveGenerator = require('hexo-generator-archive/lib/generator');
const categoryGenerator = require('hexo-generator-category/lib/generator');
const tagGenerator = require('hexo-generator-tag/lib/generator');
const { POST_ORDER } = require('../../scripts/stable-post-order');

const scriptPath = path.resolve(__dirname, '../../scripts/stable-post-order.js');
const sameDate = '2020-10-17 12:00:00';

function postPaths(page) {
  return page.posts?.toArray().map(post => post.path);
}

async function buildFixture(t, slugs) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-stable-order-'));
  const hexo = new Hexo(baseDir, { silent: true });
  t.after(async () => {
    await hexo.exit();
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  await hexo.init();
  hexo.config.permalink = ':slug/';
  hexo.config.index_generator = { path: 'memory', per_page: 2, order_by: POST_ORDER };
  hexo.config.archive_generator = { per_page: 2, yearly: false, monthly: false, daily: false, order_by: POST_ORDER };
  hexo.config.category_generator = { per_page: 2, order_by: POST_ORDER };
  hexo.config.tag_generator = { per_page: 2, order_by: POST_ORDER };
  hexo.extend.generator.register('index', indexGenerator);
  hexo.extend.generator.register('archive', archiveGenerator);
  hexo.extend.generator.register('category', categoryGenerator);
  hexo.extend.generator.register('tag', tagGenerator);
  await hexo.loadPlugin(scriptPath);

  const Post = hexo.model('Post');
  const posts = {};
  for (const slug of slugs) {
    const post = await Post.insert({
      title: slug.toUpperCase(), date: sameDate, updated: sameDate, source: `_posts/${slug}.md`, slug,
      layout: 'post', content: slug, ...(slug === 'b' ? { __permalink: 'fixed/b/', sticky: 1 } : {})
    });
    await post.setCategories(['shared']);
    await post.setTags(['shared']);
    posts[slug] = post;
  }

  let captures = [];
  hexo.extend.filter.register('template_locals', locals => {
    const page = locals.page;
    if (page.__post) {
      captures.push({
        kind: 'post', path: page.path,
        prev: page.prev?.path || null,
        next: page.next?.path || null
      });
    } else if (page.__index || page.archive || page.category || page.tag) {
      captures.push({
        kind: page.__index ? 'index' : page.archive ? 'archive' : page.category ? 'category' : 'tag',
        path: locals.path,
        posts: postPaths(page)
      });
    }
    return locals;
  }, 20);

  async function generate() {
    captures = [];
    await hexo._generate({ cache: false });
    return captures;
  }

  return { generate, posts };
}

function signature(captures) {
  return captures
    .filter(item => item.kind === 'post' || ['memory/index.html', 'memory/page/2/index.html', 'archives/index.html', 'archives/page/2/index.html',
      'categories/shared/index.html', 'categories/shared/page/2/index.html', 'tags/shared/index.html', 'tags/shared/page/2/index.html'].includes(item.path))
    .sort((left, right) => `${left.kind}:${left.path}`.localeCompare(`${right.kind}:${right.path}`));
}

test('real Hexo generators keep lists, pagination and post navigation stable across insertion order', async t => {
  const forward = await buildFixture(t, ['a', 'b', 'c']);
  const reverse = await buildFixture(t, ['c', 'b', 'a']);

  const forwardSignature = signature(await forward.generate());
  const reverseSignature = signature(await reverse.generate());
  assert.deepEqual(forwardSignature, reverseSignature);

  const indexPages = forwardSignature.filter(item => item.kind === 'index');
  assert.deepEqual(indexPages.map(item => item.posts), [['/fixed/b/', 'a/'], ['c/']]);
  for (const kind of ['archive', 'category', 'tag']) {
    assert.deepEqual(forwardSignature.filter(item => item.kind === kind).map(item => item.posts), [['a/', 'c/'], ['/fixed/b/']]);
  }
  assert.deepEqual(forwardSignature.filter(item => item.kind === 'post'), [
    { kind: 'post', path: '/fixed/b/', prev: 'c/', next: null },
    { kind: 'post', path: 'a/', prev: null, next: 'c/' },
    { kind: 'post', path: 'c/', prev: 'a/', next: '/fixed/b/' }
  ]);
});

test('warm regeneration recomputes endpoints and clears stale native prev/next values', async t => {
  const fixture = await buildFixture(t, ['a', 'b', 'c']);
  await fixture.generate();
  fixture.posts.c.date = new Date('2020-10-18 12:00:00');
  await fixture.posts.c.save();

  const posts = signature(await fixture.generate()).filter(item => item.kind === 'post');
  assert.deepEqual(posts, [
    { kind: 'post', path: '/fixed/b/', prev: 'a/', next: null },
    { kind: 'post', path: 'a/', prev: 'c/', next: '/fixed/b/' },
    { kind: 'post', path: 'c/', prev: null, next: 'a/' },
  ]);
});

