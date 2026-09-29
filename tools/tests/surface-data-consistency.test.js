'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');
const moment = require('moment-timezone');
const { buildIndex } = require('../lib/navigation-index');
const { normalizeSurfaces } = require('../lib/content-surfaces');

const root = path.resolve(__dirname, '../..');
const repoManifest = require('../data/legacy-surfaces.v1.json');
const collection = values => ({ toArray: () => values.map(name => ({ name })) });

function loadHexoCallback(file, kind, manifest = repoManifest) {
  let callback;
  const warnings = [];
  const expectedName = file.endsWith('content-browser.js')
    ? 'content_browser_records'
    : file.endsWith('search-recent-posts.js')
      ? 'search_recent_posts'
      : null;
  const generatorRequire = id => {
    if (id === '../tools/lib/content-surfaces') return require('../lib/content-surfaces');
    if (id === '../tools/lib/content-browser') return require('../lib/content-browser');
    if (id === '../tools/lib/post-surface') return require('../lib/post-surface');
    if (id === '../tools/data/legacy-surfaces.v1.json') return manifest;
    throw new Error(`unexpected generator dependency: ${id}`);
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    require: generatorRequire,
    hexo: {
      extend: {
        generator: { register: (_name, fn) => { if (kind === 'generator') callback = fn; } },
        helper: { register: (name, fn) => { if (kind === 'helper' && name === expectedName) callback = fn; } }
      },
      log: { warn: message => warnings.push(message) }
    }
  });
  return { callback, warnings };
}

