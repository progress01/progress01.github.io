'use strict';

const cheerio = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');

const imageDimensionCache = new Map();

function parseWebpDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 ||
      buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) return null;

    let width;
    let height;
    if (type === 'VP8X' && length >= 10) {
      width = 1 + buffer.readUIntLE(start + 4, 3);
      height = 1 + buffer.readUIntLE(start + 7, 3);
    } else if (type === 'VP8 ' && length >= 10 && buffer[start + 3] === 0x9d &&
               buffer[start + 4] === 0x01 && buffer[start + 5] === 0x2a) {
      width = buffer.readUInt16LE(start + 6) & 0x3fff;
      height = buffer.readUInt16LE(start + 8) & 0x3fff;
    } else if (type === 'VP8L' && length >= 5 && buffer[start] === 0x2f) {
      const bits = buffer.readUInt32LE(start + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }

    if (width > 0 && height > 0) return { width, height };
    offset = end + (length & 1);
  }
  return null;
}

function localImageFile(src, sourceDir) {
  if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//') || src.includes('\\')) return null;
  let pathname;
  try {
    const url = new URL(src, 'https://archive-preview.invalid');
    if (url.origin !== 'https://archive-preview.invalid' || !url.pathname.startsWith('/images/')) return null;
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const sourceRoot = path.resolve(sourceDir || path.resolve(__dirname, '../../source'));
  const filePath = path.resolve(sourceRoot, `.${pathname}`);
  const relative = path.relative(sourceRoot, filePath);
  if (!relative.startsWith(`images${path.sep}`) || path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`)) return null;
  return filePath;
}

function imageDimensions(src, sourceDir) {
  const filePath = localImageFile(src, sourceDir);
  if (!filePath || path.extname(filePath).toLowerCase() !== '.webp') return null;
  if (imageDimensionCache.has(filePath)) return imageDimensionCache.get(filePath);

  let dimensions = null;
  try {
    dimensions = parseWebpDimensions(fs.readFileSync(filePath));
  } catch {
    // Missing or unreadable local images should not make archive generation fail.
  }
  imageDimensionCache.set(filePath, dimensions);
  return dimensions;
}

function clearImageDimensionCache() {
  imageDimensionCache.clear();
}

function names(collection) {
  const values = typeof collection?.toArray === 'function' ? collection.toArray() : collection;
  return Array.isArray(values) ? values.map(value => typeof value === 'string' ? value : value.name) : [];
}

function archivePreview(post, sourceDir) {
  const excerpt = String(post.excerpt || '').trim();
  const song = String(post.source || '').replaceAll('\\', '/').includes('/歌曲推薦/') ||
    names(post.categories).includes('音樂') || names(post.tags).includes('歌曲推薦');

  // Song excerpts already contain the author's listening card. Preserve its links
  // and illustration instead of flattening it or asking for another summary.
  if (song && excerpt) {
    const $ = cheerio.load(excerpt, null, false);
    $('img').each((_, image) => {
      const dimensions = imageDimensions($(image).attr('src'), sourceDir);
      if (dimensions) $(image).attr('width', String(dimensions.width)).attr('height', String(dimensions.height));
      $(image).attr('loading', 'lazy').attr('decoding', 'async');
    });
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

module.exports = { archivePreview, clearImageDimensionCache, imageDimensions, parseWebpDimensions };
