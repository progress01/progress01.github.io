---
title: 閱讀管理
date: 2026-01-19 12:00:00
comments: false
---

### 📖 AI時代的提問力
<a href="https://www.books.com.tw/products/0011025033?srsltid=AfmBOop_p32lWDzbJY7yQyPq_76w7vULoznHHFabimfKXbPDHrmfW-8_" target="_blank">書籍連結 -> 點此前往</a>

{% raw %}
<style>
  .reading-progress-container {
    width: 100%;
    background-color: #e0e0e0;
    border-radius: 8px;
    margin: 10px 0;
    overflow: hidden;
  }
  .progress-inner {
    height: 24px;
    background-color: #ffa726; /* 你的主題色 */
    text-align: center;
    line-height: 24px;
    color: white;
    font-size: 12px;
    border-radius: 8px 0 0 8px;
    transition: width 0.5s ease;
  }
</style>

<div class="reading-progress-container">
  <div class="progress-inner" style="width: 5%;">5%</div>
</div>
{% endraw %}

撰寫進度：努力掙扎中

---
### 📝 碎碎念筆記
* **1/21**：大型語言模型產生文字的過程類似於克漏字，所以可以透過一些技巧來讓互動更朝向自己希望的結果。我自己覺得長對話(參數過多)有時候會有過度擬合(overfitting)的問題，所以儘管中間滿多黑盒子的但透過增加克漏字的量跟設計一些內容應該是有幫助的，以下希望記錄一些我能繼續使用的技巧。

### 最近圖書館借的書(20260303到期)
1. 許雅淑 (社會學)  何苦為男? : 打破父權體制, 解放男孩擁抱自由未來 
2. 蔡易澄 千禧年後臺灣文學社群的生產與介入 : 以「小說家讀者」為觀察核心
3. 韋柏 (Weber, Sara) 世界要完蛋了, 我卻還要工作? 
4. 漫遊藝術史作者群 漫遊藝術史
5. 河本美紀, 1978- 文字作者 張愛玲的電影史


### 📅 閱讀規劃

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
    gantt: {
        barHeight: 20,
        fontSize: 12
    }
  });
</script>
{% endraw %}