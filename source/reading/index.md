---
title: 草稿夾
date: 2026-08-29 12:00:00
layout: page
comments: false
---

<div class="reading-calendar-page">
  <div id="reading-calendar-years" class="reading-calendar-years" aria-label="選擇年份"></div>
  <p id="reading-calendar-status" class="reading-calendar-status" aria-live="polite">讀取草稿資料中……</p>
  <div class="reading-calendar-scroll">
    <div class="reading-calendar-chart-wrap">
      <div id="reading-calendar" class="reading-calendar-chart" aria-label="草稿夾每日累積熱力圖">
        <div class="reading-calendar-loading"><i class="fa fa-spinner fa-spin"></i> Loading Graph...</div>
      </div>
      <div id="reading-calendar-grid-controls" class="reading-calendar-grid-controls" aria-label="選擇草稿日期"></div>
    </div>
  </div>

  <section class="reading-calendar-details" aria-live="polite">
    <div class="reading-calendar-details-heading">
      <span>RECENT / 草稿紀錄</span>
      <h2 id="reading-calendar-detail-title">最近累積的學習題目</h2>
      <small id="reading-calendar-detail-note">點選上方格子查看當天</small>
    </div>
    <div id="reading-calendar-updates" class="reading-calendar-updates">
      <div class="reading-calendar-empty">正在整理草稿紀錄……</div>
    </div>
  </section>
</div>

<script src="/lib/echarts.min.js"></script>
<script src="/lib/languages.js"></script>
<script src="/lib/calendar.js"></script>

