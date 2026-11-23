(function() {
  'use strict';

  function initializePhotoWall(win, doc) {
    var filters = Array.from(doc.querySelectorAll('[data-photo-wall-filter]'));
    var sections = Array.from(doc.querySelectorAll('[data-photo-wall-section]'));
    if (!filters.length || !sections.length) return;
    var keys = ['all', 'music', 'books', 'films'];
    var storageKey = 'photo-wall-view-state-v3';
    var category = 'music';
    // Old single-month links now open the continuous wall at their # anchor.
    var url = new URL(win.location.href);
    if (url.searchParams.has('month')) {
      url.searchParams.delete('month');
      win.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    function save() {
      try { win.sessionStorage.setItem(storageKey, JSON.stringify({
        url: win.location.pathname + win.location.search + win.location.hash, category: category, scrollY: win.scrollY
      })); } catch (_) { /* Filtering also works without storage. */ }
    }
    function updateTOC() {
      if (win.NexT && win.NexT.utils && typeof win.NexT.utils.updateActiveNav === 'function') {
        win.NexT.utils.updateActiveNav();
      }
    }
    function show(key) {
      category = keys.indexOf(key) === -1 ? 'music' : key;
      sections.forEach(function(section) {
        section.hidden = category !== 'all' && section.dataset.photoWallSection !== category;
      });
      filters.forEach(function(filter) {
        var active = filter.dataset.photoWallFilter === category;
        filter.classList.toggle('is-active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      updateTOC();
    }
    function target() {
      var id = win.location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (_) {}
      return doc.getElementById(id);
    }
    function fromHash(initial) {
      var element = target();
      var section = element && element.closest('[data-photo-wall-section]');
      var match = win.location.hash.match(/^#photo-wall-(all|music|books|films)(?:-|$)/);
      var key = section ? section.dataset.photoWallSection : match ? match[1] : 'music';
      // Keep the whole wall open when jumping within an all-category overview.
      show(!initial && category === 'all' && section ? 'all' : key);
    }
    function focusTarget() {
      var element = target();
      if (element && typeof element.scrollIntoView === 'function') {
        win.setTimeout(function() {
          element.scrollIntoView({block:'start'});
          updateTOC();
        }, 0);
      }
    }
    // NexT's TOC handler prevents native hash navigation and only pushes history
    // after scrolling. Handle wall targets in capture phase before it measures
    // a hidden category; pushState alone does not emit a hashchange event.
    doc.addEventListener('click', function(event) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest && event.target.closest('.post-toc a[href]');
      if (!link) return;
      var url = new URL(link.href, win.location.href);
      if (url.origin !== win.location.origin || url.pathname !== win.location.pathname || !url.hash) return;
      var id = url.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (_) {}
      var element = doc.getElementById(id);
      var section = element && element.closest('[data-photo-wall-section]');
      if (!section) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      show(category === 'all' ? 'all' : section.dataset.photoWallSection);
      win.history.pushState(null, '', url.pathname + url.search + url.hash);
      focusTarget();
      save();
    }, true);
    filters.forEach(function(filter) {
      filter.addEventListener('click', function() {
        show(filter.dataset.photoWallFilter);
        var url = new URL(win.location.href);
        url.hash = 'photo-wall-' + category;
        win.history.replaceState(null, '', url.pathname + url.search + url.hash);
        save();
      });
    });
    function locationChanged() { fromHash(false); focusTarget(); }
    win.addEventListener('hashchange', locationChanged);
    win.addEventListener('popstate', locationChanged);
    win.addEventListener('pagehide', save);
    fromHash(true);
    var restored = false;
    try {
      var saved = JSON.parse(win.sessionStorage.getItem(storageKey) || 'null');
      if (saved && saved.url === win.location.pathname + win.location.search + win.location.hash && Number.isFinite(saved.scrollY)) {
        restored = true;
        if (keys.indexOf(saved.category) !== -1) show(saved.category);
        win.setTimeout(function() { win.scrollTo({top:saved.scrollY,behavior:'auto'}); }, 0);
      }
    } catch (_) {}
    if (!restored) focusTarget();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {initializePhotoWall:initializePhotoWall};
  if (typeof window !== 'undefined' && typeof document !== 'undefined') initializePhotoWall(window, document);
})();
