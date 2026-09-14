'use strict';
const crypto = require('crypto');
const cheerio = require('cheerio');

// Content-derived IDs survive inserting/reordering unrelated paragraphs. Authored IDs win.
function anchorContent(html, namespace = '') {
  const $ = cheerio.load(String(html || ''), null, false);
  const used = new Set($('[id]').map((_, node) => $(node).attr('id')).get());
  const blocks = 'p,li,blockquote,pre,h2,h3,h4,h5,h6';
  $(blocks).each((_, node) => {
    const block = $(node);
    if (block.find(blocks).length || block.closest('script,style,template,.gutter').length) return;
    const text = block.text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (!block.attr('id')) {
      const base = 'nav-' + crypto.createHash('sha256').update(namespace + '\n' + text).digest('hex').slice(0, 16);
      let id = base, suffix = 2;
      while (used.has(id)) id = base + '-' + suffix++;
      used.add(id);
      block.attr('id', id);
    }
    block.attr('data-navigation-anchor', '');
  });
  return $.html();
}

function passagesOf(html) {
  const $ = cheerio.load(String(html || ''));
  return $('[data-navigation-anchor][id]').map((_, node) => ({
    id: $(node).attr('id'), text: $(node).text().replace(/\s+/g, ' ').trim()
  })).get();
}
module.exports = { anchorContent, passagesOf };
