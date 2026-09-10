/* global CONFIG, NexT, pjax, LocalSearch */

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
  let selectedCategory = 'all';
  let searchState = 'idle';
  let searchTrigger;
  let focusTimer;
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
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

  const stripSearchTags = value => {
    const holder = document.createElement('template');
    holder.innerHTML = value;
    return holder.content.textContent || '';
  };

  const parseSearchData = responseText => {
    const isJson = String(CONFIG.path).toLowerCase().endsWith('json');
    let data;
    if (isJson) {
      data = JSON.parse(responseText);
    } else {
      const xml = new DOMParser().parseFromString(responseText, 'text/xml');
      if (xml.querySelector('parsererror') || !xml.documentElement || xml.documentElement.nodeName.toLowerCase() !== 'search') {
        throw new Error('search index XML is invalid');
      }
      data = [...xml.querySelectorAll('entry')].map(entry => ({
        title  : entry.querySelector('title')?.textContent || '',
        content: entry.querySelector('content')?.textContent || '',
        url    : entry.querySelector('url')?.textContent || ''
      }));
    }
    if (!Array.isArray(data)) throw new Error('search index must be an array');
    return data.filter(item => item && item.title).map(item => ({
      title  : String(item.title).trim(),
      content: stripSearchTags(String(item.content || '').trim()),
      url    : decodeURIComponent(String(item.url || '')).replace(/\/{2,}/g, '/')
    })).filter(item => item.title);
  };

  const fetchSearchData = () => {
    if (searchState === 'loading' || searchState === 'loaded') return;
    searchState = 'loading';
    renderLoadingState();
    fetch(CONFIG.path)
      .then(response => {
        if (!response.ok) throw new Error(`search index request failed (${response.status})`);
        return response.text();
      })
      .then(responseText => {
        localSearch.datas = parseSearchData(responseText);
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
    const searchText = input.value.trim().toLowerCase();
    const keywords = searchText.split(/[-\s]+/);
    let resultItems = [];
    if (searchText.length > 0) {
      // Perform local searching
      resultItems = localSearch.getResultItems(keywords);
    }
    if (searchText.length === 0) {
      renderRecent(selectedCategory);
    } else if (resultItems.length === 0) {
      const message = emptyMessageTemplate.replace('${query}', escapeHtml(searchText));
      container.innerHTML = renderEmptyState('far fa-frown', message);
    } else {
      resultItems.sort((left, right) => {
        if (left.includedCount !== right.includedCount) {
          return right.includedCount - left.includedCount;
        } else if (left.hitCount !== right.hitCount) {
          return right.hitCount - left.hitCount;
        }
        return right.id - left.id;
      });
      const stats = CONFIG.i18n.hits.replace('${hits}', resultItems.length);

      container.innerHTML = `<div class="search-stats">${stats}</div>
        <hr>
        <ul class="search-result-list">${resultItems.map(result => result.item).join('')}</ul>`;
      if (typeof pjax === 'object') pjax.refresh(container);
    }
  };

  localSearch.highlightSearchWords(document.querySelector('.post-body'));
  if (CONFIG.localsearch.preload) {
    localSearch.fetchData();
  }

  input.addEventListener('input', inputEventFunction);
  window.addEventListener('search:loaded', inputEventFunction);
  container.addEventListener('click', event => {
    const retry = event.target.closest('[data-search-retry]');
    if (retry) {
      input.focus();
      fetchSearchData();
      return;
    }
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
