'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const cheerio = require('cheerio');
const {
  checkTemplateWiring,
  validateArticle,
  validateThinkingStatusOutput
} = require('../thinking-status-output-check');
const { resolveThinkingStatus } = require('../lib/thinking-status');

const sourceRoot = path.resolve(__dirname, '../..');
const index = { records: [
  { kind: 'article', url: '/ordinary/' },
  { kind: 'article', url: '/another/' }
] };
const article = block => `<article class="post-content-single"><header class="post-header"></header>${block || ''}<div class="post-body"></div></article>`;

function escaped(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function renderSyntheticArticle(frontMatter) {
  const status = resolveThinkingStatus(frontMatter, { source: 'synthetic-fixture.md' });
  if (!status.visible) return article();
  return article(`<aside class="post-thinking-status" aria-labelledby="post-thinking-status-title"><h2 id="post-thinking-status-title">🚧 當前假設／探索中</h2><p><span>最近校準</span> <time datetime="${status.updated}">${status.updated}</time></p><p><span>目前適用邊界</span> ${escaped(status.boundary)}</p></aside>`);
}

function renderSyntheticCard(frontMatter, className = 'profile-article-card') {
  const status = resolveThinkingStatus(frontMatter, { source: 'synthetic-fixture.md' });
  return `<article class="${className}"><a class="profile-article-link" href="/synthetic/"><time datetime="2026-09-27">2026-09</time><h3>Synthetic fixture</h3>${status.visible ? `<span class="profile-thinking-label">探索中・校準 ${status.updated}</span>` : ''}</a></article>`;
}

test('locks production helper and article/profile template wiring', () => {
  assert.deepEqual(checkTemplateWiring(sourceRoot), []);
});

test('synthetic article fixture renders the semantic block and escapes hostile boundary text', () => {
  const html = renderSyntheticArticle({
    thinking_status: 'exploring',
    thinking_updated: '2026-09-27',
    thinking_boundary: '適用 <img src=x onerror=alert(1)> & 僅限測試'
  });
  const $ = cheerio.load(html);
  const block = $('.post-thinking-status');
  assert.equal(block.length, 1);
  assert.equal(block.attr('aria-labelledby'), 'post-thinking-status-title');
  assert.equal(block.find('h2#post-thinking-status-title').text(), '🚧 當前假設／探索中');
  assert.equal(block.find('time').attr('datetime'), '2026-09-27');
  assert.equal(block.find('time').text(), '2026-09-27');
  assert.match(block.text(), /最近校準/);
  assert.match(block.text(), /目前適用邊界/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp;/);
  assert.equal(block.find('script').length, 0);
  assert.equal(block.find('[onclick]').length, 0);
  assert.equal(block.index(), 1);
  assert.equal(block.next('.post-body').length, 1);
});

test('synthetic A card fixture keeps only the compact status and no boundary, with absent-state negative', () => {
  const fields = {
    thinking_status: 'exploring', thinking_updated: '2026-09-27', thinking_boundary: 'synthetic boundary'
  };
  const exploringCards = [
    renderSyntheticCard(fields),
    renderSyntheticCard(fields, 'profile-article-card profile-learning-card'),
    renderSyntheticCard(fields, 'profile-article-card profile-full-article-card')
  ];
  const absent = renderSyntheticCard({ learning_status: '進行中', status: 'published-note', surfaces: ['profile'] });
  for (const exploring of exploringCards) {
    assert.match(exploring, /探索中・校準 2026-09-27/);
    assert.doesNotMatch(exploring, /synthetic boundary|目前適用邊界/);
  }
  assert.doesNotMatch(absent, /探索中|校準|boundary/);
  assert.match(exploringCards[0], /href="\/synthetic\/"/);
  assert.match(exploringCards[0], /<h3>Synthetic fixture<\/h3>/);
});

test('formal no-status fixture validates articles, cover, and full A library as absent', () => {
  const pages = {
    'ordinary/index.html': article(),
    'another/index.html': article(),
    'profile/index.html': '<section class="profile-article-calendar"><h2>2026 更新日曆</h2></section>',
    'profile/articles/index.html': '<ul data-profile-article-list>'.concat('<li class="profile-article-row"></li>'.repeat(8), '</ul>'),
    'index.html': '<main></main>', 'random/index.html': '<main></main>', 'archives/index.html': '<main></main>',
    'categories/work/index.html': '<main></main>', 'search/index.html': '<main></main>'
  };
  const result = validateThinkingStatusOutput({ root: '.', sourceRoot, index, pages });
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleCount, 2);
  assert.equal(result.checkedCards, 8);
});

test('formal checker rejects maturity markup in article and A-card outputs', () => {
  const pages = {
    'ordinary/index.html': article('<aside class="post-thinking-status"></aside>'),
    'another/index.html': article(),
    'profile/index.html': '<article class="profile-article-card"><span class="profile-thinking-label">探索中</span></article>',
    'profile/articles/index.html': '<article class="profile-full-article-card"></article>',
    'random/index.html': '<main><span class="profile-thinking-label">探索中</span></main>'
  };
  const result = validateThinkingStatusOutput({ root: '.', sourceRoot, index, pages });
  assert.ok(result.errors.some(error => error.code === 'unexpected_thinking_status_without_declared_fields'));
  assert.ok(result.errors.some(error => error.code === 'unexpected_profile_thinking_label_without_declared_fields'));
  assert.ok(result.errors.some(error => error.code === 'thinking_status_marker_outside_allowed_regions'));
});
