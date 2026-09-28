# 雙面部落格施工基準（WBS 0.1）

基準日期：2026-09-25（Asia/Taipei）
工作包：WBS 0.1「現況與未提交修改基準」
目的：記錄施工開始前的 Git 狀態、目前頁面資料流與需保護的檔案範圍。這份文件不代表網站功能已變更。

## Git 與工作樹基準

唯讀檢查時間點：本輪開始、編輯本基準文件以前。分支名稱未顯示（目前為 detached HEAD），HEAD 為 `2d4d9d0375c1aa82d4b6407fb13699a2810d714d`，提交時間 `2026-09-23T00:31:50+08:00`，提交訊息 `歌曲更新*1`。

當時 `git status --porcelain=v1 -uall`：

```text
 M AGENTS.md
 M docs/personal-navigation-plan.md
 M docs/personal-navigation-progress.md
?? docs/dual-surface-blog-plan.md
?? docs/dual-surface-blog-wbs.md
```

既有差異辨識如下；這些是本工作包進場時已存在的修改，不歸入 WBS 0.1 的實作變更：

- `AGENTS.md`：額度規則已調整為不得使用重置券（除非當次明確授權），並要求記錄完成、驗證及下一步。
- `docs/personal-navigation-plan.md`：執行方式已更新為單次小步驟與重置券限制。
- `docs/personal-navigation-progress.md`：已有 2026-09-25 的雙面部落格規劃紀錄及既往歷史；本輪只會在文件最上方新增 0.1 紀錄。
- `docs/dual-surface-blog-plan.md`、`docs/dual-surface-blog-wbs.md`：進場前已存在的未追蹤規劃文件，必須原樣保留。

當時沒有其他已追蹤檔案修改或未追蹤檔案。`source/microblog.json` 當時不在 Git 修改清單內。後續差異需以上述狀態為比較點；不能以整個工作樹為施工產物，也不能覆蓋、還原、清理或改寫列出的既有修改。

## 目前網站資料流

以下依目前程式與設定檔盤點，僅描述既有行為；尚未加入 A／B 判斷。

| 功能 | 目前來源與資料流 | 施工保護提示 |
| --- | --- | --- |
| 根首頁 `/` | `themes/next/layout/index.njk` 先產生隨機卡與歌曲／閱讀點播入口；前端讀 `/random.json` 與 `/content-categories.json`。首頁其餘文章列表仍由 Hexo 的 `page.posts` 提供。 | 保留根首頁及隨機卡為作者日常入口；未完成面向契約前不可改抽籤資格或首頁用途。 |
| 隨機文章資料 | `scripts/random-generator.js` 從 `locals.posts` 產生 `random.json`；略過無路徑、`type: random` 及「站務」分類，附上標題、URL、日期、分類、標籤、摘要、視覺類型與封面。 | 現行抽籤集合由來源文章與排除條件共同決定；保留既有 URL、分類與封面規則。 |
| 隨機傳送門 | `source/random/index.md` 使用 `/random.json` 與 `/content-categories.json`；依分類抽取、以 `sessionStorage` 記錄最近抽取文章。 | 保留 `/random/`、分類篩選及最近三次不重複行為。 |
| 完整搜尋 | `scripts/navigation-index.js` 呼叫 `tools/lib/navigation-index.js`，從已發布文章、`source/microblog.json`、`source/reading-desk.yml` 建立 `/navigation-index.json`；相同文章被學習資料引用時併回文章紀錄。 `themes/next/source/js/third-party/search/local-search.js` 載入並篩選此索引。 | 保留單一文章紀錄、既有 microblog ID、學習題目引用及其目前公開範圍；A／B 不能取代公開權限判斷。 |
| 搜尋最近文章 | `scripts/search-recent-posts.js` 以 `site.posts` 日期排序，預先嵌入全部最新十篇與各分類最新十篇；`themes/next/layout/_partials/search/index.njk` 產生卡片，搜尋前端負責分類切換。 | 保留目前最近文章排序、每分類筆數與無關鍵字時的結果。 |
| 內容清單 | 根首頁文章流使用 Hexo `page.posts`；`themes/next/layout/archive.njk` 使用 Hexo archives；分類頁使用 Hexo 文章分類與 `themes/next/layout/_partials/content-browser.njk`。`source/reading-log/index.md` 讀取由 `scripts/content-categories-generator.js` 輸出的 `/content-categories.json` 建立閱讀／分類導覽。 | 施工時須逐一確認清單的資料來源及分類用途，不能把一個清單的面向篩選默默套用到其他清單。 |
| 主選單 | `themes/next/_config.yml` 的 `menu` 定義項目與連結；`themes/next/scripts/events/lib/navigation.js` 建立 `main_menu`／`menu_map`，由 `themes/next/layout/_partials/header/menu.njk` 和 `menu-item.njk` 呈現。搜尋入口另依 `local_search.enable` 顯示。 | 保留既有選單路徑與用途；後續如需依面向調整，必須先盤點返回路徑與次選單關係。 |

目前可確認的生成端和瀏覽器端沒有共用 A／B 欄位或面向過濾：抽籤依文章、分類和站務排除規則；搜尋索引涵蓋文章、碎碎念與學習資料；最近文章及 Hexo 文章清單各自使用原有排序與來源。

## 後續施工保護界線

- 本基準對應 [雙面部落格施工 WBS](dual-surface-blog-wbs.md) 的 0.1 驗收；下一工作包為 0.2「路由與內容樣本」。
- 施工前再次唯讀檢查 `git status`，與本文件的進場快照比較；新出現或變動的作者檔案先視為使用者修改，不能覆蓋或清理。
- 既有文章正文、日期、permalink、microblog ID、公開來源與目前根首頁行為均為保護範圍。A／B 是公開呈現面向，不是隱私權限。
- 本次基準沒有修改網站程式、文章、`source/` 資料、設定、網址或輸出，也沒有執行建置或部署。
