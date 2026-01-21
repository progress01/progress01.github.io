---
title: 隨機傳送門
date: 2026-01-21 14:30:00
type: "random"
comments: false
---

<div id="random-loading" style="text-align: center; margin-top: 50px; font-family: sans-serif;">
  <i class="fa fa-spinner fa-spin" style="font-size: 50px; color: #2C3E50;"></i>
  <h3 style="color: #2C3E50; margin-top: 20px;">正在從 1988 迄今的時光裡抽取記憶...</h3>
</div>

<script>
  // 利用 search.xml 進行隨機跳轉
  fetch('/search.xml')
    .then(response => response.text())
    .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
    .then(data => {
      // 1. 抓出所有文章的網址
      let posts = data.querySelectorAll('entry > url');
      
      if (posts.length > 0) {
        // 2. 隨機選一個數字
        let randomIndex = Math.floor(Math.random() * posts.length);
        
        // 3. 取得該文章網址
        let randomUrl = posts[randomIndex].textContent;
        
        // 4. 執行傳送！
        window.location.href = randomUrl;
      } else {
        document.getElementById('random-loading').innerHTML = "<h3>時光機故障：找不到文章資料庫。</h3>";
      }
    })
    .catch(err => {
      console.error('Error:', err);
      document.getElementById('random-loading').innerHTML = "<h3>傳送失敗，請稍後再試。</h3>";
    });
</script>