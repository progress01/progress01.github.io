'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfileHome, formatDiagnostics } = require('../profile-home-check');

const urls = [
  '/work/a/', '/work/b/', '/work/c/', '/work/d/',
  '/work/e/', '/work/f/', '/work/g/', '/work/h/'
];
const validData = () => ({
  schemaVersion: 1,
  copyStatus: 'approved/10.6',
  presentation: { pageTitle: '工作與學習', flipLabel: 'SIDE B／翻到個人記憶庫' },
  statusValues: ['published-note', 'learning-in-progress'],
  paths: [
    { id: 'observe-context-and-needs', title: '看見現場與需求', workingDescription: 'Internal note', workingDescriptionVisibility: 'internal', items: urls.slice(0, 3).map((url, i) => item(url, i)) },
    { id: 'organize-information-and-methods', title: '整理資訊與方法', workingDescription: 'Internal note', workingDescriptionVisibility: 'internal', items: urls.slice(3, 5).map((url, i) => item(url, i + 3)) },
    { id: 'implement-verify-and-improve', title: '實作、驗證與修正', workingDescription: 'Internal note', workingDescriptionVisibility: 'internal', items: urls.slice(5).map((url, i) => item(url, i + 5)) }
  ]
});
function item(url, index) {
  return { url, role: index < 4 ? 'featured' : 'supporting', status: 'published-note', selectionReason: 'Reason', readerValue: 'Value' };
}
function postsFor(data = validData()) {
  return data.paths.flatMap(path => path.items).map(entry => ({
    source: `source/_posts/${entry.url.split('/').filter(Boolean).at(-1)}.md`,
    url: entry.url,
    published: true,
    frontmatter: { permalink: entry.url, surfaces: ['profile'] }
  }));
}
function check(data, posts = postsFor(data)) { return validateProfileHome({ data, posts }); }
function codes(result) { return result.errors.map(error => error.code); }

test('accepts three paths and eight unique published profile posts, with four featured', () => {
  const result = check(validData());
  assert.deepEqual(result.errors, []);
  assert.equal(result.itemCount, 8);
  assert.equal(result.featuredCount, 4);
});

test('rejects invalid YAML, schema version, copy status, and malformed status values', () => {
  assert.ok(codes(validateProfileHome({ yamlText: 'paths: [oops' })).includes('yaml_invalid'));
  const wrong = validData(); wrong.schemaVersion = 2; wrong.copyStatus = 'final-ish'; wrong.statusValues = ['published-note', 'published-note'];
  assert.ok(codes(check(wrong)).includes('schema_version_invalid'));
  assert.ok(codes(check(wrong)).includes('copy_status_invalid'));
  assert.ok(codes(check(wrong)).includes('status_values_invalid'));
});

test('approved presentation is minimal, exact, and contains no public intro or tagline', () => {
  const missing = validData(); delete missing.presentation;
  assert.ok(codes(check(missing)).includes('presentation_invalid'));
  const extraField = validData(); extraField.presentation.intro = 'Not allowed';
  assert.ok(codes(check(extraField)).includes('presentation_fields_invalid'));
  const tagline = validData(); tagline.tagline = 'Not allowed';
  assert.ok(codes(check(tagline)).includes('presentation_explainer_forbidden'));
  const wrongCopy = validData(); wrongCopy.presentation.pageTitle = '其他標題';
  assert.ok(codes(check(wrongCopy)).includes('presentation_copy_invalid'));
  const wrongTitles = validData(); wrongTitles.paths[0].title = '舊路徑';
  assert.ok(codes(check(wrongTitles)).includes('approved_path_titles_invalid'));
  const exposedNote = validData(); exposedNote.paths[0].workingDescriptionVisibility = 'public';
  assert.ok(codes(check(exposedNote)).includes('path_description_visibility_invalid'));
});

test('rejects path count, duplicate or malformed IDs, empty path text and empty items', () => {
  const wrong = validData();
  wrong.paths[1].id = wrong.paths[0].id;
  wrong.paths[2].title = ' ';
  wrong.paths[2].workingDescription = '';
  wrong.paths[2].workingDescriptionVisibility = 'internal';
  wrong.paths[2].items = [];
  wrong.paths.push({ id: 'bad_id', title: ' ', workingDescription: '', items: [] });
  const result = check(wrong, postsFor(validData()));
  assert.ok(codes(result).includes('path_count_invalid'));
  assert.ok(codes(result).includes('path_id_duplicate'));
  assert.ok(codes(result).includes('path_id_invalid'));
  assert.ok(codes(result).includes('path_title_empty'));
  assert.ok(codes(result).includes('path_description_empty'));
  assert.ok(codes(result).includes('path_items_empty'));
});

