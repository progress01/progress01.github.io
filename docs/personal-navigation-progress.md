# 個人網誌動線改善進度

## 2026-09-29，修正 A 面返回後熱力圖消失（完成；返回實測與 fresh build 通過；未部署）

- 問題發生在一般頁面導覽的瀏覽器返回快取：A 面離頁時，`pagehide` 會釋放 ECharts；按上一頁從 BFCache 還原時，頁面腳本不會重新執行，原程式又沒有 `pageshow` 重建，因此只剩覆在圖表上方的透明日期按鈕，其焦點框就是畫面中的單一小方塊。`profile-article-calendar.js` 現在成對處理 `pagehide`／`pageshow`：離頁仍釋放圖表，返回時重新執行既有 `boot`，不改文章、日期資料、網址或圖表樣式。
- 專用回歸測試新增 `pageshow` 安裝護欄，並保留 PJAX send/success、重複初始化與 dispose 檢查；focused tests 2/2、`node --check themes/next/source/js/profile-article-calendar.js` 通過。fresh build 產生 1,014 files／383 HTML；surface-copy output 275 篇、site-check 138,560 個 href/src、archive/category 275 routes、側欄 A 11/6 與 B 275/6/27、SEO 275 article HTML／320 sitemap loc 均通過。
- 本機瀏覽器由 A `/` 開啟文章 `/work/content-publishing-and-tables/` 後按上一頁：A 面完整顯示 12 個月份與活動色塊，chart／canvas 均為 860×250、10 個活動日期控制仍在、fallback 不存在；不需手動重新整理。QA 分頁與臨時 Hexo server 已關閉。
- 完整 `npm run verify` 在與本修正無關的 microblog 核准基準中止：來源／輸出已有 23 筆，但兩個 regression 與 public-output 仍預期 21，另有 2 個新 ID 尚未納入既有核准清單；本輪沒有改 microblog 來源、ID 或其測試基準。下一步應將這項資料基準同步獨立處理後再重跑完整 verify；本輪未部署、未提交、未使用額度重置券。

## 2026-09-28，根首頁改為 A 面並上線（完成；手機 QA、部署與線上冒煙測試通過）

- 依作者最新決定，將 `/` 固定為 A 面「工作與學習」，B 面隨機首頁移至 `/memory/`；`/profile/` 保留為 A 面相容入口，`/profile/articles/` 仍是完整文章庫。切換鈕、品牌、選單、搜尋預設範圍、側欄統計、文章面向標記與轉場路由均同步使用這組穩定網址，不依 referrer、storage 或首次造訪狀態判斷。
- Hexo index generator 改在 `/memory/` 產生 B 面及其分頁；新增根頁 A 面來源。根頁來源不另進 sitemap，避免 `/` 與 `/index.html` 重複；自訂 sitemap 範本明確加入 `/memory/`。文章 permalink、正文、日期、microblog ID 與 `/profile/` 相容頁均未變。
- 驗收工具與 fixtures 已由舊「根頁 B」假設更新為新路由，涵蓋 surface control、品牌／選單、首頁橋接、random、搜尋、sidebar、responsive、accessibility、thinking status、SEO 與 sitemap。完整 `npm run verify` exit 0：regression 266/266、fresh build 1,011 files／380 HTML、site-check 136,282 個 href/src、SEO 272 article HTML／317 sitemap loc、public-output 440/440 decoded text；surface copy 272 篇、側欄 A 9/6、B 272/6/27。
- 手機畫面 QA：以 375×812 與 390×844 實測 `/`、`/memory/` 與雙面文章；A、B 路由及切換連結正確，主要內容沒有整頁水平溢出，只有 A 面熱力圖容器依設計可橫向捲動，主控台 error／warning 為 0。QA 專用分頁與程序已關閉，未終止使用者既有的 8766 程序。
- 作者確認本機測試 OK 並明確授權本次上線後，執行 `npm run deploy` 成功。部署前驗證 exit 0：regression 265 pass／1 skip／0 fail（fresh clean 後缺少可選的舊輸出快照，fixture 仍通過）、fresh build 1,011 files／380 HTML、surface copy 272 篇、SEO 272 article HTML／317 sitemap loc、public-output 440/440。GitHub Pages 產物提交 `fe09ac6d6` 已推送至 `progress01/progress01.github.io` 的 `main`。
- 線上冒煙測試：`https://progress01.github.io/` 回傳 A 面「工作與學習」與 2026 更新日曆，`/memory/` 回傳 B 面、可用的隨機卡／換一篇控制及返回 A 面連結，雙面文章回傳 200 且頁面標題正確；首次一般請求短暫命中舊快取，無快取請求與實際瀏覽器重新載入均已確認新版。下一步只需依日常流程維護文章與合法日期；本輪未提交來源工作樹、未使用額度重置券。

## 2026-09-28，批次改寫 A 面 9 篇文章標題（完成；fresh build 與桌機／行動版 QA 通過；未部署）

- 依作者指示一次更新 9 篇 `profile` 文章標題，不再逐篇試作。標題改成讀者可直接辨認的問題、任務或判斷，移除 `工作知識｜`、系列編號與 `學習筆記` 等站內管理前綴；permalink、`date`、`updated`、`surfaces`、分類、標籤與文章主體均保留。
- 同步修正 3 處會進入公開輸出的舊標題引用：`reading-desk.yml` 兩筆 linked learning 顯示名稱，以及 Agentic Transaction 筆記的一個相關文章連結；另更新 tag review 快照、A 面候選與固定樣本文件。公開生成文字中 9 個舊標題命中為 0。
- 9 篇 excerpt 檢查全部 PASS；同步連結的 Agentic Transaction 文章 excerpt 亦 PASS（52/86）。完整 `npm run verify` exit 0：regression 266/266、fresh build 1,010 files／379 HTML、surface-copy 272 篇、SEO 272 article HTML／316 sitemap loc、public-output 439/439 decoded text。
- 逐篇輸出核對 9/9：可見標題、canonical、JSON-LD `headline`／發布與更新日期、navigation index 及分類頁均一致。A 文章庫桌面實際畫面九篇標題可讀；390×844 行動版自然換行，沒有 link 或頁面橫向溢出。
- 下一步：作者先閱讀整批標題；若仍有正文寫法問題，再指定一篇由 Codex 先交付完整改寫版，作者接續調整。這次沒有批次改正文，也未部署、未提交、未使用額度重置券。

## 2026-09-28，A 面文章標題優先改造方法（完成盤點與方案；尚未改文；未部署）

- 作者接受 A 面預覽介面，進一步將問題收斂為文章標題可能不像一般網路文章；正文暫不判定需要改寫。本輪使用工作知識文章維護規則，盤點 9 篇明確標記 `profile` 的文章；未改文章、front matter、網址、日期、熱力圖或公開輸出。
- 新增 [A 面文章標題優先改造計畫](profile-article-rewrite-plan.md)：標題改以讀者能辨認的問題／任務與文章提供的判斷為主，移除 `工作知識｜`、系列編號、`學習筆記` 等站內管理資訊，並列出 9 篇尚待作者確認的工作標題。
- 後續拆成兩個獨立動作：先逐篇確認並只改 `title`；若作者之後指定正文改寫，再由 Codex 先交付完整版本，作者依成品接續調整。不先用抽象規格限制語氣，也不把標題問題擴成批次正文重寫。
- 標題依據交叉參考 Google Search Central、Microsoft Writing Style Guide 與 GOV.UK clear titles；外部連結與本機文件連結待文件檢查後確認。
- 下一步：以 `/work/api-requirement-troubleshooting/` 做「只改標題」試作；作者確認工作標題後才寫入來源。保留 permalink、`date`、`surfaces` 與正文，完成 excerpt、完整驗證與前後比較後，再決定是否處理下一篇。本輪未部署、未提交、未使用額度重置券。

## 2026-09-28，整理雙面部落格 WBS 與作者驗收文件（完成；文件驗證通過；未部署）

- `dual-surface-blog-plan.md` 與 `dual-surface-blog-wbs.md` 已由「尚未實作／施工」更新為 WBS 0.1～10.6 完成、10.7 部署決策 `HOLD`；早期三路徑／代表卡／最近學習封面方案在上位設計、原工作包、決議、里程碑、維護與確認點中明確標成完成後退役，現行 A 封面改以最新活動年份熱力圖驗收，完整內容仍在 `/profile/articles/`。`profile-home.yml` 只保留作內部相容／回歸資料，不再決定公開首頁。
- `dual-surface-blog-10.6-author-acceptance.md` 更新為 2026-09-28 現況：修正 HEAD 參考、移除已停止 PID 的預覽交接說法，改成可重跑的本機啟動／停止方式；現行瀏覽器實測改列熱力圖桌機與 375px 手機結果。舊 10.1～10.5 報告仍保留當時數字作時間點證據，但驗收摘要不再混用舊數字。
- 現行候選數字統一為日期與時區 tests 24/24、regression 266/266、fresh `public/` 1,010 檔／379 HTML、surface copy 272 篇、SEO 272 routes／316 sitemap loc、public output 439/439；現有文章內容檢查通過。實際檔案盤點再次得到 1,010／379，舊 PID 24528 確認未執行。
- 文件驗證：三份文件的相對 Markdown 連結全數存在；UTF-8 replacement character 0；舊現況數字與「尚未實作／施工／沒有手機實測」殘留掃描 0；`git diff --check` exit 0（僅既有 LF→CRLF 警告）。另以目前來源／`public/` 重跑 `check:content`、`check:seo-urls`、`check:public-output` 均 exit 0，確認 272 篇文章路由、316 sitemap loc、1,010 檔／379 HTML／439 文字產物。此輪未重跑已於上一輪通過的完整 `npm run verify`，未修改網站程式、文章或輸出。
- 下一步：作者依更新後驗收包啟動本機預覽，選擇接受、要求修正或暫停；WBS 10.7 與部署均需另行明確授權。本輪未部署、未提交、未使用額度重置券。

## 2026-09-28，建置前阻擋未來 updated 日期（完成；時區回歸與完整驗證通過；未部署）

- `content-check` 對有提供的文章 `updated` 保留有效性與不得早於 `date` 檢查，並新增未來日期錯誤：將解析後的 instant 明確轉成 Asia/Taipei 日曆日，晚於注入時鐘所代表的台北今日即在 build 前阻擋；今日任一時間合法。無效值仍只回報原本格式錯誤，不進行相對日期誤報。profile helper／UI 不靜默回退或修改來源值。
- 回歸案例覆蓋昨日與今日、UTC 日期與台北同日、台北未來日、`updated < date` 及無效日期。同步更新內容面向契約的 A 熱力圖事件規則，說明發表 `date` 加上合法的 distinct-day `updated`，future 更新需由 `content-check` 阻擋。
- Focused `content-check`／profile helper tests 24/24；完整 `npm run verify` exit 0：regression 266/266、fresh build 1,010 files／379 HTML、surface-copy output 272 篇、SEO 272 routes／316 sitemap loc、public-output 439/439 text checks。真實文章 `check:content` 通過。`git diff --check` 通過（工作樹既有 LF→CRLF 警告）。
- 下一步：依個人動線計畫接續返回保留原位置的下一個獨立小步驟；本輪未改文章、未部署、未提交、未使用額度重置券。

## 2026-09-28，修正雙面輸出檢查的路由與 A 入口護欄（完成；fresh build 驗證通過；未部署）

- `surface-copy-check` 比對文章 canonical 與索引路由時，兩邊都先解析 URL 並 decode percent-encoded path；中文文章 `/2026/01/25/部落格改版規劃/` 不再被誤報。回歸測試同時覆蓋 encoded Unicode 正例與錯誤 canonical 負例。
- `surface-history-output-check` 現在從 A 文章庫 `/profile/articles/` 檢查 dual 文章入口，保留 B archive、一般連結、單一 canonical、neutral article context 與 PJAX selector/refresh 等檢查；不再要求 dual 文章出現在已退役的 A 封面代表作區。回歸測試使用目前 heatmap 封面＋完整文章庫結構，並確認文章庫缺少 dual 入口仍會失敗。
- 新增 `npm run check:surface-copy-output`，並置於 `npm run verify` 的 fresh build 後。Focused tests 10/10；完整 verify exit 0、regression 263/263、新建置 1,010 files／379 HTML。正式 `public/` 的 surface-copy 輸出檢查通過 272 篇文章；surface-history 輸出檢查通過 272 篇、1 篇 dual，目標 `/work/flow-friendly-work-system/`。SEO 與 public-output checks 亦通過；`git diff --check` 通過，只有既有多檔 LF→CRLF 提示。
- 下一步：依個人動線計畫接續返回保留原位置的下一個小步驟；本輪未部署、未提交、未使用額度重置券。

## 2026-09-28，B 面日曆排除 A-only 文章（完成；測試與 fresh output 驗證通過；未部署）

- `calendar.json` 熱力圖計數與 `calendar-posts.json` 明細共用 `tools/lib/post-surface.js` 正規化面向；B 日曆只收錄含 `memory` 的文章，因此 profile-only 排除、memory-only 與 dual 保留。沒有改文章來源、permalink 或日曆明細欄位。
- `tools/tests/calendar.test.js` 加入生成器回歸案例，精準覆蓋 profile-only 排除，以及 memory-only／dual 保留；日期仍使用發表日。Focused test 通過。
- `npm run verify` exit 0：regression 261/261、fresh build 1,010 files／379 HTML、archive surface 輸出檢查與 SEO/public-output 檢查通過。Fresh `public/calendar-posts.json` 與 `public/calendar.json` 逐項對照 272 個文章路由：8 個 profile-only route 全數缺席（含 `/work/from-solving-problems-to-choosing-what-matters/`）；memory-only `/2026/01/25/部落格改版規劃/`、dual `/work/flow-friendly-work-system/` 均保留。既有 N+7 `/2026/09/17/隨筆/有工作的第N+7天/` 依 legacy manifest 為 memory，仍保留；熱力圖計數總和與明細筆數同為 264。
- 下一步：作者本機預覽 B `/calendar/` 確認面向範圍符合預期；部署仍需另行明確授權。本輪未部署、未提交、未使用額度重置券。

## 2026-09-28，A 熱力圖新增發表／更新活動事件（完成；驗證與 Chrome QA 通過；未部署）

- `/profile/` 每篇 A 文章必定有一筆 `date` 發表活動；若有效 `updated` 換成 Asia/Taipei 日曆日後不同於發表日，才另有一筆更新活動。每篇最多兩筆，不記中間版本；counts 按事件列計數。詳情列以「發表／更新」標示，標題為「文章活動」，狀態分開顯示唯一文章數與活動日期數。文章庫、側欄 A 9/6 與 B 272/6/27、B `/calendar/`、文章 metadata/front matter 均未改。
- helper 與嵌入 payload 加入 `eventType`／`eventLabel` 及 `eventTotal`；更新 JS render、少量事件標籤 CSS、profile output/copy/accessibility/visual tests 及 heatmap 契約／作者驗收文字。Fresh JSON-LD 對照驗證 9 篇、15 events、8 active dates：2026-02-26(1)、05-28(1)、07-09(1)、09-03(1)、09-04(1)、09-08(1)、09-17(8)、09-27(1)。9/17 為 2 發表＋6 更新；9/27 N+7 為 1 發表。
- Focused tests 28/28；`node --check themes/next/source/js/profile-article-calendar.js` 與 `node --check tools/lib/profile-articles.js` 通過。profile page/archive、surface accessibility（3 routes + 一般文章）、responsive（4 pages）、visual compiled CSS selectors 及 tokens 輸出檢查均通過；profile cover 核對 15／8／上述日期分佈。`npm run verify` exit 0：regression 261/261、fresh build 1,010 files／379 HTML，archive 272 canonical routes／9 profile，SEO 272 routes／316 sitemap loc、public text scan 439/439；側欄輸出核對仍 A 9/6、B 272/6/27。
- Chrome headless/CDP 桌機 1280×900、手機 375×812：預設 9/27 發表、Enter 鍵選 9/17 顯示 8 列（2 發表＋6 更新）、2/26 顯示單列發表、reload 回到 9/27；文章庫 9 篇、archive 品牌回 A、A→B 正常。手機 document/body 均 375px 無溢出，僅 heatmap 容器橫捲（700／311px）；runtime/console errors 0。證據：`tmp/wbs111-events-browser-evidence.json`、`tmp/wbs111-events-desktop.png`、`tmp/wbs111-events-mobile.png`；QA 專用 server/Chrome profile 已清理。
- `git diff --check` 通過（工作樹只有既有 LF→CRLF 提示，無 whitespace error）。本輪未部署、未使用額度重置券；下一步由作者本機閱讀事件化熱力圖，決定是否保留或調整。

## 2026-09-28，A 面側欄統計改為 profile-only（完成；輸出與 Chrome QA 通過；未部署）

- 只在 `/profile/` namespace 的作者卡顯示 A 統計：以既有 profile 文章 helper 動態計算文章總數與唯一標籤數，連結回 A 文章庫，不顯示分類；`/profile/articles/` 同樣適用。canonical 文章路徑（含 profile-only／雙面）仍按原 memory route context 顯示 B 全站統計。關閉側欄 overview partial 快取以避免跨路由沿用錯誤分支。
- 新增 `tools/sidebar-stats-output-check.js` 與 regression 測試，輸出檢查從 navigation index 動態對照 A/B counts，並接入 `npm run verify`。Focused tests 8/8；fresh output 為 A 9 文章／6 標籤、B 272 文章／6 分類／27 標籤。`npm run verify` exit 0：regression 261/261、fresh build 1,010 files／379 HTML、archive 272 canonical routes／9 profile、SEO 272 article routes、public text scan 439/439。
- Chrome headless/CDP 實際核對 `/profile/`、`/profile/articles/` 為 9／6，B 首頁仍為 272／6／27；證據 `tmp/wbs110-sidebar-browser-evidence.json`。`git diff --check` 通過（只有進場 dirty worktree 的 LF→CRLF 提示，沒有 whitespace error）。未改文章、taxonomy、heatmap、文章庫、menu／brand、B 日曆；未部署、未使用額度重置券。下一步由作者本機確認作者卡統計是否符合 A/B 分面預期。

## 2026-09-28，A 面封面改為全年更新熱力圖（完成；驗證與 Chrome QA 通過；未部署）

- `/profile/` 改用 profile-only 最新年份全年熱力圖：以已發布 A 文章的日曆日計數，透過既有本機 `Calendar.init` 繪製，不讀 B 面全站日曆 JSON、不新增 endpoint；隱藏套件內部數字滑桿，只留「少→多」圖例。日期格可用滑鼠／鍵盤選取，預設顯示最新有更新日期的文章連結；手機橫向捲動限制在圖表容器。文章庫、A 導覽／品牌、B 面與 `/calendar/` 維持原狀。此版取代前一筆 9/27 的月份文字索引版。
- 更新 profile calendar helper、模板與專用 JS/CSS、輸出及 surface checks/fixtures；同步修訂文案、內容、視覺契約與作者驗收包。Focused tests 32/32；完整 `npm run verify` 通過（regression 257/257、fresh build 1,010 files／379 HTML、272 唯一文章路由、9 篇 profile、SEO 272 canonical／316 sitemap loc／duplicate body groups 0、439/439 generated text scan）。`node --check themes/next/source/js/profile-article-calendar.js` 與 `git diff --check` 通過；profile page/archive、surface copy/responsive/accessibility/visual 輸出 checks 均通過。
- Chrome headless/CDP 1280×900、375×812 實測：2026 熱力圖渲染，四個有更新月份（02、05、07、09）、9 篇文章／8 個日期；最新日期預設內容正確、鍵盤選取及 9/17 同日兩篇連結通過；文章庫 9 篇、tag/hash/back/reload、A→B 與 B 品牌/搜尋/日曆入口保持正確。手機 chart 內部可橫向捲動（700px 內容／311px 視窗），document/body 均 375px 無溢出。Runtime/console errors 0。此站既有設定 `pjax: false`，故 live 旅程為完整頁面導航／reload；PJAX send/success 重建流程由 focused source/unit test 核對。證據與截圖：`tmp/wbs108-heatmap-browser-evidence.json`、`tmp/wbs108-heatmap-desktop.png`、`tmp/wbs108-heatmap-mobile.png`；QA 隔離 loopback 8977/9377 及專用 Chrome profile 已清理。`source/calendar/index.md`、`source/lib/calendar.js` 本輪未變。
- 本輪未部署、未使用額度重置券。下一步由作者本機閱讀全年熱力圖後決定是否保留或調整；不擴充年份切換、月份清單或同步機制。

## 2026-09-28，A 更新熱力圖改依最後活動日（完成；驗證與 Chrome QA 通過；未部署）

- 更新日曆每篇文章改以有效 `updated` 作為最後活動日，缺少或無效時回退 `date`；單篇只計入一個目前日期，不建版本歷史。UI 狀態改為更新日期數，所選日標題改「更新內容」。未修改文章／front matter、`updated_option: date`、B `/calendar/`、文章庫排序、taxonomy 或導覽。
- fresh article JSON-LD 核對出 9 篇 profile 文的實際分佈為 2026-09-17 共 8 篇、2026-09-27 共 1 篇，故最新活動年 2026、更新日期 2 日。新增 helper cases 覆蓋 updated 優先、缺值/無效回退、同日一篇只計一次、date 與 updated 都無效時沿用 date error；profile output check 以生成文章 `dateModified` 驗證活動日期。
- Focused suite 33/33；`npm run verify` exit 0：regression 258/258、fresh build 1,010 files／379 HTML、272 唯一文章 canonical／316 sitemap loc、duplicate body groups 0、439/439 decoded generated text scan。Profile cover/archive、surface copy/responsive/accessibility/visual output checks 通過；profile 封面核對為 9 篇／2 日期且詳細列出最新日一篇。B 日曆來源 diff 為空，`/calendar/`、`calendar.json`、`calendar-posts.json` 均仍生成。`node --check themes/next/source/js/profile-article-calendar.js` 與 `git diff --check` 通過。
- Chrome headless/CDP 桌機 1280×900、手機 375×812：熱力圖 2026/2 活動日；預設 9/27，鍵盤選取 9/17 顯示同日 8 篇，滑鼠選 9/27、reload 復原最新日均通過；文章庫仍 9 篇，tag/history、A→B 正常，B 品牌／搜尋／日曆入口未變；手機 heatmap 內部橫捲、document/body 無水平溢出，runtime/console errors 0。證據／截圖：`tmp/wbs109-activity-browser-evidence.json`、`tmp/wbs109-activity-desktop.png`、`tmp/wbs109-activity-mobile.png`。既有 PJAX 關閉，PJAX send/success handler 由 focused source/unit tests 核對；專用 loopback 8978/9378 與 Chrome profile 已清理。
- 未部署、未使用額度重置券。下一步由作者本機閱讀更新後的活動日熱力圖後決定是否保留或調整；不建立版本歷史。

## 2026-09-27，A 面封面改為月份式更新日曆（完成；驗證與 Chrome QA 通過；未部署）

- `/profile/` 保留 H1「工作與學習」，以 server-rendered A-only 更新日曆取代最新主卡與兩張次卡：從已發布且含 `profile` 的文章挑出最新年份，目前為 2026，依月份新到舊分區；列出該年度全部 9 篇，每列只顯示日、標題並連回原 canonical。月份與年份皆動態；封面不顯示卡片、摘要、分類、tags、圖片或 filter。頁尾動態「查看全部 9 篇」連到 `/profile/articles/`。文章庫 9 篇及 tag/hash/back/reload、A menu/品牌、B menu/search/random、`/calendar/`、文章與 profile-home 資料均未改。
- 擴充 `tools/lib/profile-articles.js` 的 profile 日期序 normalization，新增月份分組 calendar helper；新增 `_partials/profile-article-calendar.njk`、替換 profile CSS，移除舊 cover partial 與三卡樣式。更新 profile library output checker、surface copy/responsive/thinking wiring checks 及 fixtures/tests；修訂 `docs/dual-surface-copy-contract.md`、`docs/dual-surface-content-contract.md`、`docs/dual-surface-visual-rules.md` 與本驗收包的現行準則。
- Focused `node --test tools/tests/profile-articles.test.js tools/tests/profile-page-output-check.test.js tools/tests/surface-copy-check.test.js tools/tests/surface-responsive-check.test.js tools/tests/thinking-status-output-check.test.js` PASS 21/21。`npm run verify` exit 0：regression 253/253；clean/fresh build 1,009 檔、379 HTML／135,980 href/src；archive/category compatibility 272 唯一路由、9 profile；SEO 272 canonical／316 sitemap loc／duplicate body groups 0；public-output 438/438 text，舊文及退役 ID 命中 0。`node tools/profile-page-output-check.js --root public`、`node tools/profile-articles-output-check.js --root public`、`node tools/surface-copy-check.js --root public`、`node tools/surface-responsive-check.js --root public`、`node tools/thinking-status-output-check.js --root public` 均通過。
- Chrome headless/CDP 真實 viewport QA：桌機 1280×900 顯示 2026 四個月份分區與 9 篇文章、月份雙欄；手機 375×812 單欄，document/body 無水平溢出。逐列文章連結、`查看全部 9 篇`→9 篇文章庫、方法整理 tag 篩選、hash reload/back/forward、archive 品牌回 A、A→B（品牌仍回 `/`、B 搜尋入口仍存在）均通過。兩張畫面與測量證據存於 `tmp/wbs107-calendar-desktop.png`、`tmp/wbs107-calendar-mobile.png`、`tmp/wbs107-calendar-browser-evidence.json`。隔離無網路 QA 移除外部搜尋依賴、提供 no-op anime 測試 stub；完成後 runtime exceptions/console errors 為 0；專用 loopback 8976/9376 與 Chrome profile 已清理。
- `git diff --check` 待本次收尾時確認；本輪未部署、未使用額度重置券。下一步由作者本機閱讀月份式封面後決定是否保留或調整；不新增年份切換控制或同步制度。

## 2026-09-27，A 面品牌回首頁語意修正（完成；輸出與 headless QA 通過；未部署）

- 左上品牌依既有 A menu `page.path` namespace server-render：`/profile/`、`/profile/articles/` href 為 `/profile/`，A 名稱為「工作與學習封面」；B 首頁與一般文章仍回 `/`，品牌顯示文字不變。文章 permalink（含 profile-only N+7 及 dual）不自行推斷來源面，沿用現有 article route 的 memory navigation context；A→B 仍只有右上明示 switch。未改 B nav、switch、正文/front matter、URL/canonical 或內容。
- 新增 `tools/lib/brand-context.js`、註冊 Hexo helper `brand_surface_context` 並在 `themes/next/layout/_partials/header/brand.njk` 直接輸出 href；新增 unit 與 `tools/brand-context-output-check.js` 對 A 兩頁、profile-only、dual、memory-only 文章及 B 首頁檢查。輸出測試通過 6 routes。Headless Chrome 實點 6 routes：封面品牌留在 A、文章庫品牌回封面、A-only/dual文章保持目前 memory route 行為、B 首頁品牌仍回 B、B 文章品牌回 B；證據 `tmp/wbs106-brand-browser-evidence.json`，使用本輪 loopback 8975/9375 後已關閉專用 server/Chrome profile。
- Focused tests `node --test tools/tests/brand-context.test.js tools/tests/brand-context-output-check.test.js tools/tests/surface-control-output-check.test.js tools/tests/contextual-menu-output-check.test.js` PASS 15/15；`npm run verify` exit 0、regression 253/253、fresh `public/` 1,009 檔、site 379 HTML、SEO 272 unique canonical／316 sitemap loc、public-output 438/438 掃描通過；`git diff --check` exit 0，只有進場 dirty worktree 的 LF→CRLF 提示。未部署、未使用額度重置券。下一步無自動變更，作者可在本機確認左上品牌的 A/B 導覽語意。

## 2026-09-27，A 面封面與文章庫分離（完成；桌機／手機 live QA 通過；未部署）