<script>
  (function() {
    var yearsElement = document.getElementById('reading-calendar-years');
    var statusElement = document.getElementById('reading-calendar-status');
    var calendarElement = document.getElementById('reading-calendar');
    var gridControls = document.getElementById('reading-calendar-grid-controls');
    var detailTitle = document.getElementById('reading-calendar-detail-title');
    var detailNote = document.getElementById('reading-calendar-detail-note');
    var updatesElement = document.getElementById('reading-calendar-updates');
    var latestYear;
    var readingData;

    var readingColors = ['#f0e8d9', '#f4c995', '#e9a267', '#c96545', '#79382f'];

    function appendText(parent, tagName, className, value) {
      var element = document.createElement(tagName);
      element.className = className;
      element.textContent = value || '';
      parent.appendChild(element);
      return element;
    }

    function pad(value) {
      return String(value).padStart(2, '0');
    }

    function dateKey(date) {
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function todayKey() {
      return dateKey(new Date());
    }

    function allItems() {
      return readingData.topics.reduce(function(items, topic) {
        return items.concat((topic.items || []).map(function(item) {
          return { item: item, topic: topic };
        }));
      }, []);
    }

    function resolvedDate(item) {
      if (item.resolved_date) return String(item.resolved_date).slice(0, 10);
      if (item.state === 'published') return String(item.date || '').slice(0, 10);
      return '';
    }

    function isOpenAt(item, key) {
      var addedDate = String(item.date || '').slice(0, 10);
      var closedDate = resolvedDate(item);
      return addedDate && addedDate <= key && (!closedDate || closedDate > key);
    }

    function getRecords(key) {
      return allItems().filter(function(record) {
        return isOpenAt(record.item, key);
      });
    }

    function getYears() {
      var years = [Number(readingData.year) || new Date().getFullYear()];
      allItems().forEach(function(record) {
        var match = String(record.item.date || '').match(/^([0-9]{4})-/);
        if (match) years.push(Number(match[1]));
      });
      var first = Math.min.apply(null, years);
      var last = Math.max.apply(null, years);
      var result = [];
      for (var year = first; year <= last; year += 1) result.push(String(year));
      return result.sort().reverse();
    }

    function latestItemDate(year) {
      var dates = allItems().map(function(record) {
        return String(record.item.date || '').slice(0, 10);
      }).filter(function(date) {
        return date.slice(0, 4) === String(year);
      }).sort();
      return dates[dates.length - 1] || '';
    }

    function latestDataDate() {
      var dates = allItems().map(function(record) {
        return String(record.item.date || '').slice(0, 10);
      }).filter(function(date) {
        return /^\d{4}-\d{2}-\d{2}$/.test(date);
      }).sort();
      return dates[dates.length - 1] || todayKey();
    }

    function getOpenRecords() {
      return allItems().filter(function(record) {
        return !resolvedDate(record.item);
      });
    }

    function buildBacklogData(year) {
      var start = new Date(Number(year), 0, 1);
      var daysInYear = (new Date(Number(year) + 1, 0, 1) - start) / 86400000;
      var latestDate = latestDataDate();
      var data = {};
      for (var dayIndex = 0; dayIndex < daysInYear; dayIndex += 1) {
        var date = new Date(Number(year), 0, dayIndex + 1);
        var key = dateKey(date);
        if (key <= latestDate) data[key] = Math.min(4, getRecords(key).length);
      }
      return data;
    }

    function renderUpdates(records, title, note) {
      detailTitle.textContent = title;
      detailNote.textContent = note;
      updatesElement.innerHTML = '';

      if (!records.length) {
        updatesElement.innerHTML = '<div class="reading-calendar-empty">這一天沒有仍在處理的學習題目；可以點選其他日期查看累積狀態。</div>';
        return;
      }

      var fragment = document.createDocumentFragment();
      records.forEach(function(record) {
        var item = record.item;
        var link = document.createElement('a');
        link.className = 'reading-calendar-update-card';
        link.href = item.url || '#';

        appendText(link, 'time', 'reading-calendar-update-date', item.date || '未標日期');
        var copy = document.createElement('span');
        copy.className = 'reading-calendar-update-copy';
        appendText(copy, 'span', 'reading-calendar-update-category', (record.topic.name || '未分類') + ' / ' + (item.source || '未標來源'));
        appendText(copy, 'strong', 'reading-calendar-update-title', item.title || '未命名學習題目');
        appendText(copy, 'span', 'reading-calendar-update-state', item.state === 'learning' ? '學習中' : (item.state === 'collected' ? '待整理' : '已成文'));
        link.appendChild(copy);
        appendText(link, 'span', 'reading-calendar-update-arrow', '↗');
        fragment.appendChild(link);
      });
      updatesElement.appendChild(fragment);
    }

    function renderGridControls(year) {
      gridControls.innerHTML = '';
      var start = new Date(Number(year), 0, 1);
      var startDay = start.getDay();
      var dayCount = (new Date(Number(year) + 1, 0, 1) - start) / 86400000;

      for (var dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
        var date = new Date(Number(year), 0, dayIndex + 1);
        var key = dateKey(date);
        var future = key > latestDataDate();
        var count = future ? 0 : getRecords(key).length;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'reading-calendar-grid-button' + (future ? ' is-future' : '');
        button.style.gridColumn = String(Math.floor((startDay + dayIndex) / 7) + 1);
        button.style.gridRow = String(date.getDay() + 1);
        button.setAttribute('aria-label', key + ' 累積 ' + count + ' 個待解決題目');
        button.title = future ? key + '：尚未到達' : key + '：' + count + ' 個待解決題目';
        if (!future) {
          button.addEventListener('click', function(selectedDate) {
            return function() {
              renderUpdates(getRecords(selectedDate), selectedDate + ' 待解決內容', '顯示該日仍未完成的題目');
            };
          }(key));
        }
        gridControls.appendChild(button);
      }
    }

    function bindCalendarClick(chart) {
      if (!chart || typeof chart.on !== 'function') return;
      chart.on('click', function(params) {
        var data = params && params.data;
        var date = Array.isArray(data) ? data[0] : (params && params.value);
        if (Array.isArray(date)) date = date[0];
        date = String(date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > latestDataDate()) return;
        renderUpdates(getRecords(date), date + ' 待解決內容', '顯示該日仍未完成的題目');
      });
    }

    function showYear(year) {
      var selectedYear = String(year);
      var backlog = buildBacklogData(selectedYear);
      calendarElement.innerHTML = '';
      var chart = Calendar.init('reading-calendar', {
        data: backlog,
        year: selectedYear,
        colors: readingColors,
        maxValue: 4,
        tooltipUnit: '個待解決題目'
      });
      renderGridControls(selectedYear);
      bindCalendarClick(chart);

      var latestDate = latestItemDate(selectedYear);
      var currentRecords = getOpenRecords().filter(function(record) {
        return String(record.item.date || '').slice(0, 4) === selectedYear;
      });
      var latestCount = latestDate ? getRecords(latestDate).length : 0;
      statusElement.textContent = '顯示 ' + selectedYear + ' 年：' + currentRecords.length + ' 個目前未完成題目';

      Array.prototype.forEach.call(yearsElement.querySelectorAll('button'), function(button) {
        button.classList.toggle('is-active', button.getAttribute('data-year') === selectedYear);
      });

      if (currentRecords.length) {
        renderUpdates(currentRecords, '目前仍在整理的學習題目', '共 ' + currentRecords.length + ' 個未完成題目；點選熱力圖查看指定日期');
      } else if (latestDate) {
        renderUpdates(getRecords(latestDate), latestDate + ' 待解決內容', '顯示該日仍未完成的題目');
      } else {
        renderUpdates([], selectedYear + ' 年待解決內容', '點選熱力圖格子查看其他日期');
      }
    }

    fetch('/reading-desk.json')
      .then(function(response) {
        if (!response.ok) throw new Error('reading-desk.json request failed');
        return response.json();
      })
      .then(function(result) {
        readingData = result || { year: new Date().getFullYear(), topics: [] };
        var years = getYears();
        latestYear = years[0] || String(new Date().getFullYear());

        years.forEach(function(year) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'reading-calendar-year-button';
          button.setAttribute('data-year', year);
          button.textContent = year;
          button.addEventListener('click', function() { showYear(year); });
          yearsElement.appendChild(button);
        });

        showYear(latestYear);
      })
      .catch(function(error) {
        console.error(error);
        statusElement.textContent = '草稿資料讀取失敗，請稍後再試。';
        calendarElement.innerHTML = '';
        updatesElement.innerHTML = '<div class="reading-calendar-empty">目前無法整理草稿紀錄。</div>';
      });
  })();
