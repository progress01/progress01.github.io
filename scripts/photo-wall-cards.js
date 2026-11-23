'use strict';

const cheerio = require('cheerio');
const { normalizedPath, sortPhotoWall } = require('./photo-wall-order');

function postIndex(posts) {
  const links = new Map();
  const covers = new Map();
  function add(index, key, post) {
    if (!key) return;
    if (!index.has(key)) index.set(key, post);
    else if (index.get(key) !== post) index.set(key, null);
  }
  for (const post of posts) {
    add(links, normalizedPath(post.path), post);
    add(links, normalizedPath(post.permalink), post);
    add(covers, normalizedPath(post.cover), post);
  }
  return { links, covers };
}

function buildPhotoWall(content, posts) {
  const sorted = sortPhotoWall(content, posts);
  const $ = cheerio.load(sorted.content, null, false);
  const index = postIndex(posts);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const monthsByCategory = new Map();
  $('[data-photo-wall-section]').each((_, section) => {
    const category = $(section).attr('data-photo-wall-section');
    const container = $(section).find('[data-photo-wall-grid]').first();
    if (!container.length) return;
    const cards = [];
    const anchors = new Map();
    $(section).children('[data-photo-wall-jump]').remove();
    container.find('.ig-card').each((_, element) => {
      const card = $(element);
      card.find('[data-photo-wall-caption]').remove();
      const image = card.find('img').first();
      const originalLink = card.find('a').first();
      const post = index.links.get(normalizedPath(originalLink.attr('href')))
        || index.covers.get(normalizedPath(image.attr('src')));
      const value = post?.date;
      const timestamp = typeof value?.valueOf() === 'number' ? value.valueOf() : Date.parse(value);
      const date = Number.isFinite(timestamp) ? formatter.format(timestamp) : '';
      const month = date ? date.slice(0, 7) : 'undated';
      const alt = image.attr('alt') || '';
      const title = card.attr('data-title') || String(post?.title || alt).replace(/^歌曲推薦[-－]\s*/, '');
      const artist = card.attr('data-artist') || (category === 'music' && alt.includes(' - ') ? alt.split(' - ')[0] : '');
      const caption = $('<footer class="photo-wall-card__caption" data-photo-wall-caption></footer>');
      const heading = $('<p class="photo-wall-card__title"></p>');
      const articlePath = post?.path || (post?.permalink ? normalizedPath(post.permalink) : '');
      if (articlePath) heading.append($('<a></a>').attr('href', '/' + String(articlePath).replace(/^\/+/, '')).text(title));
      else heading.text(title);
      caption.append(heading);
      if (artist) caption.append($('<p class="photo-wall-card__artist"></p>').text(artist));
      if (date) caption.append($('<time class="photo-wall-card__date"></time>').attr('datetime', date).text(date.replaceAll('-', '/')));
      card.append(caption);
      if (/^photo-wall-(music|books|films)-(\d{4}-\d{2}|undated)$/.test(card.attr('id') || '')) card.removeAttr('id');
      if (date && !anchors.has(month)) {
        if (!card.attr('id')) card.attr('id', `photo-wall-${category}-${month}`);
        anchors.set(month, card.attr('id'));
      }
      cards.push(card);
    });
    container.removeClass('photo-wall-months').addClass('ig-grid').empty();
    cards.forEach(card => container.append(card));
    const months = [...anchors.keys()].sort().reverse();
    monthsByCategory.set(category, months);
    if (months.length) {
      const jump = $('<details class="photo-wall-jump" data-photo-wall-jump><summary>跳到月份</summary></details>');
      const links = $('<nav class="photo-wall-jump__links" aria-label="月份定位"></nav>');
      months.forEach(month => links.append($('<a></a>').attr('href', '#' + anchors.get(month)).text(month.replace('-', '/'))));
      jump.append(links).insertBefore(container);
    }
    $(section).attr('hidden', '');
  });
  $('[data-photo-wall-section="music"]').removeAttr('hidden');
  return { ...sorted, content: $.html(), monthsByCategory };
}

module.exports = { buildPhotoWall };
