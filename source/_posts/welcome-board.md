---
title: System Ready...
date: 2026-01-21 21:00:00
sticky: 100
comments: false
reward: false
---

<style>
/* 為了防止 JS 跑太慢，先用 CSS 擋一下首頁第一篇文章的標題 */
 /* 如果這個失效，下面的 JS 會補刀 */
.page-home .post-block:first-of-type .post-header { opacity: 0; }
  
  /* 儀表板基本設定 */
  .terminal-box { font-family: 'Courier New', monospace; }
  
  /* 手機版適配 */
  @media (max-width: 767px) {
    .terminal-box { flex-direction: column; }
    .terminal-right { 
      border-left: none !important; 
      border-top: 1px dashed #5d4037; 
      padding-left: 0 !important;
      padding-top: 20px;
      margin-top: 20px;
    }
  }
</style>

<div id="my-dashboard" class="terminal-box" style="
    display: flex; 
    background: #191414; 
    padding: 30px; 
    border-radius: 8px; 
    color: #ffb74d; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    border: 1px solid #3e2723;
    margin-top: -20px; /* 微調位置，讓它往上頂一點 */
">
  
  <div style="flex: 2; min-width: 250px;">
    <span style="color: #e65100; font-weight:bold;">PLAY <i class="fa fa-play"></i></span> 
    <span id="typewriter-text"></span><span class="cursor">_</span>
  </div>

  <div class="terminal-right" style="
    flex: 1; 
    min-width: 200px; 
    border-left: 1px dashed #5d4037; 
    padding-left: 30px; 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    color: #ffcc80; 
    font-size: 14px;
    line-height: 1.8;
  ">
<div><i class="fa fa-film" style="color: #ffa726;"></i> TAPE: Life_Vol.1</div>
<div><i class="fa fa-music" style="color: #ffa726;"></i> AUDIO: Don't worry</div>
<div><i class="fa fa-eye" style="color: #ffa726;"></i> VIEW: （´◔​∀◔`)</div>
<div><i class="fa fa-clock-o" style="color: #ffa726;"></i> TIME: <span id="clock-display">00:00:00</span></div>
    
<div style="margin-top: 15px; color: #ef6c00; font-weight: bold; animation: blink-red 2s infinite; display: flex; align-items: center;">
<span style="width: 10px; height: 10px; background-color: #ef6c00; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
REC
</div>
</div>

</div>

<script>
  // 打字機與時鐘功能
  const text = "從 1995 開始的日子有些走遠了，有些仍在前方。\n收藏往後回望的自己與那些回不去的日子....";
  const speed = 80; 
  let i = 0;
  
  function typeWriter() {
    if (i < text.length) {
      if (text.charAt(i) === '\n') {
        document.getElementById("typewriter-text").innerHTML += "<br/><br/>";
      } else {
        document.getElementById("typewriter-text").innerHTML += text.charAt(i);
      }
      i++;
      setTimeout(typeWriter, speed);
    }
  }
  
  function updateTime() {
    const now = new Date();
    document.getElementById("clock-display").innerText = now.toTimeString().split(' ')[0];
  }

  // 🔥 關鍵邏輯：找到我自己，然後殺掉我的標題
  function killHeader() {
    // 1. 找到儀表板本體
    var me = document.getElementById("my-dashboard");
    if (me) {
      // 2. 往上找最近的文章容器 (article 或 .post-block)
      var article = me.closest('article') || me.closest('.post-block');
      if (article) {
        // 3. 在這個容器裡面，找到標題 (header) 和 底部 (footer)
        var header = article.querySelector('.post-header');
        var footer = article.querySelector('.post-footer');
        
        // 4. 隱藏它們
        if (header) { header.style.display = 'none'; }
        if (footer) { footer.style.display = 'none'; }
        
        // 5. 順便把容器的白邊去掉 (暴力滿版)
        article.style.background = 'transparent';
        article.style.boxShadow = 'none';
        article.style.padding = '0';
      }
    }
  }

  // 執行順序
  typeWriter();
  setInterval(updateTime, 1000);
  updateTime();
  
  // 為了保險，我們執行兩次隱藏指令 (一次現在，一次等頁面載完)
  killHeader();
  document.addEventListener("DOMContentLoaded", killHeader);
  window.addEventListener("load", killHeader);
</script>

<style>
  .cursor { color: #ffb74d; animation: blink 1s infinite; }
  @keyframes blink { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes blink-red { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
</style>