const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');

function sourceText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function functionsBetween(source, startName, endName) {
  const start = source.indexOf(`    function ${startName}`);
  const end = source.indexOf(`    function ${endName}`, start);
  assert(start >= 0 && end > start, `${startName} or ${endName} is missing`);
  return source.slice(start, end);
}

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [2026, 8, 12, 12]));
  }
}

class NewYearDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [2026, 0, 2, 12]));
  }
}

function buttonDocument(buttons) {
  return {
    createElement() {
      return {
        style: {},
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, handler) { this.handler = handler; }
      };
    }
  };
}

{
  const source = sourceText('source/calendar/index.md');
  const dateLogic = functionsBetween(source, 'parseDate', 'getRecords');
  const recentContext = vm.createContext({ Date: FixedDate });
  vm.runInContext(dateLogic, recentContext);
  const posts = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [
      `2026-09-${String(index + 6).padStart(2, '0')}`,
      [{ title: 'fixture' }]
    ])
  );
  assert.deepStrictEqual(
    Array.from(recentContext.getRecentDates(posts)),
    ['2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09', '2026-09-08', '2026-09-07', '2026-09-06'],
    'recent window must include seven calendar dates from midnight six days ago'
  );

  const crossYearContext = vm.createContext({ Date: NewYearDate });
  vm.runInContext(dateLogic, crossYearContext);
  const crossYearPosts = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 11, 27 + index));
      return [date.toISOString().slice(0, 10), [{ title: 'fixture' }]];
    })
  );
  assert.deepStrictEqual(
    Array.from(crossYearContext.getRecentDates(crossYearPosts)),
    ['2026-01-02', '2026-01-01', '2025-12-31', '2025-12-30', '2025-12-29', '2025-12-28', '2025-12-27'],
    'recent window must cross the year boundary'
  );

  const buttons = [];
  const gridContext = vm.createContext({
    document: buttonDocument(buttons),
    gridControls: { innerHTML: '', appendChild(button) { buttons.push(button); } },
    renderUpdates() {}
  });
  vm.runInContext(functionsBetween(source, 'renderGridControls', 'showYear'), gridContext);
  gridContext.renderGridControls({}, '2024');
  assert.strictEqual(buttons.length, 366, 'leap years must expose all 366 date controls');
  assert.match(buttons[buttons.length - 1]['aria-label'], /^2024-12-31/);

  buttons.length = 0;
  gridContext.renderGridControls({}, '2023');
  assert.strictEqual(buttons.length, 365, 'non-leap years must expose 365 date controls');
  assert.match(buttons[buttons.length - 1]['aria-label'], /^2023-12-31/);
}

{
  const source = sourceText('source/reading/index.md');
  const readingLogic = functionsBetween(source, 'pad', 'renderUpdates');
  const readingData = {
    year: 2026,
    topics: [{
      name: 'Fixture',
      items: [
        ...Array.from({ length: 5 }, () => ({ date: '2026-09-04', state: 'learning' })),
        { date: '2026-09-20', state: 'collected' }
      ]
    }]
  };
  let rendered;
  const context = vm.createContext({ Date: FixedDate, readingData, renderUpdates(...args) { rendered = args; } });
  vm.runInContext(readingLogic, context);

  const backlog = context.buildBacklogData('2026');
  assert.strictEqual(backlog['2026-09-04'], 5, 'backlog data must preserve the real daily count');
  assert.strictEqual(backlog['2026-09-09'], 0, 'past dates with no additions must remain queryable');
  assert.strictEqual(backlog['2026-09-20'], 1, 'future-dated entries must remain on their entered date');
  assert.strictEqual(context.latestItemDate('2026'), '2026-09-20');

  const buttons = [];
  context.document = buttonDocument(buttons);
  context.gridControls = { innerHTML: '', appendChild(button) { buttons.push(button); } };
  vm.runInContext(functionsBetween(source, 'renderGridControls', 'bindCalendarClick'), context);
  context.renderGridControls('2026');
  const pastEmpty = buttons.find(button => button['aria-label'].startsWith('2026-09-09'));
  const planned = buttons.find(button => button['aria-label'].startsWith('2026-09-20'));
  const futureEmpty = buttons.find(button => button['aria-label'].startsWith('2026-09-13'));
  assert(pastEmpty && typeof pastEmpty.handler === 'function', 'past empty dates must remain clickable');
  assert(planned && planned.className.includes('is-future'), 'future entries must be marked as planned');
  assert.match(planned['aria-label'], /預排 新增 1 個題目/);
  assert.match(planned.title, /預排/);
  assert(futureEmpty && !futureEmpty['aria-label'].includes('預排'));
  assert.match(futureEmpty.title, /尚未到達/);
  planned.handler();
  assert.strictEqual(rendered[0].length, 1);
  assert.match(rendered[1], /預排內容/);
  futureEmpty.handler();
  assert.strictEqual(rendered[0].length, 0);
  assert.match(rendered[1], /尚未到達/);

  assert.match(source, /type: 'piecewise'/);
  assert.match(source, /label: '4\+'/);
  assert.match(source, /itemWidth: 12/);
  assert.match(source, /itemHeight: 12/);
}

{
  const registered = {};
  const hexo = { extend: { generator: { register(name, generator) { registered[name] = generator; } } } };
  const generatorSource = sourceText('scripts/calendar-generator.js');
  vm.runInNewContext(generatorSource, { hexo });
  const post = {
    title: '預排文章',
    path: 'learning/planned/',
    date: { format: () => '2026-09-20' },
    updated: { format: () => '2026-09-12' },
    categories: { toArray: () => [{ name: '學習' }] }
  };
  const locals = { posts: [post] };
  const calendar = JSON.parse(registered.calendar_json(locals).data);
  const details = JSON.parse(registered.calendar_posts_json(locals).data);
  assert.deepStrictEqual(calendar, { '2026-09-20': 1 }, 'calendar event date must come from post.date');
  assert.strictEqual(details['2026-09-20'][0].date, '2026-09-20');
  assert.strictEqual(details['2026-09-12'], undefined, 'updated must not move an event to today');
}

{
  const source = sourceText('source/lib/calendar.js');
  let option;
  const chart = { resize() {}, setOption(value) { option = value; } };
  const dom = { style: {} };
  const context = vm.createContext({
    document: { getElementById() { return dom; } },
    window: { innerWidth: 1000 },
    echarts: {
      init() { return chart; },
      getInstanceByDom() { return null; },
      format: { formatTime(format, date) { return date; } }
    }
  });
  vm.runInContext(source, context);
  context.Calendar.init('calendar', {
    data: { '2026-09-04': 5 },
    year: '2026',
    maxValue: 4,
    colors: ['zero', 'one', 'two', 'three', 'four'],
    visualMap: {
      type: 'piecewise',
      pieces: [
        { value: 0, label: '0' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { min: 4, label: '4+' }
      ]
    },
    tooltipUnit: '個當日新增題目'
  });
  assert.strictEqual(option.visualMap.type, 'piecewise');
  assert.deepStrictEqual(Array.from(option.visualMap.pieces).at(-1), { min: 4, label: '4+' });
  assert.strictEqual(option.tooltip.formatter({ data: ['2026-09-04', 5] }), '2026-09-04: 5 個當日新增題目');
}

console.log('calendar tests passed: seven-day window, leap-year controls, exact reading counts, and planned entries');
