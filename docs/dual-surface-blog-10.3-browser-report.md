# 雙面部落格 WBS 10.3 真實瀏覽器旅程報告

日期：2026-09-27（Asia/Taipei）  
工作包：WBS 10.3「真實瀏覽器旅程」  
進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`

## 結果

- 使用 Google Chrome headless Chromium，直接預覽 WBS 10.2 fresh `public/`。本輪未執行 build/clean，沒有改正式輸出或產品程式。
- 桌面 1280×900 與手機 375×812；JSON evidence 共 24 項，24/24 通過。涵蓋直接進入與重載 `/profile/`、三條路徑和卡片、文章唯一 canonical、瀏覽器返回、A→B/B→A 正式切換、普通 anchor href/target、B 隨機初抽與「換一篇」重抽、文章開啟、三種搜尋範圍、手機互動、無 JavaScript 導航。
- 隨機抽籤使用網站原生 `Math.random`，沒有注入固定值。初抽及重抽結果都在 `random.json`；其中排除僅 A 面的 `website-quality-testing-roadmap`。抽中的文章以可見連結開啟，檢查唯一正文與 canonical。
- 搜尋實際命中 B 面歌曲、A 面 profile-only 學習文章，以及真正雙面文章。搜尋範圍預設分別由 A 面 profile 頁、B 面根頁開啟後確認；切換「全部公開內容」時，雙面文章只出現一筆。關閉／重開維持所在面預設；開啟搜尋結果後按瀏覽器 Back，原查詢、`all` 範圍與單筆結果均恢復。
- 無 JavaScript 時直接載入 A、B 頁；實際點擊 A→B、B→A、B 首頁履歷 bridge 及 A 面文章卡。切換、bridge、卡片、隨機備援及文章連結均保留原生 href。搜尋與隨機抽籤的 JavaScript 行為不列入 no-JS 通過條件。
- 主控台 warning/error、pageerror、requestfailed、本機 HTTP 錯誤均為 0。瀏覽器實際走完普通 anchor 導航與 Back；A/B 切換連結的 `target` 為空值（瀏覽器預設行為），可用一般 Ctrl/⌘+click 開新分頁。
- 11 張重點截圖： [桌機履歷入口](../tmp/wbs103-desktop-profile.png)、[桌機重新載入](../tmp/wbs103-desktop-profile-reload.png)、[桌機 B 面抽籤](../tmp/wbs103-desktop-home-random.png)、[手機履歷入口](../tmp/wbs103-mobile-profile.png)、[手機 B 面抽籤](../tmp/wbs103-mobile-home-random.png)、[手機搜尋面板](../tmp/wbs103-mobile-search.png)及搜尋狀態截圖（檔名列於 evidence JSON）。

### 搜尋截圖補驗

- 主審檢視首輪 evidence 後指出，三張搜尋截圖當時未呈現 overlay。這是 QA 動畫 shim／等待條件不足，不是產品缺陷；因此修正後完整重跑 24 步並覆寫本輪 JSON 與 11 張截圖，以下結果取自補跑。
- deterministic anime adapter 現在會將每個 `timeline.add`（及一般呼叫）的目標與動畫屬性套用到最後值，包括 opacity、top、transform 等，再執行完成回呼。這只模擬動畫完成狀態，不宣稱驗證動畫時序或第三方動畫視覺品質。
- `openSearch` 等待 overlay 與 popup 的 computed `display`/`visibility`、opacity、非零矩形及 `aria-hidden=false`，再輸入並截圖；手機額外要求 popup 完整位於 viewport。補跑桌機 1280×900 搜尋面板矩形為 x=259–1021、y=109–791，overlay/popup opacity 均為 1；手機 375×812 popup 為 x=9–366、y=11–801，overlay 375×812，兩者 opacity 均為 1，搜尋結果可見。補跑 24/24；console/error、pageerror、requestfailed、本機 HTTP error 均 0。
- 已目視確認[桌機搜尋面板](../tmp/wbs103-search-memory-1280.png)、[手機搜尋面板](../tmp/wbs103-search-memory-375.png)及[手機搜尋焦點狀態](../tmp/wbs103-mobile-search.png)確實顯示遮罩、搜尋面板和結果。

## 可重跑及證據

```powershell
node --check tmp/wbs103-browser-journeys.cjs
node tmp/wbs103-browser-journeys.cjs
```

QA script 將 fresh `public/` 綁定到本機 8963 port，Chrome DevTools Protocol 使用 9363 port；啟動前檢查兩個 port 可用。它只讀取 `public/`，將本輪 Chrome profile 放在 `tmp/wbs103-chrome-profile`，結束時關閉瀏覽器／server、確認兩個 port 釋放並只移除該 profile。最後確認 8963／9363 可重新 bind，profile 不存在。

逐步輸入、預期、實際結果、viewport、最終 URL、console／pageerror／requestfailed／HTTP error、截圖名及清理結果保存於 [`tmp/wbs103-browser-evidence.json`](../tmp/wbs103-browser-evidence.json)。截圖共 11 張，未重複保存相同頁面狀態。

為在無外網依賴下跑本機旅程，QA server 在送入瀏覽器的 HTML 中將外部 searchdb script 對應到專案已安裝版本，以 deterministic anime 相容 shim 套用動畫最終樣式（含 timeline steps）並呼叫完成回呼，並略去遠端字型／CSS／analytics 請求；沒有修改 `public/` 檔案或來源。搜尋截圖前明確等待面板真實可見、opacity 大於 0 及有效尺寸；手機另檢查面板在 viewport 範圍內。這讓本輪驗證真實頁面互動、目的 URL 和瀏覽器歷史，但不涵蓋第三方 CDN 可用性或動畫時序／視覺品質。A/B anchor 導航本身未由程式攔截，實際點擊後都到達目標頁。

## 相關輸出檢查

以下均 exit 0，直接以 fresh `public/` 為輸入，沒有觸發建置：

- `node --check tmp/wbs103-browser-journeys.cjs`
- `node tools/surface-transition-check.js --root public`：9 項 transition contract。
- `node tools/surface-accessibility-check.js --root public`：來源合約、3 核心路由及一般文章。
- `node tools/surface-control-output-check.js --root public`：3 頁。
- `node tools/profile-page-output-check.js --root public`：3 paths、8 path cards、2 learning cards、8 個唯一 URL。
- `node tools/random-surface-output-check.js public`：262 個候選、7 篇 profile-only 排除、1 篇雙面文章保留。
- `node tools/search-surface-output-check.js --root public`：292 records、271 篇 recent candidates、雙面文章 profile/memory/all 各一筆、21 個共用 URL 唯一紀錄及正確預設範圍。
- `git diff --check`：exit 0；只有工作樹既有 LF→CRLF 提示，無 whitespace error。

沒有發現產品缺陷，沒有修改文章、資料、網址、策展、文案或產品程式。這項工作不涵蓋 WBS 10.4 SEO/網址稽核、10.5 最終隱私輸出稽核、10.6 作者驗收包或 10.7 部署決策。G10 尚未通過；下一步 WBS 10.4。未部署、未使用額度重置券。
