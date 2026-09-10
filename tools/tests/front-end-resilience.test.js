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
    memoryHistory: [],
    storageDisabled: false,
    window: { sessionStorage },
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
