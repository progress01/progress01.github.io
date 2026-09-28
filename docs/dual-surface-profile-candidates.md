# `/profile/` 候選文章盤點（WBS 3.1）

日期：2026-09-26
狀態：WBS 3.2 作者已核准；WBS 3.3 已將八項決策套用至指定文章 front matter；WBS 3.4 已新增首頁策展資料；WBS 3.5 驗證器與測試通過。最終定位句、視覺與對外文案仍待 WBS 5.1。

依作者在 2026-09-26 明確回覆「採用 3.1 建議，繼續施工」，本文件記錄了 WBS 3.2 核准分類。`/profile/` 是工作與學習入口，`/` 繼續作為個人記憶庫與隨機探索入口；非 microblog 內容仍是公開內容，A/B 只影響呈現與收錄，不代表隱私。每篇文章仍維持一個來源、一個 permalink；「雙面」是同篇文章被兩面入口引用，不是複製文章。

## 建議的三條長期路徑（工作標籤，非首頁定稿）

1. **從真實情境釐清需求**：先理解工作目標、使用者與資料，再形成可討論／可驗證的需求。
2. **把風險轉成品質與交付檢查**：定位資料流、找出風險、定義驗收或測試證據。
3. **讓工具與知識服務工作流程**：把溝通、學習或工具構想整理成有邊界、可試行的流程。

## 作者核准的 8 篇 A 面資格候選

以下「核准面向」是作者對 A 面資格池的決定，已依 WBS 3.3 寫入 front matter。首頁代表欄的四篇已核准為 3.4 首頁候選，不代表已決定首頁最終順序或文案。

| 來源／穩定路徑 | permalink、標題、日期 | 候選路徑與正文證據 | 履歷讀者可理解的價值 | 風險／需補強 | 核准面向；首頁代表候選 |
|---|---|---|---|---|---|
| [`source/_posts/實驗室/工作知識-從實際抽象功能一-先從真實工作問出系統該做什麼.md`](../source/_posts/實驗室/工作知識-從實際抽象功能一-先從真實工作問出系統該做什麼.md) | `/work/from-real-work-to-features/`；「需求不是功能清單：從真實工作拆出系統該做的事」；2026-09-17 | 路徑 1。正文把情境、期待結果、系統行動與功能名稱分開，並要求會前先辨識缺少的資訊、不要把假設當驗證結論。 | 顯示能從實際工作描述整理出需求討論材料，而不是直接跳到功能名詞。 | 系列仍待補更多可重複案例與邊界；即使已去識別，仍需作者確認工作脈絡呈現舒服。 | 核准 `profile`；是，首頁候選。 |
| [`source/_posts/實驗室/工作知識-從實際抽象功能四-隱性規則與風險式補審.md`](../source/_posts/實驗室/工作知識-從實際抽象功能四-隱性規則與風險式補審.md) | `/work/risk-based-review/`；「專案做到一半才發現隱性規則，該怎麼補審？」；2026-09-17 | 路徑 2。以決策原因、資料來源、權責、前置條件、失敗退路和交付證據形成補審問題，主張依風險補足而非全部重做。 | 能說明如何把新發現的條件轉成有限且可追溯的檢查。 | linked learning note 指出仍待補風險分級實例；避免讓讀者誤會已有完整實證框架。 | 核准 `profile`；是，首頁候選。 |
| [`source/_posts/實驗室/工作知識-API需求排查紀錄.md`](../source/_posts/實驗室/工作知識-API需求排查紀錄.md) | `/work/api-requirement-troubleshooting/`；「API 資料異常怎麼排查？從一筆錯誤追到資料來源」；2026-09-03 | 路徑 1／2。正文沿外部來源、後台、排程、API 到前台追資料，要求先保留異常原始狀態，再比對已知異常項目。 | 提供具體的資料流診斷順序，展示跨層定位與證據留存。 | 為去脈絡化工作知識，沒有公開系統／原始測試素材；不要讀成某特定系統的可驗證案例。 | 核准 `profile`；是，首頁候選。 |
| [`source/_posts/實驗室/工作知識-把官網改版包裝成遊戲.md`](../source/_posts/實驗室/工作知識-把官網改版包裝成遊戲.md) | `/work/gamifying-website-redesign/`；「官網改版適合做成遊戲嗎？先驗證探索是否真的有價值」；2026-02-26 | 路徑 1。正文從改版宣傳想法拆出訪客任務、實際網站行為、無障礙替代、維護成本及最小原型驗證；明確標示想法未採用、未驗證。 | 顯示能把新手的模糊點子轉成可檢查假設與低成本驗證順序。 | 未採用、無成果數據；涉及組織網站情境，作者需再確認去識別程度；只能作思考／提案能力，不可包裝成已交付產品。 | 核准 `profile`，需「構想／未驗證」狀態；否，較適合完整清單。 |
| [`source/_posts/實驗室/工作知識-簡報不是功能清單.md`](../source/_posts/實驗室/工作知識-簡報不是功能清單.md) | `/work/presentation-as-mental-model/`；「功能簡報怎麼寫？先讓聽眾看懂事情如何完成」；2026-07-09 | 路徑 3。正文將簡報順序由工具清單改成工作情境、阻力、流程、工具／人工分工、例外與行動，並要求完整排練。 | 可讓讀者看見資訊架構、受眾視角與交付溝通方法。 | 是方法整理，不含簡報成品或成效證據；正文提及網站檢核工具情境，仍應保持「方法反思」而非成果宣稱。 | 核准 `profile`；是，首頁候選。 |
| [`source/_posts/實驗室/工作知識-讓工具服務心流.md`](../source/_posts/實驗室/工作知識-讓工具服務心流.md) | `/work/flow-friendly-work-system/`；「用三個工作狀態，讓工具支援心流」；2026-05-28 | 路徑 3。正文區分發想、可行動卡片、專注工作區與事後回收，另提出兩週最小實驗及觀察指標。 | 呈現以使用者工作狀態切分需求、降低流程摩擦的系統思考。 | 作者自述仍是待驗證的工作方式；不像已完成工具或實驗結果。 | 核准雙面 `profile`+`memory`；否，較適合次層。 |
| [`source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md`](../source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md) | `/learning/website-quality-testing-roadmap/`；「42 天網站測試學習計畫：從需求檢核到上線驗證」；2026-09-04 | 路徑 2。正文列出 42 天／6 單元、每日產物與過關條件、測試主題邊界；並明確說目前是系統性學習，未宣稱已有完整 QA 實作經驗。 | 讓讀者看到學習計畫有範圍、產物與自我校準，不把接觸當熟練。 | 進行中；只有計畫不等於能力證據。若上首頁需顯示進度狀態及最近校準日，最好待有實作產物再提升權重。 | 核准 `profile`（明示進行中）；否，先放完整清單。 |
| [`source/_posts/實驗室/AI提問判斷順序-情境目標與問題類型.md`](../source/_posts/實驗室/AI提問判斷順序-情境目標與問題類型.md) | `/learning/ai-question-judgment-order/`；「向 AI 提問前，先分清楚情境、假設與任務」；2026-09-08 | 路徑 3。正文區分可觀察情境／目標／限制與原因假設，將提問分為診斷、設計、驗證，並主張以輸出測試而非模板取代判斷。 | 能展示把模糊問題轉成可分析、可比較、可驗證任務的知識整理能力。 | 進行中且大量參考外部材料；需要維持引用清楚、與實際練習分開，不暗示方法已被長期驗證。 | 核准 `profile`（明示進行中）；否，先放完整清單。 |