function article(source, url, surfaces, categories = ['一般'], extra = {}) {
  const post = {
    source, path: url.replace(/^\//, ''), title: source.split('/').at(-1),
    date: moment.tz('2026-09-20', 'Asia/Taipei'), content: '<p>fixture</p>',
    categories: collection(categories), tags: collection([]),
    ...extra
  };
  if (surfaces !== undefined) post.surfaces = surfaces;
  return post;
}

function collectionFor(posts) {
  return {
    sort: (field, direction) => ({
      toArray: () => [...posts].sort((a, b) => {
        const difference = a[field].valueOf() - b[field].valueOf();
        return direction === -1 ? -difference : difference;
      })
    })
  };
}

function helperContext(posts) {
  return { site: {
    data: { 'content-categories': [{ name: '一般' }, { name: '站務' }] },
    posts: collectionFor(posts)
  }, url_for: value => `/${value}`, date: () => '2026-09-20' };
}

function fixtureManifest() {
  return { schemaVersion: 1, posts: ['source/_posts/legacy.md'], microblogIds: [],
    readingDeskItemIds: ['legacy-learning-link'] };
}

function fixturePosts() {
  return [
    article('source/_posts/profile.md', '/profile/', ['profile']),
    article('source/_posts/legacy.md', '/legacy/', undefined),
    article('source/_posts/both.md', '/both/', ['memory', 'profile']),
    article('source/_posts/station.md', '/station/', ['memory'], ['站務']),
    article('source/_posts/random-control.md', '/random-control/', ['memory'], ['一般'], { type: 'random' })
  ];
}

test('fixture records resolve identically across navigation, random, browser, and recent consumers', () => {
  const manifest = fixtureManifest();
  const posts = fixturePosts();
  const desk = { topics: [{ name: '題目', items: [{ id: 'legacy-learning-link', url: '/profile/', title: '附註' }] }] };
  const index = buildIndex({ posts, microblog: [], desk, origin: 'https://example.test', legacySurfaceManifest: manifest });
  const articles = index.records.filter(record => record.kind === 'article');
  const byUrl = new Map(articles.map(record => [record.url, record]));
  assert.equal(articles.length, 5);
  assert.equal(byUrl.size, 5);
  assert.deepEqual(byUrl.get('/profile/').surfaces, ['profile']);
  assert.deepEqual(byUrl.get('/legacy/').surfaces, ['memory']);
  assert.deepEqual(byUrl.get('/both/').surfaces, ['profile', 'memory']);
  assert.deepEqual(byUrl.get('/profile/').learningItems[0].surfaces, ['profile']);
  assert.equal(index.records.filter(record => record.url === '/profile/').length, 1,
    'linked learning is attached to its article and does not create another article record');

  const browser = loadHexoCallback('scripts/content-browser.js', 'helper', manifest).callback;
  const recent = loadHexoCallback('scripts/search-recent-posts.js', 'helper', manifest).callback;
  const browserAll = browser.call(helperContext(posts));
  const browserProfile = browser.call(helperContext(posts), 'profile');
  const browserMemory = browser.call(helperContext(posts), 'memory');
  const urls = records => records.map(record => record.url);
  assert.deepEqual(new Set(urls(browserAll)), new Set(byUrl.keys()));
  assert.deepEqual(new Set(urls(browserProfile)), new Set(['/profile/', '/both/']));
  assert.deepEqual(new Set(urls(browserMemory)), new Set(['/legacy/', '/both/', '/station/', '/random-control/']));

  const random = loadHexoCallback('scripts/random-generator.js', 'generator', manifest).callback;
  const randomRecords = JSON.parse(random({ posts }).data);
  assert.deepEqual(new Set(randomRecords.map(record => record.url)), new Set(['/legacy/', '/both/']));
  assert.equal(randomRecords.filter(record => record.url === '/both/').length, 1);
  assert.deepEqual(new Set(urls(browserMemory).filter(url => !randomRecords.some(record => record.url === url))),
    new Set(['/station/', '/random-control/']),
    'memory eligibility is shared, while type/category random exclusions remain an additional random-only rule');

  for (const [range, flag] of [['profile', 'profile'], ['memory', 'memory']]) {
    const limited = recent.call(helperContext(posts), range);
    assert.ok(limited.every(item => byUrl.get(`/${item.post.path}`).surfaces.includes(flag)));
    assert.equal(limited.filter(item => item.post.path === 'both/').length, 1);
  }
  assert.deepEqual(recent.call(helperContext(posts)).map(item => item.post.path),
    recent.call(helperContext(posts), 'all').map(item => item.post.path),
    'legacy no-argument search fallback is the all range');
});

test('all consumers reject an invalid or new missing surface with the source diagnostic', () => {
  const manifest = fixtureManifest();
  const invalid = article('source/_posts/new-invalid.md', '/new-invalid/', ['PROFILE']);
  const missing = article('source/_posts/new-missing.md', '/new-missing/', undefined);
  const cases = [
    { post: invalid, code: 'unknown_surface' }, { post: missing, code: 'missing_surfaces' }
  ];
  for (const { post, code } of cases) {
    assert.throws(() => buildIndex({ posts: [post], microblog: [], desk: { topics: [] }, origin: 'https://example.test',
      legacySurfaceManifest: manifest }), new RegExp(`${post.source.replaceAll('/', '\\/')} \\[${code}\\]`));
    for (const [file, kind, invoke] of [
      ['scripts/random-generator.js', 'generator', callback => callback({ posts: [post] })],
      ['scripts/content-browser.js', 'helper', callback => callback.call(helperContext([post]))],
      ['scripts/search-recent-posts.js', 'helper', callback => callback.call(helperContext([post]))]
    ]) {
      const callback = loadHexoCallback(file, kind, manifest).callback;
      assert.throws(() => invoke(callback), new RegExp(`${post.source.replaceAll('/', '\\/')} \\[${code}\\]`));
    }
  }
});

function readPublishedPosts(routeMap) {
  const posts = [];
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(file);
    if (!entry.isFile() || !entry.name.endsWith('.md')) return;
    const raw = fs.readFileSync(file, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return;
    const frontmatter = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (!frontmatter?.title || frontmatter.published === false || frontmatter.draft === true) return;
    const url = routeMap.get(frontmatter.title);
    if (!url) throw new Error(`source_route_missing: ${path.relative(root, file)}`);
    const names = value => (Array.isArray(value) ? value : value == null ? [] : [value]).map(item => String(item?.name || item));
    const frontmatterEnd = match[0].length;
    posts.push({
      ...frontmatter,
      source: path.relative(root, file).split(path.sep).join('/'),
      path: url.replace(/^\//, ''),
      date: frontmatter.date == null ? null : moment(String(frontmatter.date), [moment.ISO_8601, 'YYYY-M-D HH:mm:ss', 'YYYY-MM-DD'], true).tz('Asia/Taipei'),
      content: raw.slice(frontmatterEnd),
      categories: collection(names(frontmatter.categories)),
      tags: collection(names(frontmatter.tags))
    });
  });
  visit(path.join(root, 'source/_posts'));
  return posts;
}

test('real 276-post corpus, twelve profile posts, eight approved URLs, random baseline, and legacy sample agree', t => {
  const routeSnapshot = path.join(root, 'public/navigation-index.json');
  const randomBaselineFile = path.join(root, 'tmp/wbs33-public-20260926/random.json');
  if (!fs.existsSync(routeSnapshot) || !fs.existsSync(randomBaselineFile)) {
    t.skip('4.1 route snapshot or 4.2 pre-filter random baseline is unavailable; fixture cross-consistency still runs');
    return;
  }

  const generatedNavigationSnapshot = JSON.parse(fs.readFileSync(routeSnapshot, 'utf8'));
  const snapshotArticles = generatedNavigationSnapshot.records.filter(record => record.kind === 'article');
  const routeTitles = new Map(snapshotArticles.map(record => [record.title, record.url]));
  assert.equal(snapshotArticles.length, 276);
  assert.equal(new Set(snapshotArticles.map(record => record.url)).size, 276);
  assert.equal(routeTitles.size, 276, 'snapshot titles must uniquely map real source records to their established routes');

  const posts = readPublishedPosts(routeTitles);
  assert.equal(posts.length, 276);
  const postsByUrl = new Map(posts.map(post => [`/${post.path}`, post]));
  assert.equal(postsByUrl.size, 276);
  const legacy = new Set(repoManifest.posts);
  const expectedSurfaces = new Map(posts.map(post => {
    const source = post.source;
    const resolved = normalizeSurfaces(post, { source, missingPolicy: legacy.has(source) ? 'legacy' : 'error' });
    return [`/${post.path}`, resolved.surfaces];
  }));

  const realIndex = buildIndex({
    posts,
    microblog: JSON.parse(fs.readFileSync(path.join(root, 'source/microblog.json'), 'utf8')),
    desk: yaml.load(fs.readFileSync(path.join(root, 'source/reading-desk.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA }),
    origin: 'https://progress01.github.io'
  });
  const articles = realIndex.records.filter(record => record.kind === 'article');
  const articleByUrl = new Map(articles.map(record => [record.url, record]));
  assert.equal(articles.length, 276);
  assert.equal(articleByUrl.size, 276);
  assert.equal(articleByUrl.size, new Set(articles.map(record => record.url)).size);

  const browser = loadHexoCallback('scripts/content-browser.js', 'helper').callback;
  const all = browser.call(helperContext(posts));
  const profile = browser.call(helperContext(posts), 'profile');
  const memory = browser.call(helperContext(posts), 'memory');
  const urls = records => records.map(record => record.url);
  assert.equal(all.length, 276);
  assert.equal(profile.length, 12);
  assert.equal(memory.length, 276);
  assert.equal(new Set(urls(all)).size, 276);
  assert.equal(new Set(urls(profile)).size, 12);
  assert.equal(new Set(urls(memory)).size, 276);
  for (const [url, surfaces] of expectedSurfaces) {
    assert.deepEqual(articleByUrl.get(url).surfaces, surfaces, `navigation surface mismatch at ${url}`);
    assert.equal(urls(profile).includes(url), surfaces.includes('profile'), `profile list mismatch at ${url}`);
    assert.equal(urls(memory).includes(url), surfaces.includes('memory'), `memory list mismatch at ${url}`);
  }

  const recent = loadHexoCallback('scripts/search-recent-posts.js', 'helper').callback;
  for (const [range, surface] of [['all', null], ['profile', 'profile'], ['memory', 'memory']]) {
    const limited = recent.call(helperContext(posts), range);
    assert.equal(new Set(limited.map(item => item.post.path)).size, limited.length,
      `recent ${range} contains duplicate article records`);
    for (const item of limited) {
      const url = `/${item.post.path}`;
      assert.ok(expectedSurfaces.get(url), `recent ${range} route is absent from source`);
      if (surface) assert.ok(expectedSurfaces.get(url).includes(surface), `recent ${range} leaks another surface: ${url}`);
    }
  }

  const random = loadHexoCallback('scripts/random-generator.js', 'generator').callback;
  const randomRecords = JSON.parse(random({ posts }).data);
  const randomUrls = randomRecords.map(record => record.url);
  const oldEligible = posts.filter(post => {
    const categories = post.categories.toArray().map(item => item.name);
    return post.path && post.type !== 'random' && !categories.includes('站務');
  });
  const baselineUrls = oldEligible.map(post => `/${post.path}`);
  assert.equal(baselineUrls.length, 274);
  assert.equal(new Set(baselineUrls).size, 274);
  const expectedRandom = baselineUrls.filter(url => expectedSurfaces.get(url).includes('memory'));
  assert.equal(expectedRandom.length, 274);
  assert.equal(randomRecords.length, 274);
  assert.deepEqual(new Set(randomUrls), new Set(expectedRandom));
  assert.equal(new Set(randomUrls).size, 274);

  const approved = yaml.load(fs.readFileSync(path.join(root, 'source/_data/profile-home.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
  const approvedUrls = approved.paths.flatMap(group => group.items.map(item => item.url));
  assert.equal(approvedUrls.length, 8);
  assert.equal(new Set(approvedUrls).size, 8);
  for (const url of approvedUrls) {
    assert.ok(articleByUrl.get(url)?.surfaces.includes('profile'), `navigation misses approved profile URL ${url}`);
    assert.ok(urls(profile).includes(url), `content browser misses approved profile URL ${url}`);
    const surfaceSet = expectedSurfaces.get(url);
    assert.equal(randomUrls.includes(url), surfaceSet.includes('memory') && baselineUrls.includes(url),
      `random eligibility mismatch for approved URL ${url}`);
  }
  const profileRecent = recent.call(helperContext(posts), 'profile');
  assert.ok(profileRecent.every(item => expectedSurfaces.get(`/${item.post.path}`).includes('profile')));

  const legacySongPath = 'source/_posts/歌曲推薦/歌曲推薦-sailing back to you.md';
  const legacySong = posts.find(post => post.source === legacySongPath);
  assert.ok(legacySong, 'legacy B sample must exist in source');
  const legacySongUrl = `/${legacySong.path}`;
  assert.deepEqual(expectedSurfaces.get(legacySongUrl), ['memory']);
  assert.deepEqual(articleByUrl.get(legacySongUrl).surfaces, ['memory']);
  assert.ok(urls(memory).includes(legacySongUrl));
  assert.ok(randomUrls.includes(legacySongUrl));
});
