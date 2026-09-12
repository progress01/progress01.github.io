const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const cheerio = require('cheerio');
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(x => x.isDirectory() ? walk(`${dir}/${x.name}`) : [`${dir}/${x.name}`]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const target = 'public/2026/04/06/實驗室/討論GEO篇一/index.html';
function snapshot() {
  const pages = {};
  for (const file of walk('public').filter(x => x.endsWith('.html'))) {
    const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
    if (!$('article.post-content-single').length) continue;
    const body = $('article.post-content-single .post-body');
    assert.equal(body.length, 1, file);
    pages[file] = {
      body: body.text().replace(/\s+/g, ' ').trim(),
      links: body.find('a[href]').map((_, x) => $(x).attr('href')).get(),
      images: body.find('img').map((_, x) => $(x).attr('src')).get(),
      schema: JSON.parse($('script[type="application/ld+json"]').text()),
      canonical: $('link[rel="canonical"]').attr('href')
    };
  }
  return pages;
}
if (process.argv.includes('--before')) {
  fs.writeFileSync('tmp/aeo-render-before.json', JSON.stringify(snapshot()));
  console.log('Saved article-only render baseline.');
} else {
  const before = JSON.parse(fs.readFileSync('tmp/aeo-render-before.json'));
  const after = snapshot();
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const file of Object.keys(before)) {
    assert.equal(after[file].canonical, before[file].canonical, file);
    assert.equal(after[file].schema.datePublished, before[file].schema.datePublished, file);
    if (file === target) continue;
    for (const key of ['body','links','images']) assert.deepEqual(after[file][key], before[file][key], `${file}: ${key}`);
  }
  assert.notEqual(after[target].body, before[target].body);
  assert.ok(Date.parse(after[target].schema.dateModified) > Date.parse(before[target].schema.dateModified));
  assert.ok(after[target].links.includes('https://developers.google.com/search/docs/appearance/ai-features'));
  const sourceBefore = JSON.parse(fs.readFileSync('tmp/round5-source-baseline.json'));
  assert.deepEqual(walk('source').sort(), Object.keys(sourceBefore).sort());
  let protectedFiles = 0;
  for (const [file, oldHash] of Object.entries(sourceBefore)) {
    if (file === 'source/_posts/實驗室/討論GEO篇一.md') continue;
    assert.equal(hash(fs.readFileSync(file)), oldHash, file);
    protectedFiles++;
  }
  console.log(JSON.stringify({articles: Object.keys(after).length, unchangedArticleBodies: Object.keys(after).length-1, protectedSourceFiles: protectedFiles, target: after[target].canonical, published: after[target].schema.datePublished, modified: after[target].schema.dateModified}));
}
