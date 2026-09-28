# 雙面部落格路由與內容樣本（WBS 0.2）

盤點日期：2026-09-25（Asia/Taipei）
工作包：WBS 0.2「路由與內容樣本」
依據：[施工基準與 Git 快照](dual-surface-blog-baseline.md)、目前 `source/`、`_config.yml`、`themes/next/_config.yml` 及既有 `public/` 生成檔。沒有執行建置。

本文件中的「A 面候選」「B 面候選」「雙面候選」都是**規劃驗收角色**，只用來設計未來測試；不代表作者已核准分類，也沒有將 `surfaces` 寫入任何文章。所有 URL 均為目前路由基準；`/profile/` 除外，該路由尚不存在。

## 路由基準

| 路由／操作 | 目前來源與可核對狀態 | 現況用途與未來驗收用途 |
| --- | --- | --- |
| `/` | `themes/next/layout/index.njk`；現有生成檔 `public/index.html` | 作者日常首頁，主區塊是隨機文章與點播入口，另有首頁文章列表。未來驗收 B 面仍以記憶探索為主，且直接進入根網址。 |
| `/random/` | `source/random/index.md`；`public/random/index.html` | 隨機傳送門，依分類抽文章。未來驗收只抽合格 B 面內容，分類篩選和現有最近抽取避重行為不退化。 |
| `/archives/` | Hexo archive 生成器與 `themes/next/layout/archive.njk`；`public/archives/index.html` | 全部文章時間清單。未來驗收確認完整文章入口及文章單一網址。 |
| `/categories/` | `source/categories/index.md`、`themes/next/layout/page.njk` 及 `_partials/content-browser.njk`；`public/categories/index.html` | 分類與文章瀏覽入口。未來驗收檢查面向篩選不破壞既有分類、標籤與網址條件。 |
| `/reading-log/` | `source/reading-log/index.md`；`public/reading-log/index.html` | 生活索引與收藏入口。未來驗收保留 B 面生活探索用途。 |
| `/reading/` | `source/reading/index.md`；`public/reading/index.html` | 草稿夾／學習題目索引。未來驗收確認題目可回到其文章，且加入日期不被誤當文章發表日期。 |
| `/photos/` | `source/photos/index.md`；`public/photos/index.html` | 記憶圖牆。未來驗收保留 B 面圖像探索與既有連結。 |
| `/calendar/` | `source/calendar/index.md`；`public/calendar/index.html` | 文章發表日熱力圖。未來驗收需保留其日期語意，不將發表日描述成事件實際發生日。 |
| `/status/` | `source/status/index.md`；`public/status/index.html` | 碎碎念清單；每筆以來源 `id` 設定 DOM id，可用 `#<id>` 定位。未來驗收 ID 穩定、可直接定位且來源仍只公開作者核准內容。 |
| 搜尋（無獨立路由） | `themes/next/layout/_partials/header/menu.njk` 顯示搜尋按鈕；搜尋視窗在 `_partials/search/index.njk`；`local-search.js` 處理點擊及 Ctrl+K／Cmd+K | 搜尋是全站覆層操作，不是獨立頁面。未來驗收不同面向預設範圍、全部公開內容切換及雙面文章去重。 |
| `/profile/` | 規劃中的履歷入口；目前 `source/profile/index.md`、`source/profile.md`、`public/profile/index.html` 均不存在 | 尚不可開啟，不能當作現行路由驗收。未來建立後才測 A 面直達及 A/B 切換。 |

以上列出的目前入口對應生成檔在本次唯讀檢查時均存在。這只證明本機現有 `public/` 快照可核對；不代表重新建置或線上部署已驗證。

## 固定內容樣本

### 規劃驗收角色：A 面候選文章

- 樣本：「需求不是功能清單：從真實工作拆出系統該做的事」
- 來源：`source/_posts/實驗室/工作知識-從實際抽象功能一-先從真實工作問出系統該做什麼.md`
- 目前 URL：`/work/from-real-work-to-features/`（front matter 明列 permalink；本機 `public/work/from-real-work-to-features/index.html` 存在）
- 日期：`date: 2026-09-17 12:00:00`，文章發表日期；`updated: 2026-09-17 15:12:14`，文章更新日期。
- 現況用途：工作知識文章；分類「工作知識」，有系列、封面及 `work_knowledge` 欄位。沒有 `surfaces` 欄位。
- 未來驗收用途：作為 A 面文章卡到原文章 URL 的候選；檢查標題、分類與原文日期保留。是否納入 A 面仍待作者核准。

### 規劃驗收角色：B 面候選文章

- 樣本：「歌曲推薦-sailing back to you」
- 來源：`source/_posts/歌曲推薦/歌曲推薦-sailing back to you.md`
- 目前 URL：`/2026/09/01/歌曲推薦/歌曲推薦-sailing%20back%20to%20you/`（來源未自訂 permalink；既有生成檔 canonical 對應此路徑，本機文章 HTML 存在）
- 日期：`date: 2026-09-01 12:00:00`，文章發表日期；沒有 `updated` 欄位，因此更新日期未知。
- 現況用途：音樂分類中的韓語歌曲推薦，有歌曲連結與封面。沒有 `surfaces` 欄位。
- 未來驗收用途：作為 B 面隨機記憶候選；確認原歌曲文章 URL、封面與音樂分類資訊不變。是否納入 B 面仍待作者核准。

