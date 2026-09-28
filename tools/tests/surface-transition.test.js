'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const transition = require('../../themes/next/source/js/surface-transition');

function anchor({ href = 'https://example.test/profile/', targetSurface = 'profile', target = '', download = false } = {}) {
  const attrs = { 'data-target-surface': targetSurface, target };
  return { href, hasAttribute: name => name === 'download' && download, getAttribute: name => attrs[name] ?? null };
}
const url = new URL('https://example.test/');
const click = (props = {}) => ({ button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...props });
function memoryStorage(initial = null, shouldThrow = false) {
  let value = initial;
  return { getItem: () => { if (shouldThrow) throw Error('blocked'); return value; },
    setItem: (_key, next) => { if (shouldThrow) throw Error('blocked'); value = next; },
    removeItem: () => { if (shouldThrow) throw Error('blocked'); value = null; }, peek: () => value };
}

test('native anchor markup contract and delegated code never gates navigation', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  const home = fs.readFileSync(path.join(root, 'themes/next/layout/index.njk'), 'utf8');
  const switchPartial = fs.readFileSync(path.join(root, 'themes/next/layout/_partials/dual-surface-control.njk'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'themes/next/source/js/surface-transition.js'), 'utf8');
  assert.match(home, /<a[^>]+data-target-surface/);
  assert.match(switchPartial, /<a class="surface-switch-link"[\s\S]*?data-target-surface/);
  assert.doesNotMatch(js, /preventDefault\s*\(|setTimeout\s*\(/);
  assert.match(js, /onAnimationEnd/);
  const cleanup = js.match(/const onAnimationEnd = event => \{([\s\S]*?)\n\s+\};/);
  assert.ok(cleanup);
  assert.doesNotMatch(cleanup[1], /location|\.href|\.assign\(|\.click\(/);
});

test('primary same-origin eligible navigation creates a versioned short-lived intent', () => {
  const candidate = transition.isEligibleClick(click(), anchor(), url);
  assert.deepEqual(candidate, { targetSurface: 'profile', pathname: '/profile/' });
  assert.deepEqual(transition.makeIntent(candidate.targetSurface, candidate.pathname, 1234), {
    schema: 'surface-transition', version: 1, targetSurface: 'profile', pathname: '/profile/', timestamp: 1234
  });
  assert.equal(transition.TTL <= 5000, true);
});

test('modifier, non-primary, external, download, and new-tab clicks are ignored', () => {
  assert.equal(transition.isEligibleClick(click({ ctrlKey: true }), anchor(), url), false);
  assert.equal(transition.isEligibleClick(click({ button: 1 }), anchor(), url), false);
  assert.equal(transition.isEligibleClick(click(), anchor({ href: 'https://other.test/profile/' }), url), false);
  assert.equal(transition.isEligibleClick(click(), anchor({ download: true }), url), false);
  assert.equal(transition.isEligibleClick(click(), anchor({ target: '_blank' }), url), false);
  assert.equal(transition.isEligibleClick(click(), anchor({ targetSurface: 'other' }), url), false);
});

test('storage failures and reduced-motion code path leave ordinary anchors usable', () => {
  const broken = memoryStorage(null, true);
  assert.throws(() => broken.setItem(transition.KEY, 'x'));
  assert.equal(transition.consumeIntent({ storage: broken, now: 1, pathname: '/profile/', currentSurface: 'profile', navigationType: 'navigate' }), false);
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../themes/next/source/js/surface-transition.js'), 'utf8');
  assert.match(source, /if \(reduced\(\)\) return;/);
});

test('freshness, clock skew, route and surface matching, reload/back, and read-once cleanup', () => {
  const intent = transition.makeIntent('profile', '/profile/', 1000);
  const use = (overrides = {}, storage = memoryStorage(JSON.stringify(intent))) => ({
    storage, now: 1100, pathname: '/profile', currentSurface: 'profile', navigationType: 'navigate', ...overrides
  });
  assert.equal(transition.consumeIntent(use()), 'profile');
  for (const overrides of [
    { now: 6000 }, { now: 900 }, { pathname: '/' }, { pathname: '/profile/articles/' }, { pathname: '/work/ordinary-article/' },
    { currentSurface: 'memory' }, { navigationType: 'reload' }, { navigationType: 'back_forward' }
  ]) {
    const storage = memoryStorage(JSON.stringify(intent));
    assert.equal(transition.consumeIntent(use(overrides, storage)), false);
    assert.equal(storage.peek(), null);
  }
  const storage = memoryStorage(JSON.stringify(intent));
  transition.consumeIntent(use({}, storage));
  assert.equal(storage.peek(), null);
});

test('reload cleans existing animation class; install guard prevents duplicate listeners and supports PJAX refresh', () => {
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../themes/next/source/js/surface-transition.js'), 'utf8');
  assert.match(source, /__surfaceTransitionInstalled/);
  assert.match(source, /page:loaded/);
  assert.match(source, /pjax:success/);
  assert.match(source, /querySelectorAll\(`\.\$\{className\}`\)/);
  assert.match(source, /event\.target\.classList\.remove\(className, `\$\{className\}--profile`, `\$\{className\}--memory`\)/);
});

test('install is idempotent, consumes a matched intent, and clears stale classes on PJAX refresh', () => {
  const listeners = new Map();
  const classes = new Set(['main-inner', 'profile-page']);
  const main = { classList: {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name))
  } };
  const marker = { getAttribute: name => name === 'data-current-surface' ? 'profile' : null };
  const doc = {
    addEventListener: (name, handler) => listeners.set(name, [...(listeners.get(name) || []), handler]),
    querySelector: selector => selector.startsWith('.surface-switch') ? marker : selector.startsWith('.main-inner') ? main : null,
    querySelectorAll: selector => selector.includes('surface-transition-enter') && [...classes].some(name => name.startsWith('surface-transition-enter')) ? [main] : []
  };
  const stored = new Map([[transition.KEY, JSON.stringify(transition.makeIntent('profile', '/profile/', Date.now()))]]);
  const win = {
    document: doc, location: { href: 'https://example.test/profile/', pathname: '/profile/' },
    sessionStorage: { getItem: key => stored.get(key) || null, removeItem: key => stored.delete(key), setItem: (key, value) => stored.set(key, value) },
    matchMedia: () => ({ matches: false }), performance: { getEntriesByType: () => [{ type: 'navigate' }] }
  };
  transition.install(win);
  assert.equal(listeners.get('click').length, 1);
  assert.equal(classes.has('surface-transition-enter--profile'), true);
  assert.equal(stored.has(transition.KEY), false);
  transition.install(win);
  assert.equal(listeners.get('click').length, 1);
  listeners.get('pjax:success')[0]();
  assert.equal(classes.has('surface-transition-enter'), false);
  assert.equal(classes.has('surface-transition-enter--profile'), false);
});

test('CSS limits the enter animation, preserves first-frame text, and disables motion completely', () => {
  const css = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../themes/next/source/css/_custom/surface-transition.styl'), 'utf8');
  assert.match(css, /180ms/);
  assert.match(css, /opacity:\s*\.86/);
  assert.match(css, /\.main-inner\.surface-transition-enter\.index/);
  assert.match(css, /\.main-inner\.surface-transition-enter\.profile-page/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*?animation:\s*none\s*!important[\s\S]*?animation-duration:\s*0s\s*!important[\s\S]*?transition-duration:\s*0s\s*!important[\s\S]*?transform:\s*none\s*!important/);
  assert.doesNotMatch(css, /\.post-content/);
});
