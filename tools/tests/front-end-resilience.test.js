const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const randomSource = fs.readFileSync(
  path.join(__dirname, '../..', 'source', 'random', 'index.md'),
  'utf8'
);
const randomStart = randomSource.indexOf('    function getHistory()');
const randomEnd = randomSource.indexOf('    function renderRecord(record)', randomStart);
assert(randomStart >= 0 && randomEnd > randomStart, 'random history functions are missing');
const randomLogic = randomSource.slice(randomStart, randomEnd);

function randomContext(sessionStorage) {
  const context = {
    records: [],
    contentCategories: [],
    currentCategory: 'all',
    historyKey: 'random-tape-history',
    selectionKey: 'random-tape-selection-v1',
    memoryHistory: [],
    storageDisabled: false,
    window: { sessionStorage },
    filters: { querySelectorAll: () => [] },
    Math,
    Array,
    JSON,
    String,
    Error
  };
  vm.runInNewContext(randomLogic, context);
  return context;
}

{
  const values = new Map([
    ['random-tape-selection-v1', JSON.stringify({ category: '音樂', url: '/song/' })]
  ]);
  const buttons = ['all', '音樂'].map(category => ({
    getAttribute: name => name === 'data-category' ? category : null,
    classList: { toggle() {} }
  }));
  const context = randomContext({
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  });
  context.filters.querySelectorAll = () => buttons;
  context.contentCategories = ['音樂', '閱讀與影視'];
  context.records = [
    { url: '/song/', categories: ['音樂'] },
    { url: '/book/', categories: ['閱讀與影視'] }
  ];
  assert.strictEqual(context.restoreSelection().url, '/song/', 'valid category and record should restore');
  assert.strictEqual(context.currentCategory, '音樂', 'restored selection should restore its category');
  context.currentCategory = 'all';
  values.set('random-tape-selection-v1', JSON.stringify({ category: '音樂', url: '/book/' }));
  assert.strictEqual(context.restoreSelection(), null, 'selection outside the saved category should be discarded');
  assert.strictEqual(values.has('random-tape-selection-v1'), false, 'invalid state should be removed');
  values.set('random-tape-selection-v1', JSON.stringify({ category: '退役分類', url: '/song/' }));
  assert.strictEqual(context.restoreSelection(), null, 'removed category should fall back safely');
  values.set('random-tape-selection-v1', JSON.stringify({ category: 'all', url: '/removed/' }));
  assert.strictEqual(context.restoreSelection(), null, 'stale URL should fall back safely');
}

{
  let stored;
  const context = randomContext({
    getItem: () => stored || null,
    setItem: () => { throw new Error('storage blocked'); }
  });
  context.saveHistory('/first/');
  assert.deepStrictEqual(context.getHistory(), ['/first/'], 'memory history must survive blocked sessionStorage');
}

{
  const context = randomContext({
    getItem: () => JSON.stringify(['/music/']),
    setItem: () => {}
  });
  context.records = [
    { url: '/music/', categories: ['音樂'] },
    { url: '/book/', categories: ['閱讀'] }
  ];
  context.contentCategories = ['音樂', '閱讀'];
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.strictEqual(context.chooseRecord().url, '/book/', 'all mode must choose a fresh candidate before choosing a category');
  } finally {
    Math.random = originalRandom;
  }
}

const motionSource = fs.readFileSync(
  path.join(__dirname, '../../themes/next/source/js/motion.js'),
  'utf8'
);
const motionElement = () => ({ style: {} });
const motionElements = [motionElement(), motionElement()];
const motionContext = {
  NexT: {},
  CONFIG: { motion: { async: true, duration: 200 } },
  window: {},
  document: {
    querySelectorAll: selector => selector.includes('logo-line') ? [] : motionElements
  },
  console: { warn() {} }
};
vm.runInNewContext(motionSource, motionContext);
motionContext.NexT.motion.integrator.bootstrap();
assert(motionElements.every(element => element.style.visibility === 'visible' && element.style.opacity === '1'), 'motion fallback must reveal hidden content');
