'use strict';

// Read sources and Hexo's in-memory published routes; write audit artifacts only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const Hexo = require('hexo');
const yaml = require('js-yaml');
const cheerio = require('cheerio');
const { validateReadingDate } = require('./content-check');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = html => {
  const $ = cheerio.load(String(html || ''));
  $('script,style,template,noscript,.gutter').remove();
  return $.text().replace(/\s+/g, ' ').trim();
};
const sourcePaths = () => execFileSync('git', ['ls-files', '-z', '--', 'source', 'scripts', 'themes', '_config.yml', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(file => /\.(?:md|json|ya?ml|js|njk|styl)$/.test(file));
const hashes = files => Object.fromEntries(files.map(file => [file, digest(fs.readFileSync(path.join(root, file)))]));
const canonicalPath = (value, origin) => {
  const url = new URL(value, origin);
  if (url.origin !== new URL(origin).origin) return null;
  return decodeURIComponent(url.pathname).replace(/\/index\.html$/, '/').replace(/\/$/, '') + '/';
};

async function main() {
  const files = sourcePaths();
  const before = hashes(files);
  const baseline = {
    createdAt: new Date().toISOString(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['-c', 'core.quotePath=false', 'status', '--short'], { cwd: root, encoding: 'utf8' }),
    hashes: before
  };
  fs.mkdirSync(path.join(root, 'tmp/navigation'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tmp/navigation/step1-baseline.json'), JSON.stringify(baseline, null, 2) + '\n');
  const hexo = new Hexo(root, { silent: true });
  try {
    await hexo.init();
    await hexo.load();
    const posts = hexo.locals.get('posts').toArray();
    const allPosts = hexo.model('Post').toArray();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const articles = posts.map(post => ({
      source: 'source/' + post.source,
      title: post.title,
      url: canonicalPath('/' + String(post.path).replace(/^\/+/, ''), hexo.config.url),
      date: post.date.format('YYYY-MM-DD'),
      updated: post.updated?.format('YYYY-MM-DD'),
      categories: post.categories.toArray().map(item => item.name),
      tags: post.tags.toArray().map(item => item.name),
      text: plain(post.content)
    }));
    const byUrl = new Map(articles.map(post => [post.url, post]));
    const microblog = JSON.parse(read('source/microblog.json'));
    const desk = yaml.load(read('source/reading-desk.yml'), { schema: yaml.JSON_SCHEMA });
    const topics = (desk.topics || []).flatMap(group => (group.items || []).map(item => ({
      ...item, topicId: group.id, topic: group.name,
      canonicalUrl: item.url ? canonicalPath(item.url, hexo.config.url) : null
    })));
    const issues = [];
    const seenIds = new Set();
    topics.forEach(item => {
      if (!item.id || seenIds.has(item.id)) issues.push('Missing/duplicate learning ID: ' + item.title);
      seenIds.add(item.id);
      if (!validateReadingDate(String(item.date || ''))) issues.push('Invalid learning date: ' + item.id);
      if (item.canonicalUrl && !byUrl.has(item.canonicalUrl)) issues.push('Learning URL not a published article: ' + item.url);
    });
    microblog.forEach((item, index) => {
      if (!validateReadingDate(String(item.date || ''))) issues.push('Invalid microblog date at current row ' + index);
    });
    const microKeys = microblog.map(item => JSON.stringify([item.date, plain(item.content), item.tag || '']));
    const report = {
      generatedAt: new Date().toISOString(),
      timezone: hexo.config.timezone,
      config: { search: hexo.config.search, renderDrafts: hexo.config.render_drafts, future: hexo.config.future },
      counts: {
        publicArticles: articles.length,
        excludedPosts: allPosts.length - posts.length,
        futurePublishedArticles: articles.filter(item => item.date > today).length,
        microblog: microblog.length,
        microblogWithoutId: microblog.filter(item => !item.id).length,
        duplicateMicroblogPayloads: microKeys.length - new Set(microKeys).size,
        learningGroups: (desk.topics || []).length,
        learningItems: topics.length,
        learningLinkedToArticles: topics.filter(item => byUrl.has(item.canonicalUrl)).length
      },
      issues,
      learningArticleMappings: topics.map(item => ({ id: item.id, title: item.title, addedDate: item.date, url: item.canonicalUrl, articleDate: byUrl.get(item.canonicalUrl)?.date })),
      sourcesUnchanged: JSON.stringify(before) === JSON.stringify(hashes(files))
    };
    if (!report.sourcesUnchanged) throw new Error('Source files changed during inventory; review baseline before proceeding.');
    const article = articles.find(item => item.title.includes('有工作的第N+6天'));
    const micro = microblog.find(item => String(item.content).includes('沒有被使用'));
    const learning = topics.find(item => item.id === 'reading-topic-01');
    if (!article || !micro || !learning) throw new Error('Expected real acceptance examples are unavailable.');
    const examples = {
      status: 'Source examples verified; search/UI acceptance remains pending implementation.',
      cases: [
        { id: 'article-recall', query: '有工作的第N+6天', source: article.source, expectedUrl: article.url, expectedDate: article.date, expectedType: 'article' },
        { id: 'microblog-recall', query: '沒有被使用', source: 'source/microblog.json', expectedContent: micro.content, expectedDate: micro.date, expectedUrlBase: '/status/', expectedType: 'microblog', pending: 'Persistent ID and anchor' },
        { id: 'learning-recall', query: '早段拉臂時機', source: 'source/reading-desk.yml', expectedLearningId: learning.id, expectedUrl: learning.canonicalUrl, expectedAddedDate: learning.date, expectedResultCountForThisArticle: 1, pending: 'Search reading note as an alias of the article without losing its added-date event' }
      ],
      futureBehaviorCases: [
        'Prepend and reorder microblog entries: existing links remain stable.',
        'Edit an entry without changing its ID: old link locates updated content.',
        'Linked learning note and article produce one result but retain separate date meanings.',
        'Unpublished article or unresolved local target does not leak into public search.',
        'Empty/missing optional fields, invalid dates and script/style text are handled explicitly.',
        'HTML-sensitive search text is escaped; external learning links cannot become script URLs.',
        'Search/return state, date boundaries and mobile interaction tested in later items.'
      ]
    };
    for (const [file, value] of [['personal-navigation-inventory.json', report], ['personal-navigation-acceptance.json', examples]]) {
      fs.writeFileSync(path.join(root, 'docs', file), JSON.stringify(value, null, 2) + '\n');
    }
    console.log(JSON.stringify({ counts: report.counts, issues, sourcesUnchanged: report.sourcesUnchanged, realExamples: examples.cases.length }, null, 2));
    if (issues.length) process.exitCode = 1;
  } finally {
    await hexo.exit();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
