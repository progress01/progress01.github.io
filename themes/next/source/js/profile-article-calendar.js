'use strict';

(function(global) {
  const ROOT_SELECTOR = '[data-profile-article-calendar]';
  const installedKey = '__profileArticleCalendarInstalled';
  const instances = new Map();

  function latestDate(postsByDate, year) {
    return Object.keys(postsByDate || {}).filter(date => date.startsWith(`${year}-`)).sort().pop() || '';
  }

  function countFor(counts, date) {
    return Math.max(0, Number(counts?.[date]) || 0);
  }

  function normalizeDate(value) {
    if (Array.isArray(value)) value = value[0];
    if (value && typeof value === 'object' && Array.isArray(value.value)) value = value.value[0];
    const date = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  }

  function appendArticle(parent, article) {
    const link = global.document.createElement('a');
    link.className = 'profile-calendar-article';
    link.href = article.url;
    const label = global.document.createElement('span');
    label.className = 'profile-calendar-event-label';
    label.dataset.eventType = article.eventType;
    label.textContent = article.eventLabel;
    const title = global.document.createElement('span');
    title.className = 'profile-calendar-article-title';
    title.textContent = article.title;
    link.append(label, title);
    parent.appendChild(link);
  }

  function showDate(root, payload, date) {
    const heading = root.querySelector('[data-profile-calendar-detail-heading]');
    const updates = root.querySelector('[data-profile-calendar-updates]');
    const controls = root.querySelector('[data-profile-calendar-controls]');
    if (!heading || !updates || !controls) return;
    const articles = payload.postsByDate?.[date] || [];
    heading.textContent = articles.length ? `${date} 文章活動` : `${date} 沒有文章活動`;
    updates.replaceChildren();
    if (!articles.length) {
      const empty = global.document.createElement('p');
      empty.className = 'profile-calendar-fallback';
      empty.textContent = '這天沒有可顯示的文章活動。';
      updates.appendChild(empty);
    } else {
      articles.forEach(article => appendArticle(updates, article));
    }
    controls.querySelectorAll('button[data-profile-calendar-date]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.profileCalendarDate === date));
    });
  }

  function buildControls(root, payload, chart) {
    const controls = root.querySelector('[data-profile-calendar-controls]');
    if (!controls) return;
    controls.replaceChildren();
    const year = Number(payload.latestYear);
    const firstDay = new Date(year, 0, 1).getDay();
    const leap = new Date(year, 1, 29).getMonth() === 1;
    const totalDays = leap ? 366 : 365;
    for (let offset = 0; offset < totalDays; offset += 1) {
      const date = new Date(year, 0, offset + 1);
      const key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const count = countFor(payload.counts, key);
      if (!count) continue;
      const button = global.document.createElement('button');
      button.type = 'button';
      button.className = 'profile-calendar-day-control';
      button.dataset.profileCalendarDate = key;
      button.style.gridColumn = String(Math.floor((firstDay + offset) / 7) + 1);
      button.style.gridRow = String(date.getDay() + 1);
      button.setAttribute('aria-label', `${key}，${count} 次工作與學習文章活動`);
      button.setAttribute('aria-pressed', 'false');
      button.title = `${key}：${count} 次文章活動`;
      button.addEventListener('click', () => showDate(root, payload, key));
      controls.appendChild(button);
    }
    if (chart && typeof chart.on === 'function') {
      chart.on('click', params => {
        const date = normalizeDate(params?.data || params?.value);
        if (date.startsWith(`${payload.latestYear}-`)) showDate(root, payload, date);
      });
    }
  }

  function disposeAll() {
    for (const [root, state] of instances) {
      global.removeEventListener('resize', state.resize);
      try { state.chart?.dispose?.(); } catch { /* A detached chart must not block navigation. */ }
      const element = root.querySelector('#profile-calendar-chart');
      try {
        const existing = global.echarts?.getInstanceByDom?.(element);
        existing?.dispose?.();
      } catch { /* ECharts may already have released the instance. */ }
    }
    instances.clear();
  }

  function initialize(root) {
    if (instances.has(root)) return;
    const payloadNode = root.querySelector('[data-profile-calendar-data]');
    const chartElement = root.querySelector('#profile-calendar-chart');
    const status = root.querySelector('[data-profile-calendar-status]');
    if (!payloadNode || !chartElement || !status) return;
    let payload;
    try { payload = JSON.parse(payloadNode.textContent || '{}'); }
    catch { status.textContent = '日曆資料讀取失敗；可從文章庫閱讀全部文章。'; return; }
    const counts = payload.counts || {};
    const dates = Object.keys(counts).filter(date => date.startsWith(`${payload.latestYear}-`)).sort();
    const fallback = chartElement.querySelector('[data-profile-calendar-fallback]');
    if (!global.Calendar?.init || !global.echarts || !payload.latestYear || !dates.length) {
      status.textContent = `共 ${Number(payload.articleTotal) || 0} 篇文章，${dates.length} 個活動日期；熱力圖無法載入。`;
      return;
    }
    fallback?.remove();
    const maxValue = Math.max(1, ...dates.map(date => countFor(counts, date)));
    const styles = global.getComputedStyle(root);
    const color = name => styles.getPropertyValue(`--surface-${name}`).trim();
    const chart = global.Calendar.init(chartElement.id, {
      data: counts,
      year: payload.latestYear,
      maxValue,
      colors: [color('panel'), color('border'), color('accent'), color('accent-strong')].filter(Boolean),
      visualMap: { show: false },
      tooltipUnit: '次活動'
    });
    if (!chart) {
      status.textContent = '熱力圖無法載入；可從文章庫閱讀全部文章。';
      return;
    }
    const resize = () => { try { chart.resize(); } catch { /* Detached charts are disposed on PJAX send. */ } };
    global.addEventListener('resize', resize, { passive: true });
    buildControls(root, payload, chart);
    const initialDate = latestDate(payload.postsByDate, payload.latestYear);
    if (initialDate) showDate(root, payload, initialDate);
    instances.set(root, { chart, resize });
  }

  function boot() {
    global.document.querySelectorAll(ROOT_SELECTOR).forEach(initialize);
  }

  if (global.document) {
    if (!global[installedKey]) {
      global[installedKey] = true;
      global.document.addEventListener('pjax:send', disposeAll);
      global.document.addEventListener('pjax:success', boot);
      global.addEventListener('pagehide', disposeAll);
      global.addEventListener('pageshow', boot);
      if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot, { once: true });
    }
    boot();
  }

  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({ latestDate, countFor, normalizeDate });
})(typeof window === 'undefined' ? globalThis : window);
