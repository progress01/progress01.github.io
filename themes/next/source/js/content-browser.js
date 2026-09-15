/* Category and topic archives share one progressively enhanced browser. */
(function() {
  'use strict';

  function readJson(value) {
    try { return JSON.parse(value || '[]'); }
    catch (error) { return []; }
  }

  function init() {
    const root = document.querySelector('[data-content-browser]');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';

    const entries = [...root.querySelectorAll('[data-browse-item]')].map(node => ({
      node,
      categories: readJson(node.dataset.categories),
      tags: readJson(node.dataset.tags)
    }));
    const categoryBox = root.querySelector('[data-browse-categories]');
    const summary = root.querySelector('[data-browse-summary]');
    const clearButton = root.querySelector('[data-browse-clear]');
    const archiveCategory = root.dataset.category || '';
    const archiveTag = root.dataset.tag || '';
    const categories = [...new Set(entries.flatMap(entry => entry.categories))];
    const topicValues = [...new Set(readJson(root.dataset.tagTopics))]
      .filter(value => entries.some(entry => entry.tags.includes(value)));
    const state = { category: '', topic: '' };
    let activePanel = false;
    let lastFocused = null;

    function filtered(overrides) {
      const selected = { ...state, ...(overrides || {}) };
      return entries.filter(entry =>
        (!archiveCategory || entry.categories.includes(archiveCategory)) &&
        (!archiveTag || entry.tags.includes(archiveTag)) &&
        (!selected.category || entry.categories.includes(selected.category)) &&
        (!selected.topic || entry.tags.includes(selected.topic))
      );
    }

    function countFor(kind, value) {
      if (kind === 'categories') {
        return filtered({ category: '' }).filter(entry => !value || entry.categories.includes(value)).length;
      }
      return filtered({ topic: '' }).filter(entry => !value || entry.tags.includes(value)).length;
    }

    function topicValuesForCurrentCategory() {
      if (!state.category) return state.topic ? [state.topic] : [];
      const used = new Set(filtered({ topic: '' }).flatMap(entry => entry.tags));
      const values = topicValues.filter(value => used.has(value));
      if (state.topic && !values.includes(state.topic)) values.push(state.topic);
      return values;
    }

    function topicAppliesToCategory(value) {
      if (!value || !state.category) return true;
      return entries.some(entry => entry.categories.includes(state.category) && entry.tags.includes(value));
    }

    function makeButton({ kind, value, count, selected, disabled }) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.browseKind = kind;
      button.dataset.browseValue = value;
      button.setAttribute('aria-pressed', String(value === selected));
      button.textContent = (value || '全部') + '（' + count + '）';
      if (disabled) button.disabled = true;
      return button;
    }

    function renderCategories() {
      categoryBox.replaceChildren();
      categories.forEach(value => {
        const count = countFor('categories', value);
        categoryBox.appendChild(makeButton({
          kind: 'categories', value, count, selected: state.category,
          // Keep zero-count categories available while a topic is selected so
          // choosing another category can clear an inapplicable topic.
          disabled: count === 0 && value !== state.category && !state.topic
        }));
      });
    }

    function renderOptions() {
      const options = root.querySelector('[data-browse-options="topics"]');
      if (!options) return;
      const selected = state.topic;
      const input = root.querySelector('[data-browse-search="topics"]');
      const query = (input?.value || '').trim().toLocaleLowerCase();
      options.replaceChildren();
      for (const value of ['', ...topicValuesForCurrentCategory()]) {
        if (value && query && !value.toLocaleLowerCase().includes(query) && value !== selected) continue;
        const count = countFor('topics', value);
        const button = makeButton({
          kind: 'topics', value, count, selected,
          disabled: count === 0 && value !== selected
        });
        button.classList.add('content-browser-option');
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(value === selected));
        options.appendChild(button);
      }
      if (!options.children.length) {
        const empty = document.createElement('p');
        empty.className = 'content-browser-options-empty';
        empty.textContent = '沒有符合的選項';
        options.appendChild(empty);
      }
    }

    function render() {
      if (state.category && !categories.includes(state.category)) state.category = '';
      if (state.topic && !topicValues.includes(state.topic)) state.topic = '';
      if (!topicAppliesToCategory(state.topic)) state.topic = '';
      if (!state.category && activePanel) closePanel(false);
      renderCategories();

      const label = root.querySelector('[data-browse-label="topics"]');
      const count = root.querySelector('[data-browse-selected-count="topics"]');
      const trigger = root.querySelector('[data-browse-open="topics"]');
      if (label) label.textContent = state.topic || '尚未選擇';
      if (trigger) {
        const disabled = !state.category;
        trigger.disabled = disabled;
        trigger.setAttribute('aria-disabled', String(disabled));
        if (disabled) trigger.setAttribute('aria-expanded', 'false');
        const action = trigger.querySelector('[data-browse-action="topics"]');
        if (action) action.textContent = disabled ? '先選分類' : state.topic ? '更換主題' : '挑選主題';
      }
      if (count) count.textContent = '（' + filtered().length + '）';
      renderOptions();

      const visible = filtered();
      const visibleSet = new Set(visible);
      entries.forEach(entry => { entry.node.hidden = !visibleSet.has(entry); });
      const parts = [state.category || '全部分類', state.topic || '全部主題'];
      summary.textContent = parts.join(' / ') + ' · ' + visible.length + ' 篇文章';
      clearButton.disabled = !state.category && !state.topic;
      root.querySelector('.content-browser-controls').hidden = false;
    }

    function closePanel(restoreFocus) {
      if (!activePanel) return;
      const panel = root.querySelector('[data-browse-panel="topics"]');
      const trigger = root.querySelector('[data-browse-open="topics"]');
      if (panel) panel.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      activePanel = false;
      const input = root.querySelector('[data-browse-search="topics"]');
      if (input) {
        input.value = '';
        renderOptions();
      }
      const target = restoreFocus === false ? null : lastFocused || trigger;
      lastFocused = null;
      target?.focus({ preventScroll: true });
    }

    function openPanel(trigger) {
      if (!state.category) return;
      const panel = root.querySelector('[data-browse-panel="topics"]');
      if (!panel) return;
      activePanel = true;
      lastFocused = trigger;
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const input = panel.querySelector('[data-browse-search="topics"]');
      if (input) window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    function saveLocation() {
      const url = new URL(location.href);
      url.searchParams.set('category', state.category);
      url.searchParams.set('topic', state.topic);
      url.searchParams.delete('property');
      url.searchParams.set('tag', state.topic || '');
      url.hash = '';
      history.pushState(null, '', url);
    }

    function cleanLegacyLocation(params) {
      const url = new URL(location.href);
      let changed = false;
      if (url.searchParams.has('property')) {
        url.searchParams.delete('property');
        changed = true;
      }
      const legacyTag = params.has('tag') ? params.get('tag') : root.dataset.tag || '';
      if (legacyTag && !topicValues.includes(legacyTag) && url.searchParams.has('tag')) {
        url.searchParams.delete('tag');
        changed = true;
      }
      if (changed) history.replaceState(null, '', url);
    }

    function setFromLocation() {
      const params = new URLSearchParams(location.search);
      const legacyTag = params.has('tag') ? params.get('tag') : root.dataset.tag || '';
      state.category = params.has('category') ? params.get('category') : root.dataset.category || '';
      state.topic = params.has('topic') ? params.get('topic') : '';
      if (!state.topic && topicValues.includes(legacyTag)) state.topic = legacyTag;
      cleanLegacyLocation(params);
      render();
    }

    root.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target || !root.contains(target)) return;
      if (target.hasAttribute('data-browse-open')) { openPanel(target); return; }
      if (target.hasAttribute('data-browse-close')) { closePanel(true); return; }
      if (target.hasAttribute('data-browse-clear')) {
        state.category = ''; state.topic = '';
        render(); saveLocation();
        if (activePanel) closePanel(false);
        target.focus({ preventScroll: true });
        return;
      }
      const kind = target.dataset.browseKind;
      if (kind === 'categories') {
        state.category = target.dataset.browseValue;
        const input = root.querySelector('[data-browse-search="topics"]');
        if (input) input.value = '';
        render(); saveLocation();
        return;
      }
      if (kind === 'topics') {
        state.topic = target.dataset.browseValue;
        render(); saveLocation(); closePanel(true);
      }
    });

    root.addEventListener('input', event => {
      const input = event.target.closest('[data-browse-search="topics"]');
      if (!input) return;
      renderOptions();
    });

    root.addEventListener('keydown', event => {
      if (!activePanel) return;
      if (event.key === 'Escape') {
        event.preventDefault(); closePanel(true); return;
      }
    });

    window.addEventListener('popstate', () => { if (root.isConnected) setFromLocation(); });
    setFromLocation();
    if (location.hash === '#browse-tags') root.querySelector('[data-browse-open="topics"]')?.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:success', init);
})();
