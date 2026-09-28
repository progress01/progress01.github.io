'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');
const { CONTENT_BROWSER_RANGES, filterPostsBySurface } = require('../lib/content-browser');

const legacyPostSources = new Set(['source/_posts/legacy.md']);
const post = (source, surfaces, extra = {}) => ({
  source, path: `/${path.basename(source, '.md')}/`, title: path.basename(source), date: new Date('2026-01-01'),
  categories: { toArray: () => [{ name: '分類' }] }, tags: { toArray: () => [{ name: '標籤' }] },
  ...(surfaces === undefined ? {} : { surfaces }), ...extra
});

test('ranges include all public posts or only posts that have the selected surface', () => {
  const posts = [post('source/_posts/profile.md', ['profile']), post('source/_posts/memory.md', ['memory']),
    post('source/_posts/both.md', ['memory', 'profile'])];
  assert.deepEqual(CONTENT_BROWSER_RANGES, ['all', 'profile', 'memory']);
  assert.equal(filterPostsBySurface(posts, 'all').length, 3);
  assert.deepEqual(filterPostsBySurface(posts, 'profile').map(item => item.path), ['/profile/', '/both/']);
  assert.deepEqual(filterPostsBySurface(posts, 'memory').map(item => item.path), ['/memory/', '/both/']);
});

test('legacy manifest defaults only the listed source to memory; new missing and invalid fields fail with source', () => {
  assert.deepEqual(filterPostsBySurface([post('source/_posts/legacy.md')], 'memory', { legacyPostSources })
    .map(item => item.path), ['/legacy/']);
  assert.throws(() => filterPostsBySurface([post('source/_posts/new.md')], 'all', { legacyPostSources }),
    /source\/\_posts\/new\.md \[missing_surfaces\]/);
  assert.throws(() => filterPostsBySurface([post('source/_posts/bad.md', ['PROFILE'])]),
    /source\/\_posts\/bad\.md \[unknown_surface\]/);
});

test('duplicates canonicalize through the shared helper and emit a located warning', () => {
  const warnings = [];
  const result = filterPostsBySurface([post('source/_posts/repeated.md', ['memory', 'profile', 'memory'])], 'profile', {
    onWarning: warning => warnings.push(warning)
  });
  assert.equal(result.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].source, 'source/_posts/repeated.md');
  assert.equal(warnings[0].code, 'duplicate_surface');
});

test('empty results and the existing published/draft exclusions remain intact', () => {
  assert.deepEqual(filterPostsBySurface([], 'profile'), []);
  assert.deepEqual(filterPostsBySurface([
    post('source/_posts/unpublished.md', ['profile'], { published: false }),
    post('source/_posts/draft.md', ['profile'], { draft: true }),
    post('source/_posts/memory.md', ['memory'])
  ], 'profile'), []);
  assert.throws(() => filterPostsBySurface([], 'private'), /content_browser_range_invalid/);
});

test('Hexo helper defaults to all and preserves category/tag/date/url output shape', () => {
  const script = fs.readFileSync(path.join(__dirname, '../../scripts/content-browser.js'), 'utf8');
  let recordsHelper;
  const warnings = [];
  vm.runInNewContext(script, {
    require: id => {
      if (id === '../tools/lib/content-browser') return require('../lib/content-browser');
      if (id === '../tools/data/legacy-surfaces.v1.json') return { schemaVersion: 1, posts: ['source/_posts/legacy.md'] };
      throw new Error(`unexpected require ${id}`);
    },
    hexo: {
      extend: { helper: { register: (name, callback) => { if (name === 'content_browser_records') recordsHelper = callback; } } },
      log: { warn: warning => warnings.push(warning) }
    }
  });
  const posts = [post('source/_posts/profile.md', ['profile']), post('source/_posts/legacy.md')];
  const context = {
    site: { posts: { sort: (_field, _direction) => ({ toArray: () => posts }) } },
    url_for: value => value,
    date: () => '2026-01-01'
  };
  const all = recordsHelper.call(context);
  assert.equal(all.length, 2);
  assert.deepEqual(Object.keys(all[0]), ['title', 'url', 'date', 'categories', 'tags']);
  assert.deepEqual(all[0].categories, ['分類']);
  assert.deepEqual(all[0].tags, ['標籤']);
  assert.deepEqual(recordsHelper.call(context, 'profile').map(item => item.url), ['/profile/']);
  assert.deepEqual(recordsHelper.call(context, 'memory').map(item => item.url), ['/legacy/']);
});

test('current public source produces 275 all, 11 profile, and 265 memory posts by set membership', () => {
  const root = path.resolve(__dirname, '../..');
  const manifest = require('../data/legacy-surfaces.v1.json');
  const legacy = new Set(manifest.posts);
  const posts = [];
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(file);
    if (!entry.isFile() || !entry.name.endsWith('.md')) return;
    const raw = fs.readFileSync(file, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return;
    const frontmatter = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (frontmatter?.published === false || frontmatter?.draft === true) return;
    posts.push({ ...frontmatter, source: path.relative(root, file).split(path.sep).join('/') });
  });
  visit(path.join(root, 'source/_posts'));
  const all = filterPostsBySurface(posts, 'all', { legacyPostSources: legacy });
  const profile = filterPostsBySurface(posts, 'profile', { legacyPostSources: legacy });
  const memory = filterPostsBySurface(posts, 'memory', { legacyPostSources: legacy });
  const sourceIdentity = item => item.source;
  const profileSources = new Set(profile.map(sourceIdentity));
  const memorySources = new Set(memory.map(sourceIdentity));
  const bothSources = [...profileSources].filter(source => memorySources.has(source));
  assert.equal(all.length, 275);
  assert.equal(profile.length, 11);
  assert.equal(memory.length, 265);
  assert.equal(profileSources.size, 11);
  assert.equal(memorySources.size, 265);
  assert.equal(new Set(all.map(sourceIdentity)).size, all.length);
  assert.equal(bothSources.length, 1);
  assert.equal([...profileSources].filter(source => !memorySources.has(source)).length, 10);
  const explicitPermalinkPosts = all.filter(item => typeof item.permalink === 'string' && item.permalink.trim());
  assert.equal(new Set(explicitPermalinkPosts.map(item => item.permalink)).size, explicitPermalinkPosts.length);
});
