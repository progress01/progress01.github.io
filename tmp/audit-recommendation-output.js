const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const records = JSON.parse(fs.readFileSync('public/random.json', 'utf8'));
const pages = records.map(record => {
  const file = path.join('public', decodeURIComponent(record.url), 'index.html');
  if (!fs.existsSync(file)) return {...record, missing: true};
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
  const related = $('.post-related-reading a').map((_, a) => ({title: $(a).text(), url: $(a).attr('href')})).get();
  return {...record, related};
});
function group(tag) {
  const selected = pages.filter(p => p.tags.includes(tag) && p.related);
  const exposure = new Map();
  for (const p of selected) for (const r of p.related) exposure.set(r.title, (exposure.get(r.title) || 0) + 1);
  return {tag, pages: selected.length, distinctRecommended: exposure.size, mostExposed: [...exposure].sort((a,b)=>b[1]-a[1]).slice(0,7), samples: selected.slice(0,2).map(p=>({title:p.title,related:p.related.map(r=>r.title)}))};
}
const counts = JSON.parse(fs.readFileSync('public/calendar.json', 'utf8'));
const details = JSON.parse(fs.readFileSync('public/calendar-posts.json', 'utf8'));
const reading = JSON.parse(fs.readFileSync('public/reading-desk.json', 'utf8'));
const added = {};
for (const t of reading.topics) for (const i of t.items || []) {
  const date = String(i.date).slice(0,10); added[date] = (added[date] || 0) + 1;
}
console.log(JSON.stringify({
  groups: ['音樂推薦','學習筆記'].map(group),
  missingPages: pages.filter(p=>p.missing).length,
  selfLinks: pages.filter(p=>p.related?.some(r=>decodeURIComponent(r.url)===decodeURIComponent(p.url))).map(p=>p.title),
  categorySizes: Object.fromEntries([...new Set(records.flatMap(r=>r.categories))].map(c=>[c,records.filter(r=>r.categories.includes(c)).length])),
  calendar: {countTotal:Object.values(counts).reduce((a,b)=>a+b,0),detailTotal:Object.values(details).flat().length,mismatches:[...new Set([...Object.keys(counts),...Object.keys(details)])].filter(d=>counts[d] !== details[d]?.length)},
  readingDaysAboveFour: Object.entries(added).filter(([d,n])=>n>4)
}, null, 2));
