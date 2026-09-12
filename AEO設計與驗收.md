# AEO 設計與驗收

建立日期：2026-09-11；追補驗收日期：2026-09-12。本文件把本輪確認的設計與驗收方式寫清楚；它不代表已找回早期對話的完整需求清單，也不把 AI 引用當作可保證交付的功能。

## 本站的設計目標

讓知識文章的核心主張、依據、適用範圍及更新狀態容易核對；讓文章的 HTML、網址與結構化資料描述同一份內容。保留個人網誌的寫作目的，不讓 AEO 改寫作者經驗或強迫所有文章採用固定格式。

Google 對 AI Overviews／AI Mode 沿用既有搜尋基礎，沒有額外必需的特殊 Schema 或 AI 文字檔；可被抓取與索引也不等於必定被呈現。這項說明適用於 Google 的上述功能，不推定所有答案引擎有相同規則。[Google AI features 文件](https://developers.google.com/search/docs/appearance/ai-features)

## 採用的規則

| 層面 | 本站做法 | 驗收方式 |
| --- | --- | --- |
| 內容入口 | 知識文章依目的早說核心問題或主張，保留自然敘述 | 閱讀文章開頭能判斷它在回答什麼；不要求日記或歌曲心得套用 |
| 證據與推論 | 區分作者觀察、推論及尚待驗證的假說；可查核技術與時效主張引用實際讀過的原始來源 | 人工核對主張與來源，不用關鍵字或 FAQ 數量代替判斷 |
| 適用範圍 | 只在影響理解或實際使用時補條件與例外 | 不把單一工作案例直接推成普遍規律 |
| 網頁與 metadata | 原始日期及 URL 穩定，實質修訂更新時間；摘要與正文一致 | 來源 diff、生成 HTML、canonical 及日期核對 |
| 結構化資料 | 沿用 BlogPosting／WebSite／CollectionPage／WebPage；文章與網站已有 @id 與 isPartOf 關聯 | 本站回歸測試與 site-check；規則詳見 JSON-LD 手冊 |
| 作者與主題 | 以現有真實作者、分類和標籤描述內容；分類導覽與實體關係分開考量 | 僅當有具體內容、可靠識別與維護需求時，再設計額外關係 |
| 可發現性 | 文章正文存在於 HTML，文章 URL 可由內部連結與 sitemap 找到 | 本地檔案與連結核對；正式站另查 HTTP 與搜尋引擎狀態 |

目前沒有證據要求為本站新增 FAQPage、llms.txt 或把所有標籤自動轉成 `about` 實體。`sameAs` 也不能拿來表示一般相關連結或推定作者權威。這些欄位不列為本輪的欠缺功能；有具體需求再按語意及實際內容評估。

Schema.org 提供類型與屬性的資料模型；JSON-LD 的識別符與關係描述不是內容真實性或權威性的認證。[Schema.org Data model](https://schema.org/docs/datamodel.html)、[W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)

## 本輪交付

- 修訂既有〈討論 GEO 篇一〉，保留原標題、原始發表日期與生成網址；保留涵攝比喻，釐清語意描述與實際搜尋／生成結果的界線。
- 在 reading-desk-update 與 work-knowledge-blog-update 加入精簡知識內容規則，兩份已備份、安裝及正式驗證；agents/openai.yaml 維持原樣。
- 完成技術檢查與知識文章抽樣，具體結果在下方驗收紀錄。

SKILL 備份：`C:\Users\111\AppData\Local\Temp\codex-blog-aeo-skills-backup-9ce58097802d4166be18ce164bc313a1`。

## 驗收紀錄

- `npm run verify` 成功：34 項回歸測試、937 個生成檔案、327 個 HTML、32,043 個 href／src 檢查通過。
- 243 篇文章全數列入本地 sitemap；文章頁未發現 robots meta 的 noindex／nosnippet 指令。這不涵蓋正式站伺服器回應標頭或搜尋引擎端索引狀態。
- GEO 文章原始日期維持 `2026-04-06T17:00:00+08:00`，實測修訂時間為 `2026-09-11T18:54:03+08:00`；生成 canonical 維持原網址。
- 主代理比對文章正文：其他 242 篇的文字、連結與圖片維持一致；全體文章檔案集合、canonical 及發表時間不變。此比對排除網站共用搜尋清單，沒有把整頁 body 的雜湊當成可見正文。
- 相對第五輪來源基準，除 GEO 文章外的 812 個 source 檔案全部維持相同 SHA-256。
- 兩份安裝後的 SKILL 使用真實 PyYAML 6.0.3 與正式 quick_validate.py 驗證通過，安裝內容與審核副本 SHA-256 一致。
- `git diff --check` 通過。既有未登錄技術標籤警告仍存在；本輪未調整該批標籤。

以上是本地交付驗收，不是全站每篇主張都已事實查核，也不代表搜尋引擎已重新收錄。

## 抽樣發現與後續項目

LUNA 抽查了四篇知識文章，主代理另閱讀 API 排查、AI 提問判斷與測試基本功的部分內容。沒有發現需要新增 AEO 特殊標記的技術缺陷。

| 抽查項目 | 結論 |
| --- | --- |
| 網站品質與軟體測試學習路徑 | 已明示是未完成學習系列，系列連結有效；不把學習計畫當成已完成實測 |
| 簡報製作與 Open-Slide 學習筆記 | 有方法及文件引用，保留輸出驗證限制；本次未確認可定位的來源錯誤 |
| 工作知識 API 需求排查 | 明示為去脈絡化個人工作方法；沒有外部引用本身不構成缺陷，不需為了 AEO 虛構來源 |
| Agentic Transaction／ACID-Agent 筆記 | 首輪列為待核對；後續已對照 arXiv v1 的設定與表格，修正比較範圍、統計量及百分點用語。詳見下方追補紀錄；未執行獨立重現 |

首輪另發現 sitemap 包含 reading-desk.json、microblog.json、life-index.json 三個供前端讀取的資料 URL。使用者授權繼續後，LUNA 已新增 `scripts/sitemap-filter.js`，在生成前只將這三個資料 page 設為 `sitemap: false`；不使用 skip_render、不增加 robots 阻擋、不修改 JSON 內容。驗收結果列於追補紀錄。

更細的檔案與行號記錄在 `tmp/aeo-technical-audit.md`；該報告描述本輪收尾前的檢查狀態，最終生成結果以本文件驗收紀錄為準。

## 2026-09-11 追補：研究數字與 sitemap

ACID-Agent 筆記依 [arXiv HTML v1](https://arxiv.org/html/2608.13900v1) 的 §3.1 與 Table 2–4 核對，主代理也交叉閱讀 PDF 的設定及表格文字。多數數值與原文相符，修正重點是解讀：

- 將 KramaBench 的 24 個「資料庫」改為「資料來源」。
- 64.0% 至 74.6% 的差值寫為 10.6 個百分點；保留論文敘述中的 197B 與設定／表格 397B 不一致，避免擅自替原文判定哪個名稱正確。
- 說明門檻是研究的操作設定，穩定度的誤差項為每任務變異平均後開根號；Table 3／4 限定 Environment 領域與指定模型，不能和全體任務分數直接比較。
- 表格成本僅作作者實驗報告使用；核對論文及 README 不等於獨立重現或完成全部實作審查。保留學習中的狀態與作者工作方法思考。

追補於 2026-09-12 完成驗收：

- `npm run verify` 通過：37 項回歸測試、937 個生成檔案、327 個 HTML、32,050 個 href／src。
- sitemap 由 270 個 URL 減為 267 個；精確集合比對確認只移除指定三個 JSON URL，243 篇文章全部保留。
- 三份生成 JSON 的 SHA-256 與修正前完全相同，資料檔仍存在於原路徑。
- 除 ACID-Agent 文章外，812 個 source 檔案維持相同 SHA-256；其他 242 篇文章的正文文字、圖片與連結不變。所有文章 canonical 與原始發表時間不變。
- ACID-Agent 的生成更新時間精確維持 `2026-09-11T19:02:32+08:00`。帶時區的值改用加引號 ISO 字串，避免 YAML 日期轉型後又由 Hexo 解讀而偏移八小時；主代理驗收加入來源與生成時間的同一時間點比較。
- sitemap 排除需透過 Warehouse Document.update 寫回 Page 模型，僅修改查詢副本無效。已補上真實 Hexo 模型、locals 失效後重新查詢及真實 sitemap generator 的回歸測試。
- `git diff --check` 通過。核對表保留於 `tmp/aeo-research-evidence.md`，生成驗收腳本為 `tmp/aeo-followup-review.js`。

文章仍保留學習中狀態；本次完成原文與 README 核對，未獨立重現研究。沒有部署、commit 或 push。

## 正式站與成效的後續驗收

本輪沒有部署，不能把本地輸出當成正式站已更新。部署後需要另確認文章與 sitemap 的 HTTP 回應、canonical、robots／回應標頭限制，以及 Search Console 的索引狀態。Google AI 功能流量併入 Search Console 的 Web 搜尋報表，不能只靠該報表宣稱每次 AI 引用的完整數量。[Google 成效說明](https://developers.google.com/search/docs/appearance/ai-features)

若之後評估實際引用，應保存測試問題、平台、日期及引用 URL，將觀察結果與因果判斷分開；單次被引用或未被引用都不足以證明某個 Schema 改動的效果。
