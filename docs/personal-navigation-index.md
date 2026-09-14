# 統一搜尋索引（第 2 項）

`scripts/navigation-index.js` 在 Hexo 建置時產出 `public/navigation-index.json`，格式為 `{schemaVersion: 1, timezone, records, warnings}`。資料邏輯位於 `tools/lib/navigation-index.js`，無網路請求、資料庫服務或前端追蹤。

## 目前交付

- 文章沿用 Hexo 公開 locals 與真實 path；保留分類、標籤、純文字與發表事件。
- 碎碎念的持久 id 保存在來源 JSON；新紀錄先預覽 `node tools/assign-microblog-ids.js`，再執行同指令加 `--write`。只補缺失 id；既有 id 即使改文或排序也不變。寫入前完整備份在 `tmp/navigation/microblog-before-ids-*.json`。
- 指向既有文章的學習題目併入該文章，`sources` 加入 learning，`learningItems` 保存原 id、題目、附註、來源、狀態與加入日期，`events` 保存各自日期。
- 獨立或外站學習題目暫以 `/reading/` 為站內入口，另存安全 externalUrl；失效或未公開的站內目標排除並回報 warnings。
- 日期缺失為 null；不合法日期、重複 id、來源結構錯誤會令建置失敗。腳本、樣式與行號排除，真正程式碼文字保留。

## 第 3 項：已接上搜尋視窗

現有搜尋視窗已改讀 `/navigation-index.json`；`search.xml` 仍正常生成，保留既有依賴。來源／分類／月份以 AND 組合，關鍵字以空白分詞、全部命中，不把 `+`、`-` 或 HTML 特殊字元當作查詢語法。學習筆記依 `sources` 篩選，併入文章者只顯示一筆。

- 結果顯示來源、分類、各自日期意義及命中片段。全部來源的月份對照任一事件；指定文章／碎碎念／學習筆記後，月份分別依發表／記錄／加入學習日期。
- 文章 `passages` 來自建置後實際標記的段落；`scripts/navigation-anchors.js` 只處理 post，保留作者既有 id，新增 id 由來源檔名及段落文字產生。插入不同文字的段落或重新建置不改既有位置；重複文字用後綴避免 ID 衝突。改寫該段文字會產生新 id，舊連結仍開啟原文章。
- 碎碎念資料的 canonical `url` 仍是 `/status/`，前端加入持久 id 的 hash。頁面載入後自動載入足夠筆數、展開對應年份並定位。不存在的紀錄顯示可理解的提示。
- 學習附註有獨立 `/reading/#題目id` 入口，自動切年份／加入日期並顯示命中題目的完整附註。主文章仍只出現一次。沒有可匹配段落時，結果明示「開啟文章」；外站或獨立題目先進草稿夾的紀錄。
- 搜尋文字與輸出片段以純文字處理並跳脫 HTML；錯誤索引、HTTP 錯誤提供重試，不當成空結果。Ctrl+K、Escape、Tab 循環包含新篩選控制項。
- 更新日期事件尚未納入；若後續需要，只接受作者明確填寫的 updated，不能使用檔案時間替代。返回保留條件與位置屬第 4 項。

## 驗證

- `node --test tools/tests/navigation-index.test.js`：合併去重、固定 id、資料更新、公開邊界、缺省欄位、錯誤日期、時區與外站題目。
- `npm run verify`：完整內容檢查、既有及新增回歸測試、clean/build、網站檢查。
- 依 `personal-navigation-acceptance.json` 核對實際新索引的三個案例，並檢查所有結果 URL 對應生成頁面。
- 更新或新增來源後重新建置即產生新索引；不得手改 public JSON。
- 第 3 項建置後再執行 `node tools/navigation-search-check.js`，逐一檢查索引中的段落 ID 在生成文章恰好出現一次、文字一致及三個來源案例。可附上一份先前索引路徑，比對跨建置內容與 ID 穩定性（忽略 Hexo 非固定的來源處理順序）。
