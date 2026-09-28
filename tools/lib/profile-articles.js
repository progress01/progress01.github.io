'use strict';

const { filterPostsBySurface } = require('./content-browser');

function sourceName(post) {
  const source = String(post?.source || '').replaceAll('\\', '/').replace(/^\/+/, '');
  return source.startsWith('source/') ? source : `source/${source || '<unknown post>'}`;
}

/** Return every currently published profile-qualified post in publication order. */
function getProfileArticles({ posts, legacyPostSources = new Set(), onWarning } = {}) {
  if (!Array.isArray(posts)) throw new TypeError('profile_articles_posts_invalid');
  const articles = filterPostsBySurface(posts, 'profile', { legacyPostSources, onWarning })
    .map(post => {
      const timestamp = new Date(post.date).getTime();
      if (!Number.isFinite(timestamp)) throw new Error(`${sourceName(post)} [profile_articles_date_invalid]`);
      const url = String(post.path || '');
      if (!url.startsWith('/') || !url.endsWith('/')) throw new Error(`${sourceName(post)} [profile_articles_url_invalid]`);
      return { post, timestamp, url };
    });

  articles.sort((left, right) => right.timestamp - left.timestamp || left.url.localeCompare(right.url));
  return articles.map(entry => entry.post);
}

function readTagNames(post) {
  const values = post?.tags && typeof post.tags.toArray === 'function'
    ? post.tags.toArray()
    : Array.isArray(post?.tags) ? post.tags : [];
  return [...new Set(values.map(tag => String(tag && typeof tag === 'object' ? tag.name ?? '' : tag ?? '').trim()).filter(Boolean))];
}

function summarizeTagCounts(articles) {
  const tagCounts = new Map();
  for (const article of articles) {
    const tags = Array.isArray(article?.tags) ? article.tags : readTagNames(article?.post || article);
    for (const tag of new Set(tags)) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const collator = new Intl.Collator('zh-Hant', { sensitivity: 'variant', numeric: false });
  return [...tagCounts].map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || collator.compare(left.name, right.name) || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

function getProfileArticleLibrary({ posts, legacyPostSources = new Set(), onWarning } = {}) {
  const articles = getProfileArticles({ posts, legacyPostSources, onWarning }).map(post => ({ post, tags: readTagNames(post) }));
  const tags = summarizeTagCounts(articles);
  return { articles: articles.map(item => item.post), tags, total: articles.length };
}

function getProfileArticleCalendar({ formatDate, ...options } = {}) {
  const articles = getProfileArticles(options);
  const postsByDate = {};
  let eventTotal = 0;
  const toCalendarDate = value => typeof formatDate === 'function'
    ? String(formatDate(value) || '')
    : value instanceof Date
      ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
      : String(value || '').slice(0, 10);
  const addEvent = (post, date, eventType) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new Error(`${sourceName(post)} [profile_articles_calendar_date_invalid]`);
    }
    const eventLabel = eventType === 'published' ? '發表' : '更新';
    const entries = postsByDate[date] ||= [];
    if (entries.some(entry => entry.url === String(post.path) && entry.eventType === eventType)) return;
    entries.push({ title: String(post.title || ''), url: String(post.path), eventType, eventLabel });
    eventTotal += 1;
  };
  for (const post of articles) {
    const publishedDate = toCalendarDate(post.date);
    addEvent(post, publishedDate, 'published');
    const updatedTime = post.updated == null || post.updated === '' ? NaN : new Date(post.updated).getTime();
    if (Number.isFinite(updatedTime)) {
      const updatedDate = toCalendarDate(post.updated);
      if (updatedDate !== publishedDate) addEvent(post, updatedDate, 'updated');
    }
  }
  const dates = Object.keys(postsByDate).sort();
  const eventOrder = { published: 0, updated: 1 };
  dates.forEach(date => postsByDate[date].sort((left, right) => eventOrder[left.eventType] - eventOrder[right.eventType]
    || left.url.localeCompare(right.url) || left.title.localeCompare(right.title)));
  const latestYear = dates.length ? dates[dates.length - 1].slice(0, 4) : null;
  const latestDate = dates.filter(date => date.startsWith(`${latestYear}-`)).at(-1) || null;
  const counts = {};
  for (const date of dates) if (date.startsWith(`${latestYear}-`)) counts[date] = postsByDate[date].length;
  const latestYearPostsByDate = Object.fromEntries(Object.entries(postsByDate).filter(([date]) => date.startsWith(`${latestYear}-`)));
  return {
    latestYear,
    latestDate,
    counts,
    postsByDate: latestYearPostsByDate,
    articleTotal: articles.length,
    eventTotal,
    activeDateCount: Object.keys(counts).length
  };
}

module.exports = Object.freeze({ getProfileArticles, getProfileArticleLibrary, getProfileArticleCalendar, readTagNames, summarizeTagCounts });
