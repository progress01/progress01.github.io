/* Category and tag archives share one progressively enhanced browser. */
(function() {
  'use strict';
  function init() {
    const root = document.querySelector('[data-content-browser]');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';
    const entries = [...root.querySelectorAll('[data-browse-item]')].map(node => ({
      node, categories: JSON.parse(node.dataset.categories), tags: JSON.parse(node.dataset.tags)
    }));
    const categoryBox = root.querySelector('[data-browse-categories]');
    const tagBox = root.querySelector('[data-browse-tags]');
    const summary = root.querySelector('[data-browse-summary]');
    const categories = [...new Set(entries.flatMap(entry => entry.categories))];
    let category = '', tag = '';
    function buttons(box, values, selected, kind, candidates) {
      box.replaceChildren();
      for (const value of ['', ...values]) {
        const button = document.createElement('button');
        const count = candidates.filter(entry => !value || entry[kind].includes(value)).length;
        button.type = 'button';
        button.dataset.browseKind = kind;
        button.dataset.browseValue = value;
        button.setAttribute('aria-pressed', String(value === selected));
        button.textContent = (value || '全部') + '（' + count + '）';
        box.appendChild(button);
      }
    }
    function render() {
      if (!categories.includes(category)) category = '';
      const candidates = entries.filter(entry => !category || entry.categories.includes(category));
      const tags = [...new Set(candidates.flatMap(entry => entry.tags))];
      if (!tags.includes(tag)) tag = '';
      buttons(categoryBox, categories, category, 'categories', entries);
      buttons(tagBox, tags, tag, 'tags', candidates);
      let count = 0;
      entries.forEach(entry => {
        entry.node.hidden = Boolean((category && !entry.categories.includes(category)) || (tag && !entry.tags.includes(tag)));
        if (!entry.node.hidden) count++;
      });
      summary.textContent = (category || '全部分類') + ' / ' + (tag || '全部標籤') + ' · ' + count + ' 篇文章';
      root.querySelector('.content-browser-controls').hidden = false;
    }
    function readLocation() {
      const params = new URLSearchParams(location.search);
      category = params.has('category') ? params.get('category') : root.dataset.category || '';
      tag = params.has('tag') ? params.get('tag') : root.dataset.tag || '';
      render();
    }
    function saveLocation() {
      const url = new URL(location.href);
      // Keep explicit empty values to override defaults when clearing an old archive URL.
      url.searchParams.set('category', category);
      url.searchParams.set('tag', tag);
      url.hash = '';
      history.pushState(null, '', url);
    }
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button)) return;
      const kind = button.dataset.browseKind;
      if (button.hasAttribute('data-browse-clear')) { category = ''; tag = ''; }
      else if (kind === 'categories') { category = button.dataset.browseValue; }
      else if (kind === 'tags') { tag = button.dataset.browseValue; }
      else return;
      render();
      saveLocation();
      if (kind) {
        const box = kind === 'categories' ? categoryBox : tagBox;
        [...box.querySelectorAll('button')].find(item => item.getAttribute('aria-pressed') === 'true')?.focus({ preventScroll: true });
      }
    });
    window.addEventListener('popstate', () => { if (root.isConnected) readLocation(); });
    readLocation();
    if (location.hash === '#browse-tags') tagBox.querySelector('button')?.focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:success', init);
})();
