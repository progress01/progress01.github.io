# 雙面部落格 WBS 10.4 SEO 與網址稽核報告

日期：2026-09-27（Asia/Taipei）  
工作包：WBS 10.4「SEO 與網址稽核」  
稽核來源：WBS 10.2 fresh `public/`；本輪 `npm run verify` clean/build 後再次產生並稽核。  
進場 HEAD：`2d4d9d0375c1aa82d4d6407fb13699a2810d714d`

## 結果

- `271/271` 篇文章 HTML 依 `article.post-content-single` 或 JSON-LD `BlogPosting` 辨識；每篇恰有一個 self-canonical，origin、輸出 route 與 `navigation-index.json` URL 一致。索引文章共 271 筆、271 個唯一 route；文章 canonical 共 271 個唯一 route。
- 以文章 `.post-body` 正文 HTML 正規化後計算 SHA-256，排除 article 外的共用頁首／頁尾等 chrome，移除 script/style/noscript 與 HTML 註解、排序屬性並摺疊空白。正文雜湊相同且 route 不同會失敗；診斷只輸出 route 與 hash 前綴，不輸出正文。本次重複正文群組為 0。
- 真正雙面文章 `/work/flow-friendly-work-system/` 在輸出、canonical 與索引各只有一筆；首頁 `/` 與 A 面 `/profile/` 均有指向同一原 URL 的入口。未發現 `/profile/...` 的文章正文副本。
- sitemap 可解析，共 315 個 loc，全部 same-origin、無重複且對應 HTML 輸出。包含 271 個文章 canonical、核心 `/`、`/profile/`、`/profile/articles/`，以及已生成的 7 個分類、28 個標籤集合頁；JSON/XML 資料端點不在 sitemap。其他 sitemap 頁面亦逐項解析並確認輸出存在。
- 固定樣本 5/5 route 與面向正確且 canonical 唯一：A `/work/from-real-work-to-features/`；歌曲 `/2026/09/01/歌曲推薦/歌曲推薦-sailing back to you/`（輸出可用百分比編碼表示）；profile-only learning `/learning/website-quality-testing-roadmap/`；dual `/work/flow-friendly-work-system/`；站務原 URL `/2026/01/25/部落格改版規劃/`。來源 permalink、正文與策展資料未改。
- 全站 href/src 與可見輸出 404 重用 `site-check` 驗證：378 個 HTML、134,850 個 href/src，通過。路由比較將百分比編碼解碼後比對實際輸出檔，因此中文及歌曲空白路徑不會因 `%xx` 表示差異誤報。

## 工具與負向測試

新增 `tools/seo-url-audit.js`、`tools/tests/seo-url-audit.test.js` 及 `check:seo-urls` package script。此 audit 已接入 `verify`，位置在 clean/build、`check:site` 與 archive/category compatibility 之後，以 fresh `public/` 執行。

6 個專用 tests 通過，包含依 `_config.yml` 讀取正式 origin、正例中文／百分比路徑與唯一雙面文章，以及可攔截的 duplicate canonical、non-self canonical、文章路由／正文副本、navigation duplicate、sitemap missing／duplicate／off-origin／不存在輸出／data endpoint、A/B copy path。全站檢查仍由既有 `site-check` 負責；沒有略過或放寬安全檢查。

## 命令與驗證

- `node --check tools/seo-url-audit.js`、`node --check tools/tests/seo-url-audit.test.js`：通過。
- `node --test tools/tests/seo-url-audit.test.js`：6/6 通過。
- `npm run verify`：exit 0；完整 regression 236/236、fresh `public/` 1,007 個檔案、`check:site` 378 個 HTML／134,850 個 href/src、archive/category 271 篇文章唯一路由與 6 個分類、`check:seo-urls` 271 篇文章／315 個 sitemap loc／0 個重複正文群組。
- `npm run check:site`、`node tools/seo-url-audit.js --root public`：皆 exit 0。
- `git diff --check`：exit 0；只顯示進場既有 tracked 檔案 LF/CRLF 提示，沒有 whitespace error。

## 未發現問題與限制

未發現需要修正的網站 SEO／網址缺陷；沒有修改文章、front matter、正文、permalink 或公開面向決策。正文比對採產物 HTML hash，能指出相同正文但不判定作者是否刻意保留相同內容；若日後出現命中，需人工判斷，不可由 checker 自動刪文。

WBS 10.4 完成；G10 尚未通過。下一步為 WBS 10.5「最終公開輸出稽核」。本次未部署、未使用額度重置券。
