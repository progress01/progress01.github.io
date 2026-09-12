const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const cheerio = require('cheerio');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => item.isDirectory() ? walk(dir + '/' + item.name) : [dir + '/' + item.name]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceBefore = JSON.parse(fs.readFileSync('tmp/round5-source-baseline.json'));
assert.deepEqual(walk('source').sort(), Object.keys(sourceBefore).sort());
for (const [file, before] of Object.entries(sourceBefore)) assert.equal(hash(fs.readFileSync(file)), before, file);
const visibleBefore = JSON.parse(fs.readFileSync('tmp/round5-visible-text-baseline.json'));
let articles = 0, sharedCards = 0, wholeBodyTextDifferences = 0;
const types = {};
for (const [file, before] of Object.entries(visibleBefore)) {
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
  const data = JSON.parse($('script[type="application/ld+json"]').text());
  types[data['@type']] = (types[data['@type']] || 0) + 1;
  if (data['@type'] === 'BlogPosting') {
    articles++;
    const article = $('article.post-content-single');
    assert.equal(article.length, 1, file);
    assert.equal(article.attr('itemtype'), 'https://schema.org/BlogPosting', file);
    assert.equal(new URL(article.attr('itemid')).href, new URL(data['@id']).href, file);
    assert.equal(data.publisher['@type'], 'Person', file);
    assert.equal(data.publisher.name, 'Ch-Ju', file);
    const publisher = article.find('[itemprop="publisher"]');
    assert.equal(publisher.attr('itemtype'), 'https://schema.org/Person', file);
    assert.equal(publisher.find('[itemprop="name"]').attr('content'), data.publisher.name, file);
    assert.equal(article.find('[itemprop="post"]').length, 0, file);
    if (file.startsWith('public/work/')) {
      sharedCards++;
      assert.equal(data.image, undefined, file);
    }
  }
  $('script,style,noscript').remove();
  if (hash($('body').text().replace(/\s+/g, ' ').trim()) !== before) wholeBodyTextDifferences++;
}
assert.equal(articles, 243);
assert.equal(sharedCards, 4);
console.log(JSON.stringify({sourceFilesUnchanged: Object.keys(sourceBefore).length, pagesChecked: Object.keys(visibleBefore).length, articlesAligned: articles, genericCardsOmitted: sharedCards, types, wholeBodyTextDifferences}));
