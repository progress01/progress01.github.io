'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Hexo = require('hexo');

const root = path.resolve(__dirname, '../..');
const taxonomy = aliases => `- name: Alpha\n  aliases: [${aliases.alpha}]\n- name: Beta\n  aliases: [${aliases.beta}]\n`;
const raw = tags => `---\n${tags.length ? `tags:\n${tags.map(tag => `  - ${tag}`).join('\n')}` : 'tags: []'}\n---\nfixture`;

test('real Hexo posts retain canonical front-matter order across relation and warm taxonomy changes', async t => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-post-tags-'));
  fs.mkdirSync(path.join(baseDir, 'source', '_data'), { recursive: true });
  const taxonomyPath = path.join(baseDir, 'source', '_data', 'content-tags.yml');
  fs.writeFileSync(taxonomyPath, taxonomy({ alpha: 'OldAlpha', beta: 'OldBeta' }));
  const hexo = new Hexo(baseDir, { silent: true });
  t.after(async () => {
    await hexo.exit();
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  await hexo.init();
  await hexo.loadPlugin(path.join(root, 'scripts', 'tags-normalizer.js'));
  await hexo.loadPlugin(path.join(root, 'scripts', 'post-tags.js'));
  const Post = hexo.model('Post');
  const decoy = await Post.insert({ title: 'decoy', date: '2020-01-01', source: '_posts/decoy.md', slug: 'decoy', raw: raw([]) });
  await decoy.setTags(['Beta', 'Alpha']); // Global Tag insertion order is deliberately opposite.
  const post = await Post.insert({ title: 'fixture', date: '2020-01-02', source: '_posts/fixture.md', slug: 'fixture', raw: raw(['OldAlpha', 'OldBeta', 'OldAlpha']) });
  assert.deepEqual(require('hexo-front-matter').parse(post.raw).tags, ['OldAlpha', 'OldBeta', 'OldAlpha']);
  const normalizer = require('../../scripts/tags-normalizer');
  assert.deepEqual(normalizer.getCanonicalTags(require('hexo-front-matter').parse(post.raw).tags, normalizer.loadAliases(baseDir)), ['Alpha', 'Beta']);
  // Retain pre-existing relations while the global Tag registry is reversed.
  await post.setTags(['Beta', 'Alpha']);
  hexo.config.permalink = ':slug/';
  const pageTags = [];
  hexo.extend.filter.register('template_locals', locals => {
    if (locals.page?.__post && String(locals.page.path).includes('fixture')) pageTags.push(locals.page);
    return locals;
  }, 20);
  async function generate() {
    pageTags.length = 0;
    await hexo._generate({ cache: false });
    assert.equal(pageTags.length, 1, 'real Hexo generation produced the fixture post page');
    return hexo.extend.helper.get('ordered_post_tags')(pageTags[0]).map(tag => tag.name);
  }

  assert.deepEqual(await generate(), ['Alpha', 'Beta']);
  assert.deepEqual(pageTags[0].tags.toArray().map(tag => tag.name), ['Beta', 'Alpha'], 'the getter remains untouched; consumers apply saved order');
  const orderedTags = hexo.extend.helper.get('ordered_post_tags')(pageTags[0]);
  assert.deepEqual(orderedTags.map(tag => tag.path), ['tags/Alpha/', 'tags/Beta/'], 'ordering returns the original tag records, preserving their link paths');
  assert.deepEqual(new Set(orderedTags.map(tag => tag.name)), new Set(['Alpha', 'Beta']), 'ordering preserves relation membership');
  assert.equal(String(pageTags[0]._id), String(post._id), 'the generated page local retains its source post ID');
  assert.deepEqual(hexo.extend.helper.get('ordered_post_tags')({ ...pageTags[0] }).map(tag => tag.name), ['Alpha', 'Beta'],
    'plain page-local copies resolve the source order by post ID');

  post.raw = raw(['OldBeta', 'OldAlpha']);
  await post.save();
  assert.deepEqual(await generate(), ['Beta', 'Alpha'], 'warm generation refreshes raw front-matter order');
  fs.writeFileSync(taxonomyPath, taxonomy({ alpha: 'OldBeta', beta: 'OldAlpha' }));
  assert.deepEqual(await generate(), ['Alpha', 'Beta'], 'warm generation reloads alias changes independently');
  assert.deepEqual(pageTags[0].tags.toArray().map(tag => tag.name).sort(), ['Alpha', 'Beta'], 'normalization preserves the existing relation membership');
});
