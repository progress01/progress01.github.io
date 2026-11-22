'use strict';

function normalizedPath(value) {
  if (!value) return '';
  let result = String(value);
  if (/^https?:\/\//i.test(result)) {
    try { result = new URL(result).pathname; } catch { return ''; }
  }
  result = result.split(/[?#]/, 1)[0];
  try { result = decodeURIComponent(result); } catch { return ''; }
  return result.replace(/^\/+|\/+$/g, '');
}

function addDate(index, key, date) {
  if (!key) return;
  if (!index.has(key)) index.set(key, date);
  else if (index.get(key) !== date) index.set(key, null);
}

function publicationDates(posts) {
  const links = new Map();
  const covers = new Map();
  for (const post of posts) {
    const date = typeof post.date?.valueOf() === 'number'
      ? post.date.valueOf() : Date.parse(post.date);
    if (!Number.isFinite(date)) continue;
    addDate(links, normalizedPath(post.path), date);
    addDate(links, normalizedPath(post.permalink), date);
    addDate(covers, normalizedPath(post.cover), date);
  }
  return { links, covers };
}

function attribute(markup, name) {
  return markup.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] || '';
}

function sortPhotoWall(content, posts) {
  const dates = publicationDates(posts);
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const unmatched = [];
  const sections = [];
  const output = String(content).replace(
    /<section\b[^>]*\bdata-photo-wall-section=["']([^"']+)["'][^>]*>[\s\S]*?<\/section>/gi,
    (section, key) => {
      const cardPattern = /<div\b[^>]*\bclass=["']ig-card["'][^>]*>[\s\S]*?<\/div>/gi;
      const cards = [...section.matchAll(cardPattern)].map((match, index) => {
        const markup = match[0];
        const link = markup.match(/<a\b[^>]*>/i)?.[0] || '';
        const image = markup.match(/<img\b[^>]*>/i)?.[0] || '';
        const href = attribute(link, 'href');
        const src = attribute(image, 'src');
        const date = dates.links.get(normalizedPath(href)) ?? dates.covers.get(normalizedPath(src));
        if (!Number.isFinite(date)) unmatched.push({ section: key, href, src });
        return { markup, date, day: Number.isFinite(date) ? dayFormatter.format(date) : '', index };
      });
      // Keep undated cards in their original slots and ties in their original order.
      const sorted = cards.filter(card => Number.isFinite(card.date))
        .sort((left, right) => right.day.localeCompare(left.day) || left.index - right.index);
      let knownIndex = 0;
      let cardIndex = 0;
      sections.push({ key, count: cards.length, dated: sorted.length });
      return section.replace(cardPattern, () => {
        const card = cards[cardIndex++];
        return Number.isFinite(card.date) ? sorted[knownIndex++].markup : card.markup;
      });
    }
  );
  return { content: output, unmatched, sections };
}

if (typeof hexo !== 'undefined' && hexo.extend?.filter) {
  // Run after all posts have been processed, including cached pages in hexo server.
  // Source import markers and hand-written card markup remain untouched.
  hexo.extend.filter.register('before_generate', function() {
    const page = this.model('Page').findOne({ source: 'photos/index.md' });
    if (!page) return;
    const result = sortPhotoWall(page.content, this.locals.get('posts').toArray());
    for (const card of result.unmatched) {
      this.log.warn(`記憶圖牆找不到文章發布日期，保留原位置：${card.src || card.href}`);
    }
    if (page.content === result.content) return;
    page.content = result.content;
    return page.save();
  }, 20);
}

module.exports = { normalizedPath, publicationDates, sortPhotoWall };
