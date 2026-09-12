# AEO 技術與知識內容稽核

稽核日期：2026-09-11（唯讀；沒有重新 build 或部署）  
範圍：`_config.yml`、Next head/文章模板、現有 `public/` 產物、`sitemap.xml`，以及 4 篇實驗室知識文章。既有工作樹修改保留。

## 結論

目前沒有找到必須為 AEO 新增特殊標記、`FAQPage`、`llms.txt` 或 about 實體的理由。Google 官方說 AI Overviews/AI Mode 沒有額外技術要求或特殊 schema；頁面仍須可索引、可產生 snippet，且既有 SEO 基礎（內部連結、文字內容、結構化資料與可見文字一致）成立：<https://developers.google.com/search/docs/appearance/ai-features>。

現有產物的本地檢查結果良好：`public/` 有 327 個 `index.html`，每頁各 1 個 canonical 與 JSON-LD，且沒有 `noindex` meta；首頁是 `WebSite`，`/page/2/` 是 `CollectionPage`，抽查文章是 `BlogPosting`。270 個 sitemap URL 全部唯一且為絕對 URL；抽出的 19 個 `/learning/` 或 `/work/` 文章 canonical 都在 sitemap，未發現文章因 canonical 或 sitemap 遺漏而無法被發現的本地證據。這是對現有產物的觀察，最後仍應以主代理針對目前 source 的 build 結果重跑。

## 可處理項目（1 項，屬產品決策後的低優先改善）

### sitemap 把三個機器資料 endpoint 當成搜尋 URL

- **證據**：`public/sitemap.xml:5` 是 `https://progress01.github.io/reading-desk.json`，`:158` 是 `https://progress01.github.io/microblog.json`，`:374` 是 `https://progress01.github.io/life-index.json`。它們是前端 `fetch()` 使用的資料，不是文章或可供搜尋閱讀的 HTML。`node_modules/hexo-generator-sitemap/lib/generator.js:23-26` 會把未標記 `sitemap: false` 的 pages 一併加入 sitemap。
- **影響／嚴重度**：P3、待決策。這不會使文章失去索引，但若網站不希望資料 endpoint 成為搜尋候選，sitemap 正在主動推薦這三個 URL。Google 建議 sitemap 只列希望出現在搜尋結果、且以 canonical 為主的 URL：<https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>。
- **建議**：確認這三個 JSON endpoint 是否有獨立搜尋價值；若沒有，在各資料 page 的 front matter 設 `sitemap: false` 或以 sitemap generator 的明確排除方式處理，然後檢查資料頁仍能被前端 fetch。這不是 Google 對 JSON 的硬性封鎖規則，應先依產品意圖決定。

## 知識內容待核驗（不是已確認的模板 bug）

### Agentic Transaction 筆記的量化數字仍是公開可爬取的暫存內容

- **位置**：`source/_posts/實驗室/Agentic-Transaction-ACID-Agent-學習筆記.md:77-82` 的 `0.25`、`0.50` 門檻；`:96-126` 的 KramaBench 規模、分數、成本及消融表格。
- **現況與證據**：文章在 `:15`、`:19-21`、`:82`、`:96`、`:109`、`:115`、`:126` 明確寫出「研究摘記／待核對」，並連到 arXiv 原始頁與 GitHub（`:21`、`:27-29`）。因此目前不能把它判成誤導或結構化資料錯誤；但這些精確數字仍沒有逐項對應到原論文表格或可重現實驗。
- **建議／嚴重度**：P2 內容待核驗。正式引用或主張前，逐項補上原始頁面/表格定位，或刪除未能核實的數字；保留現有研究筆記聲明。Google 的 people-first 指引要求內容可靠，且結構化資料須與頁面可見文字相符：<https://developers.google.com/search/docs/appearance/ai-features>。

## 抽樣結果

- `source/_posts/實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md:13-21` 明確說明是未完成的 42 天學習系列，並以官方文件、實際專案與可重現測試作後續核對；其 `:65,78,91,104` 相對連結在文章 trailing-slash URL 下解析到 `/learning/.../` 目標，未列為缺陷。
- `source/_posts/實驗室/簡報製作與Open-Slide學習筆記.md:13-17` 是個人學習筆記；文內引用簡報方法與 open-slide 文件，並在後段保留輸出驗證限制，未找到可定位的來源錯誤。
- `source/_posts/實驗室/工作知識-API需求排查紀錄.md:14-18` 主動去識別化，說明只保留可移植的排查方法；它沒有外部引用，但沒有把公司事件或特定資料冒充普遍研究結論，故列為內容定位選擇而非必修 AEO 問題。其共用 `cover` `/images/work-knowledge-card.svg` 已由現行 JSON-LD 模板排除，未把系列卡誤宣稱為文章代表圖片。

## 需正式站／Search Console 才能判定

- 本地沒有 `source/robots.txt`，現有產物也沒有 `public/robots.txt`；這本身不是阻擋證據。需以正式站 `GET /robots.txt`、部署 headers/CDN 與 Search Console URL Inspection 確認 Googlebot 可抓取、頁面可索引並允許 snippet。Google 的 AI 文件也把索引與 snippet 列為資格條件，且明確說符合條件不保證一定被索引或顯示：<https://developers.google.com/search/docs/appearance/ai-features>。
- 需在 Search Console 檢查 sitemap 讀取/處理狀態、canonical 選擇與實際索引覆蓋；本地 fixture/產物無法證明正式 GitHub Pages/CDN 的 HTTP 狀態或 Google 已採用哪些 URL。