**核准集合：** 八篇全部進入 A 面資格／審核池，並對應三條工作標籤；QA 路徑與 AI 提問兩篇只進完整清單，需清楚標示「進行中」。首頁候選限於標「是」的四篇；3.4 再核准各路徑代表篇、順序與文案。七篇是 profile-only，`讓工具服務心流` 是雙面；面向只控制公開入口、搜尋與清單收錄，不改變文章公開狀態。已寫入的 YAML 值為 `surfaces: [profile]` 或 `surfaces: [profile, memory]`，不得填入字串 `both`。

## 工作知識系列七篇逐篇審查

七篇是同一批工作知識系列的連續文章，不能因為都屬工作分類便整批納入 A 面。以下是相對於上表八篇的建議：

| 系列 | URL | 判斷與差異 |
|---|---|---|
| 01 先從真實工作問出系統該做什麼 | `/work/from-real-work-to-features/` | **主候選**：最直接支撐路徑 1，做為系列入口比把七篇都列首頁有效。 |
| 02 把會議逐字稿變成判斷模型 | `/work/meeting-transcripts-to-judgment-model/` | **備選**：把修正、會議比較轉成判斷順序；與 01 的需求抽象、04 的檢查問題重疊，另需補可重複的整理範例。 |
| 03 同一份規劃為什麼會被看成兩種工作 | `/work/two-project-mental-models/` | **暫緩**：執行與審查視角差異有價值，但較聚焦角色摩擦／審查模型，與 01、04、05 的交集大，作為履歷首批代表容易令焦點偏向內部互動。 |
| 04 現在才發現隱性規則，還要不要補審 | `/work/risk-based-review/` | **主候選**：系列中最清楚把風險、補審範圍和交付證據連起來；須標示風險分級實例尚待補足。 |
| 05 把主管要求拆成可遷移能力 | `/work/transferable-project-capabilities/` | **備選**：能力面向涵蓋追溯、依賴、證據與協作，但偏總結框架，和 01／04／07 重疊，尚需對應到具體練習或交付。 |
| 06 外掛導師的雙軌工作法 | `/work/ai-external-mentor-dual-track/` | **暫緩**：人機分工及未知問題有路徑 3 潛力，但仍偏概念、缺失敗案例；與 AI 提問筆記及工具心流文重疊。 |
| 07 先補 PM／SA 的基本語言 | `/work/pm-sa-foundation-map/` | **暫緩**：Scope、WBS、依賴、里程碑、交付／DoD、甘特與風險的詞彙地圖可當學習索引，但個人實作證據不足，且與 01／05 重疊。 |

