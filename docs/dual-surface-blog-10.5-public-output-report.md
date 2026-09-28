# 雙面部落格 WBS 10.5 最終公開輸出稽核報告

日期：2026-09-27（Asia/Taipei）  
工作包：WBS 10.5「最終公開輸出稽核」  
進場 HEAD：`2d4d9d0375c1aa82d4d6407fb13699a2810d714d`

## 結果

- `npm run verify` exit 0，最後由 clean/build 產生 fresh `public/`，共 1,007 個檔案：378 HTML、8 JSON、3 XML、42 JS、2 CSS、574 圖片、0 其他 binary。逐檔安全讀取後有 436 個可解碼文字產物納入掃描；包含 HTML、JSON、XML、JS、CSS、SVG、map 及其他可解碼格式，不只按副檔名挑檔。
- 使用既有 microblog 核准遷移基準及 baseline commit 的原文字紋比對所有可解碼輸出；D/V 原文字紋命中 0、退役 V ID 命中 0。兩筆核准 D replacement 均出現在 `microblog.json` 與 `navigation-index.json`；boundary checker 每筆在兩個輸出檔各命中一次。輸出及診斷沒有回顯原文或指紋。
- microblog 來源、公開 `microblog.json`、導覽索引各 21 筆；來源既有 P/D ID 全數保留且唯一，V ID 不在公開來源。JSON 與索引內容逐 ID 一致，D 內容符合核准 replacement；status 頁仍從 `/microblog.json` 讀取。公開建置只留一個根目錄 `microblog.json`，沒有 source/raw 副本。
- 來源複製檢查通過：沒有 raw Markdown/frontmatter、YAML、`source/`、`_posts`、`_data`、docs、tests、tmp、Git/Codex/Agents、private storage 或備份檔案。
- 10.4 SEO 稽核在同一 fresh 輸出通過：271/271 文章路由與 canonical 唯一、315 sitemap loc，有效同源且對應 HTML；重複正文群組 0，固定樣本 5/5 存在。全站 `site-check` 為 378 HTML、134,850 href/src，0 缺檔。搜尋、隨機、status 等所有可解碼產物都在 D/V 掃描範圍。
- `source/images/` 568/568 個原始圖片檔都保留於 `public/images/`。另有 6 個由 NexT 主題提供的既有圖示／logo，輸出圖片總數 574；固定歌曲文章 cover 存在。圖牆頁保留 225 個圖片卡引用；HTML `img/src/source/srcset` 等本地媒體參照 687 筆、CSS `url()` 1 筆，均解析到現存輸出。沒有移除、搬動、改寫或讀取圖片 metadata。

## 工具與驗證

- 新增 `tools/public-output-audit.js`、10 個正負 fixture tests 與 `npm run check:public-output`；完整輸出盤點、microblog ID／衍生資料一致性、來源複製路徑、可解碼文字指紋、圖片 inventory 與引用檢查都可重跑。
- 重用 `tools/public-boundary-check.js` 的 baseline/fingerprint 核對；抽出共用輸入載入函式供兩個 checker 使用。`check:public-output` 已接在 `verify` 的 clean/build、site、archive/category 及 SEO 檢查之後，因此正式輸出檢查使用 fresh `public/`。
- 專用正負測試 10/10；與既有 boundary tests 合跑 16/16。涵蓋 HTML／JSON／XML／JS／CSS／map 指紋、退役 ID、raw source extension/path、private／backup 路徑、重複／變更 ID、缺 D replacement、固定 cover／來源圖片遺失、broken srcset/CSS asset，以及公開文章、reading desk、圖片的正例。
- `npm run verify` exit 0；完整 regression 246/246；`check:site`、archive/category、`check:seo-urls`、`check:public-output` 全通過。獨立 `npm run check:public-boundary` 亦 exit 0（436 文字檔、原文與 retired ID 0 命中）。兩個新增 JS `node --check` 通過；`git diff --check` exit 0，只有既有 tracked 檔案 LF→CRLF 提示。

## 範圍與限制

本稽核確認核准 D/V 指紋、持久 ID、路由、衍生輸出、圖片資產存在與引用完整；沒有重新判斷文章、reading desk、收藏或圖片是否應公開。圖片依作者既有決策保留公開；本輪不逐張檢查圖像內容、人物／地點、出處標注、第三方授權或 EXIF，因此不宣稱完成逐張圖片隱私審查。沒有建立 repository 私人目錄，也沒有修改任何文章、microblog、reading desk 或圖片來源。

WBS 10.5 完成；G10 尚未通過。下一步 WBS 10.6「作者驗收包」。未部署、未使用額度重置券。
