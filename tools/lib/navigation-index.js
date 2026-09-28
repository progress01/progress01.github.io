'use strict';
const crypto = require('crypto');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const { passagesOf } = require('./navigation-anchors');
const { normalizeSurfaces, isSurfaceSubset } = require('./content-surfaces');
const DEFAULT_LEGACY_SURFACES = require('../data/legacy-surfaces.v1.json');
const TZ = 'Asia/Taipei';
const list = value => value?.toArray ? value.toArray() : (Array.isArray(value) ? value : []);
const names = value => list(value).map(item => String(item?.name || item));
const plain = value => {
  const $ = cheerio.load(String(value || ''));
  $('script,style,template,noscript,.gutter').remove();
  $('p,div,li,br,h1,h2,h3,h4,h5,h6,pre,tr,td').append(' ');
  return $.text().replace(/\s+/g, ' ').trim();
};
function dateOf(value, label) {
  if (value == null || value === '') return null;
  const parsed = moment.isMoment(value) ? value.clone().tz(TZ) : moment.tz(String(value), moment.ISO_8601, true, TZ);
  if (!parsed.isValid()) throw new Error('Invalid date: ' + label);
  return parsed.format('YYYY-MM-DD');
}
function target(value, origin) {
  if (!value) return { local: null, external: null };
  const url = new URL(String(value), origin);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('Unsafe navigation URL');
  if (url.origin !== new URL(origin).origin) return { local: null, external: url.href };
  return { local: decodeURIComponent(url.pathname).replace(/\/index\.html$/, '/').replace(/\/$/, '') + '/', external: null };
}
function assignMicroblogIds(items) {
  if (!Array.isArray(items)) throw new Error('microblog must be an array');
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid microblog entry');
    const id = item.id ?? ('micro-' + crypto.createHash('sha256').update(JSON.stringify([item.date, item.tag, item.content])).digest('hex').slice(0, 16));
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) throw new Error('Invalid or duplicate microblog ID: ' + id);
    ids.add(id);
    return { ...item, id };
  });
}

function stablePostSource(post) {
  const source = String(post?.source || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!source) return '<unknown post source>';
  return source.startsWith('source/') ? source : `source/${source}`;
}

function legacySets(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.posts)
      || !Array.isArray(manifest.microblogIds) || !Array.isArray(manifest.readingDeskItemIds)) {
    throw new Error('legacy_surface_manifest_invalid [tools/data/legacy-surfaces.v1.json]');
  }
  return {
    posts: new Set(manifest.posts),
    microblogIds: new Set(manifest.microblogIds),
    readingDeskItemIds: new Set(manifest.readingDeskItemIds)
  };
}

function resolveSurfaces(record, source, missingPolicy, warnings, extra = {}) {
  try {
    const result = normalizeSurfaces(record, { source, missingPolicy, ...extra });
    result.warnings.forEach(warning => warnings.push(`${warning.source} [${warning.code}]`));
    return result.surfaces;
  } catch (error) {
    throw new Error(`${source} [${error.code || error.name}]: surface contract violation`);
  }
}

