---
title: Heat Map
date: 2026-08-29 12:00:00
layout: page
comments: false
---

<div class="calendar-page">
  <div id="calendar-years" class="calendar-years" aria-label="選擇年份"></div>
  <p id="calendar-status" class="calendar-status" aria-live="polite">讀取文章資料中……</p>
  <div class="calendar-scroll">
    <div class="calendar-chart-wrap">
      <div id="calendar" class="calendar-chart" aria-label="文章更新熱力圖">
        <div class="calendar-loading"><i class="fa fa-spinner fa-spin"></i> Loading Graph...</div>
      </div>
      <div id="calendar-grid-controls" class="calendar-grid-controls" aria-label="選擇更新日期"></div>
    </div>
  </div>

  <section class="calendar-details" aria-live="polite">
    <div class="calendar-details-heading">
      <span>RECENT / 更新紀錄</span>
      <h2 id="calendar-detail-title">近一週有更新的文章</h2>
      <small id="calendar-detail-note">點選上方格子查看當天</small>
    </div>
    <div id="calendar-updates" class="calendar-updates">
      <div class="calendar-empty">正在整理更新紀錄……</div>
    </div>
  </section>
</div>

<script src="/lib/echarts.min.js"></script>
<script src="/lib/languages.js"></script>
<script src="/lib/calendar.js"></script>