- `/profile/` 現為自動挑選日期最新 3 篇的 A 封面：最新一篇作主卡、另兩篇作次卡；本輪 N+7 A 文自動成為主卡。封面僅呈現日期、標題、既有 tags、閱讀連結與動態「查看全部 9 篇」，無摘要／分類路徑／篩選。`/profile/articles/` 保留全部 9 篇與既有 tag/hash/back/reload 篩選；篩選只在文章庫。A contextual menu 為「工作與學習」→封面、「全部文章」→文章庫，兩頁 `aria-current` 各自正確。B 導覽、搜尋、抽籤、文章 front matter／正文／canonical／surfaces 及 `profile-home.yml` 未改。
- 更新 profile 文章選取 helper、首頁／文章庫模板、卡片樣式與 output/source/unit checks；更新 copy/content/visual contract 及作者驗收包，把「兩路由顯示同一列表」改為不同用途的封面與文章庫。`test:regression` 加 `--test-concurrency=1`（僅測試執行併發設定；原預設 worker 數在完整 verify 中觸發 V8 Zone Allocation OOM，單獨測試可過）。
- Focused：`node --test tools/tests/profile-articles.test.js tools/tests/profile-page-output-check.test.js tools/tests/profile-articles-output-check.test.js tools/tests/contextual-menu-output-check.test.js tools/tests/surface-copy-check.test.js` PASS 18/18；responsive／copy／profile／menu focused 合計 PASS 17/17；`npm run test:regression` PASS 248/248。
- 完整 `npm run verify` exit 0：fresh `public/` 1,009 檔；site 379 HTML／135,974 href/src；archive compatibility 272 唯一路由與 9 篇 profile；SEO 272 canonical／316 sitemap loc／正文重複群組 0；public-output 438/438 文字輸出掃描，舊文與退役 ID 命中 0。另跑 `node tools/profile-page-output-check.js --root public`（封面主文 N+7、3 卡、6 tags）、`node tools/profile-articles-output-check.js --root public`（9 篇）、`node tools/contextual-menu-output-check.js --root public`（3 頁）、`node tools/surface-copy-check.js --root public`、`node tools/surface-responsive-check.js --root public`、`node tools/thinking-status-output-check.js --root public`，均通過。
- Chrome headless 真實瀏覽器 QA：桌機 1280×900、手機 375×812；封面主次層級、三卡連結、9 篇入口、無封面 filter、無水平溢出、archive tag hash/back/reload、archive 返回封面及 A→B→A 全通過；瀏覽器 runtime/console issue 0。4 張截圖及步驟資料存於 `tmp/wbs106-desktop-cover.png`、`tmp/wbs106-desktop-filter.png`、`tmp/wbs106-mobile-cover.png`、`tmp/wbs106-mobile-archive.png`、`tmp/wbs106-cover-browser-evidence.json`；測試 server/CDP 使用專用 loopback ports 8974/9374，QA 後關閉並清理本輪 Chrome profile。
- `git diff --check` exit 0；只有進場 dirty worktree 的 LF→CRLF 提示、無 whitespace error。對本輪文件、模板、helper、checkers、tests 及 QA 證據執行 scoped `git status --short`，列出的均為本輪相關檔與既有 profile/contract 檔；未清理或覆蓋其他 dirty worktree。QA runtime/console errors 0。未部署、未使用額度重置券。下一步由作者本機閱讀 A 封面與文章庫、決定是否調整；此步不改變 B 面，也不建立額外同步機制。

## 2026-09-27，A-only 工作知識改寫 pilot（本機第一版；驗證通過；未部署）

- 新增[不是每個問題都值得解：先判斷未知屬於哪一種](../source/_posts/實驗室/工作知識-從解決問題到判斷什麼值得解.md)，設定 `surfaces: [profile]`、分類「工作知識」與現行 taxonomy 標籤「方法整理」；原 B 文未改。原則：A 另寫、profile-only、B 不動、無同步；這是待作者閱讀與調整的本機草稿，不建立自動制度。
- 依既有檢查補入 `docs/tag-reorganization-review.json` 一筆新文快照，並更新兩個 corpus count 測試及 SEO 稽核預設文章數；沒有改 taxonomy 或介面。A 列表為 9 篇；B memory 篩選不含此文。生成分類／方法整理標籤頁存在，文章索引一筆、唯一 canonical；共 272 個文章路由、canonical 唯一、正文重複群組 0。
- `node tools/excerpt-check.js --post "source/_posts/實驗室/工作知識-從解決問題到判斷什麼值得解.md"` PASS（50/86）。對原 B 文與新文執行 `rg -n -i 'https?://|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Z]{2,}|姓名|電話|客戶名稱|公司名稱|機關名稱|專案名稱|專案代號|帳號|密碼|token'`，沒有識別標記命中。`npm run verify` exit 0：regression 249/249、1,009 個輸出檔、379 HTML／135,977 href/src，SEO 272/272、316 sitemap loc，public-output 438 個文字輸出掃描、舊文字及退役 ID 命中皆 0；`git diff --check` 通過。生成文章引用既有工作知識封面資產，`work_note` 為「問題定義與未知判斷」。已執行 `git status --short`，保留原有 dirty worktree。未部署、未使用額度重置券。
- 下一步：作者閱讀 A 草稿後決定保留或自行調整，不自動同步至 B。

## 2026-09-27，WBS 10.6 後續：A 面可篩選文章庫（完成；desktop live QA／fresh verify 通過；未部署）

- 依核准範圍將 `/profile/` 與相容入口 `/profile/articles/` 改為同一份 profile-only 日期新到舊文章列表；H1「工作與學習」、動態總數與既有 tags 單選篩選，hash 支援返回／重載；A contextual menu 簡化為單一入口。文章來源、front matter、B 面、文章 URL、圖片與公開邊界未改。舊三路徑資料僅保留內部，不再作正式 UI。
- 已新增列表／篩選 template、helper、browser JS 與 source/output/unit tests，更新 copy/content/publishing contract、驗收包與歷史設計說明。
- 聚焦測試 56/56、最終 `npm run verify` exit 0／regression 249/249；fresh `public/` 1008 檔，site 378 HTML／135220 href/src、SEO 271 canonical／315 sitemap loc、public-output 437 decoded text／0 舊文字或退役 ID 命中，568 來源圖片／225 圖牆引用保留。Profile output=8 篇／6 tags，兩 A 路由真載入 PJAX filter script；loopback 8766 A 兩入口及 JS/CSS HTTP 200；`git diff --check` 通過（只有既有 LF→CRLF 提示）。
- 主線桌面 1256×864 live QA 通過：全部 8→方法整理 6→觀念釐清 2；Back、reload、進文章再 Back 均恢復 tag/hash；全部清除回 8。A→B→A 後 B 7 nav＋search 保持、無 A filters；搜尋開關正常，回 A filter 重初始化且 active tag 清除回全部，未重複綁定。Compat route 8 篇／7 controls/H1一致且沒有錯標 `aria-current`。未保存本輪截圖。無 mobile live QA，僅 responsive source/output checks。
- 下一步為作者對具體本機候選的決策；G10 候選已備妥，不等於作者已接受。10.7 維持 HOLD。未部署、未使用額度重置券。

## 2026-09-27，切換目的面語意與 A 面文字可讀性（完成；fresh build／桌面 QA 通過；未部署）

- 依作者截圖回饋移除右上「目前面」A/B badge，卡帶內字母改為目的面：A/profile 頁卡帶 B 且既有文字 SIDE B；B/memory 頁卡帶 A 且既有文字 SIDE A。保留原生 href、完整可及名稱與原文案契約；卡帶維持 `aria-hidden`、CSS 畫出及既有 A/B tokens，無新圖片或動畫。
- 僅對 A 面三個專用側欄導覽項與 profile 首頁三個路徑 heading 套用繁中 UI sans stack、合宜字重／行高、圖示文字間距、48px 導覽列高度及 heading 下方留白；沒有改 B 面、文章卡內容／分類或路由。
- 更新 surface visual/control source 與 output tests，明確拒絕衝突 badge，驗證卡帶目的字母及 A 面字體／尺寸規則。聚焦測試 22/22 通過；全量 `npm run verify` exit 0、regression 249/249、fresh `public/` 1,007 檔、site 378 HTML／134,850 href/src、SEO 271 canonical／315 sitemap loc、public-output 436 decoded text／0 D-V hits／0 retired ID／568 source images。visual、control、accessibility、responsive、copy 輸出檢查皆通過。
- loopback 預覽 `http://127.0.0.1:8766/profile/` 與 CSS cache-bust HTTP 均 200（PID 24528）。本工作階段無 CUA browser，由主線完成桌面目視與 A↔B 實際點擊：A 頁 computed 卡帶字母 B 與 SIDE B 一致，點擊後 `/` 卡帶字母 A 與 SIDE A 一致，再 Back 回原 profile path；AX link names 正常。畫面確認 A 側欄三列 15px／48px、圖示間距及三個 path heading 清楚。沒有保存本輪截圖；手機沒有 live visual QA，只有 responsive source/output checks。相關程式、[作者驗收包](dual-surface-blog-10.6-author-acceptance.md)及[視覺規則](dual-surface-visual-rules.md)均已更新，詳細驗證見 `tmp/wbs106-switch-css-verification.json`。
- 未部署、未使用額度重置券。G10 候選是否接受仍由作者決定，10.7 維持 HOLD。

## 2026-09-27，雙面部落格 WBS 10.6：作者驗收包（完成；本機候選已備妥；未部署）

- 進場 HEAD `2d4d9d0375c1aa82d4d6407fb13699a2810d714d`；進場工作樹 dirty，共 30,471 筆狀態項目（44 tracked、30,427 untracked），所有既有差異均保留。此 HEAD 僅為基準，不宣稱目前狀態是 release commit。
- 新增[作者驗收包](dual-surface-blog-10.6-author-acceptance.md)，含本機路由、5–8 分鐘接受／修正／暫停清單、變更摘要、已知限制、檔案級回復界線、部署前提與 10.1–10.5 證據連結。新增 `tmp/wbs106-preview.json` 紀錄服務資料。
- 本機 fresh `public/` 維持 1,007 檔；`python -m http.server 8766 --bind 127.0.0.1 --directory public` 由 PID 24528 提供，綁定 loopback。六個入口 `/`、`/profile/`、`/profile/articles/`、固定 A 文章、雙面文章與歌曲文章 HTTP 均為 200；profile 頁回應內容與 `public/` 檔案一致。8765 出現另一個未知 wildcard listener，未觸碰該程序，改選 8766。
- `npm run check:site`、`npm run check:seo-urls`、`npm run check:public-output`、`git diff --check` 全數 exit 0；未重建 `public/`。本輪只更新作者文件、WBS、進度與預覽 metadata，未改網站來源或公開輸出。
- G10 本機發布候選已備妥並交由作者決定；不等於作者已接受或已部署。10.7 維持 HOLD，下一步等待作者回覆「接受本機候選，進入部署決策」、「修正：…」或「暫停」。本輪「繼續」不是部署授權。未部署、未使用額度重置券。

## 2026-09-27，雙面部落格 WBS 10.5：最終公開輸出稽核（完成；G10 未通過；未部署）

- 進場 HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；進場已有大量施工、來源、`public/` 與 `tmp/` 差異，均保留。本輪新增 `tools/public-output-audit.js`、合成資料負向／正向測試及 `check:public-output`，將最終輸出稽核接在 `verify` clean/build、site、相容及 SEO 檢查之後；細節見[10.5 報告](dual-surface-blog-10.5-public-output-report.md)。
- `npm run verify` exit 0，regression 246/246，fresh `public/` 1,007 個檔案；436 個可解碼文字產物已掃描，D/V 原文字紋與 retired ID 0 命中，兩筆核准 replacement 均在 JSON 與 navigation index。來源／公開 JSON／navigation microblog 各 21 筆，ID 一致且唯一。詳見[10.5 報告](dual-surface-blog-10.5-public-output-report.md)。
- `site-check` 378 HTML／134,850 href/src 通過；SEO 271 篇文章與唯一 canonical、315 sitemap loc、重複正文 0；568 個來源圖片全數保留，另含 6 個固定主題資產，225 圖牆引用與 688 個 HTML/CSS 本地媒體參照可達。未逐張檢查圖像內容、授權或 EXIF，也未修改來源圖片。
- Focused tests 16/16；獨立 `check:public-boundary`、`check:site`、`check:seo-urls`、`check:public-output` 與 `git diff --check` 皆 exit 0；新增 JS 語法檢查通過。沒有發現洩漏命中；未修改文章、microblog、reading desk、網址或圖片來源，未建立 repo 私人目錄。
- 10.5 完成；G10 尚未通過。下一步 WBS 10.6「作者驗收包」。未部署、未使用額度重置券。

## 2026-09-27，雙面部落格 WBS 10.4：SEO 與網址稽核（完成；G10 未通過；未部署）

- 進場 HEAD `2d4d9d0375c1aa82d4d6407fb13699a2810d714d`；保留工作樹既有變更。新增 `tools/seo-url-audit.js`、6 個正負 fixture tests 與 `check:seo-urls`，接入 verify 的 fresh build 後段；詳見[10.4 報告](dual-surface-blog-10.4-seo-url-report.md)。
- 文章 HTML 271/271、navigation-index 271/271、canonical route 271/271 唯一；雙面 flow-friendly 只有一份正文／canonical／索引，A/B 入口都引用原 URL；正文 SHA-256 重複群組 0。固定樣本 5/5 通過。
- Sitemap 315 loc 可解析、唯一、同源且對應輸出，文章 271 筆、首頁及 profile 核心路由與公開分類／標籤集合符合預期；JSON/XML 資料端點未進 sitemap。`site-check` 通過 378 HTML／134,850 href/src。
- `node --test tools/tests/seo-url-audit.test.js` 6/6；`npm run verify` exit 0、regression 236/236、fresh `public/` 1,007 files；`node --check` 兩個新增 JS 及 `git diff --check` 通過。未發現網站 SEO／網址缺陷，未改文章來源或 permalink。
- 10.4 完成；G10 尚未通過。下一步 WBS 10.5「最終公開輸出稽核」。未部署、未使用額度重置券。

## 2026-09-27，雙面部落格 WBS 10.3：真實瀏覽器旅程（完成；G10 未通過；未部署）

- 進場 HEAD `2d4d9d0375c1aa82d4d6407fb13699a2810d714d`（10.2 報告記錄之 HEAD：`2d4d9d0375c1aa82d4d6407fb13699a2810d714d`）；保留工作樹原有變更。本輪只更新 WBS 狀態、進度與 [10.3 瀏覽器報告](dual-surface-blog-10.3-browser-report.md)，QA script、JSON 和 11 張截圖留在 `tmp/wbs103-*`；沒有改網站程式或正式 `public/`。
- Chrome headless 直接預覽 WBS 10.2 fresh `public/`，桌機 1280×900、手機 375×812；真實 click／reload／Back，24/24 步驟通過。包含 A/B 正式雙向切換、首頁「換一篇」抽籤、profile-only／memory／dual 搜尋及去重、搜尋結果返回恢復狀態、手機焦點／遮罩／溢出、停用 JS 後 A/B 直達、switch、首頁 bridge、文章卡 href。
- 主審指出首輪三張搜尋截圖沒有呈現 overlay，定位為 QA shim／截圖等待不足。修正為 deterministic anime adapter 套用 timeline 最終 CSS 狀態，並等待 computed visibility／opacity／尺寸後才截圖；手機另要求 popup 完整位於 viewport。全 24 步補跑通過、重產 11 張圖並目視確認桌機及手機遮罩、面板、結果可見。opacity 均為 1；手機 overlay 為 375×812，popup x=9–366、y=11–801。只確認動畫完成狀態，不驗證動畫時序；詳見[10.3 報告](dual-surface-blog-10.3-browser-report.md)及 JSON evidence 的 `qaHarness`。
- Console warning/error、pageerror、requestfailed、本機 HTTP error 均 0；11 張截圖與逐步輸入／預期／實際／viewport／URL 記錄於 `tmp/wbs103-browser-evidence.json`。browser QA 另外以 transition、accessibility、surface control、profile、random、search 輸出檢查 fresh `public/`，均 exit 0；random 262 candidates／7 profile-only 排除／1 dual 保留；search 292 records／271 recent／雙面文章各範圍唯一。`node --check` 與 `git diff --check` exit 0，後者僅有既有換行提示。
- QA server 使用專用 port 8963，CDP 9363；結束後確認兩者可重新 bind，關閉 server／Chrome，清除本輪 `tmp/wbs103-chrome-profile`。本地 HTML 將外部 searchdb/anime 請求映射至本機 QA adapter；不評估第三方 CDN 可用性及動畫時序。無產品缺陷需要修正。
- 10.3 完成；G10 尚未通過，10.4 SEO／網址、10.5 隱私輸出、10.6 作者驗收包、10.7 部署決策未完成。未部署、未使用額度重置券。下一步 WBS 10.4「SEO 與網址稽核」。

## 2026-09-27，雙面部落格 WBS 10.2：完整專案驗證（完成；G10 未通過；未部署）

- 進場 HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；工作樹原有 30,450 筆狀態項目（44 tracked 修改、30,406 untracked），保留所有既有差異。進場正式 `public/` 為 1,004 個檔案、137,248,253 bytes。
- 執行一次 `npm run verify`，exit 0：15 個腳本階段全部通過，Regression 230/230；clean 後 fresh `public/` 1,007 個檔案、203,418,324 bytes，site check 為 378 HTML、134,850 href/src；archive/category compatibility 為 271 篇唯一文章路由、6 個分類及固定樣本 4/4。完整記錄與 warning 分類見[10.2 報告](dual-surface-blog-10.2-verify-report.md)，原始輸出留存 `tmp/wbs102-verify-20260927.log`。
- Hexo 無執行時 warning；命令輸出的 5 個 warning 字樣是測試名稱。`git diff --check` exit 0；只出現既有 tracked 檔案 LF/CRLF 提示。本輪沒有新增／修改 JS，無額外 `node --check` 目標。
- 本輪僅更新驗證報告、WBS 10.2 狀態與本進度；沒有改文章或資料來源。`npm run verify` 依既有 script clean 並重新產生正式本機 `public/`；未部署、未使用額度重置券。10.3–10.7 尚未完成，G10 未通過。下一步 WBS 10.3「真實瀏覽器旅程」。

## 2026-09-27，雙面部落格 WBS 10.1：目標回歸測試（完成；G10 未通過；未部署）

- 依根目錄 AGENTS.md、WBS 10.1、固定樣本與停止條件執行。進場 HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；工作樹已有大量先前未提交的施工、文章與 `public/`／`tmp/` 輸出，本輪保留。只新增 `tools/surface-target-regression-check.js`、其 3 項專用測試、`tmp/wbs101-build.yml` 與[10.1 回歸報告](dual-surface-blog-10.1-regression-report.md)，並在既有 `package.json` 增加 `check:surface-regression` 命令；未改文章、來源資料、正式 `public/` 或既有樣本文件。
- fresh 隔離建置：`npx hexo generate --config _config.yml,tmp/wbs101-build.yml`，1,013 個檔案輸出至 `tmp/wbs101-public-20260927`。`npm run check:surface-regression -- --root tmp/wbs101-public-20260927` 通過 19 個既有檢查及 WBS 0.2 固定樣本：文章 5/5 唯一索引紀錄／正文 canonical，microblog `micro-56bb6eec75c50bcd` 1/1 保留 ID，歌曲 memory 隨機資格 1/1；公開邊界掃描 441 個文字檔，舊測試文字及 retired ID 均為 0 命中。
- 樣本照作者後續核准校正：`/learning/website-quality-testing-roadmap/` 是 `profile` only，與 `reading-topic-07` 合併為一個搜尋／文章紀錄並保留發表與加入學習事件；真正雙面樣本為 `/work/flow-friendly-work-system/`，順序 `profile,memory`。歌曲文章沒有明列 `surfaces`，由既有舊文相容規則正規化為 memory；分類、封面、路由及抽籤均通過。詳細結果見回歸報告。
- 驗證：專用測試 3/3；`npm run test:regression` 230/230；19 個 source/output checker 全通過（含 `/profile/`、`/profile/articles/`、`/` 的 surface、menu、switch 與策展；搜尋範圍／去重；抽籤；thinking maturity；公開邊界）；新增 JS `node --check` 通過；`git diff --check` exit 0，僅工作樹既有 LF／CRLF 提示。未執行 `npm run verify`，避免進入會 clean 並寫正式 `public/` 的 WBS 10.2。
- WBS 10.1 完成；G10 尚未通過。尚待 10.2 完整專案驗證、10.3 真實瀏覽器旅程、10.4 SEO/網址稽核、10.5 最終公開輸出稽核、10.6 作者驗收包及 10.7 部署 HOLD。沒有部署、沒有使用額度重置券。下一步 WBS 10.2「完整專案驗證」。

## 2026-09-27，雙面部落格 WBS 9.5：文案定稿（完成；G9 通過；未部署）

- 作者確認依據：上一輪已告知 9.5 涵蓋 A/B 名稱、按鍵、空狀態與公開邊界確認後，作者仍明確要求「繼續」；並沿用先前已確認的正式名稱及不補定位／摘要文案原則。沒有推定其他批准。
- A 面定名「工作與學習」，B 面定名「個人記憶庫」；保留 `SIDE A／看工作與學習`、`SIDE B／翻到個人記憶庫`。切換、搜尋、文章標記、首頁 bridge、探索中成熟度、兩種空狀態及 skip link 依[文案契約](dual-surface-copy-contract.md)鎖定。A 面 H1 與三條核准路徑、bridge 文案皆保留；沒有新增定位段落、摘要、額外卡片說明或 profile path 空狀態。`workingDescription` 等策展內部欄位維持不公開；A/B 都是公開呈現面向，文章仍一份正文、一個 URL。
- `tools/lib/post-surface.js` 與搜尋 JS 的記憶面向標籤從「個人記憶」修正為「個人記憶庫」；`profile-home.yml` 標記 `approved/9.5`。新增 `check:surface-copy` source/output contract 並接入 `verify` build 前；回歸反例涵蓋舊名稱、私人模式、flip drift、未核准 copyStatus、thinking／空狀態 drift、額外 profile intro 及 dual 順序錯。
- WBS 9.1–9.5 逐項符合，G9 通過；下一步 WBS 10.1「目標回歸測試」。未部署、未使用額度重置券；正式文章正文/frontmatter、microblog、reading desk、URL、策展選擇、視覺 token 與動畫未變更。
- Focused tests 8/8；完整 regression 227/227。隔離建置輸出 `tmp/wbs95-public-20260927`，1,013 個檔案，未 clean、未寫正式 `public/`。site、profile（8 path cards／2 learning／8 URLs）、profile articles（8）、surface control（3）、home bridge（1）、contextual menu（3）、thinking（271 篇／18 cards）、post surface（271 篇：A 7／B 263／dual 1）、search surface（292 records、271 recent candidates、dual 1/1/1、21 shared URL records）、visual、transition、accessibility、responsive、surface-copy output checks 均通過；responsive fixture 的長標題／文案、空狀態與手機／平板溢出檢查通過；content、scaffold、profile-home、public-boundary 與 surface-copy source checks 通過。
- Headless Chrome 桌機 1280×900／手機 375×812，共 10 項路由／搜尋狀態：`/`、`/profile/`、`/profile/articles/`、雙面文章及搜尋開啟狀態；copy、雙面順序、canonical、switch 可見範圍與 document/body 寬度均 0 失敗，console error/warning/exception 0。8 張截圖及逐項證據存於 `tmp/wbs95-*.png`、`tmp/wbs95-browser-evidence.json`；搜尋開啟截圖確認範圍選單實際顯示三個定稿選項。本輪 Chrome ports 已釋放，只清本輪 profile。

## 2026-09-27，雙面部落格 WBS 9.4：響應式驗收（完成；未部署；G9 未通過）

- 隔離建置輸出至 `tmp/wbs94-public-20260927`，1,013 個檔案；未執行 clean，未寫正式 `public/`。Headless Chrome 以 1280×900、768×1024、375×812 量測 `/`、`/profile/`、`/profile/articles/`、`/work/flow-friendly-work-system/`，共 12 組。document/body/main 均不超出 viewport；switch 位於視窗內且與後續內容無交疊，主要卡片都在容器內。桌機保留左右欄，768px 保留 sidebar/main 與 profile 雙欄，375px profile 單欄；首頁入口 grid computed columns 為桌機 4、768px 2、375px 1，random card、DJ 列、bridge、profile 全文清單及文章 marker 在容器內。A/B 樣式由代表性首頁／profile 截圖與 `surface-visual` 驗證。
- 主線複核發現先前 responsive 層誤用不存在的 `.home-landing-grid`，所以四入口的換行保護與 767px 規則未作用於正式模板。已改為 `.home-landing-entry-grid`；沿用既有 900px 雙欄與 430px 單欄行為，responsive 層明列 767px 雙欄及 430px 單欄。375／768 實測行為分別維持單欄／雙欄，沒有改動已驗收畫面。其他頁面量測未發現水平溢出或文字截斷；profile 600px 單欄改至 767px，以覆蓋手機至平板過渡寬度。文字容器使用 `min-width: 0`、`overflow-wrap: anywhere`、`minmax(0, 1fr)`，卡片可隨內容增高。responsive 層置於元件樣式之後載入；保留 switch 44px 目標、A/B 視覺／9.2 動畫／9.3 focus 規則，未改正式文章、資料、URL、文案、分類或動畫程式。
- 瀏覽器 synthetic fixture 僅在頁面 DOM 注入，375px 與 768px 共 10 組：80+ 字中文 profile 卡片標題、長 switch、長 thinking boundary、首頁 random 長標題、無空格 Latin 標題／正文、一般文章長 marker，以及 profile path 空清單（保留可見 section heading）、近期學習和全文清單既有空狀態。各組記錄 viewport、document/body/main 與元素 scroll/client 尺寸、rect、white-space／overflow-wrap、clamp／text-overflow／overflow 樣式及交疊；10/10 無溢出／截字，12/12 真實路由無水平超界。1px 以下 scroll/client 高差視為次像素取整，且容器 overflow 可見，沒有內容遮蔽。
- 新增 `surface-responsive-check.js`、5 個正反例測試和 `check:surface-responsive`，已接入 `verify` build 前。source 與 output 檢查鎖定正式首頁 template／CSS selector 一致、767px 雙欄、430px 單欄、長字折行、無 clamp／文字 hidden overflow／固定卡高、switch／skip／卡片安全；輸出檢查三核心頁、一般文章 hook、viewport metadata、empty template hook。反例含錯字／不存在 selector、overflow hidden／clamp、固定卡高、nowrap、缺少手機單欄與 switch absolute/fixed 遮擋。
- focused responsive tests 5/5；完整 regression 224/224。content（5 分類／21 則碎碎念／225 圖牆路徑）、article scaffold、profile-home（3 paths／8 unique URLs／4 featured）、public-boundary（433 檔、舊文字／retired ID 命中皆 0）、tags、song-tags、site（378 HTML／134,850 href/src）、profile（8 path cards／2 learning／8 URLs）、profile articles（8）、surface control（3）、home bridge（1）、contextual menu（3）、thinking（271 篇／18 卡）、post-surface（271 篇）、visual／transition／accessibility／responsive source 與 output 檢查全通過。`node --check` 與 `git diff --check` exit 0；diff check 顯示既有工作樹 LF／CRLF 提示。
- Headless Chrome 證據 `tmp/wbs94-browser-evidence.json`：12 真實路由尺寸組合＋10 合成 fixture、257 項頁面／文字／rect 檢查 0 失敗，console warning/error/exception 0。包含首頁實際入口 grid 的 computed columns（4／2／1）、手機 reduced motion（animation 0s）、no-JS skip/switch 鍵盤切換、skip／switch focus 在 viewport 內；13 張首頁／profile／long／empty 截圖在 `tmp/wbs94-*.png`。本輪 8944／9344 與 8945／9345 listener 已關閉，僅清理本輪兩個 Chrome profile。
- 範圍限四個指定真實路由、合成長內容與空狀態；不宣稱所有歷史文章任意內容或第三方嵌入／widget 全面 responsive。未部署、未使用額度重置券。WBS 9.4 完成；G9 未通過（9.5 文案 HOLD）。下一步 WBS 9.5。

