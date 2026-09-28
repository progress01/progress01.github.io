/* global CONFIG, NexT, pjax, LocalSearch, NavigationSearch */

document.addEventListener('DOMContentLoaded', () => {
  if (!CONFIG.path) {
    // Search DB path
    console.warn('`hexo-generator-searchdb` plugin is not installed!');
    return;
  }
  const localSearch = new LocalSearch({
    path             : CONFIG.path,
    top_n_per_article: CONFIG.localsearch.top_n_per_article,
    unescape         : CONFIG.localsearch.unescape
  });

  const input = document.querySelector('.search-input');
  const container = document.querySelector('.search-result-container');
  const overlay = document.querySelector('.search-pop-overlay');
  const popup = document.querySelector('.search-popup');
  const closeButton = document.querySelector('.popup-btn-close');
  const emptyMessageTemplate = CONFIG.i18n.empty || '找不到與「${query}」相關的文章或紀錄';
  const recentMarkup = container.innerHTML;
  const filterElements = [...popup.querySelectorAll('[data-navigation-filter]')];
  const filters = { source: 'all', category: 'all', month: 'all' };
  let records = [];
  let selectedCategory = 'all';
  let searchState = 'idle';
  const viewStateKey = 'navigation-search-view-state-v1';
  let restoreRequested = false;
  let viewStateRestored = false;
  let searchTrigger;
  let focusTimer;
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const escapeHtml = text => text.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
  const renderEmptyState = (icon, message) => `<div class="search-empty-state"><i class="${icon} fa-3x"></i><p>${message}</p></div>`;
  const renderLoadingState = () => {
    container.innerHTML = '<div class="search-empty-state"><i class="fa fa-spinner fa-spin fa-3x"></i><p>正在載入搜尋索引……</p></div>';
  };
  const renderFailureState = () => {
    container.innerHTML = '<div class="search-empty-state"><i class="far fa-frown fa-3x"></i><p>搜尋索引暫時無法載入，請稍後重試。</p><button type="button" class="search-retry" data-search-retry>重新載入</button></div>';
  };
  const pageStateUrl = () => window.location.pathname + window.location.search + window.location.hash;
  const readViewState = () => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(viewStateKey) || 'null');
      return saved && typeof saved === 'object' ? saved : null;
    } catch (error) {
      return null;
    }
  };
  const clearViewState = () => {
    try { window.sessionStorage.removeItem(viewStateKey); } catch (error) { /* storage unavailable */ }
  };
  const saveViewState = () => {
    const existing = readViewState();
    if (!document.body.classList.contains('search-active') && (!existing || existing.url !== pageStateUrl())) return;
    try {
      window.sessionStorage.setItem(viewStateKey, JSON.stringify({
        url: pageStateUrl(),
        query: input.value,
        filters: { ...filters },
        selectedCategory,
        scrollY: window.scrollY,
        isOpen: document.body.classList.contains('search-active')
      }));
    } catch (error) {
      // 私密瀏覽或儲存空間受限時，不阻斷搜尋與文章連結。
    }
  };
  const restoreViewState = () => {
    if (!restoreRequested || viewStateRestored || searchState !== 'loaded') return;
    const saved = readViewState();
    if (!saved || saved.url !== pageStateUrl() || saved.isOpen !== true) return;
    viewStateRestored = true;
    input.value = typeof saved.query === 'string' ? saved.query : '';
    Object.keys(filters).forEach(key => {
      const value = saved.filters && typeof saved.filters[key] === 'string' ? saved.filters[key] : 'all';
      filters[key] = value;
      const select = filterElements.find(element => element.dataset.navigationFilter === key);
      if (select) select.value = value;
    });
    selectedCategory = typeof saved.selectedCategory === 'string' ? saved.selectedCategory : 'all';
    inputEventFunction();
    openPopup(null);
    if (Number.isFinite(saved.scrollY)) {
      window.setTimeout(() => window.scrollTo({ top: saved.scrollY, behavior: 'auto' }), 0);
    }
  };
  const renderRecent = (category = selectedCategory, restoreFocus = false) => {
    selectedCategory = category;
    container.innerHTML = recentMarkup;
    const recent = container.querySelector('[data-search-recent]');
    if (!recent) return;

    recent.querySelectorAll('[data-search-category]').forEach(button => {
      const isActive = button.dataset.searchCategory === selectedCategory;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const recentItems = [...recent.querySelectorAll('[data-search-recent-item]')];
    const matchingItems = selectedCategory === 'all'
      ? recentItems.filter(item => Number(item.dataset.searchRecentRank) < 10)
      : recentItems.filter(item => {
        const categories = item.dataset.searchRecentCategories.split('|');
        return categories.includes(selectedCategory);
      }).slice(0, 10);
    const visibleSet = new Set(matchingItems);
    const visibleItems = recentItems.filter(item => {
      const isVisible = visibleSet.has(item);
      item.hidden = !isVisible;
      return isVisible;
    });
    const recentNote = recent.querySelector('[data-search-recent-note]');
    if (recentNote) recentNote.textContent = selectedCategory === 'all' ? '最近 10 篇' : '分類內最新 10 篇';
    const emptyState = recent.querySelector('[data-search-recent-empty]');
    if (emptyState) emptyState.hidden = visibleItems.length > 0;
    if (restoreFocus) {
      const selectedButton = [...recent.querySelectorAll('[data-search-category]')]
        .find(button => button.dataset.searchCategory === selectedCategory);
      if (selectedButton) selectedButton.focus();
    }
  };

  const parseSearchData = responseText => NavigationSearch.parse(responseText);

  const populateFilters = () => {
    const choices = {
      category: [...new Set(records.flatMap(record => record.categories))].sort(),
      month: [...new Set(records.flatMap(record => record.events.map(event => event.date.slice(0, 7))))].sort().reverse()
    };
    filterElements.forEach(select => {
      const key = select.dataset.navigationFilter;
      if (choices[key]) select.innerHTML = select.options[0].outerHTML + choices[key].map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      select.disabled = false;
      select.value = filters[key];
    });
  };

  const fetchSearchData = () => {
    if (searchState === 'loading' || searchState === 'loaded') return;
    searchState = 'loading';
    renderLoadingState();
    fetch('/navigation-index.json')
      .then(response => {
        if (!response.ok) throw new Error(`search index request failed (${response.status})`);
        return response.text();
      })
      .then(responseText => {
        records = parseSearchData(responseText);
        populateFilters();
        localSearch.isfetched = true;
        searchState = 'loaded';
        window.dispatchEvent(new Event('search:loaded'));
      })
      .catch(error => {
        localSearch.isfetched = false;
        searchState = 'error';
        console.error(error);
        renderFailureState();
      });
  };
  localSearch.fetchData = fetchSearchData;

  const inputEventFunction = () => {
    if (searchState !== 'loaded') return;
    const searchText = input.value.trim();
    const resultItems = NavigationSearch.search(records, searchText, filters);
    if (!searchText && Object.values(filters).every(value => value === 'all')) {
      renderRecent(selectedCategory);
    } else if (resultItems.length === 0) {
      const message = searchText ? emptyMessageTemplate.replace('${query}', escapeHtml(searchText)) : '沒有符合目前篩選條件的紀錄';
      container.innerHTML = renderEmptyState('far fa-frown', message);
    } else {
      const stats = `找到 ${resultItems.length} 筆紀錄`;

      container.innerHTML = `<div class="search-stats">${stats}</div>
        <hr>
        <ul class="search-result-list">${resultItems.map(result => NavigationSearch.render(result, searchText)).join('')}</ul>`;
      if (typeof pjax === 'object' && pjax) pjax.refresh(container);
    }
  };

  localSearch.highlightSearchWords(document.querySelector('.post-body'));
  if (CONFIG.localsearch.preload) {
    localSearch.fetchData();
  }

  input.addEventListener('input', inputEventFunction);
  filterElements.forEach(select => select.addEventListener('change', () => {
    filters[select.dataset.navigationFilter] = select.value;
    inputEventFunction();
  }));
  popup.querySelector('[data-navigation-reset]')?.addEventListener('click', () => {
    input.value = '';
    selectedCategory = 'all';
    filterElements.forEach(select => { select.value = 'all'; filters[select.dataset.navigationFilter] = 'all'; });
    clearViewState();
    inputEventFunction();
    input.focus();
  });
  window.addEventListener('search:loaded', () => {
    inputEventFunction();
    restoreViewState();
  });
  container.addEventListener('click', event => {
    const retry = event.target.closest('[data-search-retry]');
    if (retry) {
      input.focus();
      fetchSearchData();
      return;
    }
    if (event.target.closest('.search-result-title, .search-note-link')) saveViewState();
    const button = event.target.closest('[data-search-category]');
    if (!button || input.value.trim()) return;
    renderRecent(button.dataset.searchCategory, true);
  });

  const openPopup = trigger => {
    const wasOpen = document.body.classList.contains('search-active');
    if (!wasOpen && trigger && trigger !== popup && typeof trigger.focus === 'function') searchTrigger = trigger;
    NexT.utils.setGutter();
    document.body.classList.add('search-active');
    overlay.setAttribute('aria-hidden', 'false');
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      focusTimer = null;
      if (document.body.classList.contains('search-active')) input.focus();
    }, 500);
    if (searchState !== 'loaded') fetchSearchData();
  };

  const navigationEntry = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
    ? performance.getEntriesByType('navigation')[0]
    : null;
  restoreRequested = navigationEntry && (navigationEntry.type === 'back_forward' || navigationEntry.type === 'reload');
  window.addEventListener('pageshow', event => {
    if (event.persisted) restoreRequested = true;
    restoreViewState();
  });
  window.addEventListener('pagehide', saveViewState);

  // Handle and trigger popup window
  document.querySelectorAll('.popup-trigger').forEach(element => {
    element.setAttribute('tabindex', '0');
    element.addEventListener('click', () => openPopup(element));
    if (element.tagName !== 'BUTTON') {
      element.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openPopup(element);
      });
    }
  });

  // Monitor main search box
  const onPopupClose = () => {
    clearTimeout(focusTimer);
    focusTimer = null;
    NexT.utils.setGutter('0');
    document.body.classList.remove('search-active');
    if (searchTrigger && document.contains(searchTrigger)) searchTrigger.focus();
    overlay.setAttribute('aria-hidden', 'true');
    searchTrigger = null;
  };

  document.querySelector('.search-pop-overlay').addEventListener('click', event => {
    if (event.target === document.querySelector('.search-pop-overlay')) {
      onPopupClose();
    }
  });
  closeButton.addEventListener('click', onPopupClose);
  document.addEventListener('pjax:success', () => {
    localSearch.highlightSearchWords(document.querySelector('.post-body'));
    onPopupClose();
  });
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      const activeElement = document.activeElement;
      const trigger = activeElement === document.body
        ? [...document.querySelectorAll('.popup-trigger')].find(element => {
          if (element.hidden || element.closest('[hidden]')) return false;
          return typeof element.getClientRects !== 'function' || element.getClientRects().length > 0;
        })
        : activeElement;
      openPopup(trigger);
      return;
    }
    if (!document.body.classList.contains('search-active')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onPopupClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...popup.querySelectorAll(focusableSelector)]
        .filter(element => {
          if (element.hidden || element.closest('[hidden]') || element.getAttribute('aria-hidden') === 'true') return false;
          return typeof element.getClientRects !== 'function' || element.getClientRects().length > 0;
        });
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!popup.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
});
