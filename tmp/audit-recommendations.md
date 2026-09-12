# 推薦與隨機抽文稽核／修正紀錄

稽核與修正日期：2026-09-12。資料取自既有 `public/` 產物；未重新 build、部署或修改文章內容。

## 修正前的可重現問題

`themes/next/layout/_macro/post.njk:169-173` 原本對每篇非首頁文章呼叫 `popular_posts_fixed`。實際 helper 轉呼叫 `hexo-related-popular-posts`，其候選分數與排序在 `node_modules/hexo-related-popular-posts/lib/list-json.js:168-308` 主要依共同 tag 的次數；同分時只比較 PV（`:298-308`）。目前未設定 PV cache，因此同一大標籤內會依資料順序固定取前五篇。

從既有 `public/` 抽取 245 篇單篇文章、1,203 個推薦連結：

- 五個歌曲頁面各被 110 篇文章推薦，前五組合完全相同的頁面有 106 篇（102 首歌曲加 4 篇其他文章），約 43.3%。
- `/2025/10/24/歌曲推薦/歌曲推薦-2375/`、`/2026/01/09/歌曲推薦/歌曲推薦-All-for-you/`、`/2025/12/25/歌曲推薦/歌曲推薦-Better-Man/`、`/2026/01/08/歌曲推薦/歌曲推薦-Candy/`、`/2025/12/30/歌曲推薦/歌曲推薦-Don-t-You-Worry/` 各出現 110 次；它們不是最新五首，顯示同分時沒有可靠的近期或分散 tie-break。
- 抽樣沒有自我推薦；只有 1 篇無推薦，原因是沒有可匹配的 tag/category，屬合理空結果。

這是已確認的曝光集中與維護風險，不是「共同標籤推薦」本身錯誤。

另確認 `_config.yml:148-153` 原本使用 `popular_posts`（snake case），但套件讀取的是 `hexo.config.popularPosts`；而現有模板沒有傳入 `maxCount` 等套件選項。故原本的 `action`、`limit`、`date_format`、`more_link`、`excerpt` 對實際輸出沒有作用，只有套件 helper 預設的五篇生效。

## 本輪修正

- `scripts/popular-posts-fixed.js` 保留 `popular_posts_fixed` 名稱，改為本站 helper：
  - `related_posts` 明確路徑先取，過濾 self、未發佈、無效與重複路徑。
  - `recommendation_topics` 只有文章明確提供時才參與評分，不自動產生主題。
  - 依 topic、tag、category 重疊評分；同分用來源 path 與候選 path 的穩定 hash，建置順序反轉仍相同，但不同來源會得到不同 tie order。
  - limit 受 `_config.yml:148-150` 的 `enable`、`limit` 控制，空結果回傳空字串。
  - title、href 做 HTML escape，並處理 encoded／Windows path；只接受站內相對路徑。
- `themes/next/layout/_macro/post.njk:169-176` 先取 helper 結果，空結果不輸出空的「延伸閱讀」section。
- 未改九個主標籤，也未增加訪客追蹤、建置隨機或新依賴。

## 隨機抽文的設計取捨

`source/random/index.md:228-246` 的 `all` 模式先排除最近三筆，再從仍有候選的內容分類均勻抽一個分類，最後在該分類內隨機抽文章；分類模式則只在選定分類內排除最近三筆。這不是文章等機率抽樣：現有 `public/random.json` 有音樂 111 篇、閱讀與影視 105 篇、觀念與實驗 17 篇、生活紀錄 6 篇、工作知識 4 篇，因此 all 模式中的單篇工作文章機率約為單篇音樂文章的 27.75 倍。頁面文字也明確寫「從不同內容區平均抽取」，故列為已知設計取捨，不擅自改成 article-uniform；前輪測試已驗證最近三筆排除、分類耗盡 fallback 與 storage 故障仍可抽取。

## 驗證

`tools/tests/recommendations.test.js` 驗證：明確推薦優先、自我／未發佈／無效路徑排除、去重、topic/tag/category 評分、limit=1/0、enable=false、同一來源重跑與反轉候選順序結果一致、不同來源 tie order 分散、encoded／Windows 路徑、HTML escape，以及空結果不產生清單。

聚焦測試：`node --test tools/tests/recommendations.test.js`，6/6 通過。
