'use strict';

(function(global) {
  function readTagFilter(hash, allowedTags) {
    if (typeof hash !== 'string' || !hash.startsWith('#tag=')) return null;
    let tag;
    try { tag = decodeURIComponent(hash.slice(5)); }
    catch { return null; }
    return allowedTags.has(tag) ? tag : null;
  }

  function serializeTagFilter(tag) {
    return tag ? `#tag=${encodeURIComponent(tag)}` : '';
  }

  function articleMatchesTag(tags, tag) {
    return !tag || tags.includes(tag);
  }

  function initialize(root, windowObject) {
    const controls = root.querySelector('[data-profile-tag-filters]');
    const rows = [...root.querySelectorAll('[data-profile-article-row]')];
    const allButton = root.querySelector('[data-profile-tag-all]');
    const tagButtons = [...root.querySelectorAll('button[data-profile-tag]')];
    const count = root.querySelector('[data-profile-result-count]');
    const empty = root.querySelector('[data-profile-filter-empty]');
    if (!controls || !allButton || !count || !rows.length) return false;

    const allowedTags = new Set(tagButtons.map(button => button.dataset.profileTag));
    let selectedTag = null;

    function render() {
      selectedTag = readTagFilter(windowObject.location.hash, allowedTags);
      let visible = 0;
      rows.forEach(row => {
        const tags = [...row.querySelectorAll('[data-profile-article-tag]')]
          .map(element => element.dataset.profileArticleTag);
        const matches = articleMatchesTag(tags, selectedTag);
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      allButton.classList.toggle('is-active', selectedTag === null);
      allButton.setAttribute('aria-pressed', String(selectedTag === null));
      tagButtons.forEach(button => {
        const active = button.dataset.profileTag === selectedTag;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      count.textContent = `${selectedTag || '全部'} ${visible}`;
      if (empty) empty.hidden = visible !== 0;
    }

    function chooseTag(tag) {
      const nextTag = tag && tag !== selectedTag ? tag : null;
      const nextHash = serializeTagFilter(nextTag);
      if (windowObject.location.hash === nextHash) render();
      else windowObject.location.hash = nextHash;
    }

    allButton.addEventListener('click', () => chooseTag(null));
    tagButtons.forEach(button => button.addEventListener('click', () => chooseTag(button.dataset.profileTag)));
    windowObject.addEventListener('hashchange', render);
    windowObject.addEventListener('popstate', render);
    render();
    controls.hidden = false;
    return true;
  }

  if (typeof module === 'object' && module.exports) module.exports = { readTagFilter, serializeTagFilter, articleMatchesTag };
  if (global.document && !global.__profileArticleFilterInstalled) {
    global.__profileArticleFilterInstalled = true;
    const initializedRoots = new WeakSet();
    function boot() {
      global.document.querySelectorAll('[data-profile-article-library]').forEach(root => {
        if (initializedRoots.has(root)) return;
        try {
          if (initialize(root, global)) initializedRoots.add(root);
        } catch { /* Keep filters hidden; the full list remains visible. */ }
      });
    }
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
    global.document.addEventListener('pjax:success', boot);
  }
})(typeof window === 'undefined' ? globalThis : window);
