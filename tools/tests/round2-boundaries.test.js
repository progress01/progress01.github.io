const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'source/random/index.md'), 'utf8');
const logic = source.slice(source.indexOf('    function getHistory()'), source.indexOf('    function renderRecord(record)'));

function historyContext(window) {
  const randomMath = Object.create(Math);
  randomMath.random = () => 0;
  const context = {
    records: [1, 2, 3, 4, 5].map(number => ({ url: '/' + number, categories: [number < 4 ? '工作' : '音樂'] })),
    contentCategories: ['工作', '音樂'], currentCategory: 'all', historyKey: 'history',
    memoryHistory: [], storageDisabled: false, window, Math: randomMath
  };
  vm.createContext(context);
  vm.runInContext(logic, context);
  return context;
}

test('儲存API存取直接拋錯時，仍以記憶體維持最近三篇不重複', () => {
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, 'sessionStorage', { get() { throw new Error('SecurityError'); } });
  const context = historyContext(blockedWindow);
  const drawn = [];
  for (let i = 0; i < 12; i++) {
    const record = context.chooseRecord();
    assert.ok(!drawn.slice(-3).includes(record.url), '有其他候選時不得重複最近三篇');
    context.saveHistory(record.url);
    drawn.push(record.url);
  }
});

test('指定分類候選耗盡可以重新抽，不能跳去其他分類', () => {
  const context = historyContext({ sessionStorage: { getItem: () => '["/1","/2","/3"]', setItem() {} } });
  context.currentCategory = '工作';
  assert.ok(context.chooseRecord().categories.includes('工作'));
  context.currentCategory = '不存在';
  assert.equal(context.chooseRecord(), undefined);
});

test('損壞的儲存資料不妨礙抽選與後續歷史紀錄', () => {
  for (const stored of ['{broken', 'null', '{}']) {
    const context = historyContext({ sessionStorage: { getItem: () => stored, setItem() {} } });
    const record = context.chooseRecord();
    context.saveHistory(record.url);
    assert.deepEqual(Array.from(context.getHistory()), [record.url]);
  }
});

test('動畫timeline拋错會顯示內容；正常timeline仍執行原有佇列', () => {
  const motionSource = fs.readFileSync(path.join(root, 'themes/next/source/js/motion.js'), 'utf8');
  for (const broken of [true, false]) {
    const article = { style: {} };
    const additions = [];
    const context = {
      NexT: {}, CONFIG: { motion: { async: false, duration: 200 } },
      window: { anime: { timeline() {
        if (broken) throw new Error('timeline failed');
        return { add(item) { additions.push(item); } };
      } } },
      document: { querySelectorAll: selector => selector.includes('logo-line') ? [] : [article] },
      console: { warn() {} }
    };
    vm.runInNewContext(motionSource, context);
    context.NexT.motion.integrator.add(() => [{ targets: '.post-block' }]).bootstrap();
    if (broken) assert.equal(article.style.visibility, 'visible');
    else {
      assert.equal(additions.length, 1);
      assert.equal(article.style.visibility, undefined, '正常動畫不應被fallback覆蓋');
    }
  }
});
