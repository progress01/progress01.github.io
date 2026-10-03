# 雙面視覺規則（WBS 9.1–10.6）

## 共用骨架

A／profile 與 B／memory 是「同一張紙、兩種工作狀態」。兩面共用網站既有紙色基底、字體尺度、方角卡片、排版與焦點語言。文章頁維持原本中性閱讀樣式；文章不因從 A 或 B 進入而改成不同版面。

集中 token 位於 `themes/next/source/css/_custom/dual-surface-visual.styl`，由 `main.styl` 在首頁與其他客製樣式前載入。`:root` 提供共用／B 面預設，`.main-inner.index` 明確維持 B 面暖色覆寫，`.main-inner.profile-page` 只在 A 面命名空間覆寫差異色。語意 token 包含 paper、base、panel、ink、muted、border、accent、accent-strong、focus、shadow。

## 兩種工作狀態

| 面向 | 規則 |
| --- | --- |
| B／memory | 暖米紙、棕墨、陶橘重點；保留檔案盒、卡帶與紙張的既有首頁氣質，不重做 legacy 首頁。 |
| A／profile | 共用米紙底色；卡片改用冷灰藍 panel、藍灰墨色、青綠 accent，邊框與陰影更克制，呈現精準工作台。 |

Profile 標題、篩選控制、文章時間列表、空狀態、導覽與切換連結使用語意 token。首頁只在安全的 B 面語意區（目前為通往 A 面的首頁橋接列）引用 token，不機械重寫整份 `home.styl`。切換連結沿用目前路由可見的 token；A 面文章列表只顯示日期與標題，不輸出 thinking status。普通文章的 thinking status 與 post surface marker 保持中性色，不讀取 A/B token。

## 範圍與邊界

- 差異覆寫限於 `.main-inner.index` 與 `.main-inner.profile-page`。文章頁不掛 A/B route token class，也不以入口來源切換文章樣式。
- 視覺 token、首頁、profile、切換、thinking 與普通文章樣式不新增 animation/keyframes；WBS 9.2 的唯一動畫範圍是專用 `surface-transition.styl`。
- WBS 9.2 的翻面互動以原生 anchor 導航為先。只有同源、primary、無 modifier、非 download、非新分頁的目標連結會寫入最多 4.5 秒的 session intent；抵達頁以版本、目標面向、正規化 pathname 與 navigation type 比對，讀後即刪。reload、一般返回／前進、過期或不匹配的 intent 不播放。
- 動畫只作用於抵達頁 `.main-inner.index`／`.main-inner.profile-page`，時間 180ms。profile 從右側輕移入、memory 從左側輕移入，角度僅 1 度，第一幀 opacity 為 0.86；`animationend` 只負責清除 class，完全不控制導航。一般文章、focus 與 scroll 不受動畫程式影響。
- `prefers-reduced-motion: reduce` 時不寫 intent、不加動畫 class，CSS 同時關閉 animation、transition、transform。JavaScript 或 sessionStorage 無法使用時，anchor 仍按瀏覽器原生方式導航。
- 目前 PJAX 關閉，依完整頁面導航工作；安裝有全域 idempotent guard，另聽 `page:loaded`／`pjax:success` 供未來刷新，但不修改 PJAX 核心路由。動畫不處理 focus，也不代表完整 accessibility 驗收；該範圍留給 9.3。
- 9.3 才處理觸控與完整 accessibility 驗收；本文件不代表全站無障礙完成。
- 9.5 文案已定稿：A「工作與學習」、B「個人記憶庫」，保留 SIDE A／SIDE B 翻面按鍵。精確場景文字、公開邊界與內部策展欄位見[文案契約](dual-surface-copy-contract.md)；首頁不新增定位段落、摘要或額外卡片說明。
- 作者依截圖修正切換器的視覺語意：右上切換仍是同一個原生連結與原文案，只保留卡帶裝飾，卡帶字母與既有 SIDE A／SIDE B 目的面文案一致（A 頁顯示 B、B 頁顯示 A）；不再顯示造成衝突的目前面 badge。卡帶標成 `aria-hidden`，不改連結可讀名稱；輪廓以 CSS 漸層畫出。配色取自既有 surface tokens，不新增點陣圖片、動畫、路由或狀態；最小點擊尺寸、focus-visible 與 reduced-motion 規則維持原狀。
- A 面導覽使用繁中 UI sans stack、合宜字重與行高、圖示文字間距及至少 48px 點擊列。`/` 與 `/profile/` 呈現日期、標題與原 URL 的單欄文章清單，清單上方有直接輸入的標題／標籤搜尋欄；沿用 warm-paper／ink／teal tokens，連結與輸入欄提供 focus-visible。390px 手機時日期與標題改為上下排列，document/body 不得水平溢出。首頁不顯示熱力圖、月份導覽、摘要、標籤或圖片。`/profile/articles/` 保留完整日期序文章庫；B 面及文章正文／分類／路由不在此視覺調整範圍。
- A 面 tag 篩選 controls 僅出現在 `/profile/articles/`，初始隱藏，只有 JS 初始化成功後才顯示；無 JS 時完整列表仍可讀。按鈕維持原生鍵盤操作與 `aria-pressed` 狀態；PJAX 成功後初始化新列表節點。列表不因選取標籤更換文章 URL。封面不載入照片或新 bitmap、不使用動畫，沿用 warm-paper／ink／teal tokens。

