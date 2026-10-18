/* Shared search logic and recent-list DOM rendering, exercised by Node regression tests. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NavigationSearch = factory();
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const labels = { article: '文章', microblog: '碎碎念', learning: '學習筆記' };
  const surfaceLabels = { profile: '工作與學習', memory: '個人記憶庫' };
  const dateLabels = { published: '發表', recorded: '記錄', 'learning-added': '加入學習' };
  const scopes = new Set(['profile', 'memory', 'all']);
  const validSurfaces = surfaces => Array.isArray(surfaces) &&
    (surfaces.length === 1 && (surfaces[0] === 'profile' || surfaces[0] === 'memory') ||
      surfaces.length === 2 && surfaces[0] === 'profile' && surfaces[1] === 'memory');
  function defaultSurface(pathname, articlePage = false) {
    const path = typeof pathname === 'string' ? pathname : '/';
    if (path === '/' || path === '/profile' || path.startsWith('/profile/')) return 'profile';
    if (articlePage) return 'all';
    return 'memory';
  }
  function resetFilters(defaultScope) {
    return { surface: scopes.has(defaultScope) && defaultScope !== 'all' ? defaultScope : 'all', source: 'all', category: 'all', month: 'all' };
  }
  function canRestoreViewState(saved, url, requested) {
    return Boolean(requested && saved && typeof saved === 'object' && saved.url === url && scopes.has(saved.surface));
  }
  function recentIndexes(items, surface, category = 'all') {
    const eligible = items.map((item, index) => ({ item, index }))
      .filter(({ item }) => surface === 'all' || item.surfaces.includes(surface))
      .filter(({ item }) => category === 'all' || item.categories.includes(category));
    return new Set(eligible.slice(0, 10).map(({ index }) => index));
  }
  function recentArticles(records, surface, category = 'all') {
    const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
    return records.filter(record => record.kind === 'article' &&
      (surface === 'all' || record.surfaces.includes(surface)) &&
      (category === 'all' || record.categories.includes(category)))
      .slice().sort((a, b) => compareText(String(b.publishedAt || b.date || ''), String(a.publishedAt || a.date || '')) ||
        compareText(a.url, b.url)).slice(0, 10);
  }
  function renderRecent(document, recent, records, surface, category = 'all', restoreFocus = false) {
    recent.querySelectorAll('[data-search-category]').forEach(button => {
      const active = button.dataset.searchCategory === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const list = recent.querySelector('[data-search-recent-list]');
    if (!list) return [];
    list.replaceChildren();
    const selected = recentArticles(records, surface, category);
    selected.forEach(record => {
      const link = document.createElement('a');
      link.className = 'search-recent-item';
      link.href = record.url;
      link.dataset.searchRecentItem = '';
      const date = document.createElement('time');
      date.className = 'search-recent-date';
      date.dateTime = record.publishedAt || record.date || '';
      date.textContent = record.date ? record.date.slice(5) : '';
      const copy = document.createElement('span');
      copy.className = 'search-recent-copy';
      const categories = document.createElement('span');
      categories.className = 'search-recent-category';
      categories.textContent = record.categories.join(' / ');
      const title = document.createElement('span');
      title.className = 'search-recent-title';
      title.textContent = record.title;
      copy.append(categories, title);
      const arrow = document.createElement('span');
      arrow.className = 'search-recent-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      link.append(date, copy, arrow);
      list.append(link);
    });
    const note = recent.querySelector('[data-search-recent-note]');
    if (note) note.textContent = category === 'all' ? '最近 10 篇' : '分類內最新 10 篇';
    const empty = recent.querySelector('[data-search-recent-empty]');
    if (empty) empty.hidden = selected.length > 0;
    if (restoreFocus) [...recent.querySelectorAll('[data-search-category]')]
      .find(button => button.dataset.searchCategory === category)?.focus();
    return selected;
  }
  const tokens = query => [...new Set(String(query).trim().toLowerCase().split(/\s+/).filter(Boolean))];
  const safeLocal = url => typeof url === 'string' && /^\/(?!\/)/.test(url) && !/[\\\u0000-\u001f\u007f]/.test(url);
  const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function parse(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Navigation index is invalid JSON'); }
    if (data?.schemaVersion !== 1 || !Array.isArray(data.records)) throw new Error('Navigation index schema is invalid');
    const ids = new Set();
    for (const record of data.records) {
      if (!record || typeof record.id !== 'string' || ids.has(record.id) || !labels[record.kind] || !validSurfaces(record.surfaces) ||
          typeof record.title !== 'string' || typeof record.text !== 'string' || !safeLocal(record.url) ||
          Object.prototype.hasOwnProperty.call(record, 'publishedAt') && (typeof record.publishedAt !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.publishedAt) ||
            Number.isNaN(Date.parse(record.publishedAt)) || new Date(record.publishedAt).toISOString() !== record.publishedAt) ||
          !Array.isArray(record.sources) || !record.sources.length || record.sources.some(value => !labels[value]) ||
          !Array.isArray(record.categories) || record.categories.some(value => typeof value !== 'string') ||
          !Array.isArray(record.tags) || record.tags.some(value => typeof value !== 'string') ||
          !Array.isArray(record.events) || record.events.some(event => !dateLabels[event.kind] || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) ||
          !Array.isArray(record.learningItems) || record.learningItems.some(item => !/^[a-z][a-z0-9-]*$/.test(item.id))) {
        throw new Error('Navigation index record is invalid');
      }
      ids.add(record.id);
    }
    return data.records;
  }
  function matches(text, words) {
    const normalized = String(text).toLowerCase();
    return words.every(word => normalized.includes(word));
  }
  function eventsFor(record, source) {
    const kind = { article: 'published', microblog: 'recorded', learning: 'learning-added' }[source];
    return record.events.filter(event => !kind || event.kind === kind);
  }
  function search(records, query, filters = {}) {
    const words = tokens(query);
    const seenIds = new Set();
    return records.filter(record => {
      if (!record || typeof record.id !== 'string' || seenIds.has(record.id)) return false;
      seenIds.add(record.id);
      if (filters.surface && filters.surface !== 'all' && !record.surfaces.includes(filters.surface)) return false;
      if (filters.source && filters.source !== 'all' && !record.sources.includes(filters.source)) return false;
      if (filters.category && filters.category !== 'all' && !record.categories.includes(filters.category)) return false;
      if (filters.month && filters.month !== 'all' && !eventsFor(record, filters.source).some(event => event.date.startsWith(filters.month))) return false;
      return matches([record.title, record.text, ...record.categories, ...record.tags].join(' '), words);
    }).map(record => {
      const passage = words.length && (record.passages || []).find(item => matches(item.text, words));
      const learning = words.length && record.learningItems.find(item => matches([item.title, item.note, item.topic, item.source].join(' '), words));
      let href = record.url, locationLabel = '開啟文章';
      if (record.kind === 'microblog') { href += '#' + encodeURIComponent(record.id); locationLabel = '定位這則碎碎念'; }
      else if (record.kind === 'learning') { href += '#' + encodeURIComponent(record.learningItems[0].id); locationLabel = '定位學習紀錄'; }
      else if (passage) { href += '#' + encodeURIComponent(passage.id); locationLabel = '定位命中段落'; }
      const text = passage ? passage.text : learning ? [learning.title, learning.note, learning.source].filter(Boolean).join(' — ') : record.text;
      const lower = text.toLowerCase();
      const hit = words.map(word => lower.indexOf(word)).filter(index => index >= 0).sort((a, b) => a - b)[0] || 0;
      const start = Math.max(0, hit - 35);
      const snippet = (start ? '…' : '') + text.slice(start, start + 180) + (text.length > start + 180 ? '…' : '');
      const score = words.length ? (matches(record.title, words) ? 100 : 0) + words.reduce((sum, word) => sum + (record.title.toLowerCase().includes(word) ? 10 : 1), 0) : 0;
      return { record, href, locationLabel, snippet, learning, score };
    }).sort((a, b) => b.score - a.score || String(b.record.date || '').localeCompare(String(a.record.date || '')) || a.record.id.localeCompare(b.record.id));
  }
  // Mark text after escaping each range. Query text is never treated as HTML or regex.
  function highlight(text, query) {
    text = String(text);
    const lower = text.toLowerCase(), ranges = [];
    for (const word of tokens(query)) {
      let start = lower.indexOf(word);
      while (start >= 0) { ranges.push([start, start + word.length]); start = lower.indexOf(word, start + word.length); }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push(range.slice());
    }
    let html = '', cursor = 0;
    for (const [start, end] of merged) { html += escape(text.slice(cursor, start)) + '<mark>' + escape(text.slice(start, end)) + '</mark>'; cursor = end; }
    return html + escape(text.slice(cursor));
  }
  function render(result, query) {
    const { record, href, locationLabel, snippet, learning } = result;
    const dates = [...new Set(record.events.map(event => dateLabels[event.kind] + ' ' + event.date))].join(' · ') || '未標日期';
    const detail = learning ? `<a class="search-note-link" data-pjax="false" href="/reading/#${escape(learning.id)}">查看命中的學習附註</a>` : '';
    const surfaceLabel = record.surfaces.map(surface => surfaceLabels[surface]).join('・');
    return `<li><a class="search-result-title" data-pjax="false" href="${escape(href)}">${highlight(record.title, query)}</a>` +
      `<div class="search-result-meta">${escape(record.sources.map(source => labels[source]).join(' / '))} · ${escape(record.categories.join(' / ') || '未分類')}<br>${escape(dates)}</div>` +
      `<div class="search-result-surfaces">收錄於：${escape(surfaceLabel)}</div>` +
      `<p class="search-result">${highlight(snippet, query)}</p><div class="search-result-location">${escape(locationLabel)}${detail ? ' · ' + detail : ''}</div></li>`;
  }
  return { labels, surfaceLabels, parse, tokens, search, render, highlight, eventsFor, defaultSurface, resetFilters, canRestoreViewState, recentIndexes, recentArticles, renderRecent };
});