### 規劃驗收角色：雙面候選與 learning 去重配對

- 文章樣本：「42 天網站測試學習計畫：從需求檢核到上線驗證」
- 文章來源：`source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md`
- 文章 URL：`/learning/website-quality-testing-roadmap/`（front matter permalink；本機 `public/learning/website-quality-testing-roadmap/index.html` 存在）
- 文章日期：`date: 2026-09-04 12:00:00` 是發表日期；`updated: 2026-09-17 14:59:00` 是文章更新日期。文章自述為持續進行的學習路徑。
- reading-desk 配對：`source/reading-desk.yml` 的 topic `website-quality-testing`，item `reading-topic-07`，標題「網站品質與軟體測試：42 天鐵人挑戰學習路徑」，`url` 同為 `/learning/website-quality-testing-roadmap/`，`date: 2026-09-04`。
- 日期語意：`reading-desk.yml` 檔頭註明 `date` 是加入草稿夾的日期；它不是文章發表日。此筆恰巧與文章發表日期同日，不應把兩欄視為同一事件。
- 現況用途：文章是一筆已發布文章；learning item 是草稿夾／學習索引對同一文章的附註引用。兩者目前均沒有 `surfaces` 欄位。
- 未來驗收用途：雙面候選（角色而非已核准分類），同時是文章與 learning data 去重樣本。依目前 `tools/lib/navigation-index.js`，同網址的 learning item 會合併到文章紀錄並追加學習事件，不另產生第二個文章結果。未來應驗收文章仍只有一個 URL／一筆搜尋結果，保留 learning 附註和「加入學習」日期語意；是否列入 A、B 或兩面待作者核准。

### 規劃驗收角色：站務文章

- 樣本：「部落格改版規劃」
- 來源：`source/_posts/部落格改版規劃.md`
- 目前 URL：`/2026/01/25/部落格改版規劃/`（本機生成文章 canonical 對應此路徑，文章 HTML 存在）
- 日期：`date: 2026-01-25 01:22:38` 是發表日期；`updated: 2026-09-17 14:28:38` 是更新日期。
- 現況用途：分類為「站務」、標籤「站務規劃」。隨機產生器會略過站務分類；文章仍可由文章 URL 與一般文章清單存取。沒有 `surfaces` 欄位。
- 未來驗收用途：確認站務文章不因 A/B 索引而被誤納隨機抽籤；其是否在某入口可被瀏覽需依作者核准的範圍規則判定，不在此預先分類。

### 規劃驗收角色：microblog 碎碎念

- 樣本：`micro-56bb6eec75c50bcd`，內容開頭「我願意把事情做到最好，但一個很完整的成果，如果沒有被使用……」
- 來源：`source/microblog.json`，來源 `id` 為持久識別；`source/status/index.md` 將它設為文章 DOM id。
- 目前 URL／錨點：`/status/#micro-56bb6eec75c50bcd`。`/status/` 會載入 `microblog.json`，依 hash 找到 id 並展開、捲動至該筆。
- 日期：來源 `date: 2026-09-13`，是紀錄日期；不是文章發表日期。來源 `tag` 為「💭」。
- 現況用途：公開碎碎念清單紀錄；搜尋索引亦以該 id 做紀錄識別。此樣本沒有 `surfaces` 欄位。
- 未來驗收用途：檢查面向調整不重算或改寫既有 id，仍可透過相同 URL 錨點直達。任何公開範圍判斷必須以作者確認為準。

### 規劃驗收角色：reading-desk 學習題目

- 樣本：`reading-topic-07`（topic `website-quality-testing`，「網站品質與軟體測試」）
- 來源：`source/reading-desk.yml`，`url` 指向 `/learning/website-quality-testing-roadmap/`，與上方文章樣本配對。
- 目前 URL：`/learning/website-quality-testing-roadmap/`；草稿夾入口 `/reading/` 顯示題目索引；目前生成檔有對應文章頁。
- 日期：item `date: 2026-09-04` 是加入草稿夾日期（檔頭定義）；文章的 `date` 是發表日期，`updated` 是更新日期。若未來其他 item 缺 `date`，不得推算加入日期。
- 現況用途：持續整理中的學習題目，帶有 `state: learning` 和學習附註；索引器可將它併入目標文章。
- 未來驗收用途：確認草稿夾仍可呈現題目及附註，點擊回到唯一文章 URL，搜尋去重且日期標示為「加入學習」。不得從它自動推定文章的 A/B 資格。

## 不確定欄位與使用限制

- 所有上述文章樣本目前均未設定 `surfaces`；不得把本文件的角色名稱當作已寫入或已核准的分類。
- `/profile/` 尚無來源頁或生成頁，沒有既有 URL、文章日期或頁面行為可做現況比較。
- 歌曲文章未提供 `updated`；其更新日期未知，不以檔案時間或 Git 時間代替。
- `reading-desk` 的日期是加入日期；不能拿它補齊文章缺失的發表／更新日期，也不能反推實際開始學習日。
- 本機 `public/` 是當時可用的生成快照。未重建，因此不把它當成目前來源內容重新建置後的證據，也不推論線上部署狀態。
- 沒有推定任何 microblog 或學習題目的隱私狀態；A/B 都是公開呈現面向，公開資格仍須按後續 WBS 邊界審查由作者決定。
