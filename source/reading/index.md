---
title: 草稿夾
date: 2026-08-29 12:00:00
layout: page
comments: false
---

<p class="draft-desk-intro">還沒寫完的東西先放在這裡公開。哪天發表的，看<a href="/calendar/">發表日曆</a>。</p>

{% draft_desk %}

<script>
  (function() {
    // 搜尋結果會連到 /reading/#題目 id；題目在收合區時先打開再捲過去。
    function locateDraft() {
      var id = decodeURIComponent(location.hash.slice(1));
      var card = id && document.getElementById(id);
      if (!card || !card.classList.contains('draft-desk-card')) return;
      var details = card.closest('details');
      if (details) details.open = true;
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'center' });
    }
    window.addEventListener('hashchange', locateDraft);
    locateDraft();
  })();
</script>

<style>
  .draft-desk-intro { color: #6b5547; font-size: 14px; }
  .draft-desk {
    --draft-ink: #2d2521;
    --draft-brown: #79382f;
    --draft-orange: #c96545;
    --draft-paper: #f7eedc;
    --draft-line: rgba(121, 56, 47, .28);
    padding: 22px;
    color: var(--draft-ink);
    background:
      linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
      var(--draft-paper);
    background-size: 18px 18px;
    border: 1px solid var(--draft-line);
    box-shadow: 5px 5px 0 rgba(121, 56, 47, .14);
    font-family: Georgia, "Noto Serif TC", serif;
  }
  .draft-desk * { box-sizing: border-box; }
  .draft-desk-section + .draft-desk-section { margin-top: 26px; }
  .draft-desk-heading { display: flex; align-items: baseline; gap: 10px; padding-bottom: 9px; border-bottom: 2px solid var(--draft-brown); }
  .draft-desk-heading > span { color: var(--draft-orange); font: bold 12px "Courier New", monospace; letter-spacing: 1.5px; white-space: nowrap; }
  .draft-desk-heading h2 { margin: 0; color: var(--draft-brown); font-size: 21px; }
  .draft-desk-heading small { margin-left: auto; color: #96745e; font: 10px "Courier New", monospace; letter-spacing: 1px; }
  summary.draft-desk-heading { cursor: pointer; list-style: none; }
  summary.draft-desk-heading::-webkit-details-marker { display: none; }
  summary.draft-desk-heading h2::after { content: " ＋"; color: var(--draft-orange); font-size: 14px; }
  details[open] > summary.draft-desk-heading h2::after { content: " －"; }
  .draft-desk-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
  .draft-desk-card {
    min-width: 0;
    padding: 12px 14px;
    background: rgba(255, 252, 243, .86);
    border: 1px solid var(--draft-line);
    border-left: 3px solid var(--draft-orange);
    box-shadow: 3px 3px 0 rgba(121, 56, 47, .12);
  }
  .draft-desk-card.is-stuck { border-left-color: #a98261; }
  .draft-desk-card.is-dropped,
  .draft-desk-card.is-done { border-left-color: #cdb9a2; }
  .draft-desk-card-meta { display: flex; gap: 8px; align-items: center; min-width: 0; color: var(--draft-orange); font: 10px "Courier New", monospace; letter-spacing: .5px; }
  .draft-desk-card-meta > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .draft-desk-state { flex: none; padding: 2px 5px; color: #fff4dc; background: var(--draft-orange); }
  .is-stuck .draft-desk-state { background: #a98261; }
  .is-dropped .draft-desk-state,
  .is-done .draft-desk-state { color: #6b5547; background: #e6d6c0; }
  .draft-desk-title { margin: 7px 0 0; font-size: 15px; font-weight: normal; line-height: 1.5; }
  .draft-desk-title a { color: var(--draft-brown); border-bottom: 0; }
  .draft-desk-title a:hover { color: var(--draft-orange); }
  .draft-desk-next { margin: 6px 0 0; font-size: 13px; line-height: 1.7; color: #4a3028; }
  .draft-desk-next span { margin-right: 6px; color: #96745e; font-weight: 600; }
  .draft-desk-dates { margin: 6px 0 0; color: #76513f; font: 10px "Courier New", monospace; }
  .draft-desk-empty { margin: 14px 0 0; color: #6b5547; font-size: 14px; }

  @media (max-width: 767px) {
    .draft-desk { margin-right: -8px; margin-left: -8px; padding: 12px; }
    .draft-desk-heading { flex-wrap: wrap; }
    .draft-desk-heading small { width: 100%; margin-left: 0; }
    .draft-desk-list { grid-template-columns: 1fr; }
  }
</style>