</script>

<style>
  .reading-calendar-page {
    --reading-calendar-ink: #2d2521;
    --reading-calendar-brown: #79382f;
    --reading-calendar-orange: #c96545;
    --reading-calendar-gold: #e9a267;
    --reading-calendar-paper: #f7eedc;
    --reading-calendar-line: rgba(121, 56, 47, .28);
    padding: 22px;
    color: var(--reading-calendar-ink);
    background:
      linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
      var(--reading-calendar-paper);
    background-size: 18px 18px;
    border: 1px solid var(--reading-calendar-line);
    box-shadow: 5px 5px 0 rgba(121, 56, 47, .14);
    font-family: Georgia, "Noto Serif TC", serif;
  }

  .reading-calendar-page * { box-sizing: border-box; }
  .reading-calendar-status { margin: 12px 0 0; color: #96745e; text-align: center; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  .reading-calendar-years { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .reading-calendar-year-button {
    padding: 6px 14px;
    color: var(--reading-calendar-brown);
    background: #f0dfca;
    border: 1px solid #c99572;
    cursor: pointer;
    font: 11px "Courier New", monospace;
    letter-spacing: 1px;
  }
  .reading-calendar-year-button:hover,
  .reading-calendar-year-button.is-active { color: #fff4dc; background: var(--reading-calendar-brown); border-color: var(--reading-calendar-brown); }
  .reading-calendar-scroll { width: 100%; margin-top: 14px; overflow-x: auto; }
  .reading-calendar-chart-wrap { position: relative; width: 100%; min-width: 800px; height: 250px; }
  .reading-calendar-chart { position: relative; z-index: 1; width: 100%; min-width: 800px; height: 250px; }
  .reading-calendar-grid-controls {
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
  .reading-calendar-grid-button { min-width: 0; margin: 0; padding: 0; background: transparent; border: 0; cursor: pointer; }
  .reading-calendar-grid-button:hover { background: rgba(201, 101, 69, .16); outline: 1px solid rgba(201, 101, 69, .5); }
  .reading-calendar-grid-button:focus-visible { outline: 2px solid var(--reading-calendar-orange); outline-offset: -1px; }
  .reading-calendar-grid-button.is-future { cursor: default; }
  .reading-calendar-loading { padding: 50px; color: #96745e; text-align: center; font: 11px "Courier New", monospace; }

  .reading-calendar-details { margin-top: 28px; }
  .reading-calendar-details-heading { display: flex; align-items: baseline; gap: 10px; padding-bottom: 9px; border-bottom: 2px solid var(--reading-calendar-brown); }
  .reading-calendar-details-heading > span { color: var(--reading-calendar-orange); font: bold 12px "Courier New", monospace; letter-spacing: 1.5px; }
  .reading-calendar-details-heading h2 { margin: 0; color: var(--reading-calendar-brown); font-size: 21px; }
  .reading-calendar-details-heading small { margin-left: auto; color: #96745e; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  .reading-calendar-updates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
  .reading-calendar-update-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 82px;
    padding: 12px 14px;
    color: var(--reading-calendar-ink);
    background: rgba(255, 252, 243, .86);
    border: 1px solid var(--reading-calendar-line);
    box-shadow: 3px 3px 0 rgba(121, 56, 47, .12);
    text-decoration: none;
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  }
  .reading-calendar-update-card:hover { color: var(--reading-calendar-ink); border-color: var(--reading-calendar-orange); transform: translate(-2px, -2px); box-shadow: 5px 5px 0 rgba(121, 56, 47, .16); }
  .reading-calendar-update-date { color: #76513f; font: 10px "Courier New", monospace; white-space: nowrap; }
  .reading-calendar-update-copy { min-width: 0; }
  .reading-calendar-update-category { display: block; overflow: hidden; color: var(--reading-calendar-orange); font: 10px "Courier New", monospace; letter-spacing: .5px; text-overflow: ellipsis; white-space: nowrap; }
  .reading-calendar-update-title { display: block; overflow: hidden; margin-top: 5px; color: var(--reading-calendar-brown); font-size: 15px; font-weight: normal; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
  .reading-calendar-update-state { display: inline-block; margin-top: 6px; padding: 2px 5px; color: #fff4dc; background: var(--reading-calendar-orange); font: 9px "Courier New", monospace; letter-spacing: .5px; }
  .reading-calendar-update-arrow { color: var(--reading-calendar-orange); font: 16px "Courier New", monospace; }
  .reading-calendar-empty { padding: 18px; color: #6b5547; background: rgba(255, 252, 243, .86); border: 1px solid var(--reading-calendar-line); line-height: 1.8; }

  @media (max-width: 767px) {
    .reading-calendar-page { margin-right: -8px; margin-left: -8px; padding: 12px; }
    .reading-calendar-years { justify-content: flex-start; }
    .reading-calendar-chart-wrap,
    .reading-calendar-chart { min-width: 700px; }
    .reading-calendar-grid-controls { top: 30px; right: 5px; left: 5px; grid-template-rows: repeat(7, 10px); height: 70px; }
    .reading-calendar-details-heading { flex-wrap: wrap; }
    .reading-calendar-details-heading small { width: 100%; margin-left: 0; }
    .reading-calendar-updates { grid-template-columns: 1fr; }
  }
</style>
