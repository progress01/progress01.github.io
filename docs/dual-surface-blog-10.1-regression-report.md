# 雙面部落格 WBS 10.1 目標回歸報告

日期：2026-09-27（Asia/Taipei）  
工作包：WBS 10.1「目標回歸測試」  
專用命令：`npm run check:surface-regression -- --root tmp/wbs101-public-20260927`

## 結果

- 全新隔離建置：`npx hexo generate --config _config.yml,tmp/wbs101-build.yml`，產生 1,013 個檔案；輸出位於 `tmp/wbs101-public-20260927`。建置未執行 clean，也沒有寫入正式 `public/`。
- 專用回歸命令通過 19 個既有來源／輸出檢查，涵蓋內容與策展、surface/canonical、profile 首頁與清單、切換與選單、thinking maturity、視覺／動畫／無障礙／responsive、歷史、搜尋、隨機抽籤、公開邊界及全站輸出。
- WBS 0.2 固定文章樣本 5/5 各只有一筆文章索引紀錄和一個正文 canonical；固定 microblog 1/1 保留來源及索引 ID；歌曲樣本在 memory 隨機池恰有一筆。
- 五個文章路由：A 文章 `/work/from-real-work-to-features/`、歌曲 `/2026/09/01/歌曲推薦/歌曲推薦-sailing%20back%20to%20you/`、learning `/learning/website-quality-testing-roadmap/`、站務 `/2026/01/25/部落格改版規劃/`、真正雙面文章 `/work/flow-friendly-work-system/`。
- learning 樣本仍為 `profile` only；`reading-topic-07` 合併至單一文章紀錄，保留 `published` 與 `learning-added` 兩種事件及 `2026-09-04` 日期語意，A 面完整清單只有一筆文章連結。雙面文章 surface 順序為 `profile,memory`，並保留 B 面抽籤資格。
- microblog `micro-56bb6eec75c50bcd` 在來源、`microblog.json` 與搜尋索引均保持原 ID；搜尋日期語意為 `recorded`。status 頁使用既有 hash 導航載入資料，DOM 錨點由瀏覽器執行時建立。
- `npm run test:regression`：230/230 通過；專用測試 3/3 通過；兩個新 JavaScript 檔 `node --check` 通過；`git diff --check` exit 0，僅顯示工作樹既有 LF/CRLF 提示。
- 公開邊界 checker 在隔離輸出掃描 441 個文字檔，舊測試文字與 retired ID 命中皆為 0。

## 固定樣本核准校正

WBS 0.2 的 A/B 名稱是核准前的測試角色。作者後續 WBS 3.2/3.3 核准將 `/learning/website-quality-testing-roadmap/` 設為 `profile` only；因此本回歸只驗其 profile 引用及 linked-learning 去重，不要求它成為雙面文章。真正雙面樣本是 `/work/flow-friendly-work-system/`，其來源 surface 為 `[profile, memory]`。歌曲來源沿用舊文缺少 `surfaces` 的相容契約，由索引正規化為 memory；回歸確認歌曲分類、封面、原路由及 B 面抽籤都保留。

第一次執行時，額外樣本斷言誤把歌曲舊文缺少 `surfaces`、百分比編碼 URL、profile 清單中的搜尋預覽，以及 microblog 錨點必須出現在未執行 JavaScript 的初始 HTML 當作失敗。唯讀核對現行契約後，將斷言改為檢查 memory 正規化、解碼後路由、清單本體引用，以及公開 JSON／索引 ID 加 hash 載入流程；沒有修改網站功能或來源，修正後固定樣本與整合命令全部通過。

## 可重跑方式與限制

先以目前來源產生隔離輸出，再執行專用命令；命令要求 `--root` 且拒絕正式 `public/`：

```powershell
npx hexo generate --config _config.yml,tmp/wbs101-build.yml
npm run check:surface-regression -- --root tmp/wbs101-public-20260927
npm run test:regression
```

本輪沒有執行 `npm run verify`，因其會 clean 並重建正式 `public/`；這是 WBS 10.2 的工作。這份結果不涵蓋 10.3 真實瀏覽器旅程、10.4 SEO/網址稽核、10.5 最終公開輸出稽核或 10.6 作者驗收包，亦不代表 G10 通過。下一步為 WBS 10.2。未部署、未使用額度重置券。
