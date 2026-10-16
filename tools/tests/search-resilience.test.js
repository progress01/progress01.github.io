const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '../../themes/next/source/js/third-party/search/local-search.js'),
  'utf8'
);

test('索引載入失敗後可重試，連續觸發不重複請求，成功才發布 loaded', async () => {
  const fetchLogic = source.slice(source.indexOf('  const fetchSearchData'), source.indexOf('  const inputEventFunction'));
  let requests = 0, failed = 0, loaded = 0;
  const context = {
    localSearch: {}, Event,
    parseSearchData: require('../../themes/next/source/js/third-party/search/navigation-search').parse,
    populateFilters() {}, renderLoadingState() {}, renderFailureState() { failed++; },
    window: { dispatchEvent() { loaded++; } }, console: { error() {} },
    fetch: async () => {
      requests++;
      return { ok: true, text: async () => requests === 1 ? '<html>Error</html>' : '{"schemaVersion":1,"records":[]}' };
    }
  };
  vm.runInNewContext("var localSearchAvailable = true; var searchState = 'idle'; let records = [];\n" + fetchLogic + '\nthis.fetchIndex = fetchSearchData;', context);
  context.fetchIndex(); context.fetchIndex();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1); assert.equal(failed, 1); assert.equal(loaded, 0);
  assert.equal(context.searchState, 'failed');
  context.fetchIndex();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 2); assert.equal(loaded, 1); assert.equal(context.localSearch.isfetched, true);
  assert.equal(context.searchState, 'loaded');
  context.fetchIndex();
  assert.equal(requests, 2);
});

test('dynamic search states distinguish loading, index failure, keyword misses and filter-only misses accessibly', () => {
  assert.match(source, /正在載入搜尋索引/);
  assert.match(source, /搜尋索引暫時無法載入/);
  assert.match(source, /重試載入搜尋索引/);
  assert.match(source, /data-search-empty-kind="\$\{searchText \? 'keyword' : 'filters'\}"/);
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source, /searchState = 'failed'/);
  assert.doesNotMatch(source, /searchState = 'error'/);
});

test('HTTP 200 的錯誤 HTML 不能被當成空白搜尋索引', () => {
  const parserLogic = source.slice(source.indexOf('  const parseSearchData'), source.indexOf('  const populateFilters'));
  const context = {
    NavigationSearch: require('../../themes/next/source/js/third-party/search/navigation-search'),
    CONFIG: { path: '/search.xml' },
    DOMParser: class {
      parseFromString() {
        return { documentElement: { nodeName: 'html' }, querySelector: () => null, querySelectorAll: () => [] };
      }
    }
  };
  vm.runInNewContext(parserLogic + '\nthis.parseIndex = parseSearchData;', context);
  assert.throws(() => context.parseIndex('<html><body>Server unavailable</body></html>'), /invalid/);
});

