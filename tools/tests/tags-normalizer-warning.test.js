'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Hexo = require('hexo');
const { getUnregisteredTags, formatUnregisteredTagWarnings } = require('../../scripts/tags-normalizer');

const root = path.resolve(__dirname, '../..');
const raw = tags => `---\ntags:\n${tags.map(tag => `  - ${tag}`).join('\n')}\n---\nfixture`;

test('unregistered tag names are listed once, registered names and aliases are not', () => {
  const aliases = new Map([['Alpha', 'Alpha'], ['OldAlpha', 'Alpha']]);
  assert.deepEqual(getUnregisteredTags(['Alpha', 'OldAlpha', 'Typo', ' Typo ', 'Other'], aliases), ['Typo', 'Other']);
  assert.deepEqual(getUnregisteredTags(['toString'], new Map()), ['toString']);
  assert.deepEqual(formatUnregisteredTagWarnings([]), []);
});

test('real Hexo generation warns with post source and tag names instead of dropping tags silently', async t => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-tag-warning-'));
  fs.mkdirSync(path.join(baseDir, 'source', '_data'), { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'source', '_data', 'content-tags.yml'), '- name: Alpha\n  aliases: [OldAlpha]\n');
  const hexo = new Hexo(baseDir, { silent: true });
  t.after(async () => {
    await hexo.exit();
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  await hexo.init();
  await hexo.loadPlugin(path.join(root, 'scripts', 'tags-normalizer.js'));
  await hexo.loadPlugin(path.join(root, 'scripts', 'post-tags.js'));
  const warnings = [];
  hexo.log.warn = message => warnings.push(String(message));
  const Post = hexo.model('Post');
  await Post.insert({ title: 'clean', date: '2020-01-01', source: '_posts/clean.md', slug: 'clean', raw: raw(['OldAlpha']) });
  const typo = await Post.insert({ title: 'typo', date: '2020-01-02', source: '_posts/typo.md', slug: 'typo', raw: raw(['Alpha', '華語歌', '華語歌']) });

  await hexo._generate({ cache: false });
  assert.equal(warnings.length, 3, warnings.join('\n'));
  assert.match(warnings[0], /未登錄標籤：1 篇文章/);
  assert.equal(warnings[1], '  source/_posts/typo.md：華語歌');
  assert.match(warnings[2], /content-tags\.yml/);
  assert.deepEqual(Post.findById(typo._id).tags.toArray().map(tag => tag.name), ['Alpha'], 'registered tags keep their existing behavior');

  warnings.length = 0;
  typo.raw = raw(['Alpha']);
  await typo.save();
  await hexo._generate({ cache: false });
  assert.deepEqual(warnings, [], 'no warning once every tag is registered');
});