## 2026-09-27，雙面部落格 WBS 9.3：無障礙驗收（完成；未部署；G9 未通過）

- `_layout.njk` 的 body 開頭加入「跳到主要內容」，連到唯一既有 `.main-inner#main-content`；目標設 `tabindex="-1"`，沿用唯一 main landmark。skip link 聚焦時在文件左上方清楚顯示，沒有動畫，也不覆蓋右側 surface switch。
- A/B `.surface-switch-link` 與首頁 `.home-profile-bridge a` 可點盒提高到至少 44×44 CSS px；保留／補足 focus-visible。一般文章中性面向標記文字改為 `#806b60`，瀏覽器實測對白底 5.01:1，修正原本 4.47:1 的小幅不足。
- 稽核發現 NexT header 搜尋／導覽、sidebar 與 back-to-top 的部分 `role="button"` 原本不可 Tab 到達；補 `tabindex="0"` 和缺少的名稱，使用既有 click 行為加上 Enter 與 Space 鍵盤觸發。Space 於 keyup 觸發一次，瀏覽器驗證兩種鍵各只觸發一個 click。surface switch 和 bridge 仍是原生 anchor，未攔截導航。
- Reduced motion CSS 明列 animation／transition duration 為 0s、transform 為 none；既有 JS 在 reduced motion 下不寫 intent、不加翻面 class。新增 `surface-accessibility-check.js`、5 個正反例測試及 `check:surface-accessibility`，放在 `verify` build 前；檢查 source hooks、三個核心輸出路由、一般文章、skip target、main landmark、ID／ARIA、名稱、tabindex、目標尺寸、reduced motion 與文章標記順序。視覺檢查新增中性文章標記對比門檻。
- focused tests 18/18 通過；完整 regression 219/219 通過。內容檢查（5 分類／21 則碎碎念／225 個圖牆路徑）、article scaffold、profile-home（3 paths／8 URLs／4 featured）通過；public-boundary 掃描 441 個文字檔，舊文字／retired ID 命中皆為 0。`node --check` 與 `git diff --check` 通過；diff check 僅見工作樹原有 LF／CRLF 提示。
- 隔離建置 `npx hexo generate --force --config _config.yml,tmp/wbs93-build.yml` 產生 1,013 個檔案至 `tmp/wbs93-public-20260927`；未 clean，也未寫正式 `public/`。site（378 HTML／134,850 href/src）、profile（8 path cards／2 learning／8 URLs）、profile articles（8 cards）、surface control（3 pages）、home bridge（1）、contextual menu（3）、thinking status（271 articles／18 cards）、post surface（271 articles；A 7／B 263／雙面 1）、visual、transition 與 accessibility 輸出檢查均通過。文章 marker 對比檢查為 5.01:1。
- Headless Chrome 證據保存於 `tmp/wbs93-browser-evidence.json`；1280×900 與 390×844 各檢查 `/`、`/profile/`、`/profile/articles/` 及一般文章，共 8 個路由／尺寸組合。CDP `Accessibility.getFullAXTree` 保存角色、名稱、heading level 與 landmark 順序；各頁一個 main landmark。鍵盤驗證涵蓋 skip link、surface switch、首頁 bridge、profile card 及 Enter 導航；header role button 的 Enter／Space 各單次觸發。另驗 reduced motion、no-JS anchor 導航、目標盒尺寸、文字對比、ID／ARIA、橫向溢出；console warning/error/exception 為 0。focus 截圖為 `tmp/wbs93-desktop-focus.png`、`tmp/wbs93-mobile-focus.png`；8923／9363 listener ports 已釋放，僅清理本輪 Chrome profile。
- 範圍限雙面核心旅程與代表性一般文章；沒有宣稱所有歷史文章、任意文章內容或第三方 widget 全面符合 WCAG。未部署、未使用額度重置券。WBS 9.3 完成；G9 未通過（9.4／9.5 未完成）。下一步 WBS 9.4「響應式驗收」；9.5 文案仍為 HOLD。
- 目前 271 篇已發布文章沒有 `thinking_status` 資料，因此本次生成文章沒有實際 aside 可供瀏覽器量測；aside 的名稱、正文前順序由正向／回歸 fixture 驗證，樣式保持中性，後續有實際狀態文章時仍可再做實頁量測。

## 2026-09-27，雙面部落格 WBS 9.2：翻面互動（完成；未部署；G9 未通過）

- 新增專用 `surface-transition.js`，以事件委派辨識首頁 bridge 與現有 surface switch；不攔截 anchor。只為同源 primary、無 modifier、非 download／非新分頁的連結記錄 schema/version、target surface、正規化 pathname、timestamp 的 session intent，TTL 4,500ms。抵達頁由 `.surface-switch[data-current-surface]`、pathname 與 navigation type 驗證；讀後立即刪除。Storage 失敗、reduced motion、reload、back/forward 或錯路徑維持正常導航、不播動畫。
- 新增 `_custom/surface-transition.styl`，只為目標 `.main-inner.index`／`.main-inner.profile-page` 播 180ms 動畫：profile 從右側微移、memory 從左側微移，角度 1 度、第一幀 opacity 0.86；`animationend` 僅清理 class，不控制導航。Reduced-motion media query 將 animation、transition、transform 關閉。載入有全域 install guard，並支援 `page:loaded`／`pjax:success` refresh；未修改 PJAX 核心。目前仍是 pjax:false 完整導航。focus、scroll 與完整 accessibility 留待 9.3。
- `surface-visual-check` 的無動畫規則改為限制 token、profile、home、switch、thinking 與文章樣式檔；transition 專用檔是 9.2 唯一允許範圍。維持 token、對比、文章中性、focus-visible 檢查。新增 `check:surface-transition`，並納入 `verify` build 前；新增 8 項互動測試，聚焦 transition／visual 測試 13/13，`npm run test:regression` 214/214。
- 隔離建置 `npx hexo generate --force --config _config.yml,tmp/wbs92-build.yml` 產生 1,013 個檔案至 `tmp/wbs92-public-20260927`；未 clean、未寫正式 `public/`。Source/output visual 與 transition、profile-page（8 path／2 learning／8 unique URLs）、profile-articles（8）、surface-control（3 pages）、首頁 bridge（1）、contextual menu（3 pages）、site（378 HTML／134,472 href/src）均通過。另有 content（5 分類／21 碎碎念／225 圖片）、scaffold、profile-home（3 paths／8 URLs／4 featured）、public-boundary（433 文字檔、0 舊文字／retired ID 命中）通過；3 個 `node --check` 通過。`git diff --check` exit 0，只有工作樹既有 LF／CRLF 提示。
- Headless Chrome 證據 `tmp/wbs92-browser-evidence.json`：1280×900、390×844，4/4 面向轉換通過。URL 約 76–104ms 即更新；computed animation 0.18s、opacity 0.86；180ms 後所有 transition class 清除。reload/back 不誤播；reduced motion 為 0s 且無 intent；no-JS 與鍵盤 Enter 可導航；Ctrl+click 保持原頁 `/`、不寫 intent，並開 profile 新分頁。桌機 scrollWidth 1265/1280、手機 390/390；console warning/error/exception 0。離線 headless runner 以本機搜尋／動畫 shim 代替 CDN，並將既有 NexT motion 的內容設為 settled 可見狀態；surface transition CSS／JS 未被覆寫。靜態截圖為 `tmp/wbs92-desktop-profile.png`、`tmp/wbs92-desktop-memory.png`、`tmp/wbs92-mobile-profile.png`、`tmp/wbs92-mobile-memory.png`。HTTP/CDP ports 8922／9362 已釋放；僅清理本輪 `tmp/wbs92-chrome-profile`。
- 保留進場前未提交修改與既有 tmp 證據，不改文案、文章、資料、URL 或普通文章樣式。未部署、未使用額度重置券；不宣稱完整 accessibility 或文案定稿。WBS 9.2 完成；G9 未通過。下一步 WBS 9.3「觸控與完整 accessibility 驗收」，9.5 文案定稿仍未完成。

## 2026-09-27，雙面部落格 WBS 9.1：共用與差異視覺規則（完成；未部署；G9 未通過）

- 新增集中 token 層 `themes/next/source/css/_custom/dual-surface-visual.styl`，在 `main.styl` 先於首頁樣式載入。`:root` 共用預設、`.main-inner.index` 明確維持 memory 暖色、`.main-inner.profile-page` 覆寫 profile 灰藍／青綠；具 paper/base/panel/ink/muted/border/accent/accent-strong/focus/shadow 語意 token。Profile 標題、卡片、空狀態、導覽、thinking label、switch 轉用 token；首頁只將橋接列及入口標籤／hover 等安全 B 面規則轉用 token，保留 tape/archive 首頁 legacy 樣式。普通文章的 thinking 資訊塊與 post surface marker維持中性。
- 新增 `docs/dual-surface-visual-rules.md` 記錄共用骨架、A/B 規則、範圍與文章中性原則，以及 9.2／9.3／9.5 邊界。新增 `tools/surface-visual-check.js`、5 項 `tools/tests/surface-visual-check.test.js`，及 `check:surface-visual`；唯讀檢查已加入 `verify` 的 build 前。檢查鎖定載入、必要 token、A/B 差異、profile/home/switch/thinking token 引用、文章中性、focus-visible、無新增 animation/keyframes、文件及主要文字色比。20 組 ink/muted/accent/strong/focus 對 panel／paper 的最低對比為 4.96:1；既有範圍外 legacy 色彩未擴大重寫。
- Hexo 隔離建置使用 `npx hexo generate --force --config _config.yml,tmp/wbs91-build.yml`，輸出 `tmp/wbs91-public-20260927`，1,012 個檔案；沒有執行 clean，也未寫入正式 `public/`。編譯 CSS visual checker 通過；profile-page（8 path／2 learning／8 unique URLs）、profile-articles（8）、surface-control（3 pages）、thinking-status（271 文章／18 A 卡無狀態外洩）及 site（378 HTML／134,094 href/src）輸出檢查通過；post-surface（271：A 7／B 263／雙面 1）亦通過。
- Headless Chrome/CDP 證據為 `tmp/wbs91-browser-evidence.json`：16/16 通過、console warning/error/exception 0。實際檢查 `/`、`/profile/`、`/profile/articles/` 桌機 1280×900 與手機 390×844，並檢查一般文章 `/work/flow-friendly-work-system/` 的中性 marker。首頁與 profile 卡片 computed panel 分別為 `rgb(241, 228, 209)`／`rgb(232, 238, 240)`，ink 分別為 `rgb(74, 48, 40)`／`rgb(38, 60, 71)`，accent token 分別 `#914a32`／`#326f68`；所有入口 switch 可見。手機三頁 scrollWidth 均 390；桌機最大 1265/1280，無水平溢出。桌面截圖 `tmp/wbs91-desktop-memory.png`、`tmp/wbs91-desktop-profile.png`。離線 QA runner 以本機搜尋套件及 no-op motion shim 取代外部 CDN 依賴；網站程式與輸出未加入動畫行為。HTTP/CDP ports 8921／9361 已釋放，僅本輪 `tmp/wbs91-chrome-profile` 已安全清理。
- 驗證：視覺目標測試 5/5、完整 regression 206/206；content（5 分類／21 碎碎念／225 圖片）、scaffold、profile-home（3 paths／8 URLs／4 featured）、public-boundary（433 個文字檔、0 舊字串／retired ID 命中）、視覺 source/output、profile-page、profile-articles、surface-control、thinking-status、post-surface、site、3 個 `node --check` 及 `git diff --check` 均通過。diff check 只有工作樹既有 LF／CRLF 提示。保留進場前未提交修改與既有 `tmp`；未改文章、資料、URL 或 DOM；未部署、未使用額度重置券。
- WBS 9.1 完成；G9 尚未通過，因後續視覺動態與可及性項目未完成。下一步 WBS 9.2「動態與動畫增強」；9.5 文案定稿仍未完成。

## 2026-09-27，雙面部落格 WBS 8.5：作者發布 SOP（完成；未部署；G8 通過）

- 新增[一般文章發布 SOP](dual-surface-publishing-sop.md)，首頁先列最短流程，再說明公開資格、文章面向、成熟度與 A 面首頁策展四個獨立決策；包含新文／草稿流程、三個可複製 front matter 範例、圖片原則、驗證命令、常見錯誤表、發布前清單與停止條件。明確說明公開 URL 邊界、單一文章／URL、探索中日期規則、策展選填及圖片出處不等於隱私許可。
- 複核修正三個範例的 categories 為 allowlist 合法值：圖書館個人經驗 `生活紀錄`、工作文章 `工作知識`、雙面方法文章 `觀念與實驗`。相對連結逐一確認 6 個目標存在；命令與 `package.json` 對照。excerpt CLI 經核對支援 `--post <source/_posts/...md>`／重複 `--post` 及 `--all`，SOP 用法正確。3 個範例以 `js-yaml` `FAILSAFE_SCHEMA` 解析，並依現行分類 allowlist 檢查 categories、surface 僅含 `profile`／`memory` 且非空，以及成熟度欄位整組規則（共用 thinking helper 通過）。
- 唯讀驗證通過：`npm run check:article-scaffold`；`npm run check:content`（5 分類、21 則碎碎念、225 圖牆圖片路徑）；`npm run check:profile-home`（3 paths／8 unique URLs／4 featured）；`npm run check:public-boundary`（433 個文字檔、0 舊文字命中、0 retired ID 命中）；`git diff --check` exit 0。未跑 `npm run verify`，因其會 clean/build 並改寫 `public/`；未執行 build、clean、瀏覽器 QA 或部署。
- 文件連結所涉檔案均存在；本輪只新增 SOP 並更新本進度及內容契約狀態／8.5 邊界，未改程式、`package.json`、scaffold、文章、microblog、`public/` 或 `tmp/`。保留進場前所有未提交修改。未部署、未使用額度重置券。
- 已逐項確認 WBS 8.1–8.5 的契約、呈現、scaffold、驗證與作者流程互相一致：新文章發布不依賴記憶或臨時判斷；公開資格、面向、成熟度、首頁精選是四個分離決策。G8 通過；下一步 WBS 9.1「共用與差異視覺規則」。

## 2026-09-27，雙面部落格 WBS 8.4：發布驗證訊息（完成；未部署；G8 未通過）

- `tools/content-check.js` 的 `check:content` 現在對每篇文章重用 `tools/lib/thinking-status.js`。缺少全部三欄仍合法；孤兒欄位、未知狀態、錯型／格式及空 boundary 會以來源相對路徑、欄位、穩定 code 和繁中修正方式報錯，不回顯正文或 boundary 值。文章依穩定路徑排序掃描，surface 與 thinking 錯誤可同篇並列。
- 相對日期僅在成熟度三欄合法、文章 `date` 合法，且 `updated` 缺席或合法時執行。`thinking_updated` 不早於 `date` 日曆日、不晚於合法 `updated` 日曆日，也不晚於 Asia/Taipei 今日；採欄位中的字面日曆日期比較，測試可注入 clock。非法 `date`／`updated` 僅由原格式檢查回報，不追加相對日期誤報。
- surfaces 檢查維持既有 helper 契約與舊文 manifest 預設；輸出層補上各 normalize 錯誤的明確繁中修正步驟。manifest 外文章缺欄及 `surfaces: []` 均指出來源、欄位、code 與合法修法。
- 新增 content-check 整合案例涵蓋舊文全缺、合法 exploring、孤兒欄位、未知狀態、無效日期、空 boundary 不洩漏、日期早於／晚於界線、含時區同日、非法 `date`／`updated` 抑制相對誤報、clock injection、surface 缺漏／空陣列及同篇多錯。
- 驗證通過：目標測試 15/15；`npm run test:regression` 201/201；`npm run check:content`（5 分類／21 則碎碎念／225 圖牆路徑）、`npm run check:article-scaffold`、`npm run check:profile-home`（3 paths／8 URLs／4 featured）及唯讀 `npm run check:public-boundary`（433 text files、0 舊文字命中、0 retired ID 命中）；`node --check tools/content-check.js`、`node --check tools/tests/content-check.test.js`、`git diff --check` 通過。diff check 只有進場前工作樹既有 LF／CRLF 提示。
- 未改任何文章 front matter／正文／日期／URL、`source/microblog.json`、`public/`，也未清理或改動既有 `tmp`；未執行 clean、build、瀏覽器 QA 或部署，未使用額度重置券。
- WBS 8.4 完成；G8 仍未通過，因 8.5 發布 SOP 尚未完成。下一步 WBS 8.5「發布 SOP」。

## 2026-09-27，雙面部落格 WBS 8.3：新文章 scaffold（完成；未部署；G8 未通過）

- `scaffolds/post.md`、`scaffolds/draft.md` 保留原有 title/date/tags 欄位形狀；只有 post 保留 date。新增 `surfaces: []` 作未完成、發布前須替換的阻擋占位，不設預設 memory。YAML 註解依序提醒公開判斷、三種合法面向及單一文章／網址、探索中才啟用的三欄成熟度、A 面首頁策展選填；提示不進正文。`scaffolds/page.md` 位元組未改，固定功能頁不加文章欄位。
- 新增 `scripts/article-scaffold-comments.js`，因 Hexo `post.create` 會重新序列化 front matter 並丟棄 YAML 註解，此同步 `new` 事件處理將 post／draft scaffold 註解補回新檔的 front matter；不處理 page。新增 `tools/article-scaffold-check.js`、6 項 `tools/tests/article-scaffold-check.test.js` 與 `check:article-scaffold`，並將唯讀 checker 接入 `verify`。Checker 解析替換 Hexo 佔位後的 YAML，驗證 active 欄位、註解語意、空正文、無成熟度欄位、page 原始內容及無 A/B 複製提示；fixture 覆蓋預設 memory、缺公開提醒、active thinking 欄位、正文提示與 page 誤加 surface。
- 實際 Hexo scaffold API 測試在新建 `tmp/article-scaffold-*` 隔離目錄生成一篇 post、一篇 draft；確認 title/date、空 `surfaces`、四組註解、空正文及各一個輸出檔。測試後只移除自身臨時目錄；既有 `tmp` profiles 未動。
- 驗證：新增目標測試 6/6；完整 `npm run test:regression` 196/196；`npm run check:article-scaffold`、`npm run check:content`（5 分類／21 則碎碎念／225 個圖牆圖片路徑）、`npm run check:profile-home`（3 paths／8 URLs／4 featured）、唯讀 `npm run check:public-boundary`（433 個文字檔、0 舊文字命中、0 retired ID 命中）、三個新增 JS 檔 `node --check` 及 `git diff --check` 通過。後者只有工作樹既有 LF／CRLF 提示。
- 保留進場前全部未提交修改及既有文章；未改任何既有文章／頁面 front matter、正文、日期或 URL，`public/` 未改。沒有執行 build／clean、瀏覽器 QA 或部署，沒有使用額度重置券。
- 下一步 WBS 8.4「發布驗證訊息」；G8 尚未通過。

## 2026-09-27，雙面部落格 WBS 8.2：探索中資訊塊（完成；未部署；G8 未通過）

- 新增 `scripts/thinking-status.js`，直接共用 `tools/lib/thinking-status.js` 解析明確宣告的三個 front matter 欄位；缺欄時不輸出，部分／非法宣告保留來源與穩定錯誤並中止，不從 `surfaces`、策展 `status`、`learning_status`、分類、標籤或正文推論。A 面三種卡片均使用同一 parser，只有探索中卡片顯示「探索中・校準 YYYY-MM-DD」。
- 單篇文章在 `.post-surface-marker` 後、`.post-body` 前增加靜態 `<aside class="post-thinking-status">`：有標題與 `aria-labelledby`，顯示最近校準 `<time>` 及適用邊界；邊界經 HTML escape。區塊不含 JavaScript、事件、按鈕、連結或折疊；新增低彩度獨立 Stylus 樣式，長字串可換行。
- 新增 `tools/thinking-status-output-check.js`、`tools/tests/thinking-status-output-check.test.js` 與 `check:thinking-status-output`，鎖定 helper/template wiring、正式無狀態輸出、文章與 A 卡標記範圍，並以 synthetic positive/negative fixture 檢查三類 A 卡精簡標記及惡意邊界轉義。沒有修改文章 front matter、正文、日期、permalink 或挑選正式文章作探索樣本。
- 隔離建置：`npx hexo generate --config _config.yml,tmp/wbs82-build.yml`，產生 1,012 個檔案；`check:thinking-status-output` 確認 271 篇文章、18 張 A 面卡片均沒有標記（現有來源無 thinking 欄位）。正式輸出 B 面首頁、random、archive、category、search 亦無成熟度標記。profile 輸出為三路徑 8 卡、最近學習 2 卡、完整清單 8 卡。
- 驗證：目標 thinking 測試 16/16；`npm run test:regression` 190/190；content（5 分類、21 碎碎念、225 圖片路徑）、profile-home（3 paths／8 URLs／4 featured）、tags（271 文章）、song-tags（121 篇）、profile-page、profile-articles、surface-control、home-profile-bridge、contextual-menu、post-surface（271）、surface-history（271）、search-surface（292 records／271 recent）、random-surface（262 records／排除 7 profile-only／保留 1 dual）、archive-category（271 routes）、public-boundary（440 文字檔／21 sources／命中 0）及 site（378 HTML／134,094 href/src）均通過。新增 JS `node --check` 通過，隔離建置輸出已編譯 Stylus，`git diff --check` 通過（只有既有 LF/CRLF 提示）。
- Synthetic headless Chrome/CDP QA 證據：`tmp/wbs82-browser-qa-evidence.json`，桌機 1280×900、手機 390×844 共 16/16 檢查通過；驗證長邊界無溢出、語意與閱讀順序、日期、三種卡片標記、惡意字串只作文字、沒有 script/inline handler，console warning/error/exception 為 0。HTTP/CDP ports 8916／9356 已釋放，本輪 `tmp/wbs82-chrome-profile` 已移除；隔離 build、fixture 與 evidence 保留。非目標額外執行的 `check:excerpt --all` 有兩篇既有文章缺 `<!-- more -->` 標記，未修改其內容。
- 未執行會 clean 或改寫 `public/` 的流程；未部署、未使用額度重置券；保留所有進場前未提交修改及舊 tmp profiles。下一步 WBS 8.3「新文章 scaffold」；WBS 8.4 尚未開始，G8 未通過。

## 2026-09-27，雙面部落格 WBS 8.1：成熟度資料契約（完成；未部署；G8 未通過）

- 新增文章 front matter 專用 `tools/lib/thinking-status.js`：唯一狀態為精確字串 `exploring`；三欄全缺是合法且不顯示的預設，孤兒欄位、未知狀態、錯誤型別、無效 Gregorian 日期與空邊界均以穩定 code/source/field 報錯。輸出與常數凍結，解析不改輸入，也不讀取 surfaces 或其他文章狀態。
- 新增 `tools/tests/thinking-status.test.js`，涵蓋缺欄、孤兒欄位、顯式 undefined/null、自有欄位與繼承欄位、狀態大小寫／空白／未知值、各種錯誤型別、真實日期與閏日、trim 後邊界、輸入不變、輸出／常數隔離、surface 獨立與錯誤不回顯正文；目標測試 11/11 通過。
- 更新 `docs/dual-surface-content-contract.md` 增加成熟度規格、完整範例、預設及錯誤、公開性／面向／learning／策展狀態邊界。相對 thinking_updated 與文章 date、updated 或當天的矛盾規則留給 8.4；沒有改 profile-home item `status`，沒有批次修改文章 front matter，也沒有開始 8.2、8.3 或 8.4 整合。
- 驗證：兩個新增 JavaScript 檔 `node --check` 通過；`npm run test:regression` 185/185；`npm run check:content`、`npm run check:profile-home` 通過；唯讀 `npm run check:public-boundary` 通過（既有 `public/` 433 個文字檔、21 個來源樣本、舊文字命中 0、retired ID 命中 0）；`git diff --check` 通過，只有工作樹既有 LF／CRLF 提示。未執行 build、clean、`check:site` 或其他會改寫 `public/` 的命令。
- 未部署、未使用額度重置券；保留進場前所有未提交修改與既有 `tmp` profile 殘留。下一步 WBS 8.2「探索中資訊塊」；G8 尚未通過。

## 2026-09-27，雙面部落格 WBS 7.5：全部文章與分類相容（完成；未部署；G7 通過）

