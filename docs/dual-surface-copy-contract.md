# 雙面部落格文案契約（WBS 10.6 更新）

狀態：approved/10.6；A、B 均為同一公開網站的入口。每篇文章只保留一份來源、一個 URL 與一個 canonical。

路由現況（2026-10-03）：`/` 為 A 面文章與搜尋頁、`/memory/` 為 B 面；`/profile/` 與 `/profile/articles/` 保留舊網址相容。

## 正式名稱與場景文案

| 場景 | A 面 | B 面 | 其他正式文案 |
| --- | --- | --- | --- |
| 面向名稱 | 工作與學習 | 個人記憶庫 | — |
| 全站切換按鍵 | `SIDE A／看工作與學習` | `SIDE B／翻到個人記憶庫` | 保留 SIDE A／SIDE B 輔助語氣 |
| 搜尋範圍 | `工作與學習` | `個人記憶庫` | `全部公開內容` |
| 文章標記 | `收錄於 工作與學習` | `收錄於 個人記憶庫` | 雙面依序為 `工作與學習・個人記憶庫` |
| 首頁橋接 | `SIDE A`、`工作與學習` | — | `看整理過的經驗與方法`、`翻到 A 面 ↗` |
| A 面首頁 | H1 `工作與學習` | 翻面按鍵如上 | 顯示全部 profile 文章的日期與標題清單，同頁提供「搜尋文章」欄位，依標題或標籤縮小清單；不加摘要、標籤或 featured 清單 |
| A 面文章庫 | H1 `工作與學習` | — | `/profile/articles/` 保留全部 profile 文章與既有 tags 單選篩選，供舊連結使用 |
| 探索中文章 | — | — | `🚧 當前假設／探索中`、`最近校準`、`目前適用邊界` |
| A 面卡片成熟度 | — | — | `探索中・校準 YYYY-MM-DD` |
| 空狀態 | — | — | `目前沒有可顯示的文章。`；篩選無符合項目時顯示對應狀態 |
| 鍵盤略過連結 | — | — | `跳到主要內容` |

## 公開邊界與禁用稱呼

A、B 只代表公開內容的呈現面向，不是權限或隱私設定。不得把 B 稱為「私人模式」或「私密模式」，也不得以文案暗示 A/B 有不同文章副本。雙面文章仍是一篇文章、一份正文、一個 URL；不得複製文章或為兩面新增摘要。首頁只靠標題與文章本身呈現，不增加 profile intro、tagline、summary 或額外卡片說明。

`workingDescription`、`selectionReason`、`readerValue` 及 `statusValues` 是 profile 策展／驗證用內部資料，不公開渲染；`workingDescriptionVisibility` 必須維持 `internal`。舊三路徑策展資料可保留供內部驗證，但不是正式 UI，也不決定新版封面資格或排序。A 面首頁與文章庫只取含 `profile` 的已發布文章；首頁按完整發表時間由新到舊列出每篇文章的日期、標題與原 URL，搜尋欄在同頁依文章標題與標籤即時篩選，不預載全站搜尋索引；無 JavaScript 時顯示完整清單。首頁不載入 ECharts 或 B 面全站日曆 JSON，也不呈現文章更新事件。文章庫顯示全部；文章 URL 唯一。標籤及計數來自文章既有 front matter tags，沒有標籤不會推定資格。標籤篩選只在文章庫，不改變原文章 URL。A contextual menu 只保留「工作與學習」；側欄文章數連到首頁清單，舊文章庫網址仍可供既有連結使用。

## 維護

正式名稱或任一文案變更時，須同步更新本契約、`source/_data/surface-navigation.yml`、`source/_data/profile-home.yml`、post surface helper、搜尋模板與 JS、首頁 bridge、thinking／空狀態／skip link templates、相關 output checkers、fixture 與瀏覽器證據。`check:surface-copy` 驗證來源契約；隔離 build 後須以 `--root` 驗證實際輸出。

相關規則：[內容面向契約](dual-surface-content-contract.md)、[公開邊界決策](dual-surface-public-boundary-decisions.md)、[一般文章發布 SOP](dual-surface-publishing-sop.md)、[雙面視覺規則](dual-surface-visual-rules.md)。