test('preload 關閉時，同網址 reload 會先載入索引再還原且不重複請求', () => {
  const requestLogic = source.slice(
    source.indexOf('  const requestViewStateRestore'),
    source.indexOf('  restoreRequested = navigationEntry')
  );
  assert(requestLogic.includes('fetchSearchData()'), 'restore request must be able to start the index load');
  let fetches = 0;
  let restores = 0;
  const state = { url: '/profile/', isOpen: true, surface: 'profile', filters: { surface: 'profile' } };
  const context = {
    readViewState: () => state,
    isRestorableViewState: saved => saved === state,
    fetchSearchData: () => { fetches += 1; context.searchState = 'loading'; },
    restoreViewState: () => { if (context.searchState === 'loaded') restores += 1; },
    searchState: 'idle'
  };
  vm.runInNewContext(`${requestLogic}\nthis.requestRestore = requestViewStateRestore;`, context);
  assert.equal(context.requestRestore(), true);
  assert.equal(fetches, 1);
  assert.equal(restores, 0);
  assert.equal(context.requestRestore(), true);
  assert.equal(fetches, 1, 'loading state must not start a duplicate request');
  context.searchState = 'failed';
  assert.equal(context.requestRestore(), true);
  assert.equal(fetches, 2, 'failed state must be eligible for one retry');
  assert.equal(context.requestRestore(), true);
  assert.equal(fetches, 2, 'retry loading state must suppress duplicate requests');
  context.searchState = 'loaded';
  assert.equal(context.requestRestore(), true);
  assert.equal(restores, 1);

  context.isRestorableViewState = () => false;
  context.searchState = 'idle';
  assert.equal(context.requestRestore(), false);
  assert.equal(fetches, 2, 'invalid or cross-URL state must not start a request');
  assert.match(source, /restoreRequested = navigationEntry[^;]*;\s*requestViewStateRestore\(\);/s);
  assert.match(source, /window\.addEventListener\('pageshow',[\s\S]*requestViewStateRestore\(\);/);
});

test('搜尋快速關閉後不會讓延遲 focus 落到隱藏 input，Ctrl+K 也保留原觸發者', () => {
  const handlers = {};
  let pendingTimer = null;
  let focusCalls = 0;
  let focusedElement;
  const bodyClasses = new Set();
  const classList = {
    add: value => bodyClasses.add(value),
    remove: value => bodyClasses.delete(value),
    contains: value => bodyClasses.has(value)
  };
  const makeElement = (tagName = 'DIV') => {
    const listeners = {};
    const attributes = {};
    const element = {
      addEventListener: (event, callback) => { listeners[event] = callback; },
      dispatch: (event, payload = {}) => listeners[event]?.(payload),
      focus: () => { focusCalls += 1; focusedElement = element; },
      setAttribute: (name, value) => { attributes[name] = String(value); },
      getAttribute: name => attributes[name] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      classList,
      innerHTML: '<section data-search-recent></section>',
      value: '',
      closest: () => null,
      getClientRects: () => [{}],
      hidden: false,
      tagName
    };
    return element;
  };
  const input = makeElement();
  const container = makeElement();
  const overlay = makeElement();
  const popup = makeElement();
  const closeButton = makeElement();
  const trigger = makeElement();
  const elements = new Map([
    ['.search-input', input],
    ['.search-result-container', container],
    ['.search-pop-overlay', overlay],
    ['.search-popup', popup],
    ['.popup-btn-close', closeButton],
    ['.post-body', null]
  ]);
  const document = {
    body: { classList },
    activeElement: trigger,
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: selector => selector === '.popup-trigger' ? [trigger] : [],
    addEventListener: (event, callback) => { handlers[`document:${event}`] = callback; },
    contains: () => true
  };
  const context = {
    CONFIG: { path: '/search.xml', i18n: {}, localsearch: { preload: false } },
    NexT: { utils: { setGutter: () => {} } },
    LocalSearch: class {
      constructor() { this.isfetched = false; }
      highlightSearchWords() {}
      getResultItems() { return []; }
    },
    pjax: null,
    NavigationSearch: require('../../themes/next/source/js/third-party/search/navigation-search'),
    document,
    window: {
      addEventListener: (event, callback) => { handlers[`window:${event}`] = callback; },
      dispatchEvent: () => {}
    },
    Event,
    DOMParser: class {},
    fetch: () => new Promise(() => {}),
    setTimeout: callback => { pendingTimer = callback; return 1; },
    clearTimeout: () => { pendingTimer = null; },
    console: { warn: () => {}, error: () => {} }
  };
  vm.runInNewContext(source, context);
  handlers['document:DOMContentLoaded']();

  trigger.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  assert.strictEqual(trigger.getAttribute('tabindex'), '0');
  assert(bodyClasses.has('search-active'), 'Enter must open a non-button popup trigger');
  assert.strictEqual(typeof pendingTimer, 'function');
  document.activeElement = input;
  handlers['window:keydown']({ ctrlKey: true, metaKey: false, key: 'k', preventDefault() {} });
  closeButton.dispatch('click');
  assert.strictEqual(pendingTimer, null, 'closing must cancel the delayed input focus');
  assert.strictEqual(focusCalls, 1, 'closing must return focus to the original trigger');
  assert.strictEqual(focusedElement, trigger, 'Ctrl+K inside the modal must preserve its original trigger');

  trigger.dispatch('keydown', { key: ' ', preventDefault() {} });
  assert(bodyClasses.has('search-active'), 'Space must open a non-button popup trigger');
  closeButton.dispatch('click');

  document.activeElement = document.body;
  handlers['window:keydown']({ ctrlKey: true, metaKey: false, key: 'k', preventDefault() {} });
  closeButton.dispatch('click');
  assert.strictEqual(focusedElement, trigger, 'Ctrl+K from BODY must use a visible popup trigger as fallback');
});

test('SearchDB browser runtime is served from the installed package with its MIT license', () => {
  const runtimeGenerator = fs.readFileSync(path.join(__dirname, '../../scripts/searchdb-runtime.js'), 'utf8');
  const packageDirectory = path.dirname(require.resolve('hexo-generator-searchdb/package.json'));
  const packageInfo = require(path.join(packageDirectory, 'package.json'));
  let generate;
  vm.runInNewContext(runtimeGenerator, {
    require,
    hexo: { extend: { generator: { register: (name, callback) => {
      assert.equal(name, 'searchdb_runtime');
      generate = callback;
    } } } }
  });
  const routes = generate();
  const script = routes.find(route => route.path === 'lib/searchdb/search.js');
  const license = routes.find(route => route.path === 'lib/searchdb/LICENSE');
  assert(script);
  assert(license);
  assert.match(script.data, new RegExp(`hexo-generator-searchdb v${packageInfo.version}; MIT License`));
  assert.equal(script.data.slice(script.data.indexOf('\n') + 1), fs.readFileSync(path.join(packageDirectory, 'dist/search.js'), 'utf8'));
  assert.equal(license.data, fs.readFileSync(path.join(packageDirectory, 'LICENSE'), 'utf8'));
  const template = fs.readFileSync(path.join(__dirname, '../../themes/next/layout/_third-party/search/localsearch.njk'), 'utf8');
  assert.match(template, /lib\/searchdb\/search\.js[\s\S]*navigation-search\.js[\s\S]*local-search\.js/);
});

test('missing installed SearchDB dependency fails generation clearly', () => {
  const runtimeGenerator = fs.readFileSync(path.join(__dirname, '../../scripts/searchdb-runtime.js'), 'utf8');
  const unavailableRequire = Object.assign(name => require(name), {
    resolve(name) {
      if (name === 'hexo-generator-searchdb/package.json') {
        const error = new Error(`Cannot find module '${name}'`);
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      }
      return require.resolve(name);
    }
  });
  assert.throws(() => vm.runInNewContext(runtimeGenerator, {
    require: unavailableRequire,
    hexo: { extend: { generator: { register() {} } } }
  }), /hexo-generator-searchdb\/package\.json/);
});

test('missing search runtime leaves the popup and keyboard controls usable with a clear reload message', () => {
  const handlers = {};
  let focusTimerCallback;
  let reloads = 0;
  const bodyClasses = new Set();
  const classList = {
    add: value => bodyClasses.add(value),
    remove: value => bodyClasses.delete(value),
    contains: value => bodyClasses.has(value)
  };
  const makeElement = (tagName = 'DIV') => {
    const listeners = {};
    const attributes = {};
    const element = {
      addEventListener: (event, callback) => { listeners[event] = callback; },
      dispatch: (event, payload = {}) => listeners[event]?.(payload),
      focus() {},
      setAttribute: (name, value) => { attributes[name] = String(value); },
      getAttribute: name => attributes[name] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      classList,
      innerHTML: '<section data-search-recent></section>',
      value: '',
      closest: selector => selector === '[data-search-reload]' ? element : null,
      getClientRects: () => [{}],
      hidden: false,
      tagName
    };
    return element;
  };
  const input = makeElement('INPUT');
  const surfaceFilter = makeElement('SELECT');
  surfaceFilter.dataset = { navigationFilter: 'surface' };
  surfaceFilter.value = 'profile';
  const container = makeElement();
  const overlay = makeElement();
  const popup = makeElement();
  const closeButton = makeElement('BUTTON');
  const trigger = makeElement('BUTTON');
  popup.querySelectorAll = selector => selector === '[data-navigation-filter]' ? [surfaceFilter] : [];
  const elements = new Map([
    ['.search-input', input], ['.search-result-container', container],
    ['.search-pop-overlay', overlay], ['.search-popup', popup],
    ['.popup-btn-close', closeButton], ['.post-body', null]
  ]);
  const document = {
    body: { classList },
    activeElement: trigger,
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: selector => selector === '.popup-trigger' ? [trigger] : [],
    addEventListener: (event, callback) => { handlers[`document:${event}`] = callback; },
    contains: () => true
  };
  const errors = [];
  const context = {
    CONFIG: { path: '/navigation-index.json', i18n: {}, localsearch: { preload: false } },
    NexT: { utils: { setGutter: () => {} } },
    NavigationSearch: require('../../themes/next/source/js/third-party/search/navigation-search'),
    document,
    window: {
      location: { pathname: '/', search: '', hash: '', reload: () => { reloads++; } },
      sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
      addEventListener: (event, callback) => { handlers[`window:${event}`] = callback; },
      dispatchEvent() {}
    },
    Event,
    setTimeout: callback => { focusTimerCallback = callback; return 1; },
    clearTimeout: () => { focusTimerCallback = null; },
    console: { warn() {}, error: error => errors.push(error) }
  };

  vm.runInNewContext(source, context);
  handlers['document:DOMContentLoaded']();
  assert.match(container.innerHTML, /搜尋元件未能載入，搜尋暫時無法使用/);
  assert.doesNotMatch(container.innerHTML, /data-search-retry/);
  input.dispatch('input');
  surfaceFilter.dispatch('change');
  assert.match(container.innerHTML, /搜尋元件未能載入，搜尋暫時無法使用/);

  trigger.dispatch('click');
  assert(bodyClasses.has('search-active'));
  closeButton.dispatch('click');
  assert(!bodyClasses.has('search-active'));
  handlers['window:keydown']({ ctrlKey: true, metaKey: false, key: 'k', preventDefault() {} });
  assert(bodyClasses.has('search-active'));
  handlers['window:keydown']({ key: 'Escape', preventDefault() {} });
  assert(!bodyClasses.has('search-active'));
  handlers['window:keydown']({ ctrlKey: true, metaKey: false, key: 'k', preventDefault() {} });
  assert(bodyClasses.has('search-active'));
  container.dispatch('click', { target: makeElement() });
  assert.equal(reloads, 1);
  assert.deepEqual(errors, []);
  assert.equal(typeof focusTimerCallback, 'function');
});
