const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('source/reading/index.md', 'utf8');
const extract = name => source.match(new RegExp(`function ${name}\\([^]*?\\n    \\}`))[0];
const readingData = JSON.parse(fs.readFileSync('public/reading-desk.json', 'utf8'));
const ctx = vm.createContext({readingData});
for (const name of ['pad','dateKey','todayKey','allItems','getAddedRecords','latestDataDate','buildBacklogData']) vm.runInContext(extract(name), ctx);
let option;
const chartCtx = vm.createContext({
  document:{getElementById(){return {style:{}};}},window:{innerWidth:1000},
  echarts:{init(){return {resize(){},setOption(o){option=o;}};},format:{formatTime(_,date){return date;}}}
});
vm.runInContext(fs.readFileSync('source/lib/calendar.js','utf8'),chartCtx);
const data = ctx.buildBacklogData('2026');
chartCtx.Calendar.init('reading-calendar',{data,year:'2026',maxValue:4,tooltipUnit:'個當日新增題目'});
console.log(JSON.stringify({date:'2026-09-04',actualRecords:ctx.getAddedRecords('2026-09-04').length,chartValue:data['2026-09-04'],tooltip:option.tooltip.formatter({data:['2026-09-04',data['2026-09-04']]})}));
const buttons = [];
ctx.document = {createElement(){return {style:{},setAttribute(k,v){this[k]=v;},addEventListener(){this.clickable=true;}};}};
ctx.gridControls = {appendChild(button){buttons.push(button);}};
vm.runInContext(extract('renderGridControls'),ctx);
ctx.renderGridControls('2026');
const button = buttons.find(b=>b['aria-label'].startsWith('2026-09-09'));
console.log(JSON.stringify({latestAddedDate:ctx.latestDataDate(),pastDate:'2026-09-09',title:button.title,clickable:!!button.clickable}));