- 進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`。進場工作樹已有 WBS 7.1–7.4、作者文章與其他未提交修改；全部保留。本輪只改驗證工具、測試、`package.json` 及本進度紀錄，沒有改文章正文、日期、permalink、既有 microblog ID 或 `public/`。
- 新增 `tools/archive-category-compat-output-check.js`、3 項測試及 `check:archive-category-compat`；並將輸出檢查接入 `verify`。檢查器由建置後 navigation-index、HTML 與 canonical 驗證全站文章唯一性、檔案路由、所有 `/archives/` 分頁、`/categories/` 全部清單、原生分類清單、固定樣本、A 面完整清單及可選隔離基準路由差異。`content_browser_records()` 無參數為 `all` 另有既有單元測試直接鎖定。
- 全新隔離建置命令：`npx hexo generate --config _config.yml,tmp/wbs75-build.yml`；產生 1,012 個檔案，378 個 HTML；編譯 CSS 正常，未 clean、未寫入 `public/`。檢查結果：271 篇文章／271 唯一路由／271 個文章 HTML／271 個唯一 canonical；A-only 7、memory-only 263、dual 1（含面向總數 profile 8、memory 264）。`/archives/` 分頁 3 頁，100／100／71 篇，聯集 271 且各篇恰一次；`/categories/` 預設 271 筆且各篇恰一次；6 個原生分類共 271 個正確 membership。同一分類內無重複文章。A 面 `/profile/articles/` 仍為 8 篇。無 JS 靜態輸出仍保留完整文章列表及分類／標籤 fallback。
- 路由基準 `tmp/wbs33-public-20260926` 有 271 條文章路由；本次無新增或遺失。profile-only `/work/from-real-work-to-features/`、memory 歌曲 `/2026/09/01/歌曲推薦/歌曲推薦-sailing%20back%20to%20you/`、dual `/work/flow-friendly-work-system/`、站務 `/2026/01/25/部落格改版規劃/` 均留在原 URL、分類及唯一 canonical；歌曲路徑依生成編碼檢查。樣本規劃文件仍保留較早的角色紀錄，本輪依本次固定契約唯讀核對最新來源，未自動改寫文章或樣本文件。
- 驗證：目標測試 3/3；`npm run test:regression` 174/174；content（5 類別／21 則 microblog／225 圖片路徑）、profile-home（8 URL／4 featured）、tags（271）、song-tags（121）、profile-page（8 卡／2 learning）、profile-articles（8）、surface-control（3 頁）、contextual-menu（3 頁）、home bridge（1）、post-surface（271：A 7／B 263／雙面 1）、surface-history（271）、search-surface（292 records／271 recent candidates）、random-surface（262；排除 7 篇 profile-only、保留 1 篇 dual）、public-boundary（440 text files／21 sources／0 舊資料命中）、site（378 HTML／134,094 href/src）及 archive-category checker 均通過。`node --check`（新增 checker、測試及相關瀏覽器腳本）與 `git diff --check` 通過；後者僅列工作樹既有 LF／CRLF 提示。全套 `npm run verify` 未執行，因該命令會 `hexo clean` 並寫入 `public/`；等價的回歸與輸出檢查已對隔離建置執行。
- Headless Chrome/CDP QA 證據：`tmp/wbs75-browser-qa-evidence.json`，32/32 通過、console warning/error/exception 0。桌面 1280 與手機 390×844 驗證 archive 分頁、分類全部／音樂 121 篇／韓語交集 11 篇、query/reload/Back/清除、四個固定文章由分類列表以鍵盤開啟原 URL 後返回、唯一 canonical、無水平溢出；A 面清單仍 8 篇。停用 JS 的 fallback 由生成 HTML 輸出檢查確認。隔離 HTTP/CDP ports 8915／9355 已釋放；本輪 `tmp/wbs75-chrome-profile` 已清除。未碰或刪除 wbs72／wbs73 profile 殘留。
- G7 通過。沒有部署、沒有使用額度重置券。下一步為 WBS 8.1「成熟度資料契約」；本輪未開始 WBS8。

## 2026-09-27，雙面部落格 WBS 7.4：B 面通往 A 面的橋（完成；未部署；G7 未通過）

- 根首頁在原隨機卡與四個 B 面入口之後、收尾線稿之前，加入一列低彩度的 `SIDE A` 橋接：標題「工作與學習」、提示「看整理過的經驗與方法」、連結「翻到 A 面 ↗」。連結 href、目標面向與無障礙名稱共用 `surface-navigation.yml` 的 memory 控制；保留普通 `/profile/` 連結，無 JS 可用，也不設定 target 限制新分頁。沒有改隨機卡、四個入口、Welcome Board 或 A 面頁面。
- 新增 `check:home-profile-bridge` 輸出檢查及 3 個測試，確認全站只在根首頁出現一次、位置在四入口後／收尾前、入口數量未減、文案精簡、href／標籤取自共用設定，且沒有 inline handler 或 script 依賴；窄版樣式可換行並提供清楚的 `:focus-visible`。
- Hexo 使用 `tmp/wbs74-build.yml` 隔離建置至全新 `tmp/wbs74-public-20260927`，共生成 1006 個檔案；未執行 clean、未修改 `public/`。首頁 bridge checker 通過；首頁 4 個 B 入口、profile/8 cards、所有路由及編譯 CSS 均存在。
- 驗證通過：bridge 目標測試 3/3、完整 regression 171/171；random-surface 262 筆（profile-only 7 篇排除、雙面文章 1 篇保留）。`check:content`（5 分類／21 則 microblog／225 圖牆路徑）、`profile-home`（3 paths／8 URLs／4 featured）、`profile-page`（8 path＋2 learning cards）、`profile-articles`（8）、`surface-control`（3 pages）、`contextual-menu`（3）、`post-surface`（271 篇：A 7／B 263／雙面 1）、`surface-history`（271 篇）、`search-surface`（292 records／271 recent candidates）、`public-boundary`（435 text files）、tags（271 篇）、song-tags（121 篇）及 site（378 HTML／134,850 href/src）均通過。三支新增 checker／測試／QA runner 的 `node --check` 通過；Hexo build 成功編譯 Stylus。
- Chrome headless/CDP 實際瀏覽器 QA 證據：`tmp/wbs74-browser-qa-evidence.json`，11/11 通過。1280 桌面及 390×844 手機的橋接列均位於隨機主卡之後、尺寸較小且無水平溢出；Tab 可由第四個 B 入口到達橋接連結、焦點外框可見，Enter 開啟 `/profile/`；直接開啟、新分頁、reload 及 Back 均正確。因測試環境不載入 CDN，QA runner 使用本機 searchdb 程式與 PJAX／動畫替身；最終 console warning/error/exception 為 0。HTTP/CDP ports 8914／9354 已釋放，本輪 `tmp/wbs74-chrome-profile` 已清除。
- `git diff --check` 通過，輸出僅有工作樹既有的 LF/CRLF 提示。保留進場前及 WBS 7.2／7.3 所有修改與 profile 殘留；沒有改文章正文、URL、`public/`，未部署，未使用額度重置券。
- WBS 7.4 完成；G7 仍未通過，7.5 尚未完成。下一步 WBS 7.5「全部文章與分類相容」。

## 2026-09-27，雙面部落格 WBS 7.3：B 面抽籤整合（完成；未部署；G7 未通過）

- `random.json` 產生器在既有隨機資格檢查後套用共用 surfaces 契約，只收含 memory 的文章；維持既有欄位結構，不增加 `surfaces`，雙面文章不複製。首頁與 `/random/` 均讀取同一份 `/random.json`。
- 首頁保存的 `home-random-selection-v1` 僅接受目前候選資料中的文章，過期網址改抽合法候選；換一篇排除目前文章。`/random/` 新增 `random-tape-selection-v1`，以本分頁 sessionStorage 保存分類與目前 URL；只有文章仍存在且符合分類才恢復。失效分類／網址會清除後回到全部重抽；儲存不可用時仍可抽取。既有最近三次不重複與分類抽取保留。
- 新增 `check:random-surface` 與輸出檢查測試，固定檢查既有資格與 memory 的精確交集、唯一 URL、profile-only 排除、雙面文章單筆、原 random schema，以及首頁與 `/random/` 的共用資料端點和頁面狀態／JS syntax wiring。
- 以 `tmp/wbs73-build.yml` 將 Hexo 建置到全新 `tmp/wbs73-public-20260927`；生成 1006 個檔案，未執行 clean、未改 `public/`。輸出檢查通過：`random.json` 262 筆，對照 271 篇文章中的 264 篇 memory 合格文章再排除 2 篇站務／控制入口後，實際隨機集合為 262；7 篇 profile-only 不在資料中，唯一雙面文章保留一筆，URL 全唯一、沒有 surfaces 欄位。首頁與 `/random/` 均使用同一資料檔。
- 目標測試與完整 regression 通過：首頁隨機、分頁分類／URL 還原與失效狀態測試通過；完整 regression 168/168。`check:content`、profile-home（3 paths／8 URLs／4 featured）、profile-page（8 path＋2 learning cards）、profile-articles（8）、surface-control（3 pages）、contextual-menu（3 pages）、post-surface（271 articles：A 7／B 263／雙面 1）、surface-history（271）、search-surface（292 records／271 recent candidates）、public-boundary（435 text files）、tags（271 articles）與 song-tags（121 songs）均通過；site checker 通過 378 HTML、134,849 href/src。新 random checker 亦通過。
- headless Chrome/CDP 證據 `tmp/wbs73-browser-qa-final3-evidence.json`：27/27 通過。確定性控制 Math.random 驗證首頁首次抽取／換篇／reload／文章返回同卡；`/random/` 初抽／分類切換／換篇／reload／文章返回保留同分類同卡；profile-only 假狀態不能還原、雙面文章可直接呈現、無效分類及過期 URL 安全退回全部、sessionStorage 拒用仍可抽、A/B 狀態互不污染、資料請求失敗 fallback、DJ 音樂／書籍入口、鍵盤按鈕與文章連結，以及桌面 1280px／手機 390px 無水平溢出。非預期 console warning/error/exception 為 0。
- `node --check`（generator、checker、測試與 browser runner）、random 頁 inline script checker 及 `git diff --check` 通過；diff check 只有工作樹原有的 LF/CRLF 提示。瀏覽器服務 ports 8898–8901、9346–9349 均已釋放；最終輪 profile 已刪。第一次失敗 runner 留下的 `tmp/wbs73-chrome-profile/` 因 Windows 回覆 EPERM 無法清除而保留，未再重試遞迴刪除；各 CDP port 已關閉，但 Chrome parent 的 Node exit event 未確認，未處理無法識別的 Chrome 程序。未部署、未使用額度重置券。
- WBS 7.3 完成；G7 仍未通過，7.4／7.5 未完成。下一步 WBS 7.4「B 面通往 A 面的橋」。

## 2026-09-27，雙面部落格 WBS 7.2：搜尋去重與狀態（完成；未部署；G7 未通過）

- 搜尋 helper 以穩定 `record.id` 防禦性去重；相同網址的不同 ID 碎碎念仍各自保留。真實 navigation index 有 292 records、271 篇文章及 21 筆共用 `/status/` URL 的獨立紀錄；輸出 checker 驗證雙面文章在 profile、memory、all 三個範圍各只有 1 筆，並逐筆保留共用 URL 紀錄。
- 搜尋結果新增文字「收錄於」標籤：profile-only「工作與學習」、memory-only「個人記憶」、雙面「工作與學習・個人記憶」。標籤依 record 實際 `surfaces` 產生，切換範圍不改變標籤；新增低彩度邊框與可換行樣式，保留文字資訊。
- 載入中、索引載入失敗、關鍵字零結果及只有篩選條件造成的零結果均有明確文字；動態狀態使用 `role=status`、`aria-live=polite` 與 `aria-atomic=true`。失敗狀態提供可鍵盤操作的「重試載入搜尋索引」按鈕；統一狀態名稱為 `failed`，修正先前寫入 `error` 但恢復流程只辨識 `failed` 的不一致。載入期間重複觸發不會發出第二筆請求；重試成功保留查詢與範圍。
- 新增／更新搜尋輸出 checker 與測試，`npm run check:search-state -- --root <隔離輸出目錄>` 驗證狀態 wiring、surface labels、穩定 ID 去重及真實索引案例；`package.json` 新增對應 script。目標搜尋測試 19/19、完整 regression 167/167。
- 隔離 Hexo build 輸出至 `tmp/wbs72-public-20260926`，確認設定實際指向該目錄後完成 1006 個生成檔；未執行 clean、未修改 `public/`。搜尋面向 checker 通過 292 records、271 篇 recent candidates、雙面文章各範圍 `1/1/1` 筆、共用 URL 21 筆獨立紀錄。`check:content`、profile-home/page/articles、surface-control、contextual-menu、post-surface、surface-history、search-surface、search-state、public-boundary、tags、song-tags 及 site 均通過；site 檢查 378 HTML、134,849 href/src。
- headless Chrome/CDP 最終矩陣 30/30 通過：雙面文章三範圍去重、三種標籤、關鍵字與純篩選兩種空狀態、受控 HTTP 503 失敗後重試成功並保留條件、profile/article/B 預設與清除、PJAX success 面向重算、跨 URL 隔離、同 URL Back/reload 還原、鍵盤可達與可見焦點、桌面 1280×800 及手機 390×844 無水平溢出。文章段落錨點、碎碎念持久 ID、學習附註 ID 均直接開啟及 reload 成功；最終非預期 console warning/error/exception 為 0。證據：`tmp/wbs72-browser-qa-acceptance-evidence.json`；早期 runner 故障診斷分別保留於 `tmp/wbs72-browser-qa-evidence.json`、`tmp/wbs72-browser-qa-final-evidence.json`、`tmp/wbs72-browser-qa-diagnostic-evidence.json`，最終執行只將一次預期 503 記為故障攔截訊息。
- `node --check`（兩支搜尋 JS 與 QA runner/checker）通過，`git diff --check` exit 0；輸出只有既有檔案 LF/CRLF 提示。所有本輪服務 port（8893–8897、9341–9345）收尾確認無 listener。Chrome profile 清理命令在執行逾時後中止，未再遞迴刪除；目前仍有 `tmp/wbs72-chrome-profile`、`tmp/wbs72-chrome-profile-rerun`、`tmp/wbs72-chrome-profile-diagnostic`、`tmp/wbs72-chrome-profile-final`、`tmp/wbs72-chrome-profile-acceptance` 五個本輪暫存目錄。未終止無法確認 command line 的系統 Chrome 程序。未部署、未使用額度重置券。
- WBS 7.2 完成；G7 尚未通過，7.3–7.5 未完成。下一步 WBS 7.3「B 面抽籤整合」。

## 2026-09-26，雙面部落格 WBS 7.1：搜尋範圍控制（完成；未部署）

- 搜尋範圍選單新增三個有文字標籤的選項：「工作與學習」（profile）、「個人記憶庫」（memory）、「全部公開內容」（all）。預設由 pathname 和單篇文章 `.post-surface-marker`／`BlogPosting` 判斷：`/profile/` 命名空間為 profile；一般文章頁為 all；其餘頁面為 memory。清除條件回到該頁預設；PJAX success 依新頁重新判定。未使用 referrer、cookie 或 storage 推斷面向。
- `NavigationSearch.parse` 現在要求每筆 navigation-index record 有 canonical 非空 `surfaces`（profile、memory 或依 profile/memory 順序的雙面）；缺漏、空值、未知值、重複、錯序或錯型都拒絕。`search` 先以 surfaces 過濾，再與既有來源、分類、月份和查詢交集。返回／reload view-state 僅在相同完整 URL、有效 surface 且保存的 filter surface 一致時恢復。
- 最近更新改嵌入全部 271 篇公開文章候選，每筆攜帶由共用 surface 契約解析的 surfaces。瀏覽器依目前 scope 再取全域或各分類最新 10 篇，避免只從全站前十截取造成 A/B 清單不完整；分類 tabs、日期與卡片結構沿用。本包沒有新增雙面結果去重或結果面向標籤，也未改文章正文及 URL。
- 新增搜尋面向輸出 checker 與 2 個輸出測試，檢查搜尋選項、navigation-index／最近候選 surfaces 完整對照及 A/B/文章頁面預設判定。隔離 PJAX build `tmp/wbs71-public-20260926` 建置 1006 files；新 checker 通過 292 records、271 篇完整 recent candidates；profile/home/article 預設 truth 分別通過。
- 實際驗證：完整 regression 162/162；content、profile-home、profile-page（8 path cards、2 learning cards）、profile-articles（8 cards）、surface-control（3 pages）、contextual-menu（3 pages）、post-surface（271 articles）、surface-history、public-boundary（435 text files）及 site（378 HTML、134,849 href/src）均通過。首次 regression 曾因 surface data consistency VM 尚未 stub 新增 post-surface helper 而失敗；補上該依賴 stub 後完整重跑通過。最終 `git diff --check` exit 0，只有工作樹既有 LF／CRLF 提示。
- 瀏覽器 QA 未完成：computer-use skill 流程下 CUA 第一次初始化回報 `apps: []`、`browsers: []`；reset/re-init 一次後仍同樣沒有 browser。依指定 recovery 停止，未建立分頁、未調 viewport，未宣稱已測 A/B/article 預設、手動切換／互斥結果、clear、PJAX、view-state、鍵盤、390×844 或 console。自啟的 8813 服務已停止並確認無 listener。本次補驗嘗試以 Codex IAB 開啟隔離輸出：盤點曾回報可用 IAB（tabs 空）；啟動 8891 服務後，visible tab 明確回報 subagent thread 不支援可見性，hidden tab 呼叫長時間無回應並遭中止。其後 IAB inventory 回報空，沒有可用分頁證據，且 8891 已停止並確認無 listener。未調 viewport；因沒有成功建立的 tab，也沒有可用 tab 可關閉。此輪沒有取得任何瀏覽器 UI 證據；以下整個必驗矩陣仍待完成：A/B/article 搜尋範圍與代表查詢結果、三頁 clear、PJAX 跨面重算、同 URL back/reload view-state 與跨 URL 隔離、最近更新依範圍及分類 tabs、desktop／390×844 溢出、鍵盤可達與焦點可見、console warn/error。
- 第二次 fallback 仍未能執行瀏覽器 QA。唯讀盤點找到 `C:\Program Files\Google\Chrome\Application\chrome.exe` 與 Node 24 原生 `WebSocket`；Playwright、Puppeteer 與其 core 套件皆未安裝。建立的一次性 CDP runner 通過 `node --check`，但啟動隔離 Chrome 的 PowerShell 呼叫遭中止前未回傳啟動結果。其後確認 8892 靜態 server 與 9337 CDP port 均無 listener，預期的 `tmp/wbs71-chrome-profile` 和 evidence JSON 均未建立；系統有其他 Chrome processes，但讀取其 command line 遭拒，故未對不明 processes 採取終止動作。沒有打開頁面、執行 DOM／事件案例、viewport 或鍵盤測試，亦沒有瀏覽器 console 證據。QA runner 留在 `tmp/wbs71-browser-qa.cjs` 供後續排查；WBS 7.1 維持部分完成，G7 未通過。
- 本次收到主對話已開啟 `http://127.0.0.1:8765/profile/articles/` 的提示後重試 CUA；此子工作階段 `cua.getState()` 仍回報 `apps: []`、`browsers: []`，以該 URL 呼叫 `cua.getBrowser()` 回報 `No browser is available`。因此無法取得或操作主對話的 IAB，也沒有另開 server/tab 或改 viewport；未取得 UI 證據，7.1 必驗矩陣仍全部待測。WBS 7.1 維持部分完成，G7 未通過。
- 本輪改用工作區內隔離 profile 的 Chrome headless/CDP，在 8892 靜態輸出與 9340 CDP 執行剩餘矩陣；為避免受限環境無法載入 CDN，runner 注入本機 `hexo-generator-searchdb` 的正式 `LocalSearch`，並以只供 QA 的同源 DOM swap／`pjax:success` shim 驗證本站事件整合。最終 32 項中 31 項通過：A／B／文章頁預設範圍、代表查詢互斥與 all、三頁 clear、A/B 到雙面文章後重新判定 all、Back view-state、跨 URL 隔離、最近更新與分類 tabs、1280×800／390×844 無水平溢出、鍵盤焦點鏈及 console 0 warning/error 均通過；證據保存於 `tmp/wbs71-browser-qa-evidence.json`。第三方 PJAX 本體的真實點擊／返回已在 WBS 6.4 通過，本輪 shim 只補驗搜尋的 `pjax:success` 反應，不冒充 CDN 本體測試。
- 首次矩陣唯一失敗是同 URL reload：reload 前 `sessionStorage` 已正確保存 `/profile/`、查詢「AI 提問判斷順序」、profile 範圍與 `isOpen:true`，reload 後保存資料仍在，但彈窗未開、查詢為空且範圍控制仍 disabled。程式核對顯示 `restoreViewState()` 只有在 `searchState === 'loaded'` 才還原；目前 `preload:false`，reload／pageshow 原本不會主動呼叫 `fetchSearchData()`，因此還原流程無法開始。這是實際功能缺陷，不是執行環境阻塞。
- 修正 `local-search.js`：只有同一完整 URL、有效 surface、`isOpen:true` 且 filter surface 一致時，reload／back-forward／BFCache pageshow 才透過既有 `fetchSearchData()` 啟動索引載入；`idle`／`failed` 才要求載入，`loading` 不重複請求，`loaded` 直接進既有還原流程。不同 URL、無效或已清除狀態不會觸發載入或污染頁面。新增回歸測試固定 `preload:false` 的先載入再還原、防重及無效狀態隔離。
- 重新生成隔離輸出後，最終 headless/CDP 矩陣 32/32 通過，包含先前失敗的同 URL reload；console warning/error 為 0。目標搜尋測試 19/19、完整 regression 163/163；content、profile-home、profile-page（8 path cards、2 learning cards）、profile-articles（8）、surface-control（3 pages）、contextual-menu（3）、post-surface（271 articles）、surface-history、search-surface（292 records、271 recent candidates）、public-boundary（435 text files）及 site（378 HTML、134,849 href/src）全部通過。
- WBS 7.1 完成；G7 尚未通過，因 7.2～7.5 仍未完成。未部署、未使用額度重置券。下一步 WBS 7.2「搜尋去重與狀態」。

## 2026-09-26，雙面部落格 WBS 6.4：直接開啟與返回行為（完成；G6 通過；未部署）

- 實際檢查 NexT PJAX 設定為預設關閉；`themes/next/source/js/pjax.js` 原本只替換 `.main-inner`，沒有更新 contextual menu。新增 `.site-nav` selector，讓 PJAX 導覽以新 HTML 替換整個導覽節點；既有 `pjax:success` 的 `NexT.boot.refresh()` 會重新綁定選單、搜尋及手機導覽。
- 新增 `tools/surface-history-output-check.js`、5 個正反例測試與 `npm run check:surface-history`。固定驗證 URL 決定面向、PJAX selector／refresh、A 面代表文章與 B 面文章列表使用同一普通文章連結、文章只產生一個 route／canonical、直接文章仍依 URL 顯示 B 選單與原 surface 標記，並拒絕面向專用 storage、referrer 推測、redirect 及 history state 寫入。
- 以全新 `tmp/wbs64-normal-public-20260926` 及 `tmp/wbs64-pjax-public-20260926` 建置；兩者各生成 1006 檔。預設 PJAX 關閉輸出未載入 `/js/pjax.js`；臨時設定開啟 PJAX 後，生成 JS 含 `.site-nav` selector。兩個輸出均通過 history checker：271 articles，profile-only 7、memory-only 263、雙面 1；雙面原路由為 `/work/flow-friendly-work-system/`。PJAX 輸出另通過 contextual menu（3 pages）、surface control（3 pages）、post surface（271 篇）、profile 首頁／完整清單（8 篇）檢查。
- `npm run test:regression` 通過 158/158；`check:content`、`check:profile-home`、`check:public-boundary`（435 文字檔，核准替代內容各 2 處）、`check:site`（376 HTML、50,075 href/src）通過；`git diff --check` exit 0，僅有工作樹既有 LF/CRLF 提示。沒有執行 clean、沒有修改 `public/`。
- 瀏覽器 QA 使用隔離 PJAX 輸出 `tmp/wbs64-pjax-public-20260926`，本機自啟 8812 服務。A 面 `/profile/` 點擊通往雙面文章 `/work/flow-friendly-work-system/` 的卡片後，URL 保持原文章且 menu 變為 memory；Back 回 `/profile/` 且 menu 回到 profile。由 B 面 `/archives/` 清單開啟同一文章後 Back 回 `/archives/`；兩條流程均未增加 query 或 hash。
- 直接開啟及 reload 雙面文章均留在原 URL，沒有 redirect；menu=memory，canonical 為 `https://progress01.github.io/work/flow-friendly-work-system/`。文章標記的「工作與學習」連到 `/profile/`、「個人記憶」連到 `/`，兩者 Back 都回同一文章 URL。鍵盤 Tab 可到達「工作與學習」連結，`:focus-visible` 為 true 且顯示 2px 實線焦點框；Enter 可啟用並到達 `/profile/`。
- 文章頁桌面 viewport 1280×800：`scrollWidth=1265`，無水平溢出；390×844：`scrollWidth=375`，無水平溢出。瀏覽器 console warn/error 為 0。已 reset viewport、關閉本輪建立的分頁、停止 8812 服務並確認該 port 無 listener。
- WBS 6.4 與 G6 通過；未部署、未使用額度重置券。`git diff --check` exit 0，只有工作樹既有 LF/CRLF 提示。下一步 WBS 7.1「搜尋範圍控制」。

## 2026-09-26，雙面部落格 WBS 6.3：中性文章頁標記（完成；未部署）

- 單篇文章標題資訊下方新增小型「收錄於」導覽：profile-only 顯示「工作與學習」、memory-only 顯示「個人記憶」、雙面顯示「工作與學習・個人記憶」。每個名稱都是普通連結，分別回 `/profile/` 或 `/`；文章清單、分類頁與自訂頁不顯示。
- 標記由 `tools/lib/post-surface.js` 呼叫既有 `normalizeSurfaces` 契約，並使用同一份凍結 legacy manifest；不依分類、標籤、文章路徑或正文猜測面向。舊文缺欄只依名單相容為 memory，新文缺欄或值無效會使建置失敗。文章來源、正文、permalink、canonical 及結構化資料均未改，仍是一篇文章、一個網址。
- 新增 `tools/post-surface-output-check.js`、helper／輸出 fixtures 與 `npm run check:post-surface`。隔離建置到新目錄 `tmp/wbs63-public-20260926`，生成 1006 檔；逐筆對照 `navigation-index.json` 的 271 篇文章均通過：profile-only 7、memory-only 263、雙面 1，且每頁只有一個標記、連結順序及位置正確、沒有 script 或 inline 事件。
- 回歸驗證：surface control 3 pages、contextual menu 3 pages、profile 首頁 8+2 卡、profile 完整清單 8 篇及整站檢查（376 HTML、50,075 href/src）通過；內容、公開邊界、文章標籤、歌曲語言檢查通過；完整 regression 153/153。
- 瀏覽器實測雙面文章的兩個連結分別到 `/profile/` 與 `/`，瀏覽器上一頁回到同一文章網址；profile-only 與 memory-only 各只顯示其唯一入口。390×844 下標記位於正文前、無水平溢出，鍵盤焦點框清楚；console warning/error 為 0，測試 viewport 已 reset，本機 8793 預覽已停止。
- `git diff --check` 通過（只有工作樹既有 LF/CRLF 提示）。未部署、未使用重置券。下一步 WBS 6.4「直接開啟與返回行為」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 6.2：情境主選單（完成；未部署）

- 在 `source/_data/surface-navigation.yml` 新增 A 面精簡選單：「經驗與方法」回 `/profile/`、「代表路徑」連到 `/profile/#profile-path-observe-context-and-needs`、「全部工作與學習」連 `/profile/articles/`；另保留共用搜尋。翻面仍由 6.1 的獨立切換器負責，不在主選單重複。
- `_partials/header/menu.njk` 以實際 `page.path` 的 `profile/` 網址命名空間決定 A 面選單，不使用 cookie、前端記憶或不穩定的 layout 推測。B 面繼續使用主題原有七個項目：首頁、全部文章、內容分類、生活索引、草稿夾、記憶圖牆、更新日曆。A 面首頁與完整清單分別輸出單一 `aria-current="page"`。
- 隔離建置揭露並修正一個真實快取問題：NexT 原本會全站快取 menu partial，導致首個建置頁的 B 選單被重用到 A 面。現在只對會依 `page.path` 變化的 menu partial 關閉快取，其他頁首 partial 快取不變。前兩次失敗快照保留於 `tmp/wbs62-public-20260926` 與 `tmp/wbs62-final-20260926` 作為診斷證據；最終從不存在的 `tmp/wbs62-verified-20260926` 建置 1006 檔，未 clean 或觸碰 `public/`。
- 新增 `tools/contextual-menu-output-check.js`、對應測試與 `npm run check:contextual-menu`，以實際輸出檢查 B 面 7 項、A 面 3 項、搜尋、順序、網址、目前頁與代表路徑錨點；並以測試固定「依 URL 判斷」及「menu partial 不可全站快取」。
- 實際驗證：最終 contextual-menu checker 通過 3 pages；surface control、profile 首頁 8+2 卡、profile 完整清單 8 篇、內容檢查與公開邊界檢查均通過（435 文字檔，舊文／退役 ID 命中 0）；完整 regression 146/146。
- 瀏覽器實測：手機收合選單在 `/profile/` 和 `/profile/articles/` 均只顯示三個 A 面入口；「代表路徑」實際導向第一條路徑錨點；翻回 `/` 後七個 B 面項目全數存在。1280px 桌面實測兩面選單項目、目前頁與搜尋正確，無水平溢出；console warning/error 為 0。
- `git diff --check` 通過後才交付，只有工作樹既有 LF/CRLF 提示。未部署、未使用重置券。下一步 WBS 6.3「中性文章頁標記」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 6.1：共用雙面控制（完成；未部署）

