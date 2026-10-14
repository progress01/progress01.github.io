'use strict';

const cheerio = require('cheerio');

function names(collection) {
  const values = typeof collection?.toArray === 'function' ? collection.toArray() : collection;
  return Array.isArray(values) ? values.map(value => typeof value === 'string' ? value : value.name) : [];
}

function archivePreview(post) {
  const excerpt = String(post.excerpt || '').trim();
  const song = String(post.source || '').replaceAll('\\', '/').includes('/歌曲推薦/') ||
    names(post.categories).includes('音樂') || names(post.tags).includes('歌曲推薦');

  // Song excerpts already contain the author's listening card. Preserve its links
  // and illustration instead of flattening it or asking for another summary.
  if (song && excerpt) {
    const $ = cheerio.load(excerpt, null, false);
    $('img').attr('loading', 'lazy').attr('decoding', 'async');
    return { kind: 'song', html: $.root().html() };
  }

  // Never fall back to the full article: an absent excerpt is a compact title row.
  for (const markup of [post.description, excerpt]) {
    const $ = cheerio.load(String(markup || ''), null, false);
    $('script, style, iframe, img, video, audio').remove();
    $('br').replaceWith(' ');
    $('p, div, li, blockquote, h1, h2, h3, h4, h5, h6, tr').append(' ');
    const text = $.root().text().replace(/\s+/gu, ' ').trim();
    if (text) return { kind: 'text', text };
  }
  return null;
}

module.exports = { archivePreview };
