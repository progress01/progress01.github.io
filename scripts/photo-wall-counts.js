// Keep the photo-wall counters derived from the cards in the rendered page.
// This prevents the visible totals from going stale when a card is added by
// hand or restored from an imported Blogger post.

const SECTION_KEYS = ['all', 'music', 'books', 'films'];

function countCards(markup) {
  return (String(markup || '').match(/<div\s+class=["']ig-card["']/g) || []).length;
}

function updatePhotoWallCounts(content) {
  let output = String(content || '');

  SECTION_KEYS.forEach(key => {
    let count = 0;
    if (key === 'all') {
      count = countCards(output);
    } else {
      const sectionPattern = new RegExp(
        `<section\\b[^>]*\\bdata-photo-wall-section=["']${key}["'][^>]*>[\\s\\S]*?<\\/section>`,
        'i'
      );
      const section = output.match(sectionPattern);
      count = countCards(section ? section[0] : '');
    }

    const buttonPattern = new RegExp(
      `(<button\\b[^>]*\\bdata-photo-wall-filter=["']${key}["'][^>]*>[\\s\\S]*?<span>)[^<]*(<\\/span>)`,
      'i'
    );
    output = output.replace(buttonPattern, `$1${count}$2`);
  });

  return output;
}

if (typeof module !== 'undefined') {
  module.exports = { countCards, updatePhotoWallCounts };
}

if (typeof hexo !== 'undefined' && hexo.extend && hexo.extend.filter) {
  hexo.extend.filter.register('after_post_render', function(data) {
    const source = String(data.source || data.path || '');
    if (!/(^|[\\/])photos[\\/]index\.(?:md|html)$/i.test(source)) {
      return data;
    }

    data.content = updatePhotoWallCounts(data.content);
    return data;
  });
}
