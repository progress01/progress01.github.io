---
title: 閱讀管理
date: 2026-01-19 12:00:00
comments: false
---

### 📖 目前主打：AI時代的提問力
<a href="https://www.books.com.tw/products/0011025033?srsltid=AfmBOop_p32lWDzbJY7yQyPq_76w7vULoznHHFabimfKXbPDHrmfW-8_" target="_blank">書籍連結 -> 點此前往</a>

{% raw %}
<style>
  /* --- 1. 進度條樣式 --- */
  .reading-progress-container {
    width: 100%; background-color: #e0e0e0; border-radius: 8px; margin: 10px 0; overflow: hidden;
  }
  .progress-inner {
    height: 24px; background-color: #ffa726; text-align: center; line-height: 24px;
    color: white; font-size: 12px; border-radius: 8px 0 0 8px; transition: width 0.5s ease;
  }

  /* --- 2. 滑動卡片樣式 (微型動態) --- */
  .scrolling-wrapper {
    display: flex; flex-wrap: nowrap; overflow-x: auto; 
    -webkit-overflow-scrolling: touch; padding-bottom: 15px; margin-bottom: 20px;
  }
  .scrolling-wrapper::-webkit-scrollbar { display: none; } /* 隱藏捲軸 */
  
  .update-card {
    flex: 0 0 auto; width: 240px; margin-right: 15px;
    background: #f9f9f9; border: 1px solid #eee; border-radius: 8px;
    padding: 15px; font-size: 14px; position: relative;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: transform 0.2s;
  }
  .update-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
  
  .card-date { font-size: 11px; color: #aaa; margin-bottom: 8px; font-family: monospace; border-bottom: 1px dashed #ddd; padding-bottom: 5px; display: block;}
  .tag-icon { position: absolute; top: 10px; right: 10px; font-size: 16px; opacity: 0.5; }
  .card-content { line-height: 1.6; color: #444; font-size: 13px; text-align: justify;}

  /* --- 3. 歷史傳送門卡片 --- */
  .archive-card { background: #3e2723; color: #ffcc80; display: flex; align-items: center; justify-content: center; cursor: pointer; }
</style>

<div class="reading-progress-container">
  <div class="progress-inner" style="width: 5%;">5%</div>
</div>
{% endraw %}

撰寫進度：努力掙扎中

---

### 📻 碎碎念與動態 (左右滑動)

{% raw %}
<div id="microblog-container" class="scrolling-wrapper">
    <div style="padding:20px; color:#888;">正在載入動態...</div>
</div>

<script>
fetch('/microblog.json')
  .then(response => response.json())
  .then(data => {
    const container = document.getElementById('microblog-container');
    container.innerHTML = ''; 

    // 取前 6 筆顯示
    data.slice(0, 6).forEach(item => {
      const card = `
        <div class="update-card">
            <span class="tag-icon">${item.tag}</span>
            <span class="card-date">${item.date}</span>
            <div class="card-content">${item.content}</div>
        </div>
      `;
      container.innerHTML += card;
    });

    // 補上歷史按鈕
    container.innerHTML += `
      <a href="/status/" class="update-card archive-card" style="text-decoration:none;">
        <div style="text-align:center;">
            <i class="fa fa-archive" style="font-size:24px; display:block; margin-bottom:5px;"></i>
            <div>查看歷史存檔</div>
        </div>
      </a>
    `;
  })
  .catch(err => {
      console.error(err);
      document.getElementById('microblog-container').innerHTML = '暫無動態';
  });
</script>
{% endraw %}

---

### 📚 圖書館書單 (2026/03/03 到期)
1. 許雅淑 (社會學) - **何苦為男?**
2. 蔡易澄 - **千禧年後臺灣文學社群的生產與介入**
3. 韋柏 - **世界要完蛋了, 我卻還要工作?**
4. 漫遊藝術史作者群 - **漫遊藝術史**
5. 河本美紀 - **文字作者 張愛玲的電影史**


### 📅 閱讀衝刺規劃

{% raw %}
<div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;">
  <pre class="mermaid">
    gantt
      dateFormat  YYYY-MM-DD
      axisFormat %m/%d
      section 衝刺中
      提問力筆記 :crit, active, b1, 2026-01-22, 14d
      section 已完成
      AI 時代的提問力 :done, b2, 2026-01-01, 2026-01-21
  </pre>
</div>

<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  
  mermaid.initialize({ 
    startOnLoad: true,
    theme: 'neutral',
    gantt: { barHeight: 20, fontSize: 12 }
  });
</script>
{% endraw %}