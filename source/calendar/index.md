---
title: 文章產出日曆
date: 2026-01-24 12:00:00
layout: page
comments: false
---

<div id="calendar" style="width: 100%; min-height: 250px; margin-top: 20px;">
   <div style="text-align: center; padding: 20px;">
     <i class="fa fa-spinner fa-spin"></i> Loading...
   </div>
</div>

<script src="/lib/echarts.min.js"></script>
<script src="/lib/languages.js"></script>
<script src="/lib/calendar.js"></script>

<script>
  (function() {
    fetch('/calendar.json')
      .then(res => res.json())
      .then(data => {
        document.getElementById('calendar').innerHTML = "";
        Calendar.init('calendar', { data: data });
      })
      .catch(err => {
        console.error(err);
        document.getElementById('calendar').innerHTML = "讀取失敗，請確認 calendar.json 存在";
      });
  })();
</script>