系列七篇各自有 linked learning item `reading-topic-17` 至 `reading-topic-23`；它們在閱讀台中 `state: learning`，對應文章 URL 相同，日期是加入閱讀台的日期，不應當作文章發布日期。此關聯用來追蹤學習狀態，不代表每個 linked item 另成一張代表作卡。

## 備選，以及不建議先放 A 面的邊界樣本

- **備選：** 系列 02、系列 05（見上表）；另可考慮 `/work/content-publishing-and-tables/`，正文拆解 HTML、CSS、表格結構與附件權限，與 API 排查一樣屬多層排查，首批同時收容易重複；若作者更想呈現內容維運，可用它替換 API 候選。
- **暫不推薦首頁但仍公開：** `/work/local-video-cutting-helper/` 是未完成本機工具構想，沒有環境相容／資安驗證；`/work/rental-management-dashboard-idea/` 是未導入的個別使用者介面構想，原文已去識別但涉及第三方工作情境且缺正式保存、權限及交付驗證。兩者可作記憶／方法探索，不應寫成已交付成果。
- **學習型次層而非首屏代表：** CMS 內容模型、Agentic Transaction、GEO／研究整理、open-slide 簡報學習等多為研究或進行中筆記，現有內容能顯示學習方法，但尚不足以單獨證明實務熟練；須按每篇自身成熟度看待，不能由學習分類或篇幅自動入選。
- **個人興趣／敏感脈絡樣本：** 家人健康／疼痛改善筆記含健康脈絡；排球技巧筆記是個人興趣與持續學習。它們可繼續是公開記憶庫的一部分，但不是履歷入口預設的代表案例。
- **linked reading item 的規則：** 閱讀台只是索引或摘要，若正文是同一篇文章，不增加第二個候選 URL；standalone note 若只有來源摘記、沒有作者自己的方法、產物或可說明的學習價值，也不因為有獨立 ID 就自動推薦到 A 面。

## 路由、來源與 learning 配對核對

- 八篇推薦候選的來源檔存在；逐篇核對 front matter 的 `title`、`date`、`permalink`，日期與本表相符。
- 八個 URL 互不重複，且均可在目前 fresh 輸出 `tmp/wbs24-public-20260926/<permalink>/index.html` 找到；路由檔存在只證明可開啟，不代表面向已核准。
- linked 配對：系列 01 ↔ `reading-topic-17` ↔ `/work/from-real-work-to-features/`；系列 04 ↔ `reading-topic-20` ↔ `/work/risk-based-review/`；測試路徑文章 ↔ `reading-topic-07` ↔ `/learning/website-quality-testing-roadmap/`；AI 提問文章 ↔ `reading-topic-15` ↔ `/learning/ai-question-judgment-order/`。配對 URL 相同，desk item 的日期語意為收錄日期。
- 八篇均為文章／學習文章候選，沒有引用已退役的 V microblog `micro-b66fecaa3574c31a`；本輪未使用 microblog 作為 A 面證據。
- WBS 3.1 階段所有分類均為人工待核准建議，當時未改 front matter；其後的 WBS 3.2／3.3 決策與實際套用結果記錄於下方。本輪沒有改首頁策展資料或文章正文。

## WBS 3.2 作者核准紀錄

作者核准原話：「採用 3.1 建議，繼續施工。」依 3.1 建議落實如下，沒有採用未核准的推測：

| 穩定來源 | permalink | 核准決策 | 3.4 首頁候選 |
|---|---|---|---|
| `source/_posts/實驗室/工作知識-從實際抽象功能一-先從真實工作問出系統該做什麼.md` | `/work/from-real-work-to-features/` | `profile` | 是 |
| `source/_posts/實驗室/工作知識-從實際抽象功能四-隱性規則與風險式補審.md` | `/work/risk-based-review/` | `profile` | 是 |
| `source/_posts/實驗室/工作知識-API需求排查紀錄.md` | `/work/api-requirement-troubleshooting/` | `profile` | 是 |
| `source/_posts/實驗室/工作知識-把官網改版包裝成遊戲.md` | `/work/gamifying-website-redesign/` | `profile` | 否；A 面完整清單候選，須表明構想未驗證 |
| `source/_posts/實驗室/工作知識-簡報不是功能清單.md` | `/work/presentation-as-mental-model/` | `profile` | 是 |
| `source/_posts/實驗室/工作知識-讓工具服務心流.md` | `/work/flow-friendly-work-system/` | `profile`, `memory`（雙面） | 否；保留在記憶庫並可進 A 面完整清單 |
| `source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md` | `/learning/website-quality-testing-roadmap/` | `profile`；完整清單需顯示「進行中」 | 否 |
| `source/_posts/實驗室/AI提問判斷順序-情境目標與問題類型.md` | `/learning/ai-question-judgment-order/` | `profile`；完整清單需顯示「進行中」 | 否 |

