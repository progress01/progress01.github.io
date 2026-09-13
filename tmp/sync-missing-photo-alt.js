const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');
const cheerio = require('cheerio');
const known = new Map();
function remember(src, alt) {
  if (!src || !alt) return;
  if (known.has(src) && known.get(src) !== alt) throw new Error('Ambiguous alt for ' + src);
  known.set(src, alt);
}
for (const file of fs.readdirSync('source/_posts', { recursive: true }).filter(x => x.endsWith('.md'))) {
  const raw = fs.readFileSync(path.join('source/_posts', file), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) continue;
  const data = yaml.load(match[1]);
  const $ = cheerio.load(marked.parse(raw.slice(match[0].length)));
  $('img[alt]').each((_, element) => {
    const alt = $(element).attr('alt').trim();
    if (!alt) return;
    remember($(element).attr('src'), alt);
    if ($('img').length === 1 && data.cover) remember(data.cover, alt);
  });
}
const file = 'source/photos/index.md';
const original = fs.readFileSync(file, 'utf8');
const changes = [];
const escape = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const updated = original.replace(/^[ \t]*<img\b[^\r\n>]*>/gmi, tag => {
  const $ = cheerio.load(tag);
  const image = $('img');
  if (image.attr('alt') !== undefined) return tag;
  const src = image.attr('src');
  const alt = known.get(src);
  if (!alt) throw new Error('No source article alt for ' + src);
  const replacement = tag.replace(/<img\b/i, head => head + ' alt="' + escape(alt) + '"');
  changes.push({ src, alt, original: tag, replacement });
  return replacement;
});
if (!changes.length) throw new Error('No missing photo-wall alt to repair');
fs.writeFileSync('tmp/image-alt-photos-before.json', JSON.stringify({ file, original, changes }, null, 2) + '\n');
fs.writeFileSync('tmp/image-alt-photos.patch', '*** Begin Patch\n*** Update File: ' + file + '\n' + changes.map(c => '@@\n-' + c.original + '\n+' + c.replacement + '\n').join('') + '*** End Patch\n');
console.log('Prepared ' + changes.length + ' photo-wall alt additions from matching article images.');
