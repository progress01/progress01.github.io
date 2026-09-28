# 一般文章發布 SOP（WBS 8.5）

版本日期：2026-09-27（Asia/Taipei）  
適用範圍：在本站新增或將草稿轉成一般文章；本流程不包含部署。

## 最短流程

1. 用 Hexo 新增文章或草稿：`npx hexo new post "文章標題"` 或 `npx hexo new draft "文章標題"`。在產生的 Markdown 檔寫文章；草稿轉正式時也從頭重做以下檢查。
2. 先判斷內容是否能公開。本站 `source/` 中的文章都視為任何人可直接用 URL 讀取；不確定就停止，不要放進公開來源。
3. 選面向，把 scaffold 的 `surfaces: []` 換成 `[memory]`、`[profile]` 或 `[profile, memory]`。一篇文章只留一份、一個 URL。
4. 成熟文章省略全部三個 `thinking_*` 欄位；只有探索中的文章才同時填 `exploring`、校準日期與適用邊界。
5. 是否加入 A 面首頁策展另行選擇，完全選填。一般文章完成後執行 `npm run check:article-scaffold`、`npm run check:content`；策展資料有變更時再執行 `npm run check:profile-home`。發布候選前執行 `npm run verify`。

## 依序做四個決定

### 1. 能否公開

凡放在本站 `source/` 的文章，都視為任何人可能直接以 URL 讀取；不建立 repo 內私人目錄，也不把「不在首頁／搜尋」當成保護。不要發布純宣洩、可辨識的人事衝突、未公開專案細節或他人隱私。對公開資格有疑問，先停止並釐清或改寫到能安全公開為止。

只有碎碎念沿用既定 D／V 分流；一般文章不使用 D／V 作公開或隱私設定。`surfaces` 的 A／B 面向、`published: false`、草稿狀態都不是權限或隱私機制。細節見[公開邊界作者決策表](dual-surface-public-boundary-decisions.md)及[內容面向契約](dual-surface-content-contract.md)。

### 2. 選文章面向

- `profile`：工作與學習。
- `memory`：個人記憶庫，包含生活、圖書館、作品、地方及其他經驗；不限於狹義的生活分類。
- `dual`：同一篇文章同時面向兩邊，front matter 寫成 `surfaces: [profile, memory]`。

雙面仍是一份 Markdown、一篇文章、一個 URL。不要複製正文製作 A／B 版本。面向可在文章生命週期中調整；這是更改公開入口的策展選擇，不是複製文章或遷移內容。

### 3. 判斷成熟度

成熟文章或不需要成熟度聲明時，完全省略 `thinking_status`、`thinking_updated`、`thinking_boundary` 三欄。只有仍在探索、需要讓讀者知道範圍的文章才填三欄，而且要一起填：狀態只能是精確值 `exploring`；`thinking_updated` 是最近一次校準的有效 `YYYY-MM-DD`；`thinking_boundary` 寫明目前適用範圍或限制。不要填 `stable`、`published` 等其他狀態。

日期按欄位所寫的日曆日比較，採 Asia/Taipei 今日：`thinking_updated` 不得早於文章 `date`，不得晚於已填且有效的 `updated`，也不得晚於今天。修正方法是確認實際日期，將校準日改成符合文章日期、更新日期與今天的有效日期；若內容已成熟或不需聲明，就刪除三欄，而不是留下不完整組合。詳細契約見[內容面向與成熟度契約](dual-surface-content-contract.md)第 8 節。

### 4. 決定是否加入 A 面首頁

首頁策展完全選填，且是獨立決定。只有 `profile` 或 `dual` 文章可考慮加入 `source/_data/profile-home.yml`；發布文章不會自動將它列入首頁，也不需要為了首頁補一段額外摘要，依文章本身與標題呈現。即使這次不選首頁，文章仍可依面向出現在其他入口。若確實編輯策展清單，完成後執行 `npm run check:profile-home`。

## 新文章與草稿轉正式

Hexo scaffold 會產生文章 front matter 和空正文；一般文章使用 post scaffold，草稿使用 draft scaffold。保留 scaffold 已有欄位形狀，填妥標題、日期（post scaffold 有 `date`）、既有 tags／categories 等內容欄位，再把 `surfaces: []` 換成一個合法選擇。`[]` 是提醒尚未完成的占位，不是私人設定。正文照常寫在同一個檔案中；不要建立私人目錄或第二份 A／B 版本。

草稿要轉成正式文章時，即使之前已選過面向或成熟度，也重新檢查公開資格、面向、日期與成熟度；確認所有必填欄位完整後再做發布候選驗證。之後若文章主題或讀者入口改變，可以只調整 `surfaces`，保留原文章和網址。

## Front matter 範例

以下可直接複製進 front matter。範例日期採有效的 2026-09-27；`tags`、`categories` 按文章實際內容調整。前兩例是成熟／不需聲明成熟度，所以完全沒有 `thinking_*` 欄位。

記憶庫文章：

```yaml
title: 圖書館裡的一段記憶
date: 2026-09-27 10:00:00
tags: []
categories: [生活紀錄]
surfaces: [memory]
```

工作與學習文章：

```yaml
title: 整理一次工作中的問題拆解
date: 2026-09-27 10:00:00
tags: []
categories: [工作知識]
surfaces: [profile]
```

雙面探索中文章：

```yaml
title: 從地方記憶整理一種觀察方法
date: 2026-09-27 10:00:00
tags: []
categories: [觀念與實驗]
surfaces: [profile, memory]
thinking_status: exploring
thinking_updated: 2026-09-27
thinking_boundary: 目前只整理個人觀察，尚未涵蓋其他地方或不同參與者的經驗。
```