<script>
  (function() {
    var yearsElement = document.getElementById('calendar-years');
    var statusElement = document.getElementById('calendar-status');
    var calendarElement = document.getElementById('calendar');
    var gridControls = document.getElementById('calendar-grid-controls');
    var detailTitle = document.getElementById('calendar-detail-title');
    var detailNote = document.getElementById('calendar-detail-note');
    var updatesElement = document.getElementById('calendar-updates');
    var selectedYear;
    var latestYear;

    function getYears(data) {
      var years = [];
      Object.keys(data).forEach(function(date) {
        var year = date.slice(0, 4);
        if (years.indexOf(year) === -1) years.push(year);
      });
      return years.sort().reverse();
    }

    function getArticleCount(data, year) {
      return Object.keys(data).reduce(function(total, date) {
        return total + (date.slice(0, 4) === year ? Number(data[date]) || 0 : 0);
      }, 0);
    }

    function parseDate(value) {
      var parts = String(value).split('-').map(Number);
      return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
    }

    function getLatestDate(posts, year) {
      return Object.keys(posts)
        .filter(function(date) { return date.slice(0, 4) === year && posts[date] && posts[date].length; })
        .sort()
        .pop();
    }

    function getRecentDates(posts) {
      var today = new Date();
      today.setHours(23, 59, 59, 999);
      var cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 6);

      return Object.keys(posts)
        .filter(function(date) {
          var dateValue = parseDate(date);
          return dateValue && dateValue >= cutoff && dateValue <= today && posts[date] && posts[date].length;
        })
        .sort()
        .reverse();
    }

    function getRecords(posts, dates) {
      return dates.reduce(function(records, date) {
        return records.concat((posts[date] || []).map(function(post) {
          return { post: post, date: date };
        }));
      }, []);
    }

    function appendText(parent, tagName, className, value) {
      var element = document.createElement(tagName);
      element.className = className;
      element.textContent = value || '';
      parent.appendChild(element);
      return element;
    }

    function normalizeDateKey(value) {
      if (typeof value === 'number' || /^\d{10,}$/.test(String(value))) {
        var timestamp = new Date(Number(value));
        if (!isNaN(timestamp.getTime())) {
          return timestamp.getFullYear() + '-' + String(timestamp.getMonth() + 1).padStart(2, '0') + '-' + String(timestamp.getDate()).padStart(2, '0');
        }
      }
      return String(value || '').slice(0, 10);
    }

    function renderUpdates(posts, dates, title, note) {
      var records = getRecords(posts, dates);
      detailTitle.textContent = title;
      detailNote.textContent = note;
      updatesElement.innerHTML = '';

      if (!records.length) {
        updatesElement.innerHTML = '<div class="calendar-empty">這段時間沒有更新紀錄；可以點選其他日期找回以前的文章。</div>';
        return;
      }

      var fragment = document.createDocumentFragment();
      records.forEach(function(record) {
        var post = record.post || {};
        var link = document.createElement('a');
        link.className = 'calendar-update-card';
        link.href = post.url || '#';

        var date = appendText(link, 'time', 'calendar-update-date', record.date);
        date.setAttribute('datetime', record.date);
        var copy = document.createElement('span');
        copy.className = 'calendar-update-copy';
        appendText(copy, 'span', 'calendar-update-category', (post.categories || []).join(' / ') || '未分類');
        appendText(copy, 'strong', 'calendar-update-title', post.title || '未命名文章');
        link.appendChild(copy);
        appendText(link, 'span', 'calendar-update-arrow', '↗');
        fragment.appendChild(link);
      });
      updatesElement.appendChild(fragment);
    }

    function bindCalendarClick(chart, posts) {
      if (!chart || typeof chart.on !== 'function') return;
      chart.on('click', function(params) {
        var data = params && params.data;
        var date = Array.isArray(data) ? data[0] : (params && params.value);
        if (Array.isArray(date)) date = date[0];
        date = normalizeDateKey(date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        renderUpdates(posts, [date], date + ' 更新內容', '點選其他格子查看日期');
      });
    }

    function renderGridControls(posts, year) {
      gridControls.innerHTML = '';
      var start = new Date(Number(year), 0, 1);
      var startDay = start.getDay();
      var dayCount = new Date(Number(year), 1, 0).getDate() === 29 ? 366 : 365;

      for (var dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
        var date = new Date(Number(year), 0, dayIndex + 1);
        var key = year + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        var count = (posts[key] || []).length;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'calendar-grid-button';
        button.style.gridColumn = String(Math.floor((startDay + dayIndex) / 7) + 1);
        button.style.gridRow = String(date.getDay() + 1);
        button.setAttribute('aria-label', key + ' 更新 ' + count + ' 篇文章');
        button.title = key + '：' + count + ' 篇文章';
        button.addEventListener('click', function(selectedDate) {
          return function() {
            renderUpdates(posts, [selectedDate], selectedDate + ' 更新內容', '點選其他格子查看日期');
          };
        }(key));
        gridControls.appendChild(button);
      }
    }

    function showYear(data, posts, year) {
      selectedYear = year;
      calendarElement.innerHTML = '';
      var chart = Calendar.init('calendar', { data: data, year: year });
      renderGridControls(posts, year);
      bindCalendarClick(chart, posts);
      statusElement.textContent = '顯示 ' + year + ' 年：' + getArticleCount(data, year) + ' 篇文章';

      Array.prototype.forEach.call(yearsElement.querySelectorAll('button'), function(button) {
        button.classList.toggle('is-active', button.getAttribute('data-year') === selectedYear);
      });

      if (year === latestYear) {
        var recentDates = getRecentDates(posts);
        if (recentDates.length) {
          renderUpdates(posts, recentDates, '近一週有更新的文章', '只顯示有異動的日期');
          return;
        }
      }

      var latestDate = getLatestDate(posts, year);
      renderUpdates(posts, latestDate ? [latestDate] : [], latestDate ? latestDate + ' 更新內容' : year + ' 年更新內容', '點選熱力圖格子查看其他日期');
    }

    Promise.all([
      fetch('/calendar.json').then(function(response) {
        if (!response.ok) throw new Error('calendar.json request failed');
        return response.json();
      }),
      fetch('/calendar-posts.json').then(function(response) {
        if (!response.ok) throw new Error('calendar-posts.json request failed');
        return response.json();
      })
    ])
      .then(function(results) {
        var data = results[0];
        var posts = results[1];
        var years = getYears(data);
        latestYear = years[0] || String(new Date().getFullYear());

        years.forEach(function(year) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'calendar-year-button';
          button.setAttribute('data-year', year);
          button.textContent = year;
          button.addEventListener('click', function() { showYear(data, posts, year); });
          yearsElement.appendChild(button);
        });

        showYear(data, posts, latestYear);
      })
      .catch(function(error) {
        console.error(error);
        statusElement.textContent = '文章更新資料讀取失敗，請稍後再試。';
        calendarElement.innerHTML = '';
        updatesElement.innerHTML = '<div class="calendar-empty">目前無法整理更新紀錄。</div>';
      });
  })();
</script>

