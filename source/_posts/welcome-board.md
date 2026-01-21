---
title: System Ready...
date: 2026-01-21 21:00:00
sticky: 100
comments: false
reward: false
---

<style>
  .post-header, .post-footer { display: none !important; }
  .post-block.sticky {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin-top: 0 !important;
  }
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

<div class="terminal-box" style="
    display: flex; 
    background: #191414; 
    padding: 30px; 
    border-radius: 8px; 
    font-family: 'Courier New', monospace; 
    color: #ffb74d; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    border: 1px solid #3e2723;
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
    <div><i class="fa fa-music" style="color: #ffa726;"></i> AUDIO: Stereo</div>
    <div><i class="fa fa-eye" style="color: #ffa726;"></i> VIEW: Nostalgia</div>
    <div><i class="fa fa-clock-o" style="color: #ffa726;"></i> TIME: <span id="clock-display">00:00:00</span></div>
    
<div style="margin-top: 15px; color: #ef6c00; font-weight: bold; animation: blink-red 2s infinite; display: flex; align-items: center;">
   <span style="width: 10px; height: 10px; background-color: #ef6c00; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
   REC
</div>

</div>

<script>
  const text = "從 1995 開始的日子有些走遠了，有些仍在前方。\n期待著能珍藏著一些屬於我的回憶與那些回不去的日子...";
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
  
  typeWriter();
  
  function updateTime() {
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];
    document.getElementById("clock-display").innerText = timeString;
  }
  setInterval(updateTime, 1000);
  updateTime();
</script>

<style>
  .cursor { color: #ffb74d; animation: blink 1s infinite; }
  @keyframes blink { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes blink-red { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
</style>