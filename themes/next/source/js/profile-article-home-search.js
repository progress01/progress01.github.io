(() => {
  if (window.__profileArticleHomeSearchInstalled) return;
  window.__profileArticleHomeSearchInstalled = true;
  const initialized = new WeakSet();

  const boot = () => {
    document.querySelectorAll('[data-profile-article-home]').forEach(home => {
      if (initialized.has(home)) return;
      const wrapper = home.querySelector('[data-profile-home-search]');
      const input = wrapper?.querySelector('input[type="search"]');
      const rows = [...home.querySelectorAll('[data-profile-home-article-row]')];
      const count = home.querySelector('[data-profile-home-count]');
      const empty = home.querySelector('[data-profile-home-empty]');
      if (!input || !count || !empty || !rows.length) return;
      initialized.add(home);
      wrapper.hidden = false;

      input.addEventListener('input', () => {
        const query = input.value.trim().toLocaleLowerCase();
        let visible = 0;
        rows.forEach(row => {
          const matches = !query || (row.dataset.profileHomeSearchText || '').toLocaleLowerCase().includes(query);
          row.hidden = !matches;
          if (matches) visible += 1;
        });
        count.textContent = query
          ? `顯示 ${visible}／${rows.length} 篇`
          : `共 ${rows.length} 篇・依發表時間排序`;
        empty.hidden = visible !== 0;
      });
    });
  };

  boot();
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('pjax:success', boot);
})();