- 新增 `source/_data/surface-navigation.yml` 作為雙面切換文字與目標網址的共用資料：B 面使用「SIDE A／看工作與學習」前往 `/profile/`，A 面使用「SIDE B／翻到個人記憶庫」回 `/`。兩者都是有可見名稱的普通 `<a>`，沒有 cookie、前端狀態或 JavaScript 路由判斷。
- 新增共用 partial `_partials/dual-surface-control.njk` 與獨立樣式 `_custom/surface-switch.styl`，由 `index.njk`、`profile.njk` 及 `profile-articles.njk` 在主內容前的同一結構位置叫用。移除 `/profile/` 原本底部的重複翻面連結；`/profile/articles/` 原有「經驗與方法」返回連結仍是頁面導覽，與雙面控制分開。本步驟不加翻面動畫，動畫仍屬 9.2。
- 新增 `tools/surface-control-output-check.js`、對應測試與 `npm run check:surface-control`，驗證根首頁、`/profile/`、`/profile/articles/` 各只有一個切換器，目前面向、目標面向、文字、href、語意與主內容前位置正確，並拒絕 inline 事件或 script 依賴。`profile-page` 輸出檢查也已改為驗證共用切換器。
- 安全建置：建置前確認 `tmp/wbs61-build.yml` 與 `tmp/wbs61-public-20260926` 均不存在；核對 Hexo `public_dir` 後產生 1006 個檔案到新目錄，沒有 clean 或觸碰 `public/`。
- 實際驗證：目標測試 17/17；新輸出 checker 通過 3 pages；profile 首頁仍是 8 張路徑卡與 2 張學習卡，profile 完整清單仍是 8 篇；公開邊界檢查通過 435 個文字檔，舊文與退役 ID 命中皆 0；完整 regression 141/141。
- 瀏覽器驗收：從 B 面以 Tab 到達切換連結，焦點框清楚，Enter 到 `/profile/`；A 面以切換連結回 `/`。`/profile/` 重新整理後仍是 A 面，以獨立新分頁直接開啟 B 面目標網址也正確；開發者 console warning/error 均為 0。375px 實測 B 面切換器可見且無水平溢出；A 面窄屏整體已於 5.6 通過，本輪樣式另有 `max-width` 與 42px 觸控高度保護。
- 未部署、未使用重置券。下一步 WBS 6.2「情境主選單」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 5.6：A 面獨立驗收（完成；G5 通過；未部署）

- 桌面瀏覽器實測 `/profile/`：顯示 H1、3 條路徑共 8 張代表卡、2 張最近學習卡、「看全部」及 SIDE B；卡片排列與換行正常。一分鐘掃讀可辨識三條路徑及各自文章。
- 鍵盤實測：Tab 可到第一張文章卡，焦點框清楚；Enter 開啟原文 `/work/from-real-work-to-features/`，返回行為正常。「看全部」開 `/profile/articles/`，桌面清單顯示 8 張卡；SIDE B 回 `/`。
- 375×812 實測兩頁：`innerWidth=375`、`scrollWidth=360`、`noHorizontalOverflow=true`。兩頁均為單欄；首頁顯示 8 張路徑卡及 2 張最近學習卡，完整清單顯示 8 張卡；頂部、底部內容皆可讀。瀏覽器 console warning/error 均為 0。
- 無 JavaScript：本輪瀏覽器環境沒有禁用 JS 的操作能力；以生成 HTML 結構確認主要內容有靜態文章文字／連結且主內容區 0 scripts，記為結構驗證，不宣稱完成 browser-toggle 實測。viewport capability 的 explicit override 已 reset；reset 後 IAB 面板仍顯示 375，屬目前面板預設值。
- 404：不屬本次 G5 核心判定；隔離快照沒有 `404.html`，未測或宣稱無效 URL 的 hosting 404 行為。
- G5 結論：依 WBS G5 條件，`/profile/` 已可獨立作為履歷試讀入口；桌面、375px、鍵盤、兩個直接入口及互相返回均實測通過。這不代表整體雙面網站完成。沒有重建、部署或使用重置券；本輪只補驗收紀錄，`git diff --check` 通過。
- 下一步 WBS 6.1「共用雙面控制」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 5.5：A 面完整清單（完成；未部署）

- 新增固定頁面來源 `source/profile/articles/index.md`（permalink `/profile/articles/`，頁面標題「全部文章」）與 `themes/next/layout/profile-articles.njk`。清單由 `scripts/profile-articles.js` 呼叫 `tools/lib/profile-articles.js`，使用與其他資料面向相同的 `filterPostsBySurface(..., 'profile')` 及 legacy manifest，不另寫 surface 規則；依文章發表日期新到舊，穩定同時點以 URL 排序。只輸出必要標題、年月及每篇既有唯一原文 URL，無 JS 仍能讀取。
- 在 `/profile/` 啟用 `allArticlesLabel`「看全部」連至 `/profile/articles/`。遵作者建議，完整清單頁 H1／HTML title 使用頁面資料中的「全部文章」，不將 CTA 動詞當頁名。清單空集合顯示簡短空狀態，並提供返回 `/profile/` 的普通連結；卡片沿用既有 profile CSS，並補清單標題／連結樣式。
- 更新首頁輸出 checker，要求「看全部」只出現一次且精確連至新頁。新增 `tools/profile-articles-output-check.js`、fixtures 與 `npm run check:profile-articles`，以生成的 navigation-index canonical article records 中 `surfaces` 含 profile 的完整集合比對卡片數、唯一 URL、標題、日期順序、實際路由存在及返回連結；不輸出文章正文。另有 helper 測試涵蓋 profile-only、memory 排除、legacy、缺欄／錯誤日期、日期排序和同日穩定性。
- 建置前確認 `tmp/wbs55-final-20260926` 與新設定檔均不存在；新增 `tmp/wbs55-profile-build.yml` 後，以 `npx hexo config public_dir --config "_config.yml,tmp/wbs55-profile-build.yml"` 核實實際輸出路徑精確指向新目錄，再以同一參數執行 generate。完整生成 1006 檔，未執行 clean、未碰 `public/` 與舊 tmp 快照。
- 實際驗證：profile 頁及完整清單目標 suite 14/14；清單輸出 checker 通過 8 篇 profile cards，所有 8 個文章路由存在；首頁 CTA、日期／標題與回 profile link 通過；`npm run check:profile-home`、`npm run check:content`、新輸出 `check:public-boundary` 通過（435 文字檔、舊文與退役 ID 命中 0、核准替代文各出現 2 處）。完整 regression 137/137；`git diff --check` 通過（只有工作樹既有檔案的 LF/CRLF 提示）。
- 界線：本輪完成頁面與靜態輸出檢查，未做 5.6 桌面／375px 手機／瀏覽器／鍵盤 QA；未部署、未使用重置券。G5 尚待 5.6 獨立驗收。
- 下一步 WBS 5.6「A 面獨立驗收」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 5.4：最近正在學（完成；未部署）

- 新增純資料 helper `tools/lib/profile-learning.js` 與 Hexo helper `scripts/profile-learning.js`。先以共用 `filterPostsBySurface(..., 'profile')` 確認面向資格，再只選 `learning_status === '進行中'`，按文章發表日期 `date` 由新到舊排序、同日以 URL 路徑穩定排序，最多取 3 篇；不以更新日期或分類推測學習狀態。現有合格樣本為兩篇，均已在路徑卡出現；最近學習區視為另一閱讀入口，允許相同原文章 URL 跨區重現，但區內 URL 必須唯一，不複製文章或更改 URL。
- 更新 `themes/next/layout/profile.njk`，將「最近正在學」置於三條路徑之後、翻面連結之前。卡片只輸出原文章標題、既有 URL 與發表年月；不顯示英文狀態、成熟度、策展理由或說明文。空集合只顯示「目前沒有正在學習的內容。」；未提前實作 8.2 成熟度標記。
- 擴充 `tools/profile-page-output-check.js` 與 fixtures，驗證區塊順序、最多 3 張卡、空狀態、日期、區內 URL 唯一，以及允許路徑區與學習區使用同一 canonical URL。新增 `tools/tests/profile-learning.test.js`，覆蓋 profile 面向過濾、進行中狀態、發表日期排序、最多筆數、legacy surface 與錯誤輸入。
- 建置前確認全新輸出目錄 `tmp/wbs54-final-20260926` 不存在；新增額外 config `tmp/wbs54-profile-build.yml`，執行 `npx hexo config public_dir --config "_config.yml,tmp/wbs54-profile-build.yml"`，確認輸出路徑精確指向該新目錄後才以相同參數 generate。Hexo 成功生成 1005 檔；未執行 clean，未觸碰 `public/` 或先前 wbs52/wbs53 快照。
- 實際驗證：目標 tests 11/11；`npm run check:profile-home`、`npm run check:content` 通過；完整 regression 130/130；現有 public 的 boundary 檢查及新 wbs54 輸出的 `check:profile-page`、`check:public-boundary` 均通過。生成頁實際輸出 8 路徑卡、2 學習卡；兩篇學習卡按 2026-09-08、2026-09-04 排序，未輸出狀態字樣。`git diff --check` 通過，只有工作樹既有檔案的 LF/CRLF 提示。
- 未完成／界線：本輪為靜態輸出與測試驗收，未做瀏覽器互動／窄螢幕視覺驗收（WBS 5.6）；未部署、未使用重置券。
- 下一步 WBS 5.5「A 面完整清單」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 5.3：代表路徑與文章卡片（完成；未部署）

- 更新 `themes/next/layout/profile.njk`，將文章標題與文章發表年月放入整張可鍵盤聚焦的原文章連結；每條路徑依資料原順序呈現 3／2／3 張卡片，仍共用同一文章 URL，未複製內容。沒有顯示 `selectionReason`、`readerValue`、`workingDescription`、內部狀態或成果宣稱；依極簡 A 面核准原則，本工作包不輸出 WBS 範例中的選擇理由摘要。
- 新增 `themes/next/source/css/_custom/profile.styl`，並於 `themes/next/source/css/main.styl` 明確匯入；所有規則限於 `.profile-page`。沿用網站紙色／墨色與橘色系，加入路徑標題層級、兩欄卡片、鍵盤焦點指示、600px 以下單欄版及 `prefers-reduced-motion` 規則。依主代理回饋，profile 樣式與首頁專用 `_custom/home.styl` 分離。
- 新增唯讀輸出檢查器 `tools/profile-page-output-check.js`、fixtures `tools/tests/profile-page-output-check.test.js`，並新增 `npm run check:profile-page`。檢查器必須明確指定生成目錄，逐路徑核對 2–4 張卡、標題、日期、唯一 permalink、首頁翻面連結，以及內部策展文字／狀態零外洩；另覆蓋錯誤與重複連結、卡片／日期缺漏、不可用的「看全部」連結。
- 隔離建置：建置前確認 `tmp/wbs53-final-20260926` 不存在；`npx hexo config public_dir --config "_config.yml,tmp/wbs53-final-build.yml"` 輸出該新路徑後，以相同參數執行 Hexo generate，完整生成 1005 個檔案。未執行 clean，未觸碰 `public/` 或既有 tmp 快照。CSS 載入結果確認含 profile 卡片、焦點、窄螢幕及減少動態規則。
- 實際驗證：輸出檢查器通過（8 cards、8 unique URLs）；檢查器 fixtures 4/4；`npm run check:profile-home`、`npm run check:content` 通過；`npm run check:public-boundary -- --root tmp/wbs53-final-20260926` 通過（434 文字檔、舊文／退役 ID 命中 0、兩段公開替代文各 2 路徑）；完整 `npm run test:regression` 123/123；`git diff --check` 通過，僅既有 LF/CRLF 提示。未部署、未使用重置券。
- 未完成／界線：本輪未做實際瀏覽器鍵盤／375px 視覺驗收，依 WBS 5.6 獨立驗收；未建立 5.4 最近學習區或 5.5 完整清單，故「看全部」仍不顯示。
- 下一步 WBS 5.4「最近正在學」；本輪不開始。

## 2026-09-26，雙面部落格 WBS 5.2：A 面靜態頁面骨架（完成；未部署）

- 新增 `source/profile/index.md` 與 `themes/next/layout/profile.njk`，建立 `/profile/` 靜態頁面並沿用 NexT 共用頁首、頁尾與側欄骨架。頁面以語意化標題、路徑 section、文章清單及一般 `<a>` 連結輸出；主要內容不依賴 JavaScript。
- 只呈現核准的「經驗與方法」、三個路徑標題、八篇文章卡片標題／既有 URL，以及 `SIDE B／翻到個人記憶庫` 回首頁連結。沒有輸出 `workingDescription`、`selectionReason`、`readerValue`、intro 或 tagline。因 WBS 5.5 完整清單入口尚未建立，暫不呈現「看全部」，避免死連結；「最近正在學」留待 5.4。
- 安全建置：新增 `tmp/wbs52-profile-build.yml` 作為額外 Hexo 設定；執行 `npx hexo config public_dir --config "_config.yml,tmp/wbs52-profile-build.yml"` 確認實際輸出為全新 `tmp/wbs52-public-20260926`，再以相同 `--config` 參數生成。該目錄建置前不存在；未執行 clean，未觸碰既有 `public/` 及其他 tmp 快照。Hexo 完整生成 1005 個檔案，含 `profile/index.html`。
- 輸出檢查以 YAML 核准資料對照 HTML：3 個路徑標題順序一致、8 個文章連結唯一且 URL 齊全、翻面連結只有一個並回 `/`；保留入口被省略；敏感欄位名稱／內部策展文案無命中。此為靜態輸出核對，非瀏覽器／手機版面驗收；後者依 WBS 5.6。
- 實際驗證：`npm run check:profile-home`、`npm run check:content` 通過；完整 `npm run test:regression` 119/119；`git diff --check` 通過，只有既有 LF/CRLF 提示。未部署、未使用重置券。
- 下一步 WBS 5.3「代表路徑元件」；本輪不加入選擇理由摘要或額外卡片文案。

## 2026-09-26，雙面部落格 WBS 5.1：A 面極簡內容骨架（完成；未建置／未部署）

- 作者確認 A 面不加公開定位段落或補充說明，靠分類標題與文章卡片呈現。本輪將 `source/_data/profile-home.yml` 設為 `approved/5.1`，新增最小 presentation 標籤（「經驗與方法」、「最近正在學」、「看全部」、「SIDE B／翻到個人記憶庫」），沒有加入 intro/tagline。
- 三條路徑依作者確認改為「看見現場與需求／整理資訊與方法／實作、驗證與修正」，8 篇文章按核准映射重排，各 URL、卡片角色、成熟度狀態與文章內容均保留。`workingDescription` 加上 `workingDescriptionVisibility: internal`，明確禁止作為 5.2 公開文字。
- `tools/profile-home-check.js` 在 approved 狀態驗證精確 presentation 欄位和值、禁止額外展示欄位及頂層 intro/tagline，並驗證三個路徑標題順序與內部備註標記；新增對應測試。
- 更新 `docs/dual-surface-blog-plan.md` 的概念示例與 5.1 說明，明確頁面不顯示定位段落、tagline、intro 或路徑補充說明；沒有回寫舊歷史紀錄。
- 實際驗證：`node --check tools/profile-home-check.js` 通過；目標 suite 9/9；`npm run check:profile-home` 通過（3 paths、8 unique URLs、4 featured）；`npm run check:content` 通過；完整 `npm run test:regression` 119/119；`git diff --check` 通過，僅回報既有 LF/CRLF 換行提示。未建置、未寫入 public/tmp、未部署、未使用重置券。
- 下一步 WBS 5.2「A 面靜態版型」；本輪不開始版型或 UI。

> 2026-09-25 更新：不再主動檢查或記錄額度，也不再使用 10%／15% 停止線。下方既有額度內容只保留為歷史紀錄，不是目前執行規則。任何額度重置券都不得使用，除非使用者針對該次重置另行明確授權；過往授權不得沿用。

> 歷史站務改版（首頁、排版、行事曆、歌曲與內容品質）另整理於 [站務改版回溯紀錄](site-change-log.md)；本文件仍只記錄個人網誌動線計畫與其驗證，避免把 Git 歷史誤當成導覽項目已完成。

## 2026-09-26，雙面部落格 WBS 4.5：共用資料一致性測試（完成；G4 資料層通過；未建置／未部署）

- 進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`。工作樹另有此前工作包與作者未提交修改；本包只新增 `tools/tests/surface-data-consistency.test.js` 並更新此進度紀錄，沒有改產生器、helper、front matter、source、UI 或 package scripts。
- 新增執行式 cross-consistency tests：直接呼叫 navigation `buildIndex`、註冊後的 random generator、content-browser helper、recent helper；不是以 grep 代替資料運算。同一 fixture 覆蓋 profile-only、legacy memory、雙面、站務分類、`type: random`、無效／新缺欄與 linked learning legacy 繼承。索引中 linked learning 附註繼承目標 `[profile]`，文章 URL 仍只有一筆；random 與其他公開清單的差集精確為站務與既有 `type: random` 排除，不誤判成 surface 不一致。四個 consumer 對錯誤欄位都以同一 source 和 surface code 失敗。
- 真實來源交叉驗證 271 篇 published posts；以現存 `public/navigation-index.json` 僅取得既有 title→URL 路由對照，再由本測試重新執行 live `buildIndex` 與三個 helper/generator，不把舊 snapshot 當本次建置。索引輸出 271 筆唯一文章 URL；導航 surfaces 與 source 共用 normalizer 結果逐 URL 相同；內容清單為 all 271、profile 8、memory 264，7 篇 profile-only、1 篇雙面，各來源唯一。profile-home 核准 8 URL 與導航／profile 清單及 random eligibility 逐 URL 對照。Recent 每次回傳數受全域／分類配額限制，測試逐筆確認 URL 存在且符合所選 surface，不硬要求輸出等於 8／264 全集。
- Random 集合差以同一 271 篇 live source、現有資格規則重算：舊 eligibility 基準（排除 `type: random`、站務分類）269 筆；套 memory 後預期 262，實際 generator 262 且 URL 集合完全相等。另核對 legacy B 歌曲樣本缺欄位只因 manifest 相容為 memory，導航、memory 清單與 random 均保留。未把 random 規則錯當成「全部 memory 清單」規則。
- 實際驗證：cross-consistency／navigation-index／random／content-browser／recent 目標 suite 25/25；`npm run check:content`、`npm run check:profile-home`、`npm run check:public-boundary` 通過；完整 `npm run test:regression` 118/118；`node --check tools/tests/surface-data-consistency.test.js` 與 `git diff --check` 通過（僅既有換行提示）。沒有 build、沒有寫 `public/`／`tmp/`、沒有部署、沒有使用重置券。
- G4 結論：資料層的共用面向解讀、random 額外資格規則、內容清單範圍與 recent 限額一致性均通過固定 fixture 與真實來源交叉測試；G4 資料層通過。這不代表 A 面畫面、文案或 `/profile/` 路由已完成；WBS 5.1 尚未開始，視覺／文案仍按其作者確認點處理。
- 未完成／未知：沒有新 public build；既有 route snapshot 僅供 URL 對照，不視為本輪輸出。未部署。
- 下一步 WBS 5.1「A 面內容骨架」；本輪不開始 5.1。

## 2026-09-26，雙面部落格 WBS 4.4：最近文章支援範圍（完成；未建置／未部署）

- 進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`。保護進場已有的 AGENTS、規劃文件、套件設定、8 篇文章 front matter、microblog、surface/index/random 檔案與先前新增資料；本包只修改 `scripts/search-recent-posts.js`、`tools/tests/search-recent.test.js` 及本進度紀錄。
- `search_recent_posts(range = 'all')` 共用 WBS 4.3 的 `filterPostsBySurface` 與同一份 `legacy-surfaces.v1.json`，可由呼叫端要求 `all`、`profile`、`memory`。先對已按日期降冪的文章集合依 surface 篩選，再計算全域 rank 與既有各分類最新 10 篇聯集／配額，因此雙面文章在任一範圍只有一筆；未指定參數仍保留 all 行為。新文缺欄、無效值或無效範圍會定位來源／contract code 報錯；警告交 Hexo logger。未改搜尋版型、分類按鈕或前端程式。
- 消費者盤點：`themes/next/layout/_partials/search/index.njk` 仍以 `search_recent_posts()` 無參數呼叫，因此退回區預設為全部；`themes/next/source/js/third-party/search/local-search.js` 仍從初始 markup 保存並在空條件恢復最近清單。測試確認兩處既有流程未退化。面向範圍可供未來頁面明確呼叫，本包不新增 UI 控制。
- 測試覆蓋既有 all 排序、全域前 10／分類配額及去重；profile／memory 各自先過濾後排名、雙面各出現一次、manifest legacy、missing-new／invalid 來源錯誤、非法範圍、空集合與搜尋空條件退回。第一輪 fixture 的預期項數把全域前 10 與分類配額誤當成相加，測試實際指出既有規則下兩者是聯集且去重；修正 fixture 預期為 12 後通過，未更動配額實作。
- WBS 4.3 來源集合驗證已機械確認全部 271、profile 8、memory 264、profile-only 7、雙面 1，涵蓋本 helper 共用的相同資格來源；本包的有限 recent 回傳按 10 篇全域與每分類最多 10 篇規則，不以 8／264 作輸出數硬斷言。未建置，既有 public snapshot 未更新，不能代表本次程式已生成；未寫 `public/`／`tmp/`。
- 實際驗證：`node --check scripts/search-recent-posts.js` 通過；search recent 目標測試 4/4、content-browser 目標測試 6/6；`npm run check:content`、`npm run check:profile-home`、`npm run check:public-boundary` 通過；完整 `npm run test:regression` 115/115；`git diff --check` 通過（僅既有換行提示）。未部署、未使用重置券。
- 未完成／未知：無新 build 輸出；既有呼叫目前固定使用 all，未來頁面選擇 profile 或 memory 尚未到 UI 工作包。本包不宣稱新的搜尋 HTML 已產生。
- 下一步 WBS 4.5「共用資料一致性測試」；本輪不開始 4.5。

## 2026-09-26，雙面部落格 WBS 4.3：內容清單支援範圍（完成；未建置／未部署）