function buildIndex({ posts, microblog, desk, origin, legacySurfaceManifest = DEFAULT_LEGACY_SURFACES }) {
  if (!Array.isArray(microblog) || !desk || !Array.isArray(desk.topics)) throw new Error('Invalid navigation source structure');
  const legacy = legacySets(legacySurfaceManifest);
  const records = [], byUrl = new Map(), warnings = [];
  for (const post of list(posts)) {
    if (post.published === false || post.draft === true) continue;
    const url = target('/' + String(post.path || '').replace(/^\/+/, ''), origin).local;
    const source = stablePostSource(post);
    if (!post.path || !post.title || !url || byUrl.has(url)) throw new Error(`${source} [missing_or_duplicate_article_target]`);
    const surfaces = resolveSurfaces(post, source, legacy.posts.has(source) ? 'legacy' : 'error', warnings);
    const date = dateOf(post.date, post.title);
    const record = { id: 'article:' + url, kind: 'article', sources: ['article'], title: plain(post.title), text: plain(post.content), url,
      passages: passagesOf(post.content), categories: names(post.categories), tags: names(post.tags), date, dateKind: 'published',
      events: date ? [{ kind: 'published', date }] : [], learningItems: [], surfaces };
    records.push(record); byUrl.set(url, record);
  }
  const assigned = assignMicroblogIds(microblog);
  assigned.forEach((item, index) => {
    if (!microblog[index].id) throw new Error('Missing persisted microblog ID; run node tools/assign-microblog-ids.js --write');
    if (item.published === false || item.draft === true) return;
    const text = plain(item.content), date = dateOf(item.date, item.id);
    if (!text) throw new Error('Empty microblog: ' + item.id);
    const source = `source/microblog.json#${item.id}`;
    const surfaces = resolveSurfaces(item, source, legacy.microblogIds.has(item.id) ? 'legacy' : 'error', warnings);
    records.push({ id: item.id, kind: 'microblog', sources: ['microblog'], title: Array.from(text).slice(0, 48).join(''), text,
      url: '/status/', categories: [], tags: item.tag ? [plain(item.tag)] : [], date, dateKind: 'recorded',
      events: date ? [{ kind: 'recorded', date }] : [], learningItems: [], surfaces });
  });
  const learningIds = new Set();
  for (const group of desk.topics) {
    if (!Array.isArray(group.items)) throw new Error('Learning group items must be an array');
    for (const item of group.items) {
      if (!item.id || !/^[a-z][a-z0-9-]*$/.test(item.id) || learningIds.has(item.id)) throw new Error('Missing/duplicate learning ID');
      learningIds.add(item.id);
      if (group.published === false || item.published === false || item.draft === true) continue;
      const addedDate = dateOf(item.date, item.id);
      let link;
      try { link = target(item.url, origin); } catch { warnings.push('Excluded unsafe learning URL: ' + item.id); continue; }
      const linked = link.local && byUrl.get(link.local);
      if (link.local && !linked) { warnings.push('Excluded unpublished/unresolved learning target: ' + item.id); continue; }
      const source = `source/reading-desk.yml#${item.id}`;
      const isLegacy = legacy.readingDeskItemIds.has(item.id);
      const surfaces = linked
        ? resolveSurfaces(item, source, isLegacy ? 'inherit' : 'error', warnings, isLegacy ? { inheritedSurfaces: linked.surfaces } : {})
        : resolveSurfaces(item, source, isLegacy ? 'legacy' : 'error', warnings);
      if (linked && !isSurfaceSubset(surfaces, linked.surfaces, { source })) {
        throw new Error(`${source} [surface_not_subset]: linked learning surfaces exceed target article`);
      }
      const learning = { id: item.id, title: plain(item.title), topic: plain(group.name), note: plain(item.note), source: plain(item.source), state: String(item.state || ''), addedDate, surfaces };
      const text = [learning.title, learning.topic, learning.note, learning.source].filter(Boolean).join(' ');
      const event = addedDate ? [{ kind: 'learning-added', date: addedDate, sourceId: item.id }] : [];
      if (linked) {
        if (!linked.sources.includes('learning')) linked.sources.push('learning');
        linked.text += '\n' + text;
        linked.learningItems.push(learning); linked.events.push(...event);
      } else {
        records.push({ id: 'learning:' + item.id, kind: 'learning', sources: ['learning'], title: learning.title || learning.topic,
          text, url: '/reading/', externalUrl: link.external, categories: [], tags: [], date: addedDate, dateKind: 'learning-added', events: event, learningItems: [learning], surfaces });
      }
    }
  }
  const ids = records.map(record => record.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate navigation record ID');
  return { schemaVersion: 1, timezone: TZ, records, warnings };
}
module.exports = { assignMicroblogIds, buildIndex, plain, dateOf, target };
