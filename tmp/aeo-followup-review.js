const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const cheerio = require('cheerio');
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(x => x.isDirectory() ? walk(`${dir}/${x.name}`) : [`${dir}/${x.name}`]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const target = 'public/learning/agentic-transaction-acid-agent/index.html';
const targetSource = 'source/_posts/實驗室/Agentic-Transaction-ACID-Agent-學習筆記.md';
const endpoints = ['reading-desk.json','microblog.json','life-index.json'];
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
  const xml = cheerio.load(fs.readFileSync('public/sitemap.xml', 'utf8'), {xmlMode:true});
  return {
    pages,
    sources: Object.fromEntries(walk('source').map(file => [file, hash(fs.readFileSync(file))])),
    endpoints: Object.fromEntries(endpoints.map(file => [file, hash(fs.readFileSync(`public/${file}`))])),
    sitemap: xml('loc').map((_, x) => xml(x).text()).get().sort()
  };
}
if (process.argv.includes('--before')) {
  fs.writeFileSync('tmp/aeo-followup-before.json', JSON.stringify(snapshot()));
  console.log('Saved source, article body, data endpoint and sitemap baseline.');
} else {
  const before = JSON.parse(fs.readFileSync('tmp/aeo-followup-before.json'));
  const after = snapshot();
  assert.deepEqual(Object.keys(after.pages), Object.keys(before.pages));
  for (const file of Object.keys(before.pages)) {
    assert.equal(after.pages[file].canonical, before.pages[file].canonical, file);
    assert.equal(after.pages[file].schema.datePublished, before.pages[file].schema.datePublished, file);
    if (file !== target) for (const key of ['body','links','images']) assert.deepEqual(after.pages[file][key], before.pages[file][key], `${file}: ${key}`);
  }
  assert.notEqual(after.pages[target].body, before.pages[target].body);
  assert.ok(Date.parse(after.pages[target].schema.dateModified) > Date.parse(before.pages[target].schema.dateModified));
  const targetMetadata = require('js-yaml').load(fs.readFileSync(targetSource, 'utf8').split(/^---\s*$/m)[1]);
  assert.equal(Date.parse(after.pages[target].schema.dateModified), new Date(targetMetadata.updated).getTime(), 'generated updated must preserve the exact source instant');
  assert.deepEqual(Object.keys(after.sources), Object.keys(before.sources));
  for (const file of Object.keys(before.sources)) if (file !== targetSource) assert.equal(after.sources[file], before.sources[file], file);
  assert.deepEqual(after.endpoints, before.endpoints);
  const excluded = new Set(endpoints.map(file => `https://progress01.github.io/${file}`));
  const expectedSitemap = before.sitemap.filter(url => !excluded.has(url));
  assert.equal(JSON.stringify(after.sitemap) === JSON.stringify(expectedSitemap), true,
    JSON.stringify({unexpected: after.sitemap.filter(url => !expectedSitemap.includes(url)), missing: expectedSitemap.filter(url => !after.sitemap.includes(url))}));
  const urls = new Set(after.sitemap.map(url => decodeURI(url)));
  for (const page of Object.values(after.pages)) assert.ok(urls.has(decodeURI(page.canonical)), page.canonical);
  console.log(JSON.stringify({articles: Object.keys(after.pages).length, unchangedArticleBodies: Object.keys(after.pages).length-1, protectedSourceFiles: Object.keys(after.sources).length-1, unchangedDataEndpoints: endpoints.length, sitemapBefore: before.sitemap.length, sitemapAfter: after.sitemap.length, modified: after.pages[target].schema.dateModified}));
}
