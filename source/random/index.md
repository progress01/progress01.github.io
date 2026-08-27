---
title: 隨機傳送門
date: 2026-01-21 14:30:00
type: "random"
comments: false
---

{% raw %}
<style>
  #random-portal {
    --random-ink: #2d2521;
    --random-brown: #4a3028;
    --random-blue: #243d4b;
    --random-orange: #e36b2f;
    --random-gold: #f1aa58;
    --random-paper: #f7eedc;
    --random-line: rgba(74, 48, 40, .28);
    margin: 0 auto 28px;
    padding: 22px;
    color: var(--random-ink);
    background:
      linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
      var(--random-paper);
    background-size: 18px 18px;
    border: 1px solid var(--random-line);
    box-shadow: 5px 5px 0 rgba(74, 48, 40, .14);
    font-family: Georgia, "Noto Serif TC", serif;
  }

  #random-portal * { box-sizing: border-box; }
  #random-portal a { color: inherit; text-decoration: none; border-bottom: 0; }

  .random-header {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(190px, .8fr);
    gap: 18px;
    padding: 24px;
    color: #f9e9ca;
    background: var(--random-blue);
    border: 1px solid #182d37;
    box-shadow: 4px 4px 0 rgba(36, 61, 75, .22);
  }

  .random-label,
  .random-drawer-label,
  .random-meta,
  .random-screen-note,
  .random-filter {
    font-family: "Courier New", monospace;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .random-label { color: var(--random-gold); font-size: 11px; }
  .random-header h1 { margin: 18px 0 10px; color: #fff4dc; font-size: clamp(30px, 6vw, 56px); letter-spacing: 3px; line-height: 1; }
  .random-header p { max-width: 540px; margin: 0; color: #f2d9b2; line-height: 1.9; }
  .random-stamp { display: inline-block; margin-top: 22px; padding: 5px 9px; color: var(--random-orange); border: 1px solid var(--random-orange); font: 11px "Courier New", monospace; letter-spacing: 2px; transform: rotate(-3deg); }

  .random-screen {
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
  .random-screen-top { display: flex; justify-content: space-between; color: var(--random-orange); font-size: 11px; letter-spacing: 2px; }
  .random-screen strong { color: #ffe0a8; font-size: 23px; letter-spacing: 2px; line-height: 1.25; }
  .random-screen-note { color: #b48b6d; font-size: 10px; }

  .random-deck { margin-top: 28px; }
  .random-deck-heading { display: flex; align-items: baseline; gap: 10px; padding-bottom: 9px; border-bottom: 2px solid var(--random-brown); }
  .random-deck-heading span { color: var(--random-orange); font: bold 12px "Courier New", monospace; }
  .random-deck-heading h2 { margin: 0; color: var(--random-brown); font-size: 22px; }
  .random-deck-heading small { margin-left: auto; color: #96745e; font: 10px "Courier New", monospace; letter-spacing: 1.5px; }

  .random-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 15px 0; }
  .random-filter {
    padding: 8px 12px;
    color: var(--random-brown);
    background: #efe0c7;
    border: 1px solid var(--random-line);
    cursor: pointer;
    font-size: 11px;
  }
  .random-filter:hover,
  .random-filter.is-active { color: #fff4dc; background: var(--random-brown); }
  .random-filter.is-empty { display: none; }

  .random-status { min-height: 22px; color: #96745e; font: 11px "Courier New", monospace; }
  .random-card {
    position: relative;
    margin-top: 8px;
    padding: 28px;
    color: #f9e9ca;
    background: var(--random-brown);
    border: 1px solid #6b4738;
    box-shadow: 6px 6px 0 rgba(74, 48, 40, .2);
  }
  .random-card::before { position: absolute; top: 12px; right: 16px; color: var(--random-orange); content: "● REC"; font: 11px "Courier New", monospace; letter-spacing: 1px; }
  .random-card[hidden] { display: none; }
  .random-meta { color: var(--random-gold); font-size: 10px; }
  .random-card h2 { max-width: 85%; margin: 18px 0 12px; color: #fff0cf; font-size: clamp(24px, 4vw, 38px); line-height: 1.25; }
  .random-excerpt { max-width: 700px; margin: 0; color: #f1d9b9; line-height: 1.9; }
  .random-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
  .random-button { display: inline-block; padding: 10px 14px; border: 1px solid var(--random-gold); font: 12px "Courier New", monospace; letter-spacing: 1px; cursor: pointer; }
  .random-button.primary { color: var(--random-brown); background: var(--random-gold); }
  .random-button.secondary { color: #ffe5ba; background: transparent; }
  .random-button:hover { color: #fff; background: var(--random-orange); border-color: var(--random-orange); }

  .random-empty { padding: 30px; color: #6b5547; background: #efe1c9; line-height: 1.8; }
  .random-footnote { margin: 24px 0 0; color: #96745e; font: 11px "Courier New", monospace; letter-spacing: .8px; text-align: right; }

  @media (max-width: 767px) {
    #random-portal { margin-right: -8px; margin-left: -8px; padding: 12px; }
    .random-header { grid-template-columns: 1fr; padding: 18px; }
    .random-screen { min-height: 140px; }
    .random-card { padding: 22px 18px; }
  }

  @media (max-width: 430px) {
    .random-deck-heading { flex-wrap: wrap; }
    .random-deck-heading small { width: 100%; margin-left: 0; }
    .random-card h2 { max-width: 100%; }
  }
</style>

<div id="random-portal">
  <section class="random-header">
    <div>
      <div class="random-label">RANDOM TAPE // MEMORY SELECTOR</div>
      <h1>隨機傳送門</h1>
      <p>不決定要讀什麼的時候，就讓某一段已經留下來的日子自己出現。</p>
      <div class="random-stamp">PRESS PLAY / 1988</div>
    </div>
    <div class="random-screen">
      <div class="random-screen-top"><span>● READY</span><span>SIDE B</span></div>
      <strong>CHOOSE<br>A MEMORY</strong>
      <span class="random-screen-note">LIFE LOG / RANDOM ACCESS</span>
    </div>
  </section>

  <section class="random-deck">
    <div class="random-deck-heading"><span>A-01</span><h2>選擇抽取範圍</h2><small>OPEN THE DRAWER</small></div>
    <div class="random-filters" aria-label="隨機文章分類">
      <button class="random-filter is-active" type="button" data-category="all">全部</button>
    </div>
    <div id="random-status" class="random-status">正在整理 1988 以來的記憶……</div>

    <article id="random-card" class="random-card" hidden>
      <div id="random-meta" class="random-meta"></div>
      <h2 id="random-title"></h2>
      <p id="random-excerpt" class="random-excerpt"></p>
      <div class="random-actions">
        <a id="random-open" class="random-button primary" href="#">PLAY THIS ENTRY ↗</a>
        <button id="random-again" class="random-button secondary" type="button">換一篇</button>
      </div>
    </article>

    <div id="random-empty" class="random-empty" hidden>這個抽屜目前沒有可播放的文章。</div>
  </section>

  <p class="random-footnote">NO REPEAT FOR THE LAST 3 TRACKS // KEEP THE TAPE ROLLING</p>
</div>

<script>
  (function() {
    var dataUrl = '/random.json';
    var records = [];
    var contentCategories = [];
    var currentCategory = 'all';
    var historyKey = 'random-tape-history';
    var filters = document.querySelector('.random-filters');
    var status = document.getElementById('random-status');
    var card = document.getElementById('random-card');
    var empty = document.getElementById('random-empty');
    var title = document.getElementById('random-title');
    var meta = document.getElementById('random-meta');
    var excerpt = document.getElementById('random-excerpt');
    var open = document.getElementById('random-open');
    var again = document.getElementById('random-again');

    function getHistory() {
      try { return JSON.parse(sessionStorage.getItem(historyKey) || '[]'); } catch (error) { return []; }
    }

    function saveHistory(url) {
      var history = getHistory().filter(function(item) { return item !== url; });
      history.unshift(url);
      sessionStorage.setItem(historyKey, JSON.stringify(history.slice(0, 3)));
    }

    function randomItem(items) {
      return items[Math.floor(Math.random() * items.length)];
    }

    function poolFor(category) {
      if (category === 'all') return records;
      return records.filter(function(item) { return item.categories.indexOf(category) !== -1; });
    }

    function categoryButtons() {
      return filters.querySelectorAll('.random-filter');
    }

    function chooseRecord() {
      var pool = poolFor(currentCategory);
      if (currentCategory === 'all') {
        var categories = contentCategories.filter(function(category) {
          return records.some(function(item) { return item.categories.indexOf(category) !== -1; });
        });
        if (categories.length) {
          var selectedCategory = randomItem(categories);
          pool = pool.filter(function(item) { return item.categories.indexOf(selectedCategory) !== -1; });
        }
      }

      var history = getHistory();
      var freshPool = pool.filter(function(item) { return history.indexOf(item.url) === -1; });
      return randomItem(freshPool.length ? freshPool : pool);
    }

    function renderRecord(record) {
      if (!record) {
        card.hidden = true;
        empty.hidden = false;
        status.textContent = '這個抽屜沒有可播放的內容。';
        return;
      }
      card.hidden = false;
      empty.hidden = true;
      meta.textContent = (record.categories || []).join(' / ') + '  //  ' + record.date;
      title.textContent = record.title;
      excerpt.textContent = record.excerpt || '這篇文章沒有摘要，直接播放這段紀錄。';
      open.href = record.url;
      status.textContent = currentCategory === 'all' ? '已從不同內容區平均抽取一段記憶。' : '目前抽取範圍：' + currentCategory;
      saveHistory(record.url);
    }

    function draw() { renderRecord(chooseRecord()); }

    filters.addEventListener('click', function(event) {
      var button = event.target.closest('.random-filter');
      if (!button) return;
      currentCategory = button.getAttribute('data-category');
      categoryButtons().forEach(function(item) { item.classList.toggle('is-active', item === button); });
      draw();
    });

    again.addEventListener('click', draw);

    Promise.all([
      fetch(dataUrl).then(function(response) {
        if (!response.ok) throw new Error('random data unavailable');
        return response.json();
      }),
      fetch('/content-categories.json').then(function(response) {
        if (!response.ok) throw new Error('content categories unavailable');
        return response.json();
      })
    ])
      .then(function(results) {
        records = results[0].filter(function(item) { return item && item.url && item.title; });
        contentCategories = results[1].map(function(category) { return category.name; });
        results[1].forEach(function(category) {
          var button = document.createElement('button');
          button.className = 'random-filter';
          button.type = 'button';
          button.setAttribute('data-category', category.name);
          button.textContent = category.name;
          if (!poolFor(category.name).length) button.classList.add('is-empty');
          filters.appendChild(button);
        });
        draw();
      })
      .catch(function() {
        status.textContent = '時光機故障：找不到文章資料庫。';
        empty.hidden = false;
        empty.textContent = '隨機資料尚未準備好，請重新建置網站後再試。';
      });
  })();
</script>
{% endraw %}