test('rejects duplicate, noncanonical, missing, ambiguous, and unpublished post URLs', () => {
  const data = validData();
  data.paths[1].items[0].url = urls[0];
  data.paths[2].items[0].url = '/work/missing/';
  data.paths[2].items[1].url = '/work/draft/';
  data.paths[2].items[2].url = '/work/no-trailing-slash';
  const posts = postsFor(validData());
  posts.push({ source: 'source/_posts/duplicate.md', url: urls[0], published: true, frontmatter: { permalink: urls[0], surfaces: ['profile'] } });
  posts.push({ source: 'source/_posts/draft.md', url: '/work/draft/', published: false, frontmatter: { permalink: '/work/draft/', draft: true, surfaces: ['profile'] } });
  const result = check(data, posts);
  assert.ok(codes(result).includes('url_duplicate'));
  assert.ok(codes(result).includes('url_multiple_posts'));
  assert.ok(codes(result).includes('url_not_published_post'));
  assert.ok(codes(result).includes('url_post_unpublished'));
  assert.ok(codes(result).includes('url_invalid'));
});

test('requires profile surface and rejects malformed surface data', () => {
  const posts = postsFor();
  posts[0].frontmatter.surfaces = ['memory'];
  posts[1].frontmatter.surfaces = ['PROFILE'];
  const result = check(validData(), posts);
  assert.ok(codes(result).includes('post_not_profile_qualified'));
  assert.ok(codes(result).includes('post_surfaces_invalid'));
});

test('rejects page, microblog, and draft references because they are not unique published posts', () => {
  const data = validData();
  data.paths[0].items[0].url = '/profile/';
  data.paths[0].items[1].url = '/microblog/';
  data.paths[0].items[2].url = '/work/draft/';
  const posts = postsFor(validData()).filter(post => post.url !== urls[0] && post.url !== urls[1] && post.url !== urls[2]);
  posts.push({ source: 'source/_posts/draft.md', url: '/work/draft/', published: false, frontmatter: { permalink: '/work/draft/', published: false, surfaces: ['profile'] } });
  const result = check(data, posts);
  assert.ok(codes(result).filter(code => code === 'url_not_published_post').length >= 2);
  assert.ok(codes(result).includes('url_post_unpublished'));
});

test('rejects invalid role/status, empty item copy, and item totals outside v1 bounds', () => {
  const data = validData();
  data.paths[0].items[0].role = 'other';
  data.paths[0].items[0].status = 'unknown';
  data.paths[0].items[1].selectionReason = ' ';
  data.paths[0].items[1].readerValue = '';
  data.paths[2].items.pop(); data.paths[2].items.pop(); data.paths[2].items.pop();
  const result = check(data, postsFor(validData()));
  assert.ok(codes(result).includes('role_invalid'));
  assert.ok(codes(result).includes('status_invalid'));
  assert.ok(codes(result).includes('selection_reason_empty'));
  assert.ok(codes(result).includes('reader_value_empty'));
  assert.ok(codes(result).includes('item_count_out_of_range'));
  assert.ok(codes(result).includes('featured_count_invalid'));

  const tooMany = validData();
  tooMany.paths[2].items.push(item('/work/i/', 8), item('/work/j/', 9), item('/work/k/', 10));
  const extraPosts = postsFor(tooMany);
  const upperResult = check(tooMany, extraPosts);
  assert.ok(codes(upperResult).includes('item_count_out_of_range'));
});

test('diagnostics identify code/path/url without exposing article body text', () => {
  const secret = 'fixture-private-body-should-not-leak';
  const result = check(validData());
  result.errors = [{ code: 'url_missing', path: 'source/_posts/example.md', url: '/missing/', message: secret }];
  const rendered = formatDiagnostics(result).join('\n');
  assert.match(rendered, /url_missing/);
  assert.match(rendered, /path=/);
  assert.match(rendered, /url=\/missing\//);
  assert.doesNotMatch(rendered, /fixture-private-body-should-not-leak/);
});