- 進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`。工作樹已含此前 WBS 與使用者未提交修改；保留全部既有差異，只修改本工作包的 `scripts/content-browser.js`，新增 `tools/lib/content-browser.js`、`tools/tests/content-browser.test.js`，以及本進度紀錄。
- 抽出純 helper `filterPostsBySurface(posts, range, options)`，支援 `all`（預設）、`profile`、`memory`，只允許穩定 manifest 內的舊 source 缺欄位相容成 memory；新來源缺欄、非法範圍或非法 surfaces 會帶 source／contract code 失敗，重複值交由共用 normalizer 正規化並回報 warning。延續原 helper 的 `published !== false && draft !== true` 排除規則與 Hexo 日期排序；分類、標籤、日期、URL 產出欄位不變。未改內容分類資料、JSON schema、頁面或 UI。
- 真實來源機械集合驗證：271 筆公開文章、8 筆 profile、264 筆 memory；profile-only 7、雙面 1，source 身分均唯一。保留的 4.1 `public/navigation-index.json` 路由快照（本工作包未重建，且該快照是先前 WBS 4.1 意外生成的 side-effect snapshot）有 271 筆文章與 271 個唯一 URL，面向分布同為 8 profile／264 memory／7 profile-only／1 dual，只作既有路由參照，不宣稱是本次建置。helper 的 Hexo 包裝測試確認預設 `all`、`profile`／`memory` 分流，且輸出仍保留原有 `title/url/date/categories/tags` 形狀；實際 URL 仍由既有 `url_for(post.path)` 提供。
- 正式測試新增 6 組，覆蓋三種範圍、雙面各出現一次、legacy manifest、new missing／invalid 失敗定位、重複 warning、空集合、draft／unpublished 排除及既有分類／標籤資料形狀。第一次執行曾發現 VM 測試的跨 realm Set 型別檢查問題及「只有部分文章有明確 permalink」造成的測試 URL 假設；已改為檢查 manifest-like `.has()` 介面、以穩定 source 身分計算 source 集合，並另核對既有 4.1 路由快照，未改文章 URL 或 manifest。
- 實際驗證：`node --check tools/lib/content-browser.js`、`node --check scripts/content-browser.js` 通過；`node --test tools/tests/content-browser.test.js` 6/6；`npm run check:content`、`npm run check:profile-home`、`npm run check:public-boundary` 通過；`npm run test:regression` 112/112；`git diff --check` 通過（僅工作樹既有換行提示）。未建置，未寫入 `public/` 或 `tmp/`，未部署、未使用重置券。
- 未完成／未知：本包依指示不執行 Hexo build，故 helper 本輪尚未產生新的實體內容清單；既有全部文章路由未改，route mapping 由原有 `url_for` 保持。`public/` snapshot 不代表本次 helper 產出。
- 下一步 WBS 4.4「最近文章支援範圍」；本輪不開始 4.4。

## 2026-09-26，雙面部落格 WBS 4.2：隨機資料依 memory 過濾（程式／測試完成；未重建／未部署）

- 更新 `scripts/random-generator.js`：既有資格先照原規則執行（必須有文章 path，排除 `type: random` 與「站務」分類），再以共用 `normalizeSurfaces` 與 `tools/data/legacy-surfaces.v1.json` 篩含 `memory` 的項目。舊文僅以穩定 `source` 命中 manifest 時相容預設 memory；新文缺欄或明確無效值以 source path／contract code 失敗。雙面正規化為 `[profile, memory]`，保留一次。`random.json` record schema 不加 surface 欄位，首頁／隨機頁 UI、返回狀態與既有視覺資料不變。
- 進場唯讀固定基準：`tmp/wbs33-public-20260926/random.json` 有 269 筆、269 個唯一 URL，且與當時 `public/random.json` 完全一致。逐一和 WBS 4.1 已產生的文章 surfaces 對照，8 篇候選全在原抽籤集合，其中 7 篇為 profile-only、1 篇 `/work/flow-friendly-work-system/` 為雙面。以新 generator callback 依同一基準資料執行記憶體整合比對，輸出為 262 筆唯一 URL；集合差恰為那 7 個 profile-only URL，雙面文章保留，原 memory eligible 集合完整保留，沒有其他資格變化。此計數由實際集合計算，非程式硬編文章數。
- 正式測試更新 `tools/tests/home-random.test.js`，覆蓋 memory、profile-only、both、manifest legacy、missing-new、invalid surfaces、既有 `type=random`／站務／無 path 排除、雙面單筆、無 eligible 空集合，以及 `random.json` 不擴 schema。`themes/next` 消費端未修改。
- 未重新建置：前一工作包記錄的 Hexo runtime config 偏差尚無 WBS 3.3 安全 CLI 命令可直接重用，依保護規則不再嘗試建置或觸碰 `public/`。因此目前既有 `public/random.json` 仍是 4.1 時生成的舊 eligibility snapshot（269 筆），不是本次新程式輸出；本包以正式測試與舊基準集合整合比對驗證程式，不宣稱已更新產物。未執行 clean。
- 實際驗證：`node --check scripts/random-generator.js`、home-random 測試通過；`npm run check:content`、`npm run check:profile-home` 通過；navigation-index tests 11/11、surface tests 9/9、完整 `npm run test:regression` 106/106；`npm run check:public-boundary` 通過（目前舊 public snapshot 433 個文字檔，舊文／retired ID 命中 0）；`git diff --check` 通過，僅既有換行提示。未部署、未使用重置券。
- 下一步 WBS 4.3「內容清單支援範圍」；本輪不開始 4.3。

## 2026-09-26，雙面部落格 WBS 4.1：統一索引加入 surface（程式／測試完成；建置路徑有偏差；未部署）

- 更新 `tools/lib/navigation-index.js`，所有索引 record 現在都有共用 `content-surfaces` helper 正規化出的 `surfaces`：文章明確欄位依 profile／memory／雙面輸出；舊文章只在穩定 source path 命中版本化 legacy manifest 時相容預設 memory；microblog 以持久 ID 查 manifest；linked reading-desk item 缺欄位時只對 manifest 舊 ID 繼承目標文章 surfaces，並以共用 subset helper 限制不可擴權；standalone 舊 learning item 缺欄位為 memory。新項目缺欄位、無效欄位或 linked 子集合違規會以 source／ID／contract code 失敗。功能 pages 不在輸入集合內。保留索引 `schemaVersion: 1`、文章＋learning 去重、ID、日期語意、事件、順序與文章錨點；linked item 的面向另外保存在 `learningItems[].surfaces`，不改目標文章面向。
- `scripts/navigation-index.js` 已直接呼叫上述共用 library；不另複製 surface 規則。前端現有 parser 只要求 schemaVersion 1 與 records 陣列，能相容新增 record 欄位，因此沒有提升 schemaVersion 或修改搜尋／UI。
- 正式測試更新 `tools/tests/navigation-index.test.js`，覆蓋 profile／memory legacy／雙面 canonical 順序、linked 繼承與 subset、standalone legacy memory、去重、錯誤定位與 invalid surfaces；另以真實 source 的核准 8 篇、21 microblog、reading-desk linked sample 驗證 8 篇 7 profile-only＋1 雙面、微文 memory、linked `reading-topic-17` 面向、record 唯一性及所有索引記錄帶 surfaces。
- **建置偏差及保護處置：** 本輪曾嘗試用 Hexo API 在初始化後只改 `hexo.config.public_dir`，但 Hexo 實際仍寫入既有 ignored `public/`；`tmp/wbs41-public-20260926/` 未建立。Hexo 回報並唯讀 mtime 核對顯示 `public/` 內 1004 個檔案均在本輪生成時間窗更新：HTML 376、WebP 351、PNG 171、JPG 48、JS 41、JSON 8、XML 3、CSS 2、SVG 3、GIF 1。沒有執行 clean，依保護指示不回復／刪除任何 public 檔案；該樹是本輪意外重生的 ignored snapshot，不宣稱為獨立 tmp build 證據。由於未取得 WBS 3.3 的確切安全命令，本輪不再重試建置，改以 source-backed generator integration test 驗證，並將偏差如實留檔。
- 對意外生成之 `public/navigation-index.json` 僅作唯讀核對：schemaVersion 1、292 records（271 articles、21 microblogs）、271 個唯一文章 URL、零筆缺 surfaces；surface 分布為 7 profile-only、284 memory-only、1 dual；24 個 linked learning item 均為目標子集合。四篇核准代表 URL 含 profile，`/work/flow-friendly-work-system/` 為 `[profile,memory]`。與既有 `tmp/wbs33-public-20260926/navigation-index.json` 比較，移除新增 surfaces 後每筆 record、欄位、順序、日期事件與 passage anchors 完全相同。此比較是 side-effect snapshot 差異核對，不是預定 tmp build。
- 實際驗證：`node --check tools/lib/navigation-index.js` 與 `scripts/navigation-index.js` 通過；navigation-index 目標測試 11/11；`npm run check:content`、`npm run check:profile-home` 通過；完整 `npm run test:regression` 通過 106/106；`npm run check:public-boundary` 在目前 `public/` 通過（433 文字檔，舊文／retired ID 命中皆 0）；`git diff --check` 通過，僅有既有 LF/CRLF 提示。未部署、未使用重置券。
- 下一步：WBS 4.2「隨機資料過濾」；本輪不開始 4.2。後續如需 Hexo 全站建置，先用額外 config 檔與已驗證的 Hexo CLI `--config` 參數核對實際 `public_dir`，不可只在初始化後變更 config 欄位。

## 2026-09-26，雙面部落格 WBS 3.5：策展資料驗證器（完成；G3 通過；未建置／未部署）

- 新增唯讀檢查器 `tools/profile-home-check.js`、Node 測試 `tools/tests/profile-home-check.test.js`，及 `npm run check:profile-home`；`npm run verify` 現在會先執行此檢查，再進入其他既有驗證。沒有改策展 YAML、文章、surface、頁面或 UI。
- schema v1 驗證 3 條唯一格式正確 path、每條非空且描述完整、6–10 個唯一 URL、每筆 `featured`／`supporting` 角色與已宣告 status、非空理由和值、恰 4 筆 featured。每個 URL 必須依既有 permalink 正規化規則唯一對應 `_posts` 中已發布文章，並以共用 surface helper 驗證含 `profile`；不接受 draft、page、microblog、不存在或歧義目標。檢查錯誤只列 code/path/url，不輸出正文。
- 實際驗證：`node --check tools/profile-home-check.js` 通過；目標測試 8/8；`npm run check:profile-home` 通過（3 paths、8 unique URLs、4 featured）；`npm run check:content` 通過（5 分類、21 則 microblog、225 圖牆路徑）；surface tests 9/9；完整 `npm run test:regression` 101/101；`npm run check:public-boundary` 通過（public 433 文字檔，舊文與 retired ID 命中均為 0）；`git diff --check` 通過。未建置（本包是資料驗證器，3.5 無需重建）、未部署、未使用重置券。
- G3 通過範圍：作者已核准 A 面資格與首頁候選，策展資料可由程式穩定驗證；這不代表 A 面畫面或 `/profile/` 路由已建置，文案仍待 5.1。下一步 WBS 4.1「統一索引加入 surface」。

## 2026-09-26，雙面部落格 WBS 3.4：三條 A 面路徑策展資料（完成；未建置／未部署）

- 新增 `source/_data/profile-home.yml`，以 `schemaVersion: 1`、`copyStatus: working/5.1-pending`、穩定 path `id`、`title`、`workingDescription` 及 `items` 建立三條作者核准路徑。每個 item 含唯一 URL、`featured`／`supporting` 角色、明確成熟度 `status`、短 `selectionReason` 與 `readerValue`。
- 八篇核准文章各列一次：四篇 `featured` 沿用作者核准首頁候選；四篇 `supporting` 包含一篇未驗證構想、一篇待驗證工作方式、兩篇進行中學習。learning 狀態與文章 front matter 相符，沒有加入成果數字或完成宣稱。最終定位句、視覺與對外文案留待 WBS 5.1；沒有建立 `/profile/` 頁、產生器、版型或 CSS。
- 實際驗證：YAML parse 成功；三個穩定 path ID 唯一、八個 URL 唯一且來源與 fresh 路由存在、每篇均含 `profile`、featured 集合精確為核准四篇、status 值與兩篇 learning 狀態相符；文件相對連結核對通過。`npm run check:content` 通過；`node --test tools/tests/content-surfaces.test.js` 通過 9/9；`git diff --check` 通過，僅有既有換行提示。沒有 consumer，未建置。
- 本輪只新增策展 YAML，並更新候選文件與此進度；未修改文章、front matter、microblog、reading-desk、程式、測試或 UI。未部署、未使用額度重置券。
- 下一步：WBS 3.5「策展資料驗證器」；只為 schema、唯一 path ID／URL、已發布且含 `profile` 的目標、三條非空路徑與 6–10 篇上限新增 validator/tests。不得在該包擴大到 UI 或定稿 5.1 文案。

## 2026-09-26，雙面部落格 WBS 3.3：套用首批 front matter（完成；未部署）

- 進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`。進場唯讀檢查確認本次 8 篇目標文章均無工作樹差異，且與 HEAD 一致；其他工作樹未提交修改照常保護。
- 僅新增 `surfaces` 至八篇核准文章 front matter：`source/_posts/實驗室/工作知識-從實際抽象功能一-先從真實工作問出系統該做什麼.md`、`source/_posts/實驗室/工作知識-從實際抽象功能四-隱性規則與風險式補審.md`、`source/_posts/實驗室/工作知識-API需求排查紀錄.md`、`source/_posts/實驗室/工作知識-把官網改版包裝成遊戲.md`、`source/_posts/實驗室/工作知識-簡報不是功能清單.md`、`source/_posts/實驗室/工作知識-讓工具服務心流.md`、`source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md`、`source/_posts/實驗室/AI提問判斷順序-情境目標與問題類型.md`。七篇為 `[profile]`；`讓工具服務心流` 為 `[profile, memory]`。正文、既有 front matter 欄位、日期與 URL 保持不變；未改 `source/reading-desk.yml`、首頁策展資料或程式。
- 對八檔以 Node 機械比對：移除唯一新增的 `surfaces` 行後，bytes 與 HEAD 完全一致；每檔其餘 front matter hash、正文 hash 均相同，surface 值精確且唯一。八個 URL 不重複，均在 fresh build 路由存在；兩篇學習筆記原有 `learning_status: 進行中` 保留。詳細結果見 [候選核准與套用記錄](dual-surface-profile-candidates.md#wbs-33-套用結果)。
- 驗證：`node --test tools/tests/content-surfaces.test.js` 通過 9/9；`npm run check:content` 通過（5 類別、21 則 microblog、225 圖牆路徑）；`npm run test:regression` 通過 93/93；`node tools/assign-microblog-ids.js` 預覽為 0 IDs；目前 `public/` 與 `tmp/wbs33-public-20260926/` 的 `check:public-boundary` 均通過（各 433 個文字檔、舊文與退役 ID 0 命中、兩段 D replacement 各 2 路徑）。Hexo 透過 API 在生成前確認 `public_dir` 指向新暫存目錄後，完整生成 1004 個檔案；未執行 `clean`，未覆蓋既有 `public/`。`git diff --check` 通過，僅有既有 LF/CRLF 提示。
- [候選文件](dual-surface-profile-candidates.md)已更新為 3.3 套用完成狀態。未部署、未使用額度重置券。
- 下一步 WBS 3.4「三條 A 面路徑」：只準備 `source/_data/profile-home.yml` 代表作策展資料；依 3.2 確認的四篇首頁候選，需完成各路徑 6–10 篇總集合、說明與排序決策。不得推定本輪的四篇候選就是最終首頁清單。

## 2026-09-26，雙面部落格 WBS 3.2：作者歸類核准記錄（完成；未套用 front matter）

- 作者明確核准：「採用 3.1 建議，繼續施工。」已在 [A 面候選盤點](dual-surface-profile-candidates.md#wbs-32-作者核准紀錄) 逐項記錄八個穩定來源、permalink 與決策：七篇 `profile`、`/work/flow-friendly-work-system/` 為 `[profile, memory]`。八篇皆進 A 面資格池；首頁候選四篇沿用 3.1；QA 路徑與 AI 提問只進完整清單並標示「進行中」。
- 三條工作標籤採用 3.1 名稱與映射。系列 02、05 是備選；系列 03、06、07 及其他候選暫不進首批。`profile` 單面只是不進 B 面列表／隨機，文章仍公開可直連；A/B 不是隱私邊界。沒有使用 `both` 作為欄位值，雙面以契約陣列 `[profile, memory]` 表示。
- 本輪只更新候選決策文件及此進度檔；沒有修改文章、front matter、`source/reading-desk.yml`、程式、測試或首頁資料，未建置、未部署、未使用額度重置券。
- 實際驗證：8 個來源與 permalink 唯一性、surface 值及首頁候選子集、學習狀態標記、相對連結已核對；`git diff --check` 通過（含既有換行提示），`git status` 顯示來源／程式差異均為工作樹先前既有修改。本輪純文件變更。
- 下一步：WBS 3.3「套用首批 front matter」；精確限於候選文件列出的 8 個文章 Markdown 檔，只新增 `surfaces` front matter。不得改正文、日期、permalink、reading-desk linked item 或 `profile-home.yml`；後者留待 3.4。未授權部署。

## 2026-09-26，雙面部落格 WBS 3.1：A 面候選盤點（完成；3.2 HOLD）

- 新增 [A 面候選盤點](dual-surface-profile-candidates.md)，實際閱讀候選正文與 metadata，不以檔名／分類推定資格。提出三條工作標籤與 8 篇推薦審核池，落在 3.4 核心策展 6–10 篇範圍；首頁候選先限四篇，另列系列七篇逐篇重疊評估、備選及不推薦首屏的邊界樣本。
- 核對 8 篇來源路徑及 front matter 標題、日期、permalink；八個 URL 不重複，均可在 `tmp/wbs24-public-20260926/<permalink>/index.html` 找到。核對四組 linked reading item 與文章 URL；reading-desk 日期為收錄日期。候選沒有 V microblog 引用。
- 建議分類僅供作者於 3.2 決策，沒有修改 front matter、文章、source、首頁策展資料、程式、package 或測試；沒有把「公開」推論為 A 面資格。文章仍各自單一來源與單一 URL。
- 實際驗證：來源及 fresh 路由存在性檢查通過；文件內相對連結核對、候選 URL 唯一性及 linked 配對核對完成；`git diff --check` 通過（如有既有換行提示另列）；`git status` 核對只新增本候選文件並更新本進度文件，其他改動皆為先前工作樹既有狀態。未重建、未部署、未使用額度重置券。
- 限制：履歷讀者價值、去識別脈絡是否足夠舒適、三條工作路徑命名及 A 面代表作均需作者判斷；兩篇學習筆記仍在進行中，不能當作已完成 QA／AI 實作資歷。
- 下一步：**HOLD：WBS 3.2 等待作者批次確認推薦 8 篇、路徑名稱／映射及學習筆記是否只入完整清單；收到確認後再開始 3.2，本輪不改 front matter。**

## 2026-09-26，雙面部落格 WBS 2.5：公開輸出洩漏檢查（完成；G2 限定於目前輸出樹通過）

- 新增唯讀 checker [tools/public-boundary-check.js](../tools/public-boundary-check.js)、六項 fixture 測試 [tools/tests/public-boundary-check.test.js](../tools/tests/public-boundary-check.test.js) 與 `npm run check:public-boundary`。Checker 從版本化 D/D/V migration plan 與基準 Git commit 記憶體載入舊內容；僅掃描文字型輸出，跳過 `.git` 物件與符號連結。它驗證來源 21 筆、D 替代精確一致、V ID 不在來源、公開樹無三筆舊文／V ID，且兩段 D 新文各至少出現於輸出；錯誤只回報 code/path/count，不印文案或雜湊。
- 三個可公開／可部署工作樹均通過同一檢查：`tmp/wbs24-public-20260926/`、目前 `_config.yml` 的 `public/`、`.deploy_git/` working tree（掃描排除 `.git`）。各樹均掃描 433 個文字檔，舊文 hits/path count = 0/0，V ID hits/path count = 0/0，兩段 D 替代文各命中 2 個輸出檔。Checker 預設讀 `_config.yml` 的 `public_dir`，也支援明確 `--root`；本輪沒有重新建置，也未改動上述輸出樹。
- 本機歷史證據另行分類：`tmp/navigation/microblog-before-ids-1789386752959.json` 與 `tmp/navigation/step3-index-before-rebuild.json` 仍含舊內容，但它們是既有本機歷史測試證據，不是 `public/` 或 `.deploy_git/` working-tree 公開輸出；依作者自行管理決策不刪不改。把 `tmp/` 整體打包或同步仍會暴露這些內容。主 repo Git 歷史、`.deploy_git/.git` 歷史、remote visibility／遠端快取均未清理或核實；本檢查跳過 Git objects，不能據此宣稱歷史、遠端或網際網路內容已清除。
- 實際驗證：checker 與測試 `node --check` 通過；目標測試 6/6 通過，覆蓋乾淨輸出、舊 D 文、V 文、V ID、缺 D 替代文及診斷不洩漏 fixture 文字／指紋；`npm run check:public-boundary`（預設 public）及兩個明確 root 掃描全數通過；`npm run check:content` 通過（5 分類、21 則 microblog、225 圖牆路徑）；`npm run test:regression` 通過 93/93；`git diff --check` 通過，僅既有 LF/CRLF 提示。未部署、未 commit/push、未改 Git history、未刪 tmp、未使用重置券。
- G2 結論：**目前三個工作樹的公開輸出驗收通過**；整體歷史／遠端清除狀態未知，不納入本包宣稱。WBS 2.5 完成，下一步為 WBS 3.1；本輪不開始 G3／3.1。

## 2026-09-26，雙面部落格 WBS 2.4：核准 microblog 邊界遷移（完成，未部署／未改歷史）

- 作者否決並撤回 WBS 2.3 外部私人保存方案；沒有建立 `C:\Blog\blog-1988-private`，沒有私人副本、manifest 或備份。已將 [2.3 私人保存文件](dual-surface-private-storage.md) 頂端標為撤回／不採用，避免後續誤照舊方案施工。作者接受自行管理原件；回復依進場 HEAD／Git 歷史與施工前差異。
- 依核准決策修改 `source/microblog.json`：來源由 22 筆變為 21 筆；M-14 `micro-e410b2604c189eb4` 與 M-18 `micro-7a5980df9ed2f10a` 保留原 ID、date、tag、欄位與位置，只將 content 換成作者核准公開文字；M-17 `micro-b66fecaa3574c31a` 從公開來源移除，無 tombstone，該 ID 永不重用。其餘 19 筆 P 與進場基準的 ID、date、tag、content 及相對順序相同。
- 刪除本輪尚未執行且已不符合決策的 `tools/export-private-microblog.js` 與其測試；將私人匯出計畫改為無原文／無舊 hash 的 `tools/data/microblog-boundary-migration.v1.json`，記錄兩筆 D、V ID、精確公開 replacement、進場基準 commit 與不得重用 ID 的規則。從 `tools/data/legacy-surfaces.v1.json` 移除已不在公開來源的 V ID，不放寬其他缺欄位檢查。新增唯讀基準測試 `tools/tests/microblog-boundary-migration.test.js`，執行時從基準 commit 記憶體讀舊資料，只比較、不輸出舊內容。
- 進場 HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；進場已有的其他規劃／程式差異均保留。Git remote 為 `https://github.com/progress01/progress01.github.io.git`，但 remote repository visibility 未證實。舊 commit、remote clone、cache 或備份可能仍保留原文；本包不改寫 Git history、不清除 remote/cache、不部署，也不使用額度重置券。
- 實際驗證：來源及決策 JSON parse 通過；`node tools/assign-microblog-ids.js` 預覽為 `Would assign 0 IDs`，未執行 `--write`；`npm run check:content` 通過（5 分類、21 則 microblog、225 圖牆路徑）；目標基準測試通過 1/1，完整 `npm run test:regression` 通過 87/87；`npm run check:tags` 通過（271 篇），`npm run check:song-tags` 通過（121 篇）；獨立臨時輸出目錄 Hexo generate 通過（1004 檔）。在臨時輸出 433 個文字檔中，三筆核准 D/V 原文命中 0 檔、V ID 命中 0 檔，兩段核准替代文字各出現於 2 檔（來源 microblog 輸出與 status 頁）；目標測試另證明來源為 21 筆、V 不存在、兩筆 D 同 ID/date/tag/欄位與位置，19 筆 P 內容／欄位／順序與基準一致。`git diff --check` 通過，僅有既有 LF/CRLF 提示。
- 建置界線與意外副作用：首次臨時輸出命令的多設定參數未正確引用，Hexo 退回預設 `public/` 並增量重生 `microblog.json`、`sitemap.xml`、`navigation-index.json` 三個既有 ignored 快照檔；主代理已指示保留、不回復／刪除，這三檔不作為本包驗收證據。之後先核對 `hexo config public_dir` 確認輸出為 `tmp/wbs24-public-20260926/`，才完成 1004 檔完整生成及掃描。未執行 `npm run verify`，因其會 `npm run clean` 清除既有 `public/`；`check:site` 固定讀 `_config.yml` 的 `public_dir`，未把不完整的舊快照當成完整站點驗收。臨時完整生成結果保留於 `tmp/wbs24-public-20260926/` 供下一包稽核。
- 更廣的唯讀掃描另外發現：新產生的完整臨時輸出與目前 `public/` 三個增量產物均無核准原文命中；但既有 ignored `.deploy_git/` 有 2 個文字檔、其他既有 `tmp/` 有 2 個路徑仍含舊內容（合計 12 次文字命中）。未列印原文、未修改／清理這些舊 cache 或暫存；這證明本機舊部署副本／暫存仍有殘留，需由 2.5 清楚區分本輪新輸出與既有殘留，不能宣稱全工作區已清除。
- 未完成／限制：此遷移只改目前公開來源與本機可建置輸出，不能讓舊 Git 歷史、遠端副本或外部 cache 忘記原文；remote visibility、快取狀態與歷史清除均未知。本輪沒有外部私人保存副本可供獨立恢復。
- 下一步：WBS 2.5「公開輸出洩漏檢查」；本輪到此停止，未進入 2.5。

## 2026-09-26，雙面部落格 WBS 2.3：私人保存位置與排除規則（歷史方案，作者已撤回／不採用）

- 新增[私人保存與排除規則](dual-surface-private-storage.md)，只涵蓋已核准的兩筆 D（M-14、M-18）與一筆 V（M-17）。設計外部 sibling 根目錄 `C:\Blog\blog-1988-private`、私人 manifest／逐筆 record 欄位、原件完整性指紋（僅存私人區）、原子寫入／備份／回復、ID 永不重用、D 原 ID 配核准改寫、V 公開移除、microblog 公開衍生輸出清單與 2.4 前置驗證。
- 進場 HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；進場既有未提交工作依 0.1 基準保護。本包只新增規則文件並更新此進度檔；沒有建立 workspace 外檔案／資料夾，沒有讀出或保存 microblog 原文，沒有改 `source/microblog.json`、source、程式、設定或其他規劃文件。
- 唯讀核對：`source/microblog.json` 是 Git 追蹤檔；`.gitignore` 忽略 `public/` 與 `.deploy*/`，但這不是隱私保護或 Hexo 輸出排除；`_config.yml` 指向 `source/` 與 `public/`，本機存在舊 `public/` 和 `.deploy_git/`。預定 sibling `C:\Blog\blog-1988-private` 目前不存在，本包未建立。歷史 Git／remote 是否含原件尚未稽核，移出當前來源不能清除歷史 commit。
- 實際驗證：規則文件連結／路徑與排除範圍、D/V 欄位和 ID 規則核對；`git diff --check` 與 git status 核對列於本輪交付。未建置、未部署、未用額度重置券。
- HOLD：WBS 2.4 寫入 sibling 目錄前需作者／系統授權並檢查 canonical path、ACL；M-14 與 M-18 的具體公開改寫尚待作者核准；M-17 舊 hash 未匹配行為如需替代頁需另確認；是否要求清除歷史 Git／remote 原件仍未知。未符合前置門檻不得搬移或編輯來源。
- 下一步：**HOLD：待 2.4 執行前核准外部私人路徑寫入與兩筆 D 文案，確認 M-17 舊錨點策略；完成後才可進 WBS 2.4「核准項目安全遷移」**。本輪不開始 2.4。

## 2026-09-26，雙面部落格 WBS 2.2：公開邊界定案（完成，未搬移、未部署）

- 作者定案：只有 microblog 需要 P／D／V 判斷；271 篇文章、24 個 learning item、568 張圖片及功能／衍生輸出全部 P（直接公開），不再對非 microblog 保留 D／V／R。A/B 面向歸類仍是後續 WBS 3.2，不能從 P 推導。
- 圖片因個人保存兼分享用途且已有出處標示而全部維持公開，既有路徑、原圖／縮圖與引用不動。出處標示不等同授權證明；EXIF、人物同意可另作非阻塞維護檢查，但不是 2.2 HOLD，未經另行授權不修改圖片。
- 逐筆檢視 22 則 microblog 後，作者核准：M-01–M-13、M-15–M-16、M-19–M-22 共 19 筆 P；M-14、M-18 為 D；M-17 為 V。只記錄 ID 與中性理由，未複製敏感原文，也未改來源；D 的公開改寫文字與 V 的安全遷移留待 2.3／2.4。
- 若 microblog 選 D/V，其公開頁、原始 JSON 與所有衍生索引必須同步只保留核准公開版或排除，不能靠 A/B 或前端隱藏。V 原文的私人位置、ID 與舊錨點處理留到 2.3。
- 本輪只更新決策與進度文件；未修改 source、圖片、文章、microblog、learning data、程式、設定或輸出，未建置、未部署、未使用額度重置券。
- 下一步：WBS 2.3「私人保存位置與排除規則」，只為兩筆 D 原文及一筆 V 原文設計不進 Git／建置／部署的保存與回復方式；未核准實際公開文字前不開始 2.4 改寫。

## 2026-09-25，雙面部落格 WBS 2.2：作者邊界待確認表（文件完成，決策 HOLD）

- 新增[公開邊界作者決策表](dual-surface-public-boundary-decisions.md)：先列不需重問的公開底線，再按文章批次、22 筆 microblog 穩定 ID、24 個 reading-desk item ID、568 張圖片的來源路徑批次，以及功能頁／JSON／feed／search／calendar 等輸出建立審核範圍。每列含來源／穩定識別、暴露面、中性風險摘要、保守建議及 P 保留公開／D 去識別公開／V 轉私人／R 逐項複查選項；未核准項皆 HOLD。
- 進場 HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；進場既有工作樹差異依 WBS 0.1 基準保護。本包僅新增決策文件並更新此進度；未改 source、文章、圖片、程式、設定、manifest、tests 或其他規劃文件。
- 已確認原則照既有規劃列示，不重問：純負面宣洩、人事摩擦、未公開專案與他人隱私不公開；公開碎片須有脈絡／反思；探索中可公開但需標示狀態；A/B 不等於隱私。個別內容尚未判定，未以 AI 代作者定案。
- 實際核對：manifest 文章 271 篇（實驗室 32、歌曲推薦 121、閱讀影評 106、隨筆 10、根層站務 2；工作知識系列七篇為實驗室批次子集）；microblog 22 筆、reading-desk 24 item、圖片 568 檔（`source/images/` 直接子檔 244、`blogger-import/**` 324）。七篇工作知識 linked item 以 `reading-topic-17`–`23` 與 front matter permalink 配對；日期均為 2026-09-17 發表日。微文與 learning 表只保留 ID／日期／必要 URL，不複製原文或附註。未逐張看圖、未檢 EXIF，這些風險仍未知。
- 實際驗證：來源存在性／數量及日期對照、相對文件連結與敏感原文檢查、`git diff --check`、git status 核對列於本輪交付。未建置、未部署、未用額度重置券。
- 未完成／HOLD：作者尚未核准任一公開邊界；即使內容目前已可在舊快照開啟，也不代表重新確認。不可開始私人搬移、去識別改寫、移除來源、調整 URL/ID 或加 `surfaces`。任何含他人／專案資料的不確定項依停止條件暫停。
- 下一步：**HOLD：等待作者 2.2 決策；核准後進 WBS 2.3「私人保存位置與排除規則」**。本輪不開始 2.3。

## 2026-09-25，雙面部落格 WBS 2.1：公開來源盤點（完成，唯讀盤點，G2 待作者決策）

- 新增[公開資料流盤點](dual-surface-public-data-flow.md)，逐類記錄來源→設定／處理器→公開輸出→直接請求／頁面呈現→日期、ID 與隱私風險，覆蓋文章、草稿／未來日期、microblog、reading-desk、`_data`、圖片、功能頁、首頁／隨機／日曆／分類／搜尋索引／search.xml／Atom／sitemap／archive/category/tag。
- 進場 HEAD 為 `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；進場時既有未提交變更依 WBS 0.1 基準保留，本步只新增盤點文件並更新此進度檔，未碰來源、程式、設定、manifest、helper 或測試。
- 唯讀快照核對：列出的 10 個主要 HTML 路徑及 2 個固定文章樣本均存在，`/profile/` 不存在；11 個 feed／index／資料端點存在；568/568 個 `source/images/` 相對路徑在舊 `public/` 快照存在。`source/_drafts` 有兩個目錄但 0 個檔案。`microblog.json`、`life-index.json` 的來源與快照雖同名，但 SHA-256 不同；快照不是目前來源的最新生成證據。原始 `reading-desk.yml` 與 `_data` 同路徑未見於快照，轉製的 `reading-desk.json`、`content-categories.json` 則存在。詳細結果與未知事項見盤點文件。
- 關鍵界線：`surfaces` 只可作為明確接入的清單／索引資格，不是存取控制；不能保護直接文章 URL、靜態 JSON/YAML、搜尋 XML、Atom、頁面 HTML、圖片或其他衍生輸出。未建置、未查線上狀態、未檢驗圖片內容／EXIF，也未判定任何內容應公開或私人。
- 實際驗證：以唯讀檢查核對設定、生成器、頁面 fetch 與舊 `public/` 路徑；表格列明存在與不存在項目、快照限制及 `_data/calendar.json` 等未知依賴。未執行 build／verify／部署。`git diff --check` 與文件相對連結及 git status 核對列於本輪交付結果。
- 下一步：WBS 2.2「作者決定公開／私人邊界」，逐類核准保留公開、去識別後公開或移至私人保存；在決策完成前，對應資料變更依 HOLD 處理。

## 2026-09-25，雙面部落格 WBS 1.4：建置前內容檢查（完成，G1 資料檢查通過，未建置、未部署）

- 進場基準：HEAD `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`；保留進場既有 `AGENTS.md`、`docs/personal-navigation-plan.md` 與本進度檔差異，以及先前規劃／契約／helper／測試產物；未覆蓋或清理。
- 新增版本化 manifest `tools/data/legacy-surfaces.v1.json`：僅允許基準紀錄省略 `surfaces`，不授予 A/B 資格。識別方式為 271 篇文章的 slash 正規化來源相對路徑、22 筆 microblog 持久 `id`、24 筆 reading-desk item 穩定 `id`；未用日期、mtime、分類或陣列序號推測。文章缺欄位按 legacy=`memory`，standalone 舊 learning item 按 legacy=`memory`，舊 linked item 繼承已發布目標面向；manifest 外的新紀錄缺欄位錯誤。
- `tools/content-check.js` 現在以共用 helper 驗證 posts、microblog、learning item 的所有明確 `surfaces`；重複值回報含來源路徑／record ID 的 warning，錯誤帶來源、識別與 `surfaces` 欄位。linked item 明確面向需為目標子集合；不存在或未發布的本站目標報錯且不按 standalone 相容降級。本站連結目前以文章明列的 `permalink` 精確解析；現有 24 筆 reading-desk 連結全部命中已發布文章。功能 pages 不由現行 content-check 掃描，亦不納入面向欄位檢查。
- 實際驗證：目標單元測試 `node --test tools/tests/content-surfaces.test.js tools/tests/content-check.test.js` 通過 19/19；`npm run check:content` 通過（5 分類、22 則 microblog、225 個圖牆路徑）；`npm run test:regression` 通過 86/86；`git diff --check` 通過。首次目標測試有一項 fixture 假文章使用被測試替換的標籤，修正 fixture 後重跑通過，非現有來源錯誤。
- 範圍／限制：本步只改內容檢查、其 fixture 測試與 manifest；未改 `source/`、front matter、microblog ID、reading-desk、scaffold、產生器或 UI。依工作包指示未跑 build／verify；因此只驗證 checker 與回歸，不宣稱重新生成輸出已逐項比對。未部署。未判定任何文章的 A/B 資格或私人性。
- 下一步：WBS 2.1「公開來源盤點」，沿文章、草稿、microblog、reading-desk、圖片與產生資料追查公開輸出流向。

## 2026-09-25，雙面部落格 WBS 1.3：契約單元測試（完成，未整合、未部署）

- 新增 `tools/tests/content-surfaces.test.js`，以現有 `node:test`／`node:assert/strict` 風格只測 `tools/lib/content-surfaces.js`；覆蓋合法面向與正規順序、重複值 warning、輸出／常數隔離、missingPolicy 三種政策、欄位不存在與 own `undefined`／`null` 分流、record／options／source 錯誤、各種無效型別與值、inherit、subset，以及錯誤的穩定欄位。
- 實際驗證：`node --test tools/tests/content-surfaces.test.js` 通過 9/9；`npm run test:regression` 通過 81/81（約 26.7 秒）；`git diff --check` 通過。首次目標測試曾因測試 wrapper 將 `undefined` 轉成預設參數、及一個不適用的 legacy 期望而失敗；修正測試後全數通過，未發現 helper 契約 bug，因此 helper 未修改。
- 本步只新增測試檔並更新此進度文件；未整合產生器／content-check，未修改來源資料、front matter、UI 或既有規劃；未建置、未部署。驗證範圍目前限於 helper 單元與既有 regression suite，呼叫端整合留待後續工作包。
- 下一步：WBS 1.4「相容集合與內容檢查設計／實作」，先依 WBS 與資料契約界定可靠的舊文清單來源，再進行獨立驗收。

## 2026-09-25，雙面部落格 WBS 1.2：共用正規化工具（完成，未整合、未部署）

- 新增 `tools/lib/content-surfaces.js`，提供 Hexo scripts／tools 可共用的純函式 `normalizeSurfaces`、`isSurfaceSubset`、穩定錯誤類別 `SurfaceContractError` 及凍結的唯讀值／順序常數。缺欄位政策必須由呼叫端明確指定 `legacy`、`error` 或 `inherit`；本工具不使用日期、mtime、分類或其他欄位猜測新舊。
- 解析器區分無 own `surfaces` 欄位與 own 欄位值為 `undefined`／`null`；只接受非空陣列及精確 `profile`／`memory`，輸出順序固定 `profile` → `memory`，重複值去重並回傳含來源 context 的 warning。錯誤有可辨識 code、source 與欄位資訊；回傳陣列為每次新建，修改它不會污染共用常數。子集 helper 已提供，但尚未整合 learning 資料流。
- 實際驗證：`node --check tools/lib/content-surfaces.js` 通過；不寫檔的 `node -e` assertions 通過合法值、三種缺漏政策、明確 undefined/null、空值／錯誤型別／未知／大小寫／空白、重複警告、來源 context、子集及常數隔離。第一次 assertions 曾以預設 `error` 驗證 legacy fixture，第二次 matcher 回傳字串而非 boolean；修正測試 harness 後通過，helper 未因此修改。`git diff --check` 通過。
- 本步只新增 helper 並更新此進度文件；未新增正式測試檔，留待 WBS 1.3；未修改任何既有產生器、索引器、content-check、source、front matter、scaffold 或畫面，未建置、未部署。
- 未知／待後續：既有相容清單如何版本化仍須由呼叫端方案決定；linked learning item 的子集合與附註可見範圍尚未整合；正式 fixture 與回歸測試待 1.3。
- 下一步：WBS 1.3「契約單元測試」，將本 helper 的成功、缺漏、錯誤、去重、linked subset 與輸出隔離案例保存為正式測試。

## 2026-09-25，雙面部落格 WBS 1.1：定義欄位規格（完成，未實作、未部署）

- 新增 [雙面部落格內容面向資料契約](dual-surface-content-contract.md)，定義 `profile`／`memory`、陣列型別與正規順序、重複去重、舊文缺欄位預設、無效值錯誤，以及 posts、microblog、reading-desk standalone／linked item、功能 pages、站務文章、首頁策展、搜尋／隨機／清單的規則。
- 明確規定 linked learning item 面向必須是目標文章面向子集合，首頁策展只可引用已發布且具 `profile` 資格的文章；公開權限與 A/B 呈現完全分開。本步只定規格，沒有修改 helper、驗證器、範本、scaffold、網站程式或任何來源資料。
- 實際驗證：依 WBS 1.1／0.3 完成文件自洽核對（缺欄位與明確空值分流、舊文相容與新文必填、linked 子集合、站務隨機排除和功能頁排除規則）；相對連結／空白檢查與 `git diff --check` 通過。未建置、未部署。
- 未知／待後續確認：舊文相容清單的機械化識別方式、新欄位強制生效時點，以及各文章／microblog／learning item 實際公開與 A/B 歸類，留待驗證器設計及 WBS 2.2／3.2 作者核准；`/profile/` 與 `profile-home.yml` 仍不存在。
- 下一步：WBS 1.2「共用正規化工具」，依本契約實作單一解析 helper；先確認相容集合的可靠識別方案，再開始程式修改。

## 2026-09-25，雙面部落格 WBS 0.3：驗收與回復規則（完成，未施工、未部署）

- 新增 [驗收與回復規則](dual-surface-blog-validation-and-recovery.md)，供後續 WBS 各工作包共用；涵蓋進場／完成檢查、證據格式、修改類型最低驗收矩陣、停止條件與 HOLD、測試失敗流程、逐檔回復限制、部署／線上回復邊界、0.2 固定樣本回歸對照及 progress 紀錄範本。
- 依 0.1 基準唯讀比較 Git 狀態；既有規劃文件和前兩個工作包產物均保留。本輪只新增規則文件並更新本進度檔，未回復任何檔案，也未修改網站、文章、`source/` 資料、網址或設定。
- 實際驗證：文件相對連結、空白及 `git diff --check` 通過；未執行建置或部署。
- 下一步：WBS 1.1「定義欄位規格」，先明確寫出 `surfaces` 允許值、舊文章預設、錯誤行為與適用資料類型。

## 2026-09-25，雙面部落格 WBS 0.2：路由與內容樣本（完成，未施工、未部署）

- 新增 [路由與內容樣本](dual-surface-blog-samples.md)：記錄 `/`、`/random/`、文章／分類／生活索引／草稿夾／圖牆／日曆、搜尋觸發方式與規劃中的 `/profile/`；為 A 候選、B 候選、雙面候選、站務文章、microblog 及 reading-desk 學習題目各保存來源、URL、日期語意、現況與未來驗收用途。
- 固定去重配對樣本：文章 `/learning/website-quality-testing-roadmap/` 與 `reading-topic-07` 指向同一 URL；保留文章發表日、更新日及學習題目加入日各自語意。A/B/雙面名稱僅為規劃驗收角色，未改 front matter 或來源資料。
- 實際驗證：唯讀核對來源檔、路由設定與既有 `public/` 快照；指定現行入口及樣本文章輸出均存在，`/profile/` 的來源與輸出不存在；microblog 錨點依既有 id 對應。未執行建置，未修改網站程式、文章、`source/` 資料、網址或設定。文件連結／空白檢查及 `git diff --check` 通過。
- 下一步：WBS 0.3「驗收與回復規則」，定義停止條件、每階段驗收與檔案級回復方式。

## 2026-09-25，雙面部落格 WBS 0.1：現況與未提交修改基準（完成，未施工、未部署）

- 新增 [雙面部落格施工基準](dual-surface-blog-baseline.md)，記錄本輪開始時的 HEAD、Git 狀態、進場前既有修改，以及首頁、搜尋、隨機、內容清單、最近文章與主選單的來源和資料流。
- 已標示不可覆蓋的既有修改：`AGENTS.md`、`docs/personal-navigation-plan.md`、`docs/personal-navigation-progress.md` 的工作樹差異，以及未追蹤的 `docs/dual-surface-blog-plan.md`、`docs/dual-surface-blog-wbs.md`。當時 `source/microblog.json` 不在修改清單內。
- 本工作包只新增基準文件並更新本進度檔；未修改網站程式、文章、`source/` 資料、網址或設定，未建置、未部署。驗證：完成唯讀來源／資料流盤點、交叉核對文件連結，並執行 `git diff --check`。
- 下一步：WBS 0.2「路由與內容樣本」，為 A/B、雙面、站務、碎碎念及學習題目選取可實際開啟的樣本並保存既有 URL 與日期基準。

## 2026-09-25，雙面部落格施工 WBS 與跨角色審查（完成，未施工、未部署）

- 已將雙面部落格方案拆成 [施工 WBS](dual-surface-blog-wbs.md)：包含 13 個不可變更原則、角色／RACI、模擬跨角色設計審查、12 個階段、工作包依賴、產出、驗收、停止條件及 6 個使用者確認點。
- 模擬作者、履歷讀者、內容編輯、資訊架構、隱私、UX、SEO、Hexo 工程與 QA 立場後，保留原核心決策：`/profile/` 為履歷入口、`/` 為隨機記憶庫、文章單一來源／單一網址、A／B 不是隱私、未完成內容以成熟度說明、網址而非前端狀態決定目前面向。
- 施工關鍵路徑定為：保存基準 → surface 契約 → 公開邊界 → 作者核准內容歸類 → 共用資料服務 → A 面 → 雙面導覽 → 搜尋／抽籤整合 → 發布流程 → 視覺與無障礙 → 本機發布候選 → 另行授權部署。
- 本次只新增施工文件並替上位設計加入交叉連結，沒有修改網站程式、文章、資料、畫面或部署。實際驗證為文件結構與相對連結核對，以及 `git diff --check`。
- 下一步：取得使用者確認後執行 WBS `0.1 現況與未提交修改基準`；只保存施工基準，不直接修改首頁。

## 2026-09-25，雙面部落格定位與詳細規劃（規劃完成，未實作、未部署）

- 確認網站採同一座公開記憶庫、兩個觀看入口：履歷使用 `/profile/` 進入「工作與學習」A 面；作者平常由 `/` 進入保留隨機探索的「個人記憶庫」B 面，兩面以一般連結互相切換。
- 同一篇文章不複製檔案或網址；後續以 `surfaces: [profile, memory]` 表示可在兩面被引用。缺少欄位的舊文章預設只屬於 `memory`，避免既有文章未經挑選便進入履歷入口。
- 明確區分「展示面向」與「公開權限」：A／B 都是公開內容，不能拿來藏資料；私人文章、碎碎念與學習資料必須不進公開建置，尤其不能只在畫面隱藏 `source/microblog.json` 或 `source/reading-desk.yml` 的內容。
- 已完成 [雙面部落格詳細計畫](dual-surface-blog-plan.md)，涵蓋資料欄位、首頁架構、文章雙面引用、搜尋／抽籤／選單規則、公開邊界、九個小步驟、驗收矩陣及風險防呆。本次只新增規劃文件，未修改網站功能或部署。
- 實際驗證：核對現有 `random.json`、統一搜尋索引、內容清單、最近文章與主選單的程式來源，確認目前均未具備面向欄位；計畫所列影響範圍可對應現有檔案。文件差異另以 `git diff --check` 檢查。
- 下一步：只建立 `surfaces` 共用資料契約、驗證器與測試；先不改首頁、不搬私人資料、不批次分類文章。

## 2026-09-21，首頁減負後保留文章特色：隨機文章視覺櫥窗（完成，未部署）

- 開始／收尾額度：5 小時剩餘 81%／60%，每週剩餘 41%／38%；未使用重置額度。
- 首頁仍只保留一張隨機文章卡，不恢復最新文章流水；依文章內容分成歌曲、閱讀、觀影、生活、學習、工作與一般文章七種視覺語彙，讓先前為首頁設計的封面與記錄感能在精簡版首頁繼續出現。
- 歌曲、閱讀、觀影與一般文章可顯示站內 `/images/` 封面；其餘類型使用與上方播放面板一致的終端／錄音帶資訊面板。只接受安全的站內圖片路徑，外部網址與可疑路徑不會帶入首頁。
- 「全部文章」的時間排序、側邊選單與既有網址均未調整。桌面版視覺區固定在卡片右側；375 × 812 手機版收成 84px 高的橫向短帶，不額外拉長首頁，也沒有水平溢出。
- 實際瀏覽器驗收工作、生活與歌曲樣本；換篇後類型及封面／資訊面板會正確切換，主控台 0 警告、0 錯誤。驗收時發現作者樣式會蓋過 HTML `hidden` 狀態，已補上明確規則，避免封面與資訊面板同時顯示。
- 完整 `npm run verify` 通過：72 項測試、999 個生成檔案、373 個 HTML、49,695 個 href/src。最後樣式修正後另執行乾淨建置與 `npm run check:site`，結果同樣通過；本機預覽使用 4013，完成後已停止並確認連接埠釋放。沒有部署。
- 下一步：由使用者確認首頁視覺櫥窗；若仍希望在「全部文章」看到特殊版型，可另規劃可切換的卡片檢視，不在本步驟擴大範圍。

## 2026-09-20，懷舊線稿互動第 1 階段定稿：器材線框頁尾（完成，未部署）

- 開始／收尾額度：5 小時剩餘 16%／8%，每週剩餘 47%／46%；使用者明確表示今日不需保留原訂停止線，因此完成本小步驟後收尾，未使用重置額度。
- 依首頁上方播放面板的器材／儀表語彙重畫頁尾：移除人物與長椅，改為方正錄音帶、幾何耳機、短刻度與橫跨整個米白框的深色底線；保留少量磚橘細節，但整體降低透明度與視覺重量。
- 頁尾改為純裝飾，不再是按鈕，也移除滑過、點擊動畫及相關腳本；容器設為 `aria-hidden="true"`，不會產生多餘的鍵盤焦點或朗讀項目。
- 實際瀏覽器驗收桌面與 375 × 812 手機版：器材圖示均貼在底線兩端、主焦點仍在隨機文章卡；手機沒有水平溢出，頁尾內沒有按鈕、連結或 `tabindex`。
- `npm run verify` 通過：72 項測試、992 個生成檔案、369 個 HTML、48,732 個 href/src；本機預覽使用 4012，完成後已關閉分頁並確認連接埠釋放。4011 已被其他程序占用，未終止。沒有部署。
- 下一步：由使用者確認此器材線框定稿；第 2 階段仍未開始。

## 2026-09-20，懷舊線稿互動第 1 階段修整：跨欄頁尾飾帶（完成，未部署）

- 開始／收尾額度：5 小時剩餘 35%／17%，每週剩餘 50%／47%。
- 依首頁實際比例將原本偏大的獨立插圖收成貼底飾帶：錄音帶與人物約縮小一半，底線從桌面版整個米白框左側跨過側欄與主內容到最右側；平板與手機維持內容滿寬，不產生橫向捲動。
- 人物改為無五官的側／背影線稿並保持靜止，錄音帶外觀也改得較方正；互動只讓兩個轉軸與耳機線播放 2.2 秒，結束後移除播放狀態，`prefers-reduced-motion` 下不播放。
- 實際瀏覽器驗收桌面與 375 × 812 手機版：桌面飾帶跨過 252px 側欄區並完整貼齊主框寬度，手機沒有水平溢出；計算樣式確認轉軸與線材有動畫、人物為 `none`，2.2 秒後播放狀態確實清除。
- `npm run verify` 通過：72 項測試、992 個生成檔案、369 個 HTML、48,732 個 href/src；本機預覽使用 4011，完成後確認連接埠已釋放。沒有部署。
- 下一步：先停在第 1 階段讓使用者確認整體氣質；第 2 階段「隨機文章頁 CRT 小電視」尚未開始，需另行確認後再做。

## 2026-09-20，懷舊線稿互動第 1 階段：首頁錄音帶尾線小人（完成，未部署）

- 開始／收尾額度：5 小時剩餘 66%／39%，每週剩餘 55%／51%。
- 在首頁四個入口下方加入無文字的雙色 SVG 收尾插圖：錄音帶拉出的虛線延伸到戴耳機、坐在長椅上的線條人；僅使用既有米白、深棕與磚橘色系，不新增內容入口或浮出文案。
- 插圖是可存取按鈕；桌面滑過或點擊、手機點擊時，捲軸、人物點頭與晃腳只播放 2.2 秒後停止。使用者啟用 `prefers-reduced-motion` 時不播放動畫。
- 第一版手機放大裁掉了錄音帶與部分人物，實際驗收後改為完整橫向縮放；375px 下插圖寬 344px、高約 73px，錄音帶、尾線、人物與長椅均完整顯示，頁面沒有水平溢出。
- 新增首頁插圖、可存取名稱、互動與減少動態效果的回歸檢查；`npm run verify` 通過：72 項測試、992 個生成檔案、369 個 HTML、48,732 個 href/src。手機修正後另執行乾淨建置與 `npm run check:site` 通過，瀏覽器主控台無警告或錯誤，`git diff --check` 通過。
- 測試使用 4010，完成後已停止；已被占用的 4001、4002 與短暫占用的 4003 均未終止其他程序。沒有部署。
- 下一步：先由使用者確認首頁插圖的大小與意境；確認後再獨立進行第 2 階段「隨機文章頁 CRT 小電視」，不在本階段提前加入其他頁面。

## 2026-09-20，搜尋定位段落高亮修正範圍核對（完成，未部署）

- 開始／收尾額度：5 小時剩餘 72%／70%，每週剩餘 56%／56%。
- 目前共有 265 篇公開文章；其中 264 篇具有搜尋定位段落，共 5,407 個段落，全部由同一個共用樣式控制，因此 2026-09-19 的正文黃底／橘框修正已涵蓋所有可能出現此問題的文章段落，不需逐篇修改。
- 唯一沒有搜尋定位段落的是自訂首頁看板 `System Ready...`（`/2026/01/21/welcome-board/`），它不是一般正文版型，本來就不會出現該段落高亮問題。
- 再次確認來源與編譯後 CSS 均不存在 `[data-navigation-anchor]:target` 規則；碎碎念與日曆卡片的定位提示仍存在。這次只做範圍核對，沒有修改網站程式或部署。
- 下一步：不需再逐篇修正；若使用者發現其他黃色區塊，需以該頁網址判斷是否是不同元件的既有卡片樣式。

## 2026-09-19，搜尋定位段落取消持續高亮（完成，未部署）

- 開始／收尾額度：5 小時剩餘 87%／73%，每週剩餘 58%／56%。
- 問題根因是站內搜尋以段落錨點開啟文章後，共用 `[data-navigation-anchor]:target` 樣式會替一般正文持續加上淡黃底與橘色外框，讓正常段落看起來像作者特別強調。
- 保留段落錨點及 `scroll-margin-top`，因此搜尋結果仍可精準定位；只取消文章正文段落的持續高亮。碎碎念與日曆卡片的定位提示仍保留，文章正文、網址與日期均未變更。
- 新增回歸測試，避免文章段落重新套回 `:target` 高亮；目標文章摘要檢查通過（53／86）。`npm run verify` 通過：72 項測試、992 個生成檔案、369 個 HTML、48,748 個 href/src。
- 以原問題段落錨點實際預覽：桌面與 375px 手機的計算樣式均為透明背景、無外框，段落位於視窗頂端且手機沒有水平溢出。測試改用 4002，完成後已停止；原本已占用的 4001 未處理。沒有部署。
- 下一步：由使用者確認實際閱讀感受；部署仍需另行明確授權。

## 2026-09-19，首頁隨機探索改版第 4 步：桌面與手機實際驗收（完成，未部署）

- 開始／收尾額度：5 小時剩餘 100%／88%，每週剩餘 60%／58%。
- 桌面實際預覽確認首頁隨機卡可載入；「換一篇」會更換文章，進入文章後用瀏覽器返回會恢復同一篇；主選單與首頁四個內容入口均符合第 3 步規劃。
- 「全部文章」顯示 265 篇文章與公開草稿說明，最新文章依日期由新到舊排列；舊 `/page/2/` 保留 10 篇時間清單，並顯示前往「全部文章」的相容提示。
- 375px 手機實際預覽確認首頁、全部文章與舊分頁均無水平溢出；折疊主選單可操作，七個入口名稱與順序正確。瀏覽器主控台沒有警告或錯誤。
- 本步驟沒有修改網站程式；第 3 步的完整 `npm run verify`（71 項測試、992 個生成檔案、369 個 HTML、48,748 個 href/src）仍是目前網站版本的完整驗證。另執行 `git diff --check` 通過；測試使用 4001，完成後已停止本任務的預覽程序。沒有部署。
- 下一步：由使用者本機試用並決定是否部署；部署仍需另行明確授權。

## 2026-09-19，首頁隨機探索改版第 3 步：入口與主選單精簡（完成，未部署）

- 開始／收尾額度：5 小時剩餘 69%／62%，每週剩餘 61%／60%。
- 主選單調整為「首頁、全部文章、內容分類、生活索引、草稿夾、記憶圖牆、更新日曆」；移除重複的「隨機文章」選單，並將原 `Heat Map` 顯示名稱改為較明確的「更新日曆」，網址均不變。
- 首頁四個入口調整為「全部文章、生活索引、草稿夾、記憶圖牆」，不再重複顯示隨機文章入口；`/random/` 頁面與完整功能保留，仍可從首頁主要隨機卡、無腳本退回入口及生活索引開啟。
- 擴充首頁回歸測試，固定主選單項目／順序、首頁入口不重複與日曆名稱；`npm run verify` 通過：71 項測試、992 個生成檔案、369 個 HTML、48,748 個 href/src。生成首頁的主選單及四個入口均與規劃一致。沒有部署。
- 下一步：進行最後的桌面與 375px 手機實際預覽，驗證隨機卡載入、換篇、進入文章再返回、選單與舊分頁；通過後再整理整體交付，部署仍需另行授權。

## 2026-09-19，首頁隨機探索改版第 2 步：首頁隨機文章卡（完成，未部署）

- 開始／收尾額度：5 小時剩餘 83%／71%，每週剩餘 64%／62%。
- 首頁第一頁保留 Welcome Board、隨機選曲／選書與既有入口，將最新文章流水及首頁分頁改為一張主要隨機文章卡；卡片沿用 `random.json`，顯示分類、日期、標題與摘要，提供閱讀、換一篇及完整隨機傳送門。
- 抽到的文章以分頁 `sessionStorage` 保存，進入文章再返回時會恢復；換一篇排除目前文章並先隨機選內容分類，避免文章量大的分類壟斷結果。儲存或資料載入失敗時仍可前往全部文章／隨機傳送門。
- 舊 `/page/N/` 網址繼續生成原本的時間文章清單，並加入文章列表已移至「全部文章」的提示；根首頁不再提供文章分頁。主選單與首頁第四張「隨機文章」入口尚未精簡，留待下一個獨立步驟。
- 新增首頁隨機資料、換篇與儲存失敗回歸測試；`npm run verify` 通過：71 項測試、992 個生成檔案、369 個 HTML、49,117 個 href/src。產出頁另確認首頁只有 1 個置頂區塊、0 個分頁，`/page/2/` 保留 10 篇文章與相容提示；生成的首頁腳本語法通過。沒有部署。
- 下一步：調整首頁四個入口與主選單順序，以「全部文章」取代重複的隨機文章入口，並將 `Heat Map` 顯示名稱整理為「更新日曆」。

## 2026-09-19，首頁隨機探索改版第 1 步：建立「全部文章」入口（完成，未部署）

- 開始／收尾額度：5 小時剩餘 90%／85%，每週剩餘 65%／64%。
- 將既有 `/archives/` 從隱藏歸檔提升為主選單的「全部文章」，頁面標題與說明明確標示所有文章及持續整理中的公開草稿仍依發表時間由新到舊排列；沒有合併、限額或隱藏草稿。
- 保留首頁目前的最新文章流水、隨機文章選單與所有既有網址，尚未執行後續首頁隨機卡及選單精簡，避免一次跨越多個可驗證步驟。
- `npm run verify` 通過：70 項測試、992 個生成檔案、369 個 HTML、49,312 個 href/src；生成的首頁與歸檔頁均有「全部文章」選單，歸檔頁包含最新公開草稿且時間序列正常。沒有部署。
- 下一步：以既有 `random.json` 在首頁加入可返回保留的隨機文章卡，移除首頁第一頁的文章流水與分頁，同時保留 `/page/N/` 舊網址的文章清單相容。

## 2026-09-15，更新「部落格改版規劃」文章（完成，未部署）

- 開始／收尾額度：5 小時剩餘 75%、每週剩餘 76%。
- 在 `source/_posts/部落格改版規劃.md` 補入已完成的桌面兩個固定案例，以及搜尋、圖牆、草稿夾與日曆的返回條件／位置保存；同步把仍需觀察的特殊版型與瀏覽器返回事件列為後續，不把它們寫成已完全解決。
- 保留原文章網址、分類、日期與標籤；更新 `updated` 後同步逐篇標籤清單的正文雜湊與更新時間。
- `node tools/excerpt-check.js --post "source/_posts/部落格改版規劃.md"` 通過（68/86）；`npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src。生成文章的正文、`dateModified`、JSON-LD 與標籤均已檢查；未部署。

## 2026-09-15，桌面文章排版案例修正（完成，未部署）

- 開始額度：5 小時剩餘 84%、每週剩餘 78%。先用實際生成頁面固定兩個案例：一般文章 `部落格改版規劃`，以及長標題歌曲文章 `歌曲推薦-有沒有那麼一首歌會讓你想起我`；另檢查文章列表。
- 釐清根因：NexT 的 `.posts-expand .post-header` 預設置中，`.post-meta` 又以 `justify-content: center` 排列；文章列表的 `text-wrap: pretty` 原本只在手機媒體查詢內，桌面長標題沒有孤單換行保護。
- 修改 `themes/next/source/css/main.styl`：桌面（768px 以上）單篇文章標題與中繼資料共用左側閱讀界線；文章標題使用 `text-wrap: balance`，文章列表標題在各尺寸使用 `text-wrap: pretty`。手機原有置中版型與區塊間距保留。
- 實際瀏覽確認：一般文章標題／日期／分類靠左，長歌曲標題維持完整一行，文章正文與閱讀欄不變；沒有改動文章正文、分類、標籤或網址。
- `npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src；本機預覽未部署。收尾額度：5 小時剩餘 81%、每週剩餘 77%。下一步仍為第四項「返回保留原位置」，需另以搜尋、圖牆、草稿夾與日曆逐一建立案例。

## 2026-09-15，日曆返回條件與位置（完成，未部署）

- 開始／收尾額度：5 小時剩餘 80%、每週剩餘 77%。盤點確認日曆原本只在 JavaScript 變數中保存年份與選定日期，離開頁面後重新載入會回到預設。
- 修改 `source/calendar/index.md`：選定年份與日期寫入 `?year=YYYY&date=YYYY-MM-DD`，直接開啟、上一頁與重新整理會重建相同明細；分頁 `sessionStorage` 另保存精確網址與捲動位置，返回時復原。儲存不可用時仍保留網址條件，不阻斷文章連結。
- 實際生成頁面以 `?year=2025&date=2025-10-21` 開啟，確認年份按鈕、日期明細與文章卡片均對應 2025-10-21；`npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src。
- 本次只完成日曆案例，搜尋、圖牆、草稿夾仍待各自建立返回案例；沒有部署。下一步可處理草稿夾的年份／日期與捲動狀態。

## 2026-09-15，草稿夾返回條件與位置（完成，未部署）

- 開始額度：5 小時剩餘 79%、每週剩餘 77%；盤點確認草稿夾原本只用 JavaScript 變數保存年份，hash 定位雖可用，但日期與捲動位置沒有持久狀態。
- 修改 `source/reading/index.md`：選定年份與日期寫入 `?year=YYYY&date=YYYY-MM-DD`，返回／重新整理／直接開啟會復原相同日期；分頁 `sessionStorage` 保存網址與捲動位置，文章卡片離開前與 pagehide 都會記錄。既有 `#reading-topic-*` 題目定位仍會選回原加入日期並聚焦卡片。
- 實際瀏覽確認：`?year=2026&date=2026-09-08` 顯示指定日期；`#reading-topic-01` 仍定位到 2026-08-29 題目。`npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src。
- 收尾額度：5 小時剩餘 79%、每週剩餘 77%。本次沒有部署；下一步處理圖牆的分類／返回位置，再處理搜尋彈窗的條件與捲動狀態。

## 2026-09-15，圖牆分類與返回位置（完成，未部署）

- 開始額度：5 小時剩餘 78%、每週剩餘 77%。盤點確認圖牆分類已用 hash，但「全部」原本會清掉 hash，重新整理會回到歌曲；捲動位置也沒有保存。
- 修改 `source/photos/index.md`：將全部分類也寫成 `#photo-wall-all`，保留歌曲／書籍／觀影的既有 hash；以分頁 `sessionStorage` 保存當前 hash 與捲動位置，返回時復原，且避免自動跳到分類標題覆蓋原位置。儲存不可用時分類 hash 仍正常。
- 實際瀏覽確認：直接開啟 `#photo-wall-all` 顯示 214 筆全部內容；直接開啟 `#photo-wall-books` 顯示書籍區，篩選與頁面連結仍存在。`npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src。
- 收尾額度：5 小時剩餘 78%、每週剩餘 77%。本次沒有部署；下一步處理搜尋彈窗的查詢、分類／月份條件與返回捲動位置。

## 2026-09-15，搜尋返回條件與位置（完成，未部署）

- 開始額度：5 小時剩餘 77%、每週剩餘 77%。盤點確認搜尋查詢、內容來源、分類與月份原本只存在當次彈窗，離開後沒有持久狀態。
- 修改 `themes/next/source/js/third-party/search/local-search.js`：分頁狀態保存查詢、三組篩選、最近分類、彈窗開啟狀態與捲動位置；只有相同網址的返回／重新整理情境才復原並重開彈窗，直接新開頁面不擅自彈出；清除條件會同步清掉保存狀態，文章頁離開也不會覆蓋搜尋頁狀態。
- 實際瀏覽確認：搜尋彈窗可開啟，索引載入後三組篩選可用；輸入 `AI` 顯示 25 筆命中，結果可進入學習文章。`node --check themes/next/source/js/third-party/search/local-search.js` 通過。
- `npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src；本次沒有部署。
- 收尾額度：5 小時剩餘 75%、每週剩餘 76%。四個入口的條件／位置保存已各自完成；若瀏覽器本身把重新整理標成一般導覽，需以該瀏覽器的實際返回事件再補驗。

## 2026-09-15，歷史改版回溯補登（完成，未部署）

- 開始／收尾額度讀值：5 小時剩餘 92%、每週剩餘 79%。
- 依 Git 歷史、現行來源檔案與既有驗證工具新增 `docs/site-change-log.md`，整理早期搜尋、行事曆、手機版、排版、首頁、側欄、歌曲／圖牆，以及近期導覽、JSON-LD、標籤與內容分類改版。
- 將「桌面換行／置中異常」、「JSON-LD 規範」、「分類與標籤查找」、「返回位置」與資料品質維護改寫成問題情境、證據、真正問題、處理與狀態；歷史提交無法支持的根因明確標為待補驗證。
- `git diff --check` 通過；引用的代表提交均以 `git rev-parse --verify` 確認存在。這次只新增文件與入口，保留進場所有未提交網站修改，沒有重跑建置或部署。
- 下一步仍為第四項「返回保留原位置」；若要處理桌面排版問題，先依回溯文件的紀錄格式建立可重現案例，再做單一小步驟修改與驗證。

## 2026-09-15，重寫「部落格改版規劃」文章（完成，未部署）

- 開始額度：5 小時剩餘 86%、每週剩餘 78%。
- 將 `source/_posts/部落格改版規劃.md` 的正文整篇改寫成「改版目的 → 原則 → 已整理方向 → 問題釐清流程 → 未完成項目 → 更新紀錄」的文章結構，保留分類 `站務`、標籤 `站務規劃`、原日期與原文章網址，更新可靠的 `updated` 時間。
- 因正文與 `updated` 有正式變更，同步更新逐篇標籤清單中這一篇的正文雜湊與更新時間；沒有重新分配任何文章標籤。
- `node tools/excerpt-check.js --post "source/_posts/部落格改版規劃.md"` 通過；`npm run verify` 通過：69 項測試、963 個生成檔案、348 個 HTML、43,014 個 href/src。生成文章為 `/2026/01/25/部落格改版規劃/`，canonical、BlogPosting JSON-LD 與 `dateModified` 對齊。
- 收尾額度：5 小時剩餘 85%、每週剩餘 78%。本次沒有部署，進場已有的未提交修改均保留。下一步仍為第四項「返回保留原位置」。

## 2026-09-14，追加：分類與標籤統一介面（完成，未部署）

- 使用者確認將側欄分類與標籤合併。保留「內容分類」入口；分類、標籤總覽與原有個別分類／標籤網址使用同一介面。數字區的標籤連到 `/categories/#browse-tags`。
- 同頁顯示 246 篇文章；分類與標籤交集篩選、可選標籤隨分類收斂、不相容標籤自動清除、一鍵清除條件。條件寫入原網址查詢參數，重新整理及上一頁可恢復。無 JavaScript 時保留文章與原分類／標籤連結。
- `npm run verify` 通過原有 69 項測試、945 個生成檔案。標題統一後重新建置並執行 `npm run check:site` 通過：330 個 HTML、37,102 個 href/src；`git diff --check` 通過。
- 實際瀏覽：音樂 111 篇，僅可選歌曲推薦標籤；切到生活紀錄得到 7 篇並清除不相容標籤；上一頁及重整恢復音樂／歌曲推薦。清除條件後回到 246 篇。側欄無独立標籤選單，標籤數字連結正確。390×844 手機版檢視通過，已還原尺寸。
- 保留進場所有未提交修改，沒有部署。測試使用 4001，完成後已停止本任務的測試程序；沒有處理使用者的 4000 程序。
- 額度：開始 5 小時 28%／每週 89%；中段 21%／88%；最終讀值 8%／86%。兩次讀值間下降超出預留緩衝，本次未守住使用者要求的 10%，已告知並立即停止新增工作。未消耗剩餘重置券。後續更早縮小工作批次、增加驗證途中讀值頻率。
- 下一步仍為第四項完整返回位置保留；本次僅處理整合頁本身的條件歷史，未宣稱圖牆、搜尋或日曆的返回位置已完成。待額度恢復再接續。

## 2026-09-14，預覽連接埠交接修正

- 使用者啟動 Hexo 時回報 4000 已占用；已停止上一輪由本任務啟動的預覽工作階段。
- 以 Node 實際綁定 4000 成功後立即釋放，確認連接埠可供使用者重新執行 `npm run server`。未再啟動背景預覽；未更動網站程式或部署。
- 開始餘額：5 小時 37%、每週 90%；收尾讀值：34%／90%。
- 下一步仍為第四項。往後本機驗證完成後應釋放預覽連接埠，或明確交接既有程序，避免使用者重複啟動而衝突。

規劃於 2026-09-14 獲使用者確認。每次執行前先讀取根目錄 AGENTS.md 的額度限制與原規劃。

| 項目 | 狀態 | 證據／接續 |
| --- | --- | --- |
| 1. 資料盤點與查找案例 | 完成 | `personal-navigation-data-contract.md`、inventory/acceptance JSON、盤點腳本 |
| 2. 統一搜尋資料 | 完成 | `personal-navigation-index.md`、`personal-navigation-step2-verification.json`；266 筆紀錄，15 個學習題目已合併 |
| 3. 搜尋篩選與定位 | 完成 | 69 項測試、三個真實瀏覽案例、4,435 段落錨點；見 step3-verification JSON 及下方紀錄 |
| 4. 返回保留位置 | 完成 | 日曆、草稿夾、圖牆與搜尋均保存條件／位置；見 2026-09-15 四筆完成紀錄 |
| 5. 同期紀錄回顧 | 未開始 | 重用 events；保留現有熱力圖統計 |
| 6. 接續連結 | 未開始 | 保留圖牆收聽與既有一般文章導航 |
| 7. 整體驗收 | 未開始 | 所有互動完成後提供本機試用；部署未授權 |

## 2026-09-14，第 1 項

- 開始額度：5 小時剩餘 86%，每週剩餘 25%；中段讀值剩餘 68%／22%；結束讀值剩餘 60%／21%。餘額為帳號即時讀值，可能包含其他同時進行的任務用量。
- 246 篇公開文章、20 則碎碎念、11 組共 15 個學習題目。15 題全部連到公開文章；20 則碎碎念尚無持久 id。
- 找到並修正盤點腳本對前導 `/` permalink 的處理；修正後 15 個連結全部配對成功。這是盤點工具問題，不是原站連結損壞。
- 執行 `node tools/navigation-inventory.js`：通過，0 個異常、3 個真實來源案例，來源雜湊確認未變。
- `node --check tools/navigation-inventory.js` 與 `git diff --check` 通過。
- 進場已有 `source/microblog.json` 的未提交修改；完整保留。新文件位於 docs，未加入網站內容。
- 本次沒有修改網站介面、搜尋行為或部署；不需為純盤點重跑整站瀏覽測試。功能驗收依各項實作再執行。
- 下一次：先檢查額度與工作樹，再開始第 2 項的持久識別及統一索引。既有規劃已確認，不需重問相同實作授權。

## 2026-09-14，第 2 項

- 開始額度：5 小時剩餘 52%，每週剩餘 20%；中段 42%／18%；結束 35%／17%。餘額為帳號讀值，可能包含同時使用。
- 新增靜態 `navigation-index.json`，含 246 篇文章、20 則碎碎念；15 個學習題目併入原文章，保留附註與加入日期事件。總共 266 筆，沒有重複學習文章。
- 20 則碎碎念已持久化 id；原文、日期、其他欄位與順序經完整資料比對保留。原本未提交的內容已納入寫入前備份。再次執行 id 補齊工具為 0 筆變更。
- 6 項新增單元測試通過；`npm run verify` 通過（60 項測試、943 個生成檔案、330 個 HTML），`git diff --check` 通過。
- 實際索引三個來源案例均找到預期結果；全部目標頁存在，warnings 為空。驗證紀錄見 `personal-navigation-step2-verification.json`。
- 原搜尋視窗及 search.xml 保持原行為，沒有介面改動或部署。查找案例通過的是資料層，尚未宣稱使用者介面已能跨來源搜尋。
- 下一次：額度接近 15% 提前停止線，先重新讀取餘額；不足以安全完成下一小步時等待恢復。額度允許時接第 3 項，使用已建立的 schemaVersion/records，先實作搜尋視窗讀取與結果顯示，再分步完成篩選及錨點。

## 第 3 項啟動檢查：依保留額度規則提前收尾

- 使用者已要求進行第 3 項，實作授權持續有效。
- 本次開始讀值：5 小時剩餘 99%，每週剩餘 16%。每週距離 15% 提前停止線只有 1 個百分點；無法可靠預估實作加測試是否會超過，依 AGENTS.md「消耗難以控制時更早收尾」暫不啟動程式修改。
- 第 3 項仍為未開始，沒有執行功能測試，也沒有修改網站或部署。本次只保存交接。
- 收尾讀值：5 小時剩餘 94%，每週剩餘 15%，已到提前停止線。餘額為帳號讀值，不代表全部用量均由本次操作產生。
- 下一個可交付小步驟為 3a：讓現有搜尋視窗讀取 navigation-index.json 的 schemaVersion/records，顯示來源、日期與命中片段；保持既有載入失敗、重試、空結果與 Ctrl+K 行為。先以第 1 項三個真實案例驗證跨來源查找，再測中文／英文／HTML 特殊字元與索引格式錯誤。分類／月份篩選及精準錨點作為後續 3b、3c，不提前標成完成。
- 本次額度工具顯示每週視窗預計於 2026-09-19 16:34（Asia/Taipei）重置；以後續實際讀值為準。恢復後可直接接續，不需重新確認原規劃。

## 2026-09-14，第 3 項完成

- 使用者指示「先做完 不夠再重製」，本次解讀為完成已授權的第三項，額度不足時使用一次既有重置券。沒有延伸到第四項或部署。
- 開始餘額：5 小時 84%、每週 14%；接續讀值 77%／12%。因不足以完成並保留日常用量，依本次明確授權使用 1 次重置；工具回傳 outcome=reset，重新讀值 99%／100%，尚餘 1 張重置券。沒有購買額度。
- 實作檢查點：搜尋顯示與篩選、文章／紀錄定位完成並通過初測後，餘額 90%／98%；完成瀏覽與邊界測試後 60%／94%；最終收尾讀值 40%／91%。餘額為帳號讀值，可能包含其他同時進行的任務。
- 搜尋視窗改讀統一索引，顯示文章／碎碎念／學習來源、分類、各自日期意義、命中片段與高亮。新增來源／分類／月份交集篩選及清除條件；空條件恢復原本最近文章列表。
- 文章定位到生成後的真實段落；保留作者原 id，新段落 id 由來源與文字產生。碎碎念使用既有持久 id，載入後展開年份並顯示足夠筆數。學習附註可直接開啟原日期與完整附註，主文章維持單筆結果。無命中段落時明示開啟文章，紀錄被移除時顯示提示。
- `npm run verify` 最終通過：69 項測試、944 個生成檔案、330 個 HTML。含來源／分类／月份全部 48 組合、中文英文與特殊符號、空結果、錯誤索引重試、鍵盤焦點、超過 20 筆的定位、改文／排序、舊年份及缺日期的測試。
- `node tools/navigation-search-check.js tmp/navigation/step3-index-before-rebuild.json` 通過：266 筆索引、4,435 個段落錨點在目標頁恰好出現一次且文字一致，三個實際查找案例正確。重新 clean/build 後逐筆內容與 ID 相同；Hexo 處理來源的排列順序可能不同，不影響前端排序或定位。證據：`personal-navigation-step3-verification.json`。
- 本機瀏覽驗收：搜尋「有工作的第N+6天」定位到文章段落；「沒有被使用」找到碎碎念及另篇文章，指定碎碎念與 2026-09 後只剩目標紀錄；「早段拉臂時機」只有一篇合併結果，可開文章段落或草稿夾附註。三種定位均測試直接開啟／重新載入。
- 390×844 手機尺寸確認搜尋控制、結果與附註連結可操作；測試三種篩選同時使用、特殊字元無結果、清除条件、Ctrl+K、Escape 與 Shift+Tab 焦點留在搜尋視窗。桌面畫面亦檢視完成；測試後已還原瀏覽器尺寸。
- `git diff --check` 通過。保留進場前未提交的 `source/microblog.json` 與第二項成果；未改文章來源文字、既有網址或首頁動線。本次沒有部署。
- 本機試用：`npm run server -- --static --port 4000`，開啟 `http://localhost:4000/`，按 Ctrl+K 搜尋。
- 下一步：第四項「返回保留原位置」，將搜尋條件、列表位置以及圖牆／草稿夾／日曆狀態保留到返回時。沿用原確認規劃與至少 10% 日常額度規則；本次一次重置授權已使用，不將它視為未來自動消耗剩餘重置券的授權。

## 2026-09-15，公開文章標籤重整（完成，未部署）

- 開始餘額：5 小時剩餘 95%、每週剩餘 83%；收尾讀值：5 小時剩餘 90%、每週剩餘 83%。
- 逐篇閱讀並重整 246 篇公開文章的 front matter 標籤；保留正文、分類、日期、更新日期與 permalink。每篇最多 2 個標籤，無適合性質時保留空標籤；清單記錄 246 篇，含 2 篇需日後人工確認的案例（CMS 前後台理解、痠痛改善研究）。
- 更新 `content-tags.yml` 的主標籤定義、整合瀏覽介面、圖牆與匯入預設值；移除已停用名稱作為文章標籤。舊標籤頁不再保留，站內引用改指向新標籤、分類或整合瀏覽頁。
- 新增 `docs/tag-reorganization-review.json` 逐篇修改清單與 `check:tags` 驗證工具；驗證正文雜湊、分類、日期、更新日期、permalink、標籤數量與主標籤註冊狀態。
- `npm run verify` 通過：內容檢查、逐篇標籤清單、69 項回歸測試、997 個生成檔案與網站檢查（382 個 HTML、41,040 個 href/src）。搜尋索引含 246 篇文章，舊標籤為 0 筆；分類／標籤交集通過檢查。未部署。
- 下一步仍為第四項「返回保留原位置」；標籤重整已完成，不把部署或人工覆核 2 個不確定案例列為已完成。

## 2026-09-15，移除舊標籤站內引用與轉址（完成，未部署）

- 開始餘額：5 小時剩餘 86%、每週剩餘 82%；收尾讀值：5 小時剩餘 85%、每週剩餘 82%。
- 更新首頁歡迎頁播放按鈕、進度文件與所有可檢出的站內舊標籤 URL；文章正文其餘內容與新標籤設定保留。逐篇清單保留首頁連結更新前的雜湊與更新後雜湊，標示這次必要的站內連結修改。
- 移除 `content-tag-redirects.yml`、`scripts/tag-redirects.js` 及檢查工具中的轉址專用邏輯；舊標籤頁不再生成，外部收藏舊網址依本次決定失效。
- `npm run verify` 通過：69 項回歸測試、957 個生成檔案、342 個 HTML、40,960 個 href/src。來源與生成 HTML 的舊標籤 URL 均為 0，舊標籤輸出目錄為 0，轉址機制引用為 0，`git diff --check` exit 0。未部署。
- 下一步仍為第四項「返回保留原位置」；本次只完成舊標籤引用清理與轉址移除。

## 2026-09-15，歌曲語言標籤（完成，未部署）

- 開始餘額：5 小時剩餘 84%、每週剩餘 82%；收尾讀值：5 小時剩餘 82%、每週剩餘 81%。餘額為帳號即時讀值，可能包含其他同時進行的任務用量。
- 逐篇檢視 111 篇歌曲推薦正文的歌手、曲名與語言線索，保留既有「歌曲推薦」，新增一個語言標籤：華語 68、英語 16、韓語 11、台語 7、日語 5、粵語 3。國語主歌搭配韓語副歌的〈神話〉無單一語言標籤，列為不確定案例；書籍與其他文章未加語言標籤。
- `source/_data/content-tags.yml` 新增六個語言主標籤；`tools/song-language-tags.js` 保存逐篇語言群組與不確定案例，支援寫入及檢查；`package.json` 將 `check:song-tags` 納入 `verify`。逐篇清單同步保存 `languageTag`、判定依據與不確定狀態。
- `npm run verify` 通過：內容檢查、標籤清單、歌曲語言檢查、69 項回歸測試、963 個生成檔案、348 個 HTML、42,996 個 href/src。生成 `tags/華語/`、`tags/粵語/`、`tags/台語/`、`tags/英語/`、`tags/日語/`、`tags/韓語/`；搜尋資料含新標籤，分類與文章網址未改。`git diff --check` 通過，未部署。
- 下一步仍為第四項「返回保留原位置」；若要再細分混唱歌曲，先人工確認〈神話〉的語言需求再調整，不把它目前的省略視為缺漏。

## 2026-09-15，內容分類篩選介面收合（完成，未部署）

- 開始餘額：5 小時剩餘 81%、每週剩餘 81%；收尾讀值：5 小時剩餘 78%、每週剩餘 81%。餘額為帳號即時讀值，可能包含其他同時進行的任務用量。
- 先確認 `source/_data/content-tags.yml` 的文章性質／主題標籤定義；只新增 `group` 分組欄位供介面辨識，沒有修改文章標籤、分類、正文、日期或 permalink。
- 內容分類頁改為分類直接可見，文章性質與主題標籤各自收合成篩選按鈕；桌面使用下拉面板，手機使用底部面板。面板提供搜尋、目前條件下的文章數、全部、停用零筆選項、關閉與 Escape；搜尋只縮小選項清單，不直接改變文章結果。
- 分類、文章性質與主題採交集篩選；結果列顯示條件與數量並提供一鍵清除。網址讀取既有 `category`／`tag` 參數，並以 `property`／`topic` 保存新條件；上一頁與重新整理可恢復，保留 `#browse-tags` 錨點並將焦點帶到主題篩選。
- 新增鍵盤焦點循環、面板關閉後回到觸發按鈕、手機背景捲動鎖定、長名稱換行與窄螢幕防溢出；未標籤文章仍包含在全部結果。
- 本機預覽驗收：桌面、360×800 與 390×844；確認收起高度、面板捲動、選項搜尋、交集 11 篇結果、網址帶入的 0 篇結果、目前選項仍可辨認、清除、Escape、焦點返回、上一頁、重新整理與舊 `tag=韓語` 兼容。
- `npm run verify` 通過：內容／標籤／歌曲標籤檢查、69 項回歸測試、963 個生成檔案、348 個 HTML、42,996 個 href/src；`git diff --check` 通過。未部署。
- 主要檔案：`content-browser.njk`、`content-browser.js`、`scripts/content-browser.js`、`main.styl`、`content-tags.yml`。下一步仍為第四項「返回保留原位置」。

## 2026-09-15，主題標籤依分類收斂（完成，未部署）

- 開始餘額：5 小時剩餘 78%、每週剩餘 81%；收尾讀值：5 小時剩餘 76%、每週剩餘 81%。餘額為帳號即時讀值，可能包含其他同時進行的任務用量。
- 主題標籤選項改由整合頁的公開文章資料即時計算，不新增分類／標籤對照表；選定分類後只列出該分類實際使用的主題標籤與文章數，文章標籤或分類新增／修改後由一般建置更新。
- 未選分類時主題按鈕顯示「先選分類」並停用，全部文章仍可見；直接進入 `topic` 新標籤網址時保留標籤結果，不擅自選分類，按鈕停用且只保留目前選項，選分類後再顯示該分類的實際主題清單。
- 切換分類時保留仍在該分類使用的主題；不適用的主題會清除並同步網址，避免留下不可見條件。零筆分類仍可在已有主題條件時點選，以完成上述清除流程。
- 本機預覽驗收：未選分類、音樂分類 7 個語言主題、閱讀與影視無主題、`topic=韓語` 直接網址 11 篇、`topic=提問方法` 切換至音樂後清除主題並回到 111 篇。桌面與手機收合介面沿用前一階段驗證。
- `npm run verify` 通過：69 項回歸測試、963 個生成檔案、348 個 HTML、42,996 個 href/src；JavaScript 語法與 `git diff --check` 通過。未部署。
- 下一步仍為第四項「返回保留原位置」。

## 2026-09-15，主題標籤改為原位展開（完成，未部署）

- 開始餘額：5 小時剩餘 97%、每週剩餘 80%；收尾讀值：5 小時剩餘 93%、每週剩餘 79%。餘額為帳號即時讀值，可能包含其他同時進行的任務用量。
- 主題選擇由下拉／手機底部面板改為原位置的展開／收合區；收起時顯示目前主題、文章數與「挑選主題／更換主題」，展開後只顯示所選分類實際使用的主題按鈕，靠左換行。
- 展開區保留主題名稱搜尋、文章數、全部選項、零筆停用、選中狀態與兩個明確的收合按鈕；搜尋只過濾選項，不改變文章結果。選定主題後自動收合，Escape 或收合按鈕會將焦點返回觸發按鈕。
- 移除背景遮罩、手機底部定位與背景捲動鎖定；面板改為頁面內的 static 區塊，手機使用滿列寬、長名稱換行與可捲動選項區，避免橫向溢出。分類、主題、結果數量與文章清單維持左側對齊。
- 保留 `category`／`topic`／舊 `tag` 網址、清除、上一頁與重新整理狀態；`property` 參數仍會清除。直接開啟主題或文章性質標籤頁仍可閱讀對應文章，整合頁不重新顯示文章性質篩選。
- 本機瀏覽驗收：桌面確認收起／展開高度、靠左按鈕換行、搜尋、韓語交集 11 篇、清除、Escape、收合焦點、上一頁、重整、直接主題網址與舊文章性質網址清理；生成 HTML 未含背景遮罩或 panel lock 舊字串。headless Chrome 以 360／390px 實際視窗驗證，兩種寬度的 document/body scrollWidth 都等於 viewport，展開區為 static 且滿內容寬度，360px 時主題按鈕最右側仍在內容欄內。
- `npm run verify` 通過：內容／標籤／歌曲標籤檢查、69 項回歸測試、963 個生成檔案、348 個 HTML、42,996 個 href/src；`node --check themes/next/source/js/content-browser.js` 與 `git diff --check` 通過。未部署。
- 下一步仍為第四項「返回保留原位置」。

## 2026-09-15，移除文章性質篩選（完成，未部署）

- 開始讀值：5 小時剩餘 74%、每週剩餘 80%；期間 5 小時視窗重置後收尾讀值：99%、每週剩餘 80%。額度為帳號即時讀值，可能包含其他同時進行的任務用量。
- 內容分類頁簡化為「分類 → 該分類主題 → 文章」；移除文章性質控制、狀態、篩選與網址保存。文章原有標籤資料保留，沒有重新分配或刪除標籤。
- 主題清單只使用 `group: topic` 定義，再由公開文章資料計算目前分類實際使用的主題；不新增手動分類／標籤對照表。新增文章或修改標籤後，一般建置即可更新清單。
- `property` 網址參數會被移除並以 `replaceState` 清理；舊 property tag 不再成為整合頁的隱藏條件。獨立 `/tags/歌曲推薦/` 頁仍顯示 111 篇對應文章，沒有重新出現第三個篩選器。
- 分類按鈕與主題選擇器靠左排列，手機選擇器填滿內容欄；保留分類／主題網址、清除、上一頁與重新整理。桌面、360px、390px 均確認長標籤與文章清單不橫向溢出。
- 本機驗收：未選分類時主題停用；音樂顯示 6 個語言主題；主題搜尋不改結果；分類／主題交集、清除、返回、重整及直接標籤頁正常。
- `npm run verify` 通過：69 項回歸測試、963 個生成檔案、348 個 HTML、42,996 個 href/src；JavaScript 語法與 `git diff --check` 通過。未部署。
- 下一步仍為第四項「返回保留原位置」。
