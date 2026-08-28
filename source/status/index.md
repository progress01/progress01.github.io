---
title: 碎碎念歸檔
date: 2026-02-09 12:00:00
type: "status"
comments: false
---

{% raw %}
<style>
  #status-archive {
    --status-ink: #2d2521;
    --status-brown: #4a3028;
    --status-blue: #243d4b;
    --status-orange: #e36b2f;
    --status-gold: #f1aa58;
    --status-paper: #f7eedc;
    --status-line: rgba(74, 48, 40, .28);
    margin: 0 auto 28px;
    padding: 22px;
    color: var(--status-ink);
    background:
      linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
      var(--status-paper);
    background-size: 18px 18px;
    border: 1px solid var(--status-line);
    box-shadow: 5px 5px 0 rgba(74, 48, 40, .14);
    font-family: Georgia, "Noto Serif TC", serif;
  }

  #status-archive * { box-sizing: border-box; }
  #status-archive a { color: inherit; border-bottom: 0; text-decoration: none; }

  .status-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(190px, .8fr);
    gap: 18px;
    padding: 24px;
    color: #f9e9ca;
    background: var(--status-blue);
    border: 1px solid #182d37;
    box-shadow: 4px 4px 0 rgba(36, 61, 75, .22);
  }

  .status-label,
  .status-section-heading small,
  .status-meta,
  .status-screen-note,
  .status-summary {
    font-family: "Courier New", monospace;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .status-label { color: var(--status-gold); font-size: 11px; }
  .status-hero h1 {
    margin: 18px 0 10px;
    color: #fff4dc;
    font-size: clamp(30px, 6vw, 56px);
    letter-spacing: 3px;
    line-height: 1;
  }
  .status-hero p { max-width: 520px; margin: 0; color: #f2d9b2; line-height: 1.9; }
  .status-stamp {
    display: inline-block;
    margin-top: 22px;
    padding: 5px 9px;
    color: var(--status-orange);
    border: 1px solid var(--status-orange);
    font: 11px "Courier New", monospace;
    letter-spacing: 2px;
    transform: rotate(-3deg);
  }

  .status-screen {
    display: flex;
    min-height: 170px;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px;
    color: #ffcc80;
    background: #191414;
    border: 1px solid #6d4637;
    box-shadow: inset 0 0 0 4px #2e211d;
    font-family: "Courier New", monospace;
  }
  .status-screen-top { display: flex; justify-content: space-between; color: var(--status-orange); font-size: 11px; letter-spacing: 2px; }
  .status-screen strong { color: #ffe0a8; font-size: 22px; letter-spacing: 2px; line-height: 1.25; }
  .status-screen-note { color: #b48b6d; font-size: 10px; }

  .status-section { margin-top: 28px; }
  .status-section-heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-bottom: 9px;
    border-bottom: 2px solid var(--status-brown);
  }
  .status-section-heading > span { color: var(--status-orange); font: bold 12px "Courier New", monospace; }
  .status-section-heading h2 { margin: 0; color: var(--status-brown); font-size: 22px; }
  .status-section-heading small { margin-left: auto; color: #96745e; font-size: 10px; }
  .status-summary { margin: 14px 0 0; color: #96745e; font-size: 10px; }
  .status-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
  }
  .status-search-label { color: #96745e; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  .status-search {
    flex: 1 1 auto;
    min-width: 0;
    padding: 9px 11px;
    color: var(--status-ink);
    background: rgba(255, 252, 243, .86);
    border: 1px solid var(--status-line);
    font: 14px Georgia, "Noto Serif TC", serif;
  }
  .status-search:focus { outline: 2px solid var(--status-orange); outline-offset: 2px; }
  .status-button {
    padding: 9px 13px;
    color: #f9e9ca;
    background: var(--status-blue);
    border: 1px solid #182d37;
    font: 11px "Courier New", monospace;
    cursor: pointer;
  }
  .status-button:hover { color: #fff4dc; background: var(--status-orange); border-color: var(--status-orange); }
  .status-button:disabled { opacity: .5; cursor: not-allowed; }

  .status-list {
    margin-top: 14px;
  }
  .status-year { margin: 0 0 16px; border: 1px solid var(--status-line); background: rgba(255, 252, 243, .35); }
  .status-year + .status-year { margin-top: 16px; }
  .status-year-summary {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 13px;
    color: var(--status-brown);
    background: rgba(231, 221, 208, .62);
    font: bold 14px "Courier New", monospace;
    cursor: pointer;
    list-style: none;
  }
  .status-year-summary::-webkit-details-marker { display: none; }
  .status-year-summary::before { content: "+"; color: var(--status-orange); font-size: 17px; line-height: 1; }
  .status-year[open] > .status-year-summary::before { content: "−"; }
  .status-year-count { margin-left: auto; color: #96745e; font-size: 10px; font-weight: normal; }
  .status-year-list {
    position: relative;
    margin: 0 0 0 9px;
    padding: 16px 0 2px 28px;
    border-left: 2px solid #b48b6d;
  }
  .status-item { position: relative; margin: 0 0 26px; }
  .status-item:last-child { margin-bottom: 0; }
  .status-item::before {
    content: "";
    position: absolute;
    top: 4px;
    left: -37px;
    width: 12px;
    height: 12px;
    background: var(--status-orange);
    border: 3px solid var(--status-paper);
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--status-brown);
  }
  .status-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: #96745e; font-size: 10px; }
  .status-date { color: #76513f; }
  .status-tag { padding: 3px 7px; color: var(--status-blue); background: #e7ddd0; border: 1px solid #c7a17a; }
  .status-content {
    margin-top: 8px;
    padding: 15px 18px;
    color: #5d4639;
    background: rgba(255, 252, 243, .86);
    border: 1px solid var(--status-line);
    box-shadow: 3px 3px 0 rgba(74, 48, 40, .12);
    line-height: 1.8;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  }
  .status-content:hover { transform: translate(-2px, -2px); border-color: var(--status-orange); box-shadow: 5px 5px 0 rgba(74, 48, 40, .16); }
  .status-content p { margin: 0 0 8px; }
  .status-content p:last-child { margin-bottom: 0; }
  .status-content a { color: var(--status-orange); border-bottom: 1px solid currentColor; }
  .status-empty,
  .status-error { padding: 20px; color: #6b5547; background: rgba(255, 252, 243, .86); border: 1px solid var(--status-line); line-height: 1.8; }
  .status-error { color: #8b4a35; }
  .status-actions { display: flex; justify-content: center; margin-top: 18px; }
  .status-footnote { margin: 24px 0 0; color: #96745e; font: 11px "Courier New", monospace; letter-spacing: .8px; text-align: right; }

  @media (max-width: 767px) {
    #status-archive { margin-right: -8px; margin-left: -8px; padding: 12px; }
    .status-hero { grid-template-columns: 1fr; padding: 18px; }
    .status-screen { min-height: 140px; }
  }

  @media (max-width: 430px) {
    .status-section-heading { flex-wrap: wrap; }
    .status-section-heading small { width: 100%; margin-left: 0; }
    .status-controls { align-items: stretch; flex-wrap: wrap; }
    .status-search-label { width: 100%; }
    .status-search { flex-basis: calc(100% - 65px); }
    .status-year-list { margin-left: 5px; padding-left: 22px; }
    .status-item::before { left: -31px; }
    .status-content { padding: 13px 14px; }
  }
</style>

<div id="status-archive">
  <section class="status-hero">
    <div>
      <div class="status-label">STATUS TAPE // FIELD NOTES</div>
      <h1>碎碎念歸檔</h1>
      <p>把還沒整理成文章的念頭，先留在正在發生的現場。</p>
      <div class="status-stamp">MICROBLOG / LIFE LOG</div>
    </div>
    <div class="status-screen">
      <div class="status-screen-top"><span>● REC</span><span>SIDE B</span></div>
      <strong>SMALL<br>THOUGHTS</strong>
      <span class="status-screen-note">SHORT NOTES / LONG DAYS</span>
    </div>
  </section>

  <section class="status-section">
    <div class="status-section-heading"><span>A-01</span><h2>現場紀錄</h2><small>KEEP THE TAPE ROLLING</small></div>
    <div id="status-summary" class="status-summary">正在整理微型資料庫……</div>
    <div class="status-controls" role="search" aria-label="搜尋碎碎念">
      <label class="status-search-label" for="status-search">搜尋</label>
      <input id="status-search" class="status-search" type="search" placeholder="搜尋文字、日期或標籤……" autocomplete="off">
      <button id="status-clear" class="status-button" type="button">清除</button>
    </div>
    <div id="status-list" class="status-list">
      <div class="status-empty">正在連線至微型資料庫……</div>
    </div>
    <div id="status-actions" class="status-actions" hidden>
      <button id="status-load-more" class="status-button" type="button">載入更多</button>
    </div>
  </section>

  <p class="status-footnote">SHORT NOTES // KEEP THE TAPE ROLLING</p>
</div>

<script>
  (function() {
    var list = document.getElementById('status-list');
    var summary = document.getElementById('status-summary');
    var search = document.getElementById('status-search');
    var clear = document.getElementById('status-clear');
    var actions = document.getElementById('status-actions');
    var loadMore = document.getElementById('status-load-more');
    var pageSize = 20;
    var visibleLimit = pageSize;
    var query = '';
    var data = [];

    function textElement(tagName, className, value) {
      var element = document.createElement(tagName);
      element.className = className;
      element.textContent = value || '';
      return element;
    }

    function plainContent(value) {
      var holder = document.createElement('div');
      holder.innerHTML = value || '';
      return holder.textContent || holder.innerText || '';
    }

    function yearOf(item) {
      var match = String(item.date || '').match(/^\d{4}/);
      return match ? match[0] : '未分類';
    }

    function createEntry(item) {
      var entry = document.createElement('article');
      entry.className = 'status-item';

      var meta = document.createElement('div');
      meta.className = 'status-meta';
      var date = textElement('time', 'status-date', item.date);
      if (item.date) date.setAttribute('datetime', item.date);
      meta.appendChild(date);
      if (item.tag) meta.appendChild(textElement('span', 'status-tag', item.tag));

      var content = document.createElement('div');
      content.className = 'status-content';
      // microblog.json 是站內自己維護的內容，保留其中的連結與換行標記。
      content.innerHTML = item.content || '（這則紀錄沒有文字。）';

      entry.appendChild(meta);
      entry.appendChild(content);
      return entry;
    }

    function render() {
      var normalizedQuery = query.trim().toLowerCase();
      var filtered = data.filter(function(item) {
        if (!normalizedQuery) return true;
        var haystack = [item.date, item.tag, plainContent(item.content)].join(' ').toLowerCase();
        return haystack.indexOf(normalizedQuery) !== -1;
      });
      var visible = filtered.slice(0, visibleLimit);

      list.innerHTML = '';
      if (!data.length) {
        list.innerHTML = '<div class="status-empty">這卷錄音帶目前還沒有內容。</div>';
        summary.textContent = 'SIDE B / 目前沒有現場紀錄';
        actions.hidden = true;
        return;
      }

      if (!filtered.length) {
        list.innerHTML = '<div class="status-empty">找不到符合的紀錄，換個關鍵字試試看。</div>';
        summary.textContent = 'SIDE B / 搜尋不到符合的紀錄';
        actions.hidden = true;
        return;
      }

      var groups = Object.create(null);
      var years = [];
      visible.forEach(function(item) {
        var year = yearOf(item);
        if (!groups[year]) {
          groups[year] = [];
          years.push(year);
        }
        groups[year].push(item);
      });

      var fragment = document.createDocumentFragment();
      years.forEach(function(year, index) {
        var yearBlock = document.createElement('details');
        yearBlock.className = 'status-year';
        yearBlock.open = index === 0 || Boolean(normalizedQuery);

        var yearSummary = document.createElement('summary');
        yearSummary.className = 'status-year-summary';
        yearSummary.appendChild(textElement('span', 'status-year-label', year));
        yearSummary.appendChild(textElement('span', 'status-year-count', groups[year].length + ' 則'));

        var yearList = document.createElement('div');
        yearList.className = 'status-year-list';
        groups[year].forEach(function(item) {
          yearList.appendChild(createEntry(item));
        });

        yearBlock.appendChild(yearSummary);
        yearBlock.appendChild(yearList);
        fragment.appendChild(yearBlock);
      });

      list.appendChild(fragment);
      if (normalizedQuery) {
        summary.textContent = 'SIDE B / 搜尋「' + query.trim() + '」：顯示 ' + visible.length + ' / ' + filtered.length + ' 則（共 ' + data.length + ' 則）';
      } else {
        summary.textContent = 'SIDE B / 顯示最新 ' + visible.length + ' / ' + data.length + ' 則現場紀錄';
      }
      actions.hidden = visible.length >= filtered.length;
      loadMore.textContent = '載入更多（還有 ' + (filtered.length - visible.length) + ' 則）';
    }

    search.addEventListener('input', function() {
      query = search.value;
      visibleLimit = pageSize;
      render();
    });

    clear.addEventListener('click', function() {
      search.value = '';
      query = '';
      visibleLimit = pageSize;
      search.focus();
      render();
    });

    loadMore.addEventListener('click', function() {
      visibleLimit += pageSize;
      render();
    });

    fetch('/microblog.json')
      .then(function(response) {
        if (!response.ok) throw new Error('找不到 microblog.json');
        return response.json();
      })
      .then(function(payload) {
        if (!Array.isArray(payload)) throw new Error('microblog.json 格式錯誤');
        data = payload;
        render();
      })
      .catch(function() {
        list.innerHTML = '<div class="status-error">時光機暫時無法讀取，請稍後再試。</div>';
        summary.textContent = 'SIDE B / 讀取失敗';
        actions.hidden = true;
      });
  })();
</script>
{% endraw %}
