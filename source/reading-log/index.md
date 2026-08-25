---
title: 生活索引
date: 2026-01-19 12:00:00
comments: false
---

{% raw %}
<style>
  #life-index {
    --life-ink: #2d2521;
    --life-brown: #4a3028;
    --life-blue: #243d4b;
    --life-orange: #e36b2f;
    --life-gold: #f1aa58;
    --life-paper: #f7eedc;
    --life-line: rgba(74, 48, 40, .28);
    margin: 0 auto 28px;
    padding: 22px;
    color: var(--life-ink);
    background:
      linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
      var(--life-paper);
    background-size: 18px 18px;
    border: 1px solid var(--life-line);
    box-shadow: 5px 5px 0 rgba(74, 48, 40, .14);
    font-family: Georgia, "Noto Serif TC", serif;
  }

  #life-index * { box-sizing: border-box; }
  #life-index a { color: inherit; text-decoration: none; border-bottom: 0; }

  .life-index-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(190px, .8fr);
    gap: 18px;
    padding: 24px;
    color: #f9e9ca;
    background: var(--life-blue);
    border: 1px solid #182d37;
    box-shadow: 4px 4px 0 rgba(36, 61, 75, .22);
  }

  .life-index-label,
  .life-index-section-heading small,
  .life-index-card-label,
  .life-index-screen-note,
  .life-index-list-label {
    font-family: "Courier New", monospace;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .life-index-label { color: var(--life-gold); font-size: 11px; }
  .life-index-hero h1 {
    margin: 18px 0 10px;
    color: #fff4dc;
    font-size: clamp(32px, 6vw, 58px);
    letter-spacing: 3px;
    line-height: 1;
  }
  .life-index-hero p { max-width: 520px; margin: 0; color: #f2d9b2; line-height: 1.9; }
  .life-index-stamp {
    display: inline-block;
    margin-top: 22px;
    padding: 5px 9px;
    color: var(--life-orange);
    border: 1px solid var(--life-orange);
    font: 11px "Courier New", monospace;
    letter-spacing: 2px;
    transform: rotate(-3deg);
  }

  .life-index-screen {
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
  .life-index-screen-top { display: flex; justify-content: space-between; color: var(--life-orange); font-size: 11px; letter-spacing: 2px; }
  .life-index-screen strong { color: #ffe0a8; font-size: 22px; letter-spacing: 2px; line-height: 1.25; }
  .life-index-screen-note { color: #b48b6d; font-size: 10px; }

  .life-index-section { margin-top: 28px; }
  .life-index-section-heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-bottom: 9px;
    border-bottom: 2px solid var(--life-brown);
  }
  .life-index-section-heading > span { color: var(--life-orange); font: bold 12px "Courier New", monospace; }
  .life-index-section-heading h2 { margin: 0; color: var(--life-brown); font-size: 22px; }
  .life-index-section-heading small { margin-left: auto; color: #96745e; font-size: 10px; }

  .life-index-now,
  .life-index-entry-grid { display: grid; gap: 12px; margin-top: 14px; }
  .life-index-now { grid-template-columns: repeat(2, 1fr); }
  .life-index-now-card,
  .life-index-entry-card {
    display: block;
    position: relative;
    padding: 17px;
    background: rgba(255, 252, 243, .78);
    border: 1px solid var(--life-line);
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .life-index-now-card:hover,
  .life-index-entry-card:hover { color: var(--life-ink); transform: translate(-2px, -2px); box-shadow: 4px 4px 0 rgba(74, 48, 40, .2); }
  .life-index-now-card:nth-child(1) { background: #f2dfc1; }
  .life-index-now-card:nth-child(2) { background: #e7ddd0; }
  .life-index-card-label { color: var(--life-orange); font-size: 10px; }
  .life-index-now-card h3,
  .life-index-entry-card h3 { margin: 12px 0 7px; color: var(--life-brown); font-size: 18px; }
  .life-index-now-card p,
  .life-index-entry-card p { margin: 0; color: #6b5547; font-size: 13px; line-height: 1.7; }
  .life-index-card-link { display: block; margin-top: 16px; color: var(--life-blue); font: 11px "Courier New", monospace; letter-spacing: 1px; }

  .life-index-entry-grid { grid-template-columns: repeat(4, 1fr); }
  .life-index-entry-card { min-height: 132px; }
  .life-index-entry-card h3 { font-size: 16px; }
  .life-index-entry-card p { font-size: 12px; }
  .life-index-entry-card .life-index-card-icon { float: right; color: var(--life-orange); font-size: 18px; }

  .life-index-heatmap-panel { padding: 17px; background: rgba(255, 252, 243, .78); border: 1px solid var(--life-line); }
  .life-index-heatmap-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #96745e; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  .life-index-heatmap-top a { color: var(--life-blue); white-space: nowrap; }
  .life-index-heatmap-scroll { margin-top: 16px; overflow-x: auto; padding-bottom: 5px; }
  .life-index-heatmap { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 12px); grid-auto-columns: 12px; gap: 3px; min-width: 760px; }
  .life-index-heatmap-cell { width: 12px; height: 12px; background: #eee5d4; border: 1px solid rgba(74, 48, 40, .08); }
  .life-index-heatmap-cell.level-1 { background: #d7e4d0; }
  .life-index-heatmap-cell.level-2 { background: #a7c89b; }
  .life-index-heatmap-cell.level-3 { background: #5e9a70; }
  .life-index-heatmap-cell.level-4 { background: #2f5d50; }
  .life-index-heatmap-legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 10px; color: #96745e; font: 10px "Courier New", monospace; }
  .life-index-heatmap-legend i { display: inline-block; width: 10px; height: 10px; background: #eee5d4; }
  .life-index-heatmap-legend i.level-1 { background: #d7e4d0; }
  .life-index-heatmap-legend i.level-2 { background: #a7c89b; }
  .life-index-heatmap-legend i.level-3 { background: #5e9a70; }
  .life-index-heatmap-legend i.level-4 { background: #2f5d50; }

  .life-index-log { display: flex; gap: 12px; margin-top: 14px; padding-bottom: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .life-index-log::-webkit-scrollbar { display: none; }
  .life-index-log-card {
    flex: 0 0 220px;
    min-height: 130px;
    padding: 14px;
    position: relative;
    color: #f6dfbd;
    background: var(--life-brown);
    border: 1px solid #6b4738;
    box-shadow: 3px 3px 0 rgba(74, 48, 40, .16);
  }
  .life-index-log-card.archive { display: flex; align-items: center; justify-content: center; color: #ffe0a8; background: var(--life-blue); text-align: center; }
  .life-index-log-tag { position: absolute; top: 12px; right: 12px; color: var(--life-gold); font-size: 15px; }
  .life-index-log-date { display: block; padding-bottom: 7px; color: #d19b6f; border-bottom: 1px dashed #89604b; font: 10px "Courier New", monospace; }
  .life-index-log-content { margin-top: 12px; color: #f8e8ca; font-size: 13px; line-height: 1.7; }
  .life-index-footnote { margin: 24px 0 0; color: #96745e; font: 11px "Courier New", monospace; letter-spacing: .8px; text-align: right; }

  @media (max-width: 767px) {
    #life-index { margin-right: -8px; margin-left: -8px; padding: 12px; }
    .life-index-hero { grid-template-columns: 1fr; }
    .life-index-now { grid-template-columns: 1fr; }
    .life-index-entry-grid { grid-template-columns: repeat(2, 1fr); }
    .life-index-hero { padding: 18px; }
    .life-index-screen { min-height: 140px; }
  }

  @media (max-width: 430px) {
    .life-index-entry-grid { grid-template-columns: 1fr; }
    .life-index-section-heading { flex-wrap: wrap; }
    .life-index-section-heading small { width: 100%; margin-left: 0; }
  }
</style>

<div id="life-index">
  <section class="life-index-hero">
    <div>
      <div class="life-index-label">PERSONAL ENTRY // 1988 EDITION</div>
      <h1>生活索引</h1>
      <p>收藏正在發生的事，也保存那些回不去的日子。</p>
      <div class="life-index-stamp">1988 / REC</div>
    </div>
    <div class="life-index-screen">
      <div class="life-index-screen-top"><span>● REC</span><span>SIDE A</span></div>
      <strong>DON'T COUNT<br>THE DAYS</strong>
      <span class="life-index-screen-note">LIFE LOG / PERSONAL ENTRY</span>
    </div>
  </section>

  <section class="life-index-section">
    <div class="life-index-section-heading"><span>A-01</span><h2>現在的我</h2><small>NOW PLAYING</small></div>
      <div id="life-index-current" class="life-index-now">
      <div class="life-index-entry-card">正在讀取現在的內容……</div>
    </div>
  </section>

  <section class="life-index-section">
    <div class="life-index-section-heading"><span>B-01</span><h2>內容入口</h2><small>OPEN THE DRAWER</small></div>
    <div class="life-index-entry-grid">
      <a class="life-index-entry-card" href="/categories/音樂/"><i class="fa fa-music life-index-card-icon"></i><span class="life-index-card-label">01 / AUDIO</span><h3>音樂</h3><p>歌曲推薦與聽歌時的片段。</p></a>
      <a class="life-index-entry-card" href="/categories/閱讀與影視/"><i class="fa fa-book life-index-card-icon"></i><span class="life-index-card-label">02 / SCREEN</span><h3>閱讀與影視</h3><p>書籍、電影與連續劇留下的紀錄。</p></a>
      <a class="life-index-entry-card" href="/categories/觀念與實驗/"><i class="fa fa-flask life-index-card-icon"></i><span class="life-index-card-label">03 / LAB</span><h3>觀念與實驗</h3><p>問題情境、發現過程與真正原因。</p></a>
      <a class="life-index-entry-card" href="/categories/生活紀錄/"><i class="fa fa-pencil life-index-card-icon"></i><span class="life-index-card-label">04 / DAILY</span><h3>生活紀錄</h3><p>工作、情緒與那些還在整理的日子。</p></a>
      <a class="life-index-entry-card" href="/photos/"><i class="fa fa-camera life-index-card-icon"></i><span class="life-index-card-label">05 / MEMORY</span><h3>記憶圖牆</h3><p>用圖片留下來的片段與收藏。</p></a>
      <a class="life-index-entry-card" href="/status/"><i class="fa fa-comment life-index-card-icon"></i><span class="life-index-card-label">06 / STATUS</span><h3>碎碎念</h3><p>短一點、即時一點的現場紀錄。</p></a>
      <a class="life-index-entry-card" href="/calendar/"><i class="fa fa-calendar life-index-card-icon"></i><span class="life-index-card-label">07 / CALENDAR</span><h3>更新熱力圖</h3><p>回頭看自己什麼時候留下了紀錄。</p></a>
      <a class="life-index-entry-card" href="/random/"><i class="fa fa-random life-index-card-icon"></i><span class="life-index-card-label">08 / RANDOM</span><h3>隨機文章</h3><p>不預設主題，讓下一篇自己出現。</p></a>
    </div>
  </section>

  <section class="life-index-section">
    <div class="life-index-section-heading"><span>C-01</span><h2>紀錄熱力圖</h2><small>KEEP THE TAPE ROLLING</small></div>
    <div class="life-index-heatmap-panel">
      <div class="life-index-heatmap-top">
        <span id="life-index-heatmap-label">正在讀取最近的紀錄……</span>
        <a href="/calendar/">OPEN FULL CALENDAR ↗</a>
      </div>
      <div class="life-index-heatmap-scroll">
        <div id="life-index-heatmap" class="life-index-heatmap" aria-label="文章產出熱力圖"></div>
      </div>
      <div class="life-index-heatmap-legend"><span>少</span><i></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>多</span></div>
    </div>
  </section>

  <section class="life-index-section">
    <div class="life-index-section-heading"><span>D-01</span><h2>現場紀錄</h2><small>LIVE LOG</small></div>
    <div id="life-index-log" class="life-index-log"><div class="life-index-log-card">正在讀取最近的紀錄……</div></div>
  </section>

  <p class="life-index-footnote">KEEP THE TAPE ROLLING // LIFE_VOL.01</p>
</div>

<script>
  (function() {
    var currentContainer = document.getElementById('life-index-current');
    var currentSlots = [
      { key: 'listen', fallbackLabel: 'LISTEN / 聽歌中' },
      { key: 'watch', fallbackLabel: 'WATCH / 觀看中' }
    ];

    function addText(parent, tagName, className, value) {
      var element = document.createElement(tagName);
      element.className = className;
      element.textContent = value || '';
      parent.appendChild(element);
      return element;
    }

    function renderLifeIndex(data) {
      currentContainer.innerHTML = '';
      currentSlots.forEach(function(slot) {
        var item = data.current && data.current[slot.key] ? data.current[slot.key] : {};
        var card = document.createElement('a');
        card.className = 'life-index-now-card';
        card.href = item.url || '#';
        if (/^https?:\/\//.test(item.url || '')) {
          card.target = '_blank';
          card.rel = 'noopener';
        }
        addText(card, 'span', 'life-index-card-label', item.label || slot.fallbackLabel);
        addText(card, 'h3', '', item.title || '尚未設定');
        addText(card, 'p', '', item.description || '之後再補上這段紀錄。');
        addText(card, 'span', 'life-index-card-link', item.linkLabel || 'OPEN ↗');
        currentContainer.appendChild(card);
      });

    }

    fetch('/life-index.json')
      .then(function(response) {
        if (!response.ok) throw new Error('找不到 life-index.json');
        return response.json();
      })
      .then(renderLifeIndex)
      .catch(function() {
        currentContainer.innerHTML = '<div class="life-index-entry-card">目前的內容暫時無法讀取。</div>';
      });
  })();

  (function() {
    var heatmap = document.getElementById('life-index-heatmap');
    var label = document.getElementById('life-index-heatmap-label');

    function pad(value) { return String(value).padStart(2, '0'); }

    function renderHeatmap(data) {
      var dates = Object.keys(data).sort();
      var year = dates.length ? dates[dates.length - 1].slice(0, 4) : String(new Date().getFullYear());
      var start = new Date(Number(year), 0, 1);
      var end = new Date(Number(year), 11, 31);
      var dayIndex = 0;
      var total = 0;
      var max = 0;

      dates.forEach(function(date) {
        if (date.slice(0, 4) === year) max = Math.max(max, Number(data[date]) || 0);
      });

      heatmap.innerHTML = '';
      for (var day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        var key = year + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate());
        var value = Number(data[key]) || 0;
        var cell = document.createElement('span');
        var level = value === 0 ? 0 : Math.min(4, Math.ceil((value / Math.max(1, max)) * 4));
        cell.className = 'life-index-heatmap-cell level-' + level;
        cell.style.gridColumn = String(Math.floor((start.getDay() + dayIndex) / 7) + 1);
        cell.style.gridRow = String(day.getDay() + 1);
        cell.title = key + '：' + value + ' 篇文章';
        heatmap.appendChild(cell);
        total += value;
        dayIndex += 1;
      }
      label.textContent = year + ' 年文章紀錄：' + total + ' 篇';
    }

    fetch('/calendar.json')
      .then(function(response) {
        if (!response.ok) throw new Error('找不到 calendar.json');
        return response.json();
      })
      .then(renderHeatmap)
      .catch(function() {
        label.textContent = '熱力圖暫時無法讀取。';
      });
  })();

  fetch('/microblog.json')
    .then(function(response) { return response.json(); })
    .then(function(data) {
      var container = document.getElementById('life-index-log');
      container.innerHTML = '';
      data.slice(0, 6).forEach(function(item) {
        var card = document.createElement('article');
        card.className = 'life-index-log-card';
        card.innerHTML = '<span class="life-index-log-tag">' + item.tag + '</span>' +
          '<span class="life-index-log-date">' + item.date + '</span>' +
          '<div class="life-index-log-content">' + item.content + '</div>';
        container.appendChild(card);
      });
      var archive = document.createElement('a');
      archive.href = '/status/';
      archive.className = 'life-index-log-card archive';
      archive.innerHTML = '<span><i class="fa fa-archive"></i><br>查看歷史存檔 ↗</span>';
      container.appendChild(archive);
    })
    .catch(function() {
      document.getElementById('life-index-log').innerHTML = '<div class="life-index-log-card">暫時沒有現場紀錄。</div>';
    });
</script>
{% endraw %}