範例各自代表單篇文章的面向選擇，不是重複文章；圖書館、作品、地方或其他經驗都可依文章實際重心選 memory，也可在同一份文章同時選 profile 和 memory。WBS 10.6 起，A 面列表資格只依明確的 `profile` surface；列表標籤篩選只讀該文章已有 tags，標籤不會代替面向或改變公開資格。舊三路徑策展資料不再作為正式 UI。

## 圖片原則

個人保存兼分享性質的圖片可以保留，圖片需有出處／授權資訊，或作者自己的說明；只需在同一篇文章使用，不因 A／B 重複圖片或製作兩份文章。標明出處不會自動取得公開他人隱私的許可；若人物同意、圖片權利或可辨識資訊不清楚，先停止並確認能否公開。

## 驗證命令

在 repo 根目錄執行以下命令：

| 時機 | 命令 | 用途 |
| --- | --- | --- |
| 首次使用或修改過文章 scaffold 後 | `npm run check:article-scaffold` | 確認專案的 post／draft scaffold 欄位和提示符合約定；此命令檢查 scaffold，不是單篇文章 front matter。 |
| 新增或修改文章後 | `npm run check:content` | 檢查新文章面向與成熟度欄位及日期規則，也會檢查其他既有公開內容。 |
| 新增或修改 A 面首頁策展資料後 | `npm run check:profile-home` | 檢查策展引用有效且文章含 `profile`；有策展修改時可併入常規檢查。 |
| 想檢查單篇首頁／索引摘要時 | `npm run check:excerpt -- --post "source/_posts/檔名.md"` | 只檢查指定文章；位置須在 `source/_posts/` 下。工具也支援 `npm run check:excerpt -- --all` 全文檢查，不要加其他未支援參數。 |
| 發布候選完成、準備交付前 | `npm run verify` | 執行完整驗證、clean 與 build。它會清除並重新產生 `public/`，執行前確認可接受這項輸出改寫。 |

`npm run verify` 成功代表本機候選通過腳本檢查，不會替作者決定文章是否公開，也不等於已部署。`deploy` 是另一個外部操作；只有取得當次明確授權才可進行。本 SOP 不提供部署指令。

## 常見錯誤與修法

| 檢查訊息／情況 | 作者可採取的修法 |
| --- | --- |
| missing `surfaces` | 新文章明確加上面向欄位，填 `[memory]`、`[profile]` 或 `[profile, memory]`。 |
| empty `surfaces`／`surfaces: []` | 把空占位換成上列一種非空選擇；空陣列不代表隱藏或私人。 |
| thinking orphan／孤兒欄位 | 若不聲明成熟度，刪除三個 `thinking_*` 欄位；若屬探索中，補齊三欄。 |
| unsupported thinking status | 只保留精確的 `thinking_status: exploring`；其他狀態請移除整組欄位或改成合法組合。 |
| bad `thinking_updated` date | 填實際存在的 `YYYY-MM-DD` 日期，包含正確閏日；不要用斜線、時間或無效日期。 |
| 空白或缺少 boundary | 在探索中時補上非空、適用的範圍／限制說明；若不需要聲明則移除整組欄位。 |
| 校準日早於文章 `date` | 檢查是否填錯日期；依實際校準日修正，必要時確認文章日期是否原本就正確。 |
| 校準日晚於 `updated` | 將校準日改成不晚於文章更新日的實際日期，或確認 `updated` 是否填錯；不要為了通過檢查任意挪日期。 |
| 校準日晚於今天 | 改為已發生的最近校準日期；若尚未校準，先不要填探索中三欄。 |
| `profile-home` 不相容 | 確認引用的文章存在且已發布、沒有重複引用，並且 `surfaces` 含 `profile`；否則移除首頁引用或重新判斷文章面向。 |
| 驗證失敗或訊息不確定 | 停止發布候選，照檢查器指出的檔案／欄位修正後重跑對應檢查；不要略過失敗。 |

檢查訊息不會回顯正文或 boundary 實際內容。不要把私人正文或 boundary 值複製到進度紀錄或求助訊息中。

## 發布前核對清單與停止條件

- [ ] 內容適合公開，可由任何人用直接 URL 閱讀；沒有純宣洩、可辨識的人事衝突、未公開專案細節或他人隱私。
- [ ] `surfaces` 是非空合法值；雙面仍只有一篇文章、一份來源、一個 URL。
- [ ] 成熟文章完全省略三個成熟度欄位；探索中則三欄完整且日期符合規則。
- [ ] 圖片有出處／授權或作者說明，且公開人物與隱私的權利已釐清。
- [ ] A 面首頁是否策展已獨立判斷；不會因發布就自動加入，也不為此補寫額外摘要。
- [ ] 依適用情況執行 scaffold、content、profile-home、excerpt 檢查；發布候選前完成 `npm run verify` 並確認 `public/` 的 clean/build 改寫結果。

若公開資格不確定、圖片權利或他人隱私不明、涉及未公開工作細節、必須更改既有 URL／文章日期才能繼續，或任何驗證失敗，先停止並釐清／修正。沒有出現在首頁或搜尋結果，不代表私人；A／B、`published: false` 也都不是隱私機制。部署另需當次明確授權。

## 相關資料

- [內容面向與成熟度契約](dual-surface-content-contract.md)
- [公開邊界作者決策表](dual-surface-public-boundary-decisions.md)
- [驗收與回復規則](dual-surface-blog-validation-and-recovery.md)
- [A 面首頁策展資料](../source/_data/profile-home.yml)
- [post scaffold](../scaffolds/post.md)／[draft scaffold](../scaffolds/draft.md)
