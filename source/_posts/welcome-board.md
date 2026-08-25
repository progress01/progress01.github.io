---
categories: [站務]
title: System Ready...
date: 2026-01-21 21:00:00
sticky: 100
comments: false
reward: false
---

{% raw %}
<style>
/* 防止標題閃爍 */
.page-home .post-block:first-of-type .post-header { opacity: 0; }

/* 儀表板全域字體 */
.terminal-box { font-family: 'Courier New', monospace; }

/* 連結樣式重置 */
.terminal-box a {
    text-decoration: none !important;
    border-bottom: none !important;
    cursor: pointer;
    transition: all 0.3s ease;
}

/* PLAY 按鈕 */
.play-btn {
    color: #e65100 !important; 
    font-weight: bold;
    padding: 2px 8px;
    border: 1px solid transparent;
    white-space: nowrap;
}
.play-btn:hover {
    background-color: #e65100;
    color: #191414 !important;
    border-radius: 4px;
    box-shadow: 0 0 10px #e65100;
}

/* TAPE 連結 */
.tape-link {
    color: #ffcc80 !important;
    border-bottom: 1px dashed #ffcc80 !important;
}
.tape-link:hover {
    color: #fff !important;
    border-bottom: 1px solid #fff !important;
}

/* 左下角進度條動畫 */
.loading-bar-container {
    width: 100%;
    height: 4px;
    background: #3e2723;
    margin-top: auto;
    margin-bottom: 5px;
    position: relative;
    overflow: hidden;
}
.loading-bar {
    width: 40%;
    height: 100%;
    background: #e65100;
    position: absolute;
    left: -40%;
    animation: load 3s infinite linear;
}
@keyframes load {
    0% { left: -40%; }
    100% { left: 100%; }
}
.loading-text {
    font-size: 10px; 
    color: #5d4037; 
    margin-top: 5px;
    letter-spacing: 2px;
}

/* --- 🆕 新增：1988 風格音頻跳動條 CSS --- */
.equalizer {
    display: inline-flex;
    align-items: flex-end;
    height: 14px; /* 高度設定 */
    width: 16px;  /* 總寬度 */
    margin-right: 8px; /* 跟文字保持距離 */
}
.bar {
    width: 3px; /* 每一條的寬度 */
    background-color: #ffa726; /* 使用原本圖示的顏色 */
    margin-right: 2px; /* 條之間的間距 */
    animation: bounce 1s infinite ease-in-out;
    border-radius: 1px 1px 0 0; /* 上面圓角 */
}
/* 讓三根柱子跳動節奏不一樣，製造隨機感 */
.bar:nth-child(1) { animation-duration: 0.8s; height: 40%; animation-delay: -0.2s; }
.bar:nth-child(2) { animation-duration: 1.1s; height: 80%; animation-delay: -0.4s; }
.bar:nth-child(3) { animation-duration: 1.3s; height: 50%; animation-delay: -0.6s; }

@keyframes bounce {
    0%, 100% { height: 20%; opacity: 0.6; }
    50% { height: 100%; opacity: 1; }
}

/* 手機版適配 */
@media (max-width: 767px) {
    .terminal-box { flex-direction: column; }
    .terminal-left { margin-bottom: 20px; }
    .terminal-right { 
      border-left: none !important; 
      border-top: 1px dashed #5d4037; 
      padding-left: 0 !important;
      padding-top: 20px;
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
    margin-top: -20px;
">
  
  <div class="terminal-left" style="
    flex: 2; 
    min-width: 250px; 
    display: flex; 
    flex-direction: column; 
    justify-content: space-between;
  ">
    <div style="display: flex; align-items: flex-start;">
        <div style="margin-right: 15px; flex-shrink: 0;">
            <a href="/tags/音樂推薦/" class="play-btn">
                PLAY <i class="fa fa-play"></i>
            </a>
        </div>
        <div style="line-height: 1.8;">
             <span id="typewriter-text"></span><span class="cursor">_</span>
        </div>
    </div>
    <div style="margin-top: 30px; opacity: 0.7;">
        <div class="loading-bar-container">
            <div class="loading-bar"></div>
        </div>
        <div class="loading-text">SYSTEM_SYNCING... [||||||||||]</div>
    </div>
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
    <div>
        <i class="fa fa-film" style="color: #ffa726;"></i> TAPE: 
        <a href="/archives/" class="tape-link">Life_Vol.1</a>
    </div>
    
    <div style="display: flex; align-items: center;">
        <div class="equalizer">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
        </div>
        AUDIO: Don't worry
    </div>
    
    <div>
        <i class="fa fa-eye" style="color: #ffa726;"></i> VIEW: 
        <a href="/photos/" class="tape-link" title="記憶縮影">（´◔​∀◔`)</a>
    </div>

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

  // 隱藏標題
  function killHeader() {
    var me = document.getElementById("my-dashboard");
    if (me) {
      var article = me.closest('article') || me.closest('.post-block');
      if (article) {
        var header = article.querySelector('.post-header');
        var footer = article.querySelector('.post-footer');
        
        if (header) { header.style.display = 'none'; }
        if (footer) { footer.style.display = 'none'; }
        
        article.style.background = 'transparent';
        article.style.boxShadow = 'none';
        article.style.padding = '0';
      }
    }
  }

  typeWriter();
  setInterval(updateTime, 1000);
  updateTime();
  
  killHeader();
  document.addEventListener("DOMContentLoaded", killHeader);
  window.addEventListener("load", killHeader);
</script>

<style>
  .cursor { color: #ffb74d; animation: blink 1s infinite; }
  @keyframes blink { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes blink-red { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
</style>
{% endraw %}