## WBS 9.3 已驗證準則

- 全站 body 起始提供「跳到主要內容」連結，指向唯一 `#main-content`；目標是既有 `.main-inner` 且 `tabindex="-1"`，不另加 main landmark。焦點時連結明顯出現，位於文件頂端，不遮住面向切換控制。focus／skip 樣式不含動畫或轉場。
- A/B 切換與首頁橋接可點擊盒至少 44×44 CSS px；profile 卡片維持可見 focus-visible 輪廓。A/B 導覽使用原生 anchor，翻面導航不由 JavaScript 攔截。
- 既有 NexT `role="button"` header／sidebar 控制補上 Tab 焦點與 Enter、Space 鍵盤觸發；Space 在 keyup 只觸發一次。焦點輪廓可見，控制名稱非空。內容中的原生 links／buttons 與主要 landmark、heading、ARIA ID 參照由來源及隔離輸出檢查。
- Reduced motion 不記錄翻面 intent、不加翻面 class；surface transition animation／transition duration 為 0，transform 為 none。首頁、profile 卡片既有 reduce 規則一併保留。
- 一般文章的「文章收錄面向」與 thinking aside 有名稱，位於正文前；維持中性文章樣式。A/B 核心旅程以生成輸出與瀏覽器實測核對可見文字對比、focus、順序及溢出。
- 驗收範圍是 `/`、`/profile/`、`/profile/articles/`、首頁橋接、profile cards 與代表性一般文章。不代表所有歷史文章、任意文章內容或第三方 widget 已全面符合 WCAG；其他響應式細節留在 WBS 9.4，文案依 WBS 9.5 契約驗收。

## WBS 9.4 響應式驗收

- 隔離建置以 1280×900、768×1024、375×812 檢查 `/`、`/profile/`、`/profile/articles/` 與一般文章 `/work/flow-friendly-work-system/`，共 12 組。每組量測 document、body、main 的 scroll width、switch 與主要卡片矩形；document/body/main 均未超出 viewport，switch 保持在視窗內並與後續內容分開，卡片留在其容器內。768px 保留 sidebar/main 與兩欄 profile；375px profile 改單欄，首頁 random、DJ、四入口、bridge 與完整文章清單均在版面內。
- 長內容 fixture 只注入隔離瀏覽器 DOM，不改正式文章或資料；在 375px 與 768px 覆蓋 80 字以上中文標題、無空格 Latin 字串、長 surface switch label、thinking boundary、profile card title 與首頁 random title。核對 computed white-space、overflow-wrap、scrollWidth/clientWidth、scrollHeight/clientHeight，以及 line-clamp、text-overflow、overflow hidden；文字完整可折行，沒有水平溢出或截字。`overflow:hidden` 僅保留於首頁 random 視覺圖像容器及收尾裝飾線稿，不裁切文字。
- 空狀態 fixture 同樣保留模板 class 與編譯 CSS，覆蓋 profile path（保留 section heading、空清單）、最近學習與完整文章清單既有 empty state；兩個 viewport 下均可見、沒有重疊或溢出。正式模板不新增文案或資料。
- 集中規則 `surface-responsive.styl` 在既有元件樣式後載入：profile 首頁清單在手機改為單欄日期與標題；首頁正式 template 的 `.home-landing-entry-grid` 在 767px 維持雙欄、430px 收為單欄，延續 `home.styl` 原有 900／430px 行為。長內容容器使用 min-width:0、overflow-wrap:anywhere、minmax(0,1fr)，元件高度由內容決定；不改導航契約、文章、URL、動畫或文案。`check:surface-responsive` source contract 與輸出檢查涵蓋正式 template／CSS selector 一致、3 個核心頁、一般文章 hook、viewport metadata、空狀態模板 hook；反例測試拒絕錯字 selector、overflow hidden、截字／clamp、固定高度、nowrap、文件水平溢出及 absolute/fixed switch。
- Headless Chrome 證據存於 `tmp/wbs94-browser-evidence.json`；桌機、平板、手機首頁截圖以及 long／empty fixtures 截圖均留在 `tmp/wbs94-*.png`。測試含手機 reduced motion、no-JS skip/switch 鍵盤導航與 focus 位置，瀏覽器 console error/warning 為 0。
- 範圍只涵蓋以上真實路由、代表文章及合成 fixture；不宣稱所有歷史文章任意內容、第三方嵌入或外部 widget 全面 responsive。WBS 9.5 文案及輸出驗收通過後，9.1–9.5 均符合，G9 通過。
