---
title: 文章產出日曆
date: 2026-01-24 12:00:00
layout: page
comments: false
---

{% raw %}
<div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 20px;">
    
    <div id="calendar" style="width: 100%; min-width: 800px; height: 250px;">
       <div style="text-align: center; padding: 50px;">
         <i class="fa fa-spinner fa-spin"></i> Loading Graph...
       </div>
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
        // 初始化圖表
        Calendar.init('calendar', { data: data });
      })
      .catch(err => {
        console.error(err);
        document.getElementById('calendar').innerHTML = "讀取失敗，請確認 calendar.json 存在";
      });
  })();
</script>
{% endraw %}