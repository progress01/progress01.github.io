const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const nunjucks = require('nunjucks');

const templatePath = path.join(__dirname, '..', '..', 'themes', 'next', 'layout', '_macro', 'post.njk');
const template = fs.readFileSync(templatePath, 'utf8');
const featureStart = template.indexOf('{# Reading, film');
const featureEnd = template.indexOf('{#################}', featureStart);
const bodyStart = template.indexOf('    <div class="post-body');
const bodyEnd = template.indexOf('    {#####################}', bodyStart);
assert.ok(featureStart >= 0 && featureEnd > featureStart);
assert.ok(bodyStart >= 0 && bodyEnd > bodyStart);
const renderedSections = template.slice(featureStart, featureEnd) + template.slice(bodyStart, bodyEnd);

function tags(names) {
  return { length: names.length, toArray: () => names.map(name => ({ name })) };
}

function renderPost(overrides = {}) {
  const post = {
    source: 'source/_posts/歌曲推薦/歌曲推薦-test.md',
    title: '歌曲推薦-test',
    cover: '',
    excerpt: '歌曲摘要',
    content: '歌曲正文',
    learning: false,
    work_knowledge: false,
    tags: tags(['音樂推薦']),
    date: { format: () => '2026-09-11' },
    ...overrides
  };
  const env = new nunjucks.Environment(null, { autoescape: false });
  env.addGlobal('url_for', value => value);
  env.addGlobal('escape_html', value => String(value));
  env.addGlobal('symbolsTime', () => '1 分鐘');
  return env.renderString(renderedSections, {
    is_index: true,
    post,
    config: { symbols_count_time: { time: false } },
    theme: { read_more_btn: false }
  });
}

test('歌曲列表在 cover 存在或不存在時都保留摘要，且不產生 reading feature card', () => {
  for (const cover of ['', '/images/song-test.webp']) {
    const output = renderPost({ cover });
    assert.doesNotMatch(output, /post-feature-card/);
    assert.match(output, /歌曲摘要/);
  }
});

test('learning 文章輸出 feature card 並隱藏重複正文摘要', () => {
  const output = renderPost({
    source: 'source/_posts/實驗室/學習筆記.md',
    title: '學習筆記',
    cover: '/images/learning.webp',
    learning: true,
    excerpt: '學習摘要'
  });
  assert.match(output, /post-feature-card/);
  assert.equal((output.match(/學習摘要/g) || []).length, 1);
});
