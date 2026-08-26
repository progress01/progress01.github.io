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
  const emptyMessageTemplate = CONFIG.i18n.empty || '找不到與「${query}」相關的文章或紀錄';
  const recentMarkup = container.innerHTML;
  let selectedCategory = 'all';
  const escapeHtml = text => text.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
  const renderEmptyState = (icon, message) => `<div class="search-empty-state"><i class="${icon} fa-3x"></i><p>${message}</p></div>`;
  const renderRecent = (category = selectedCategory) => {
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
  };

  const inputEventFunction = () => {
    if (!localSearch.isfetched) return;
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
    const button = event.target.closest('[data-search-category]');
    if (!button || input.value.trim()) return;
    renderRecent(button.dataset.searchCategory);
  });

  // Handle and trigger popup window
  document.querySelectorAll('.popup-trigger').forEach(element => {
    element.addEventListener('click', () => {
      NexT.utils.setGutter();
      document.body.classList.add('search-active');
      // Wait for search-popup animation to complete
      setTimeout(() => input.focus(), 500);
      if (!localSearch.isfetched) localSearch.fetchData();
    });
  });

  // Monitor main search box
  const onPopupClose = () => {
    NexT.utils.setGutter('0');
    document.body.classList.remove('search-active');
  };

  document.querySelector('.search-pop-overlay').addEventListener('click', event => {
    if (event.target === document.querySelector('.search-pop-overlay')) {
      onPopupClose();
    }
  });
  document.querySelector('.popup-btn-close').addEventListener('click', onPopupClose);
  document.addEventListener('pjax:success', () => {
    localSearch.highlightSearchWords(document.querySelector('.post-body'));
    onPopupClose();
  });
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      NexT.utils.setGutter();
      document.body.classList.add('search-active');
      setTimeout(() => input.focus(), 500);
      if (!localSearch.isfetched) localSearch.fetchData();
    }
  });
  window.addEventListener('keyup', event => {
    if (event.key === 'Escape') {
      onPopupClose();
    }
  });
});
