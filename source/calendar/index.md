---
title: 文章產出日曆
date: 2026-01-24 12:00:00
layout: page
comments: false
---

<div class="calendar-page">
  <p class="calendar-intro">用每一天留下的文章，回看這個網站慢慢長出來的時間軌跡。</p>
  <div id="calendar-years" class="calendar-years" aria-label="選擇年份"></div>
  <p id="calendar-status" class="calendar-status" aria-live="polite">讀取文章資料中……</p>
  <div class="calendar-scroll">
    <div id="calendar" class="calendar-chart" aria-label="文章產出熱力圖">
      <div class="calendar-loading"><i class="fa fa-spinner fa-spin"></i> Loading Graph...</div>
    </div>
  </div>
</div>

<script src="/lib/echarts.min.js"></script>
<script src="/lib/languages.js"></script>
<script src="/lib/calendar.js"></script>

<script>
  (function() {
    var yearsElement = document.getElementById('calendar-years');
    var statusElement = document.getElementById('calendar-status');
    var calendarElement = document.getElementById('calendar');
    var selectedYear;

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

    function showYear(data, year) {
      selectedYear = year;
      calendarElement.innerHTML = '';
      Calendar.init('calendar', { data: data, year: year });
      statusElement.textContent = '顯示 ' + year + ' 年：' + getArticleCount(data, year) + ' 篇文章';

      Array.prototype.forEach.call(yearsElement.querySelectorAll('button'), function(button) {
        button.classList.toggle('is-active', button.getAttribute('data-year') === selectedYear);
      });
    }

    fetch('/calendar.json')
      .then(function(response) {
        if (!response.ok) throw new Error('calendar.json request failed');
        return response.json();
      })
      .then(function(data) {
        var years = getYears(data);
        years.forEach(function(year) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'calendar-year-button';
          button.setAttribute('data-year', year);
          button.textContent = year;
          button.addEventListener('click', function() { showYear(data, year); });
          yearsElement.appendChild(button);
        });

        showYear(data, years[0] || String(new Date().getFullYear()));
      })
      .catch(function(error) {
        console.error(error);
        statusElement.textContent = '文章熱力圖讀取失敗，請確認 calendar.json 存在。';
        calendarElement.innerHTML = '';
      });
  })();
</script>

<style>
  .calendar-page {
    color: #5d5147;
  }

  .calendar-intro,
  .calendar-status {
    color: #96745e;
    text-align: center;
  }

  .calendar-years {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 24px 0 10px;
  }

  .calendar-year-button {
    border: 1px solid #c7a17a;
    border-radius: 3px;
    background: #fdf6e3;
    color: #76553f;
    cursor: pointer;
    padding: 5px 14px;
  }

  .calendar-year-button:hover,
  .calendar-year-button.is-active {
    background: #2c3e50;
    color: #fff;
  }

  .calendar-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-top: 20px;
  }

  .calendar-chart {
    width: 100%;
    min-width: 800px;
    height: 250px;
  }

  .calendar-loading {
    text-align: center;
    padding: 50px;
  }

  @media (max-width: 767px) {
    .calendar-intro {
      text-align: left;
    }

    .calendar-years {
      justify-content: flex-start;
    }

    .calendar-chart {
      min-width: 700px;
    }
  }
</style>
