---
title: 碎碎念歸檔
date: 2026-02-09 12:00:00
type: "status"
comments: false
---

{% raw %}
<style>
  /* --- 時間軸容器設定 --- */
  .timeline-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px 0;
    font-family: sans-serif;
  }

  /* --- 左邊那條直線 --- */
  .timeline-list {
    border-left: 3px solid #e0e0e0; /* 灰色的線 */
    padding-left: 30px;
    margin-left: 10px;
    position: relative;
  }

  /* --- 每一則動態的區塊 --- */
  .timeline-item {
    margin-bottom: 40px; /* 每則動態之間的距離 */
    position: relative;
  }

  /* --- 線上的圓點點 (裝飾用) --- */
  .timeline-item::before {
    content: '';
    position: absolute;
    left: -38px; /* 調整圓點的位置，讓它壓在線上 */
    top: 5px;
    width: 14px;
    height: 14px;
    background: #ffa726; /* 你的主題橘色 */
    border: 3px solid #fff; /* 白框，讓圓點更明顯 */
    border-radius: 50%;
    box-shadow: 0 0 5px rgba(0,0,0,0.2);
  }

  /* --- 日期與標籤 --- */
  .timeline-meta {
    font-size: 14px;
    color: #888;
    margin-bottom: 8px;
    font-family: 'Courier New', monospace; /* 復古字體 */
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .timeline-tag {
    background: #eee;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  /* --- 內容框框 --- */
  .timeline-content {
    background: #f9f9f9;
    padding: 15px 20px;
    border-radius: 8px;
    border: 1px solid #eee;
    color: #444;
    line-height: 1.6;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    transition: transform 0.2s ease;
  }

  /* 滑鼠移上去會有微微浮起的效果 */
  .timeline-content:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    border-color: #ffa726; /* 邊框變色 */
  }
</style>

<div id="timeline-app" class="timeline-container">
    <div class="timeline-list">
        <div style="color:#999;">正在連線至微型資料庫...</div>
    </div>
</div>

<script>
  // 抓取根目錄下的 microblog.json
  fetch('/microblog.json')
    .then(response => {
      if (!response.ok) throw new Error("找不到 microblog.json 檔案");
      return response.json();
    })
    .then(data => {
      const app = document.querySelector('#timeline-app .timeline-list');
      app.innerHTML = ''; // 清空載入中文字

      // 迴圈：把每一筆資料都印出來
      data.forEach(item => {
        // 建立 HTML 結構
        const html = `
          <div class="timeline-item">
            <div class="timeline-meta">
              <span>${item.date}</span>
              <span class="timeline-tag">${item.tag}</span>
            </div>
            <div class="timeline-content">
              ${item.content}
            </div>
          </div>
        `;
        // 加到網頁上
        app.innerHTML += html;
      });
    })
    .catch(err => {
      console.error(err);
      document.querySelector('#timeline-app .timeline-list').innerHTML = 
        `<div style="color:red; padding:20px; background:#ffe6e6; border-radius:8px;">
           ⚠️ 讀取失敗：請檢查 source/microblog.json 檔案是否存在且格式正確。
         </div>`;
    });
</script>
{% endraw %}