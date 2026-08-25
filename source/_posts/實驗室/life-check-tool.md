---
categories: [觀念與實驗]
title: 混亂日常的一個「存檔點」工具設計
date: 2026-02-02 12:00:00
tags: [自製工具, 實驗室]
---

###  專案說明 (The Pain Point)

說明文字(待補)


 <!-- more -->

### 作品展示 (Live Demo)

與其說原理，不如直接試用。https://progress01.github.io/lifecheck/
我在下方嵌入了這個工具的視窗，你可以直接在這裡點擊操作，體驗一下把焦慮一項項「劃掉」的快感。

{% raw %}
<style>
  /* 復古電腦視窗風格容器 */
  .retro-window {
    border: 2px solid #5d4037; 
    border-radius: 6px; 
    overflow: hidden; 
    margin: 30px 0;
    box-shadow: 4px 4px 0px #3e2723; /* 復古陰影 */
    background: #fff;
  }
  
  /* 視窗標題列 */
  .retro-title-bar {
    background: #3e2723; 
    color: #ffcc80; 
    padding: 8px 15px; 
    font-size: 14px; 
    font-family: 'Courier New', monospace;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* 紅綠燈小按鈕裝飾 */
  .window-controls span {
    display: inline-block;
    width: 10px; height: 10px;
    border-radius: 50%;
    margin-left: 5px;
  }
</style>

<div class="retro-window">
    <div class="retro-title-bar">
        <span>> SYSTEM_TOOL: LIFE_CHECK_V1.0</span>
        <div class="window-controls">
            <span style="background:#ff5f56;"></span>
            <span style="background:#ffbd2e;"></span>
            <span style="background:#27c93f;"></span>
        </div>
    </div>
    
    <iframe 
        src="https://progress01.github.io/lifecheck/" 
        style="width: 100%; height: 600px; border: none;"
        title="Life Check Tool Demo">
    </iframe>
</div>
{% endraw %}

### 👨‍💻 技術筆記 (Under the Hood)

說明待補

* **Host**：託管於 GitHub Pages，免費且穩定。
* **Tech Stack**：HTML5, CSS3, Vanilla JS (純原生 JavaScript)。
* **Design**：響應式設計 (RWD)，手機上也能完美顯示。

這個工具或許不能幫我解決工作上的大難題，但它能幫我解決生活中的小焦慮。
當我看著清單全部變綠的那一刻，我就知道：**System Ready. 可以繼續前進了。**

> **Project Status**: Stable
> **Repository**: [View on GitHub](https://github.com/progress01/lifecheck)
