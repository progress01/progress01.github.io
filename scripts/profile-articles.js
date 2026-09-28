'use strict';

const { getProfileArticleLibrary, getProfileArticleCalendar, readTagNames } = require('../tools/lib/profile-articles');
const { resolveThinkingStatus } = require('../tools/lib/thinking-status');
const legacySurfaces = require('../tools/data/legacy-surfaces.v1.json');

if (!legacySurfaces || legacySurfaces.schemaVersion !== 1 || !Array.isArray(legacySurfaces.posts)) {
  throw new Error('legacy_surface_manifest_invalid [tools/data/legacy-surfaces.v1.json]');
}
const legacyPostSources = new Set(legacySurfaces.posts);

function getLibrary(context) {
  const library = getProfileArticleLibrary({
    posts: this.site.posts.toArray(),
    legacyPostSources,
    onWarning: warning => hexo.log.warn(`${warning.source} [${warning.code}]`)
  });
  library.articles = library.articles.map(post => {
    const thinking = resolveThinkingStatus(post, { source: String(post.source || '<unknown post>') });
    return {
      title: post.title,
      url: this.url_for(post.path),
      date: this.date(post.date, 'YYYY-MM'),
      datetime: this.date(post.date, 'YYYY-MM-DD'),
      tags: readTagNames(post),
      thinking: thinking.visible ? thinking : null
    };
  });
  return library;
}

function getCalendar() {
  const calendar = getProfileArticleCalendar({
    posts: this.site.posts.toArray(),
    formatDate: date => this.date(date, 'YYYY-MM-DD'),
    legacyPostSources,
    onWarning: warning => hexo.log.warn(`${warning.source} [${warning.code}]`)
  });
  const payload = {
    latestYear: calendar.latestYear,
    latestDate: calendar.latestDate,
    counts: calendar.counts,
    postsByDate: calendar.postsByDate,
    articleTotal: calendar.articleTotal,
    eventTotal: calendar.eventTotal,
    activeDateCount: calendar.activeDateCount
  };
  return {
    ...payload,
    json: JSON.stringify(payload).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
  };
}

hexo.extend.helper.register('profile_articles', function() { return getLibrary.call(this).articles; });
hexo.extend.helper.register('profile_article_library', function() { return getLibrary.call(this); });
hexo.extend.helper.register('profile_article_calendar', function() { return getCalendar.call(this); });
