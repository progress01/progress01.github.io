const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const cheerio = require('cheerio');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(`${dir}/${x.name}`):[`${dir}/${x.name}`]);
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
function snapshot() {
  const pages = {};
  for (const file of walk('public').filter(f=>f.endsWith('.html'))) {
    const $=cheerio.load(fs.readFileSync(file,'utf8'));
    if (!$('article.post-content-single').length) continue;
    const body=$('article.post-content-single .post-body');
    pages[file]={body:body.text().replace(/\s+/g,' ').trim(),links:body.find('a[href]').map((_,e)=>$(e).attr('href')).get(),images:body.find('img').map((_,e)=>$(e).attr('src')).get(),schema:JSON.parse($('script[type="application/ld+json"]').text())};
  }
  return {pages,source:Object.fromEntries(walk('source/_posts').map(f=>[f,hash(fs.readFileSync(f))])),data:Object.fromEntries(['calendar.json','calendar-posts.json','random.json','reading-desk.json'].map(f=>[f,hash(fs.readFileSync('public/'+f))]))};
}
if(process.argv.includes('--before')) {
  fs.writeFileSync('tmp/recommendations-round-before.json',JSON.stringify(snapshot()));
  console.log('Saved article source/body/schema and generated data baseline.');
} else {
  const before=JSON.parse(fs.readFileSync('tmp/recommendations-round-before.json'));
  const after=snapshot();
  const changedPages = [...new Set([...Object.keys(before.pages),...Object.keys(after.pages)])].filter(f=>JSON.stringify(before.pages[f])!==JSON.stringify(after.pages[f]));
  const changedSources = [...new Set([...Object.keys(before.source),...Object.keys(after.source)])].filter(f=>before.source[f]!==after.source[f]);
  assert.equal(changedPages.length,0,`Changed article pages: ${changedPages.join(', ')}`);
  assert.equal(changedSources.length,0,`Changed article sources: ${changedSources.join(', ')}`);
  const baselinePosts = Object.values(before.pages).map(p=>p.schema);
  const identity = r=>JSON.stringify({title:r.title,url:decodeURI(r.url),date:r.date,categories:[...r.categories].sort()});
  const expectedPosts = baselinePosts.map(p=>({title:p.headline,url:new URL(p.url).pathname,date:p.datePublished.slice(0,10),categories:p.articleSection}));
  const calendarDetails=JSON.parse(fs.readFileSync('public/calendar-posts.json'));
  const calendarCounts=JSON.parse(fs.readFileSync('public/calendar.json'));
  const mismatchedDays=Object.keys(calendarDetails).filter(d=>calendarDetails[d].length!==calendarCounts[d] || calendarDetails[d].some(p=>p.date!==d));
  assert.equal(mismatchedDays.length,0,`Calendar dates/count mismatch: ${mismatchedDays.join(', ')}`);
  assert.equal(JSON.stringify(Object.values(calendarDetails).flat().map(identity).sort())===JSON.stringify(expectedPosts.map(identity).sort()),true,'Calendar records must preserve article identity/date/category');
  const random=JSON.parse(fs.readFileSync('public/random.json'));
  assert.equal(JSON.stringify(random.map(identity).sort())===JSON.stringify(expectedPosts.filter(p=>!p.categories.includes('站務')).map(identity).sort()),true,'Random pool must preserve article identity/date/category');
  console.log(JSON.stringify({unchangedArticlePages:Object.keys(after.pages).length,unchangedArticleSources:Object.keys(after.source).length,byteIdenticalDataEndpoints:Object.keys(after.data).filter(f=>after.data[f]===before.data[f]),changedDataHashes:Object.keys(after.data).filter(f=>after.data[f]!==before.data[f])}));
}