三條工作標籤核准沿用上方名稱與文章映射。系列 02（`/work/meeting-transcripts-to-judgment-model/`）與系列 05（`/work/transferable-project-capabilities/`）保留為備選，不進首批；系列 03、06、07 及其他候選暫不進首批。這些暫緩不代表私人或下架，仍依既有公開來源處理。`profile` 單面文章仍可由原 permalink 直接公開開啟，但不進 B 面清單／隨機；雙面文章仍只有一份正文、一個 URL。A/B 不是隱私邊界。

## WBS 3.3 套用結果

- 只在上述 8 個來源的 front matter 新增 `surfaces`：七篇 `surfaces: [profile]`，`/work/flow-friendly-work-system/` 為 `surfaces: [profile, memory]`。實際修改檔案清單即上方作者核准表的八個穩定來源。
- 未修改正文、title、date、updated、permalink、categories、tags、其他既有 front matter 欄位或 `source/reading-desk.yml`。兩筆進行中學習文章原有 `learning_status: 進行中` 保留。
- 逐檔將新增 surface 行移除後與施工前 `HEAD` bytes 完整比較，八檔全數相同；其他 front matter hash 與正文 hash 均一致。解析後每檔恰有一個精確合法值，8 個 permalink 唯一且 fresh build 路由存在。
- 驗證：`node --test tools/tests/content-surfaces.test.js` 9/9；`npm run check:content` 通過（5 類別、21 則 microblog、225 圖牆路徑）；`npm run test:regression` 93/93；`node tools/assign-microblog-ids.js` 預覽為 0 個待補 ID；目前 `public/` 與 fresh build 均通過 public boundary checker（433 個文字檔，舊文／V ID 0 命中，D replacement 各 2 個路徑）。fresh build 位於 `tmp/wbs33-public-20260926/`，建置前在同一執行程序驗證 Hexo `public_dir` 指向該工作區暫存路徑，產生 1004 個檔案，沒有執行 clean；既有 `public/` 未作為本次建置目標。
- WBS 3.4 資料位於 [`source/_data/profile-home.yml`](../source/_data/profile-home.yml)：三條核准路徑共列八篇，各 URL 一次；四篇 `featured` 沿用作者核准的首頁候選，其餘為 `supporting`。`status` 明確區分已發布方法筆記、未驗證構想、待驗證工作方式與進行中學習，未宣稱未完成成果。 `copyStatus: working/5.1-pending` 表示路徑描述、selection reason 與 reader value 都只是內容結構草稿，最終定位句／視覺文案留待 WBS 5.1。

## WBS 3.5 策展資料驗證器

- 新增 `tools/profile-home-check.js` 與 `tools/tests/profile-home-check.test.js`，並加入 `npm run check:profile-home`；`npm run verify` 會在其他內容檢查前執行它。檢查器唯讀，不輸出文章正文。
- `profile-home` schema v1 明確固定 `schemaVersion: 1`、`copyStatus` 為 `working/5.1-pending` 或 `approved/5.1`、三條路徑、6–10 個唯一 URL、四個 featured。每條路徑需有唯一 kebab-case ID、非空標題／working description 和非空 items；item 的 role、status、selectionReason、readerValue 都必須有效。
- URL 依既有 `normalizePostUrl` 正規化規則與 `_posts` 的 permalink 對照；只接受唯一已發布文章，排除 draft/page/microblog、不存在與多重 permalink。profile 資格透過共用 `normalizeSurfaces` helper 判斷，不另訂 surface 規則。
- 驗證器錯誤只輸出 code、來源 path 與 URL（若可用），不輸出文章正文或匹配內容。測試以隔離物件 fixtures 覆蓋合法資料、YAML/schema 錯誤、path ID/count、item count、重複／非正規／缺失／多重／未發布 URL、page/microblog/draft、不含 profile、錯誤 surfaces、role/status、空文案及診斷不洩漏。
- 本輪沒有修改 `profile-home.yml`、文章、surfaces、page、generator、template、CSS 或 UI；沒有建置或部署。G3 達成：作者核准的資格與首頁候選有可重跑且通過的機械驗證；此結論不表示 `/profile/` 頁面已建成。下一步是 WBS 4.1 統一索引加入 surface。
