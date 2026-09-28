# 雙面部落格文案契約（WBS 10.6 更新）

狀態：approved/10.6；A、B 均為同一公開網站的入口。每篇文章只保留一份來源、一個 URL 與一個 canonical。

路由現況（2026-09-28）：`/` 為 A 面、`/memory/` 為 B 面；`/profile/` 保留 A 面相容入口，`/profile/articles/` 為完整 A 面文章庫。

## 正式名稱與場景文案

| 場景 | A 面 | B 面 | 其他正式文案 |
| --- | --- | --- | --- |
| 面向名稱 | 工作與學習 | 個人記憶庫 | — |
| 全站切換按鍵 | `SIDE A／看工作與學習` | `SIDE B／翻到個人記憶庫` | 保留 SIDE A／SIDE B 輔助語氣 |
| 搜尋範圍 | `工作與學習` | `個人記憶庫` | `全部公開內容` |
| 文章標記 | `收錄於 工作與學習` | `收錄於 個人記憶庫` | 雙面依序為 `工作與學習・個人記憶庫` |
| 首頁橋接 | `SIDE A`、`工作與學習` | — | `看整理過的經驗與方法`、`翻到 A 面 ↗` |
| A 面封面 | H1 `工作與學習` | 翻面按鍵如上 | 顯示 profile 文章最新年份的全年更新熱力圖；日期格可查看當日文章，頁尾可查看全部文章；不加摘要、標籤或 featured 清單 |
| A 面文章庫 | H1 `工作與學習` | — | `/profile/articles/` 顯示全部 profile 文章與既有 tags 單選篩選；頁尾可由封面動態查看篇數 |
| 探索中文章 | — | — | `🚧 當前假設／探索中`、`最近校準`、`目前適用邊界` |
| A 面卡片成熟度 | — | — | `探索中・校準 YYYY-MM-DD` |
| 空狀態 | — | — | `目前沒有可顯示的文章。`；篩選無符合項目時顯示對應狀態 |
| 鍵盤略過連結 | — | — | `跳到主要內容` |

## 公開邊界與禁用稱呼

A、B 只代表公開內容的呈現面向，不是權限或隱私設定。不得把 B 稱為「私人模式」或「私密模式」，也不得以文案暗示 A/B 有不同文章副本。雙面文章仍是一篇文章、一份正文、一個 URL；不得複製文章或為兩面新增摘要。首頁只靠標題與文章本身呈現，不增加 profile intro、tagline、summary 或額外卡片說明。

`workingDescription`、`selectionReason`、`readerValue` 及 `statusValues` 是 profile 策展／驗證用內部資料，不公開渲染；`workingDescriptionVisibility` 必須維持 `internal`。舊三路徑策展資料可保留供內部驗證，但不是正式 UI，也不決定新版封面資格或排序。A 面封面與文章庫只取含 `profile` 的已發布文章：熱力圖每篇一定記一筆 `post.date` 發表活動；只有有效 `post.updated` 換算 Asia/Taipei 日曆日且不同於發表日，才另記一筆更新活動。缺少／無效／同日更新不新增活動；不保存中間版本歷史，每篇最多兩筆事件。熱力圖計數是事件數，狀態分開表達文章總數與活動日期數，明細標示「發表／更新」。封面只呈現最新活動年份的全年熱力圖，新年份出現時自動成為封面年度，舊年份仍在文章庫。選取有活動的日期可查看當日事件及原 URL。封面資料由 profile helper 內嵌，不讀取 B 面全站日曆 JSON。文章庫顯示全部；文章 URL 唯一。標籤及計數來自文章既有 front matter tags，沒有標籤不會推定資格。標籤篩選只在文章庫，不改變原文章 URL。A contextual menu 入口為「工作與學習」與「全部文章」，目前頁標記依實際路由切換。

## 維護

正式名稱或任一文案變更時，須同步更新本契約、`source/_data/surface-navigation.yml`、`source/_data/profile-home.yml`、post surface helper、搜尋模板與 JS、首頁 bridge、thinking／空狀態／skip link templates、相關 output checkers、fixture 與瀏覽器證據。`check:surface-copy` 驗證來源契約；隔離 build 後須以 `--root` 驗證實際輸出。

相關規則：[內容面向契約](dual-surface-content-contract.md)、[公開邊界決策](dual-surface-public-boundary-decisions.md)、[一般文章發布 SOP](dual-surface-publishing-sop.md)、[雙面視覺規則](dual-surface-visual-rules.md)。
