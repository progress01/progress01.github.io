/* global window, document */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KEY = 'surface-transition-intent';
  const VERSION = 1;
  const TTL = 4500;
  const ROUTES = { profile: ['/', '/profile/', '/profile/articles/'], memory: ['/memory/'] };

  function normalizePath(pathname) {
    if (!pathname || pathname === '/') return '/';
    return `${pathname.replace(/\/+$/, '')}/`;
  }

  function isEligibleClick(event, anchor, currentUrl) {
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.hasAttribute('download')) return false;
    const target = (anchor.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return false;
    const targetSurface = anchor.getAttribute('data-target-surface');
    if (!['profile', 'memory'].includes(targetSurface)) return false;
    try {
      const destination = new URL(anchor.href, currentUrl.href);
      return destination.origin === currentUrl.origin ? { targetSurface, pathname: normalizePath(destination.pathname) } : false;
    } catch { return false; }
  }

  function makeIntent(targetSurface, pathname, now) {
    if (!['profile', 'memory'].includes(targetSurface)) return null;
    return { schema: 'surface-transition', version: VERSION, targetSurface, pathname: normalizePath(pathname), timestamp: now };
  }

  function consumeIntent({ storage, now, pathname, currentSurface, navigationType, routes = ROUTES, maxAge = TTL }) {
    let raw;
    try { raw = storage.getItem(KEY); } catch { return false; }
    try { storage.removeItem(KEY); } catch { /* best effort; the intent is still consumed for this call */ }
    if (!raw || navigationType !== 'navigate') return false;
    let intent;
    try { intent = JSON.parse(raw); } catch { return false; }
    if (intent.schema !== 'surface-transition' || intent.version !== VERSION || !Number.isFinite(intent.timestamp) ||
        now < intent.timestamp || now - intent.timestamp > maxAge) return false;
    const path = normalizePath(pathname);
    if (intent.pathname !== path || intent.targetSurface !== currentSurface) return false;
    if (!(routes[currentSurface] || []).map(normalizePath).includes(path)) return false;
    return intent.targetSurface;
  }

  function install(win) {
    if (!win || !win.document || win.__surfaceTransitionInstalled) return;
    win.__surfaceTransitionInstalled = true;
    const doc = win.document;
    const className = 'surface-transition-enter';
    let consumedMatchedIntent = false;
    const clear = () => {
      doc.querySelectorAll(`.${className}`).forEach(node => node.classList.remove(className));
      doc.querySelectorAll(`.${className}--profile, .${className}--memory`).forEach(node => {
        node.classList.remove(`${className}--profile`, `${className}--memory`);
      });
    };
    const reduced = () => {
      try { return Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch { return true; }
    };
    const currentNavigationType = () => {
      try { return win.performance.getEntriesByType('navigation')[0]?.type || 'navigate'; }
      catch { return 'navigate'; }
    };
    const refresh = () => {
      clear();
      if (consumedMatchedIntent) return;
      let marker;
      try { marker = doc.querySelector('.surface-switch[data-current-surface]'); } catch { return; }
      if (!marker) return;
      let target;
      try {
        target = consumeIntent({ storage: win.sessionStorage, now: Date.now(), pathname: win.location.pathname,
          currentSurface: marker.getAttribute('data-current-surface'), navigationType: currentNavigationType() });
      } catch { return; }
      if (target) {
        consumedMatchedIntent = true;
        if (reduced()) return;
        const main = doc.querySelector('.main-inner.index, .main-inner.profile-page');
        if (main) {
          main.classList.add(className);
          main.classList.add(`${className}--${target}`);
        }
      }
    };
    const onClick = event => {
      if (reduced()) return;
      const source = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
      const anchor = source && source.closest ? source.closest('a[data-target-surface]') : null;
      const eligible = isEligibleClick(event, anchor, new URL(win.location.href));
      if (!eligible) return;
      const intent = makeIntent(eligible.targetSurface, eligible.pathname, Date.now());
      try {
        win.sessionStorage.setItem(KEY, JSON.stringify(intent));
        consumedMatchedIntent = false;
      } catch { /* ordinary anchor navigation remains untouched */ }
    };
    const onAnimationEnd = event => {
      if (!event.target || !event.target.classList || !event.target.classList.contains(className)) return;
      event.target.classList.remove(className, `${className}--profile`, `${className}--memory`);
    };
    doc.addEventListener('click', onClick);
    doc.addEventListener('animationend', onAnimationEnd);
    doc.addEventListener('page:loaded', refresh);
    doc.addEventListener('pjax:success', refresh);
    refresh();
  }

  return { KEY, VERSION, TTL, ROUTES, normalizePath, isEligibleClick, makeIntent, consumeIntent, install };
});