<style>
  .calendar-page {
    --calendar-ink: #2d2521;
    --calendar-brown: #4a3028;
    --calendar-blue: #243d4b;
    --calendar-orange: #e36b2f;
    --calendar-gold: #f1aa58;
    --calendar-paper: #f7eedc;
    --calendar-line: rgba(74, 48, 40, .28);
    padding: 22px;
    color: var(--calendar-ink);
    background:
      linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
      var(--calendar-paper);
    background-size: 18px 18px;
    border: 1px solid var(--calendar-line);
    box-shadow: 5px 5px 0 rgba(74, 48, 40, .14);
    font-family: Georgia, "Noto Serif TC", serif;
  }

  .calendar-page * { box-sizing: border-box; }
  .calendar-status { margin: 12px 0 0; color: #96745e; text-align: center; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  .calendar-years { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .calendar-year-button {
    padding: 6px 14px;
    color: var(--calendar-brown);
    background: #efe0c7;
    border: 1px solid #c7a17a;
    cursor: pointer;
    font: 11px "Courier New", monospace;
    letter-spacing: 1px;
  }
  .calendar-year-button:hover,
  .calendar-year-button.is-active { color: #fff4dc; background: var(--calendar-blue); border-color: var(--calendar-blue); }
  .calendar-scroll { width: 100%; margin-top: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .calendar-chart-wrap { position: relative; width: 100%; min-width: 800px; height: 250px; }
  .calendar-chart { position: relative; z-index: 1; width: 100%; min-width: 800px; height: 250px; }
  .calendar-grid-controls {
    position: absolute;
    z-index: 2;
    top: 80px;
    right: 30px;
    left: 30px;
    display: grid;
    grid-template-columns: repeat(53, minmax(0, 1fr));
    grid-template-rows: repeat(7, 13px);
    height: 91px;
  }
  .calendar-grid-button { min-width: 0; margin: 0; padding: 0; background: transparent; border: 0; cursor: pointer; }
  .calendar-grid-button:hover { background: rgba(227, 107, 47, .13); outline: 1px solid rgba(227, 107, 47, .45); }
  .calendar-grid-button:focus-visible { outline: 2px solid var(--calendar-orange); outline-offset: -1px; }
  .calendar-loading { padding: 50px; color: #96745e; text-align: center; font: 11px "Courier New", monospace; }

  .calendar-details { margin-top: 28px; }
  .calendar-details-heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-bottom: 9px;
    border-bottom: 2px solid var(--calendar-brown);
  }
  .calendar-details-heading > span { color: var(--calendar-orange); font: bold 12px "Courier New", monospace; letter-spacing: 1.5px; }
  .calendar-details-heading h2 { margin: 0; color: var(--calendar-brown); font-size: 21px; }
  .calendar-details-heading small { margin-left: auto; color: #96745e; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  .calendar-updates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
  .calendar-update-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 72px;
    padding: 12px 14px;
    color: var(--calendar-ink);
    background: rgba(255, 252, 243, .86);
    border: 1px solid var(--calendar-line);
    box-shadow: 3px 3px 0 rgba(74, 48, 40, .12);
    text-decoration: none;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  }
  .calendar-update-card:hover { color: var(--calendar-ink); border-color: var(--calendar-orange); transform: translate(-2px, -2px); box-shadow: 5px 5px 0 rgba(74, 48, 40, .16); }
  .calendar-update-date { color: #76513f; font: 10px "Courier New", monospace; white-space: nowrap; }
  .calendar-update-copy { min-width: 0; }
  .calendar-update-category { display: block; overflow: hidden; color: var(--calendar-orange); font: 10px "Courier New", monospace; letter-spacing: .5px; text-overflow: ellipsis; white-space: nowrap; }
  .calendar-update-title { display: block; overflow: hidden; margin-top: 5px; color: var(--calendar-brown); font-size: 15px; font-weight: normal; text-overflow: ellipsis; white-space: nowrap; }
  .calendar-update-arrow { color: var(--calendar-orange); font: 16px "Courier New", monospace; }
  .calendar-empty { padding: 18px; color: #6b5547; background: rgba(255, 252, 243, .86); border: 1px solid var(--calendar-line); line-height: 1.8; }

  @media (max-width: 767px) {
    .calendar-page { margin-right: -8px; margin-left: -8px; padding: 12px; }
    .calendar-years { justify-content: flex-start; }
    .calendar-chart-wrap,
    .calendar-chart { min-width: 700px; }
    .calendar-grid-controls { top: 30px; right: 5px; left: 5px; grid-template-rows: repeat(7, 10px); height: 70px; }
    .calendar-details-heading { flex-wrap: wrap; }
    .calendar-details-heading small { width: 100%; margin-left: 0; }
    .calendar-updates { grid-template-columns: 1fr; }
  }
</style>
