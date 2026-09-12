const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('source/calendar/index.md', 'utf8');
const extract = name => source.match(new RegExp(`function ${name}\\([^]*?\\n    \\}`))[0];
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-09-12T12:00:00+08:00'])); }
}
const ctx = vm.createContext({ Date: FixedDate });
vm.runInContext(`${extract('parseDate')}\n${extract('getRecentDates')}`, ctx);
const posts = Object.fromEntries(Array.from({length:7}, (_,i) => [`2026-09-${String(i+6).padStart(2,'0')}`, [{title:'test'}]]));
const recent = ctx.getRecentDates(posts);
const buttons = [];
const gridCtx = vm.createContext({
  document: { createElement: () => ({style:{}, setAttribute(k,v){this[k]=v;}, addEventListener(){}}) },
  gridControls: { appendChild(button){buttons.push(button);} }, renderUpdates(){}
});
vm.runInContext(extract('renderGridControls'), gridCtx);
gridCtx.renderGridControls({}, '2024');
console.log(JSON.stringify({recentWindowFixture:{today:'2026-09-12', expectedFirst:'2026-09-06',actualDates:recent},leapYear:{year:2024,buttonCount:buttons.length,lastDate:buttons.at(-1)['aria-label']}}));
