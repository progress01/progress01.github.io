const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const cheerio = require('cheerio');
const yaml = require('js-yaml');
const baseline = JSON.parse(fs.readFileSync('tmp/round4-supervisor-baseline.json'));
function filesUnder(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => {
    const file = `${dir}/${item.name}`;
    return item.isDirectory() ? filesUnder(file) : [file];
  });
}
assert.deepEqual(filesUnder('source').filter(f => !f.startsWith('source/_posts/歌曲推薦/')).sort(), Object.keys(baseline).sort(), 'no extra or missing source files');
for (const [file, hash] of Object.entries(baseline)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash, file);
}
const manifest = JSON.parse(fs.readFileSync('tmp/round4-covers-before/manifest.json'));
for (const entry of manifest.articles) {
  const before = fs.readFileSync(entry.baselinePath, 'utf8');
  const after = fs.readFileSync(entry.path, 'utf8');
  assert.equal(after.replace(/^cover:.*\r?\n/m, ''), before, `${entry.path}: only cover line may differ`);
  const meta = yaml.load(after.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  assert.ok(entry.localWebpPaths.includes(meta.cover), `${entry.path}: cover agrees with body`);
  assert.ok(fs.existsSync(path.join('source', meta.cover)), `${entry.path}: cover exists`);
}
console.log(`PASS ${Object.keys(baseline).length} protected source files unchanged; ${manifest.articles.length} songs changed only by cover metadata`);
if (process.argv.includes('--render')) {
  const rendered = JSON.parse(fs.readFileSync('tmp/round4-song-render-before.json'));
  const cache = new Map();
  for (const row of rendered) {
    if (!cache.has(row.file)) cache.set(row.file, cheerio.load(fs.readFileSync(row.file, 'utf8')));
    const $ = cache.get(row.file);
    const article = $('article').filter((i, el) => $(el).find('.post-title').text().trim() === row.title);
    assert.equal(article.length, 1, `${row.file}: ${row.title}`);
    const body = article.find('.post-body');
    const actual = {
      text: body.text().replace(/\s+/g, ' ').trim(),
      images: body.find('img').map((i, el) => $(el).attr('src')).get(),
      links: body.find('a').map((i, el) => $(el).attr('href')).get()
    };
    for (const key of ['text', 'images', 'links']) assert.deepEqual(actual[key], row[key], `${row.file}: ${key}`);
    if (row.single) {
      const schemas = $('script[type="application/ld+json"]').map((i, el) => JSON.parse($(el).text())).get();
      const nodes = schemas.flatMap(s => s['@graph'] || s);
      const blog = nodes.find(s => s['@type'] === 'BlogPosting');
      assert.ok(blog, `${row.file}: BlogPosting`);
      const schemaImage = typeof blog.image === 'string' ? blog.image : Array.isArray(blog.image) ? blog.image[0] : blog.image?.url;
      assert.ok(actual.images.some(src => decodeURI(new URL(schemaImage).pathname) === decodeURI(src)), `${row.file}: schema image agrees with body`);
    }
  }
  console.log(`PASS ${rendered.length} rendered song pages/list entries retain text/images/links; ${rendered.filter(r => r.single).length} schema images agree with body`);
}
