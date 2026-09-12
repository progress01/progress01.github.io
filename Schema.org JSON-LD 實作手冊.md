# Schema.org JSON-LD 實作手冊

這份手冊記錄目前網站的 Schema.org JSON-LD 實作方式。它是提供搜尋引擎閱讀的結構化資料，不會直接改變網站畫面，也不需要為每篇文章手動建立一份 JSON。下文會分開說明 Schema.org／Google 的通用規則，以及本站為了維持輸出一致而訂的檢查約定。

## 實作位置

JSON-LD 由 Hexo 主題模板自動產生，實作檔案是：

```text
themes/next/layout/_partials/head/head-unique.njk
```

每次執行 `hexo generate` 或 `npm run verify` 時，模板會依照目前頁面的資料重新產生 JSON-LD。不要直接修改 `public/` 裡建置後的 HTML，下一次建站會被覆蓋。

## 目前處理的頁面類型

| 頁面 | Schema.org 類型 | 用途 |
| --- | --- | --- |
| 文章頁 | `BlogPosting` | 描述文章本身、作者、日期、分類與封面 |
| 首頁 | `WebSite` | 描述網站名稱、網址、簡介與語言 |
| 分頁、分類、標籤與彙整 | `CollectionPage` | 描述文章集合並保留各自 canonical URL |
| 其他頁面 | `WebPage` | 提供基本頁面資訊，不假裝是文章 |

真正首頁使用 `WebSite`；分類、標籤與文章彙整，以及 `page/<數字>/` 形式的數字分頁使用 `CollectionPage`；搜尋頁、圖牆、隨機文章與熱力圖等功能頁維持 `WebPage`。模板先判斷文章頁，再判斷首頁與集合頁，因此文章即使位於看似集合路徑，也優先使用 `BlogPosting`。

## 所有頁面共用欄位

| 欄位 | 目前內容 | 資料來源 |
| --- | --- | --- |
| `@context` | `https://schema.org` | Schema.org 規範入口 |
| `@type` | `BlogPosting`、`WebSite`、`CollectionPage` 或 `WebPage` | 依目前頁面判斷 |
| `@id` | canonical URL 加上實體片段 | 首頁使用 `#website`、文章使用 `#article`、集合使用 `#collectionpage` |
| `url` | 頁面的 canonical URL | 同上 |
| `name` | 文章標題或網站標題 | `page.title` 或 `config.title` |
| `description` | 文章摘要或網站簡介 | `page.description`、文章 excerpt 或 `config.description` |
| `inLanguage` | `zh-TW` | `page.lang` 或 `config.language` |

### 摘要的取用順序

文章摘要依照以下順序取得：

1. front matter 的 `description`。
2. 文章的 excerpt，先移除 HTML，再截取最多約 200 個字元。
3. 網站設定的 `description`。

這樣即使文章沒有額外寫 `description`，搜尋引擎仍會得到一段可用的說明；也不需要複製文章內容到另一個欄位。

## 文章頁處理的欄位

文章頁使用 `BlogPosting`，目前會自動產生以下欄位：

| 欄位 | 目前內容 | 資料來源與規則 |
| --- | --- | --- |
| `headline` | 文章標題 | `page.title`，與頁面上顯示的標題一致 |
| `datePublished` | 發布日期與時間 | `page.date` |
| `dateModified` | 最後修改日期與時間 | front matter 明確的 `updated`；沒有時穩定回退至 `page.date` |
| `author` | 作者實體 | `config.author`，類型為 `Person` |
| `publisher` | 網站發布者 | `config.author`，類型為 `Person`；本站是個人部落格 |
| `mainEntityOfPage` | 文章所在頁面 | 指向文章的 canonical URL |
| `image` | 文章封面 | 只有文章有 `cover` 時才輸出，使用完整網站網址；通用的 `/images/work-knowledge-card.svg` 不代表單篇文章，因此省略，其他能代表文章的 SVG 可使用 |
| `articleSection` | 文章分類陣列 | 來自 front matter 的 `categories` |
| `keywords` | 文章標籤陣列 | 來自建置後的 `page.tags`；先依 `source/_data/content-tags.yml` 將歷史 alias 正規化為 canonical，未註冊標籤不會輸出 |

### 文章 front matter 範例

```yaml
---
title: 文章標題
date: 2026-08-30 12:00:00
categories: [閱讀與影視]
tags: [閱讀紀錄]
cover: /images/book_作品名稱.webp
---
```

文章只要維持正常的 front matter，JSON-LD 就會自動同步。沒有 `cover` 的文章仍會輸出有效的文章結構化資料，只是不會有 `image` 欄位。

文章頁的既有 Microdata 與 JSON-LD 也指向同一個 canonical 實體：`BlogPosting` 使用 canonical URL 加上 `#article`，Microdata 的 `mainEntityOfPage` 使用同一篇文章網址。文章模板不再另外放置隱藏的 `CreativeWork` `itemprop`，避免產生第二個不一致的文章實體。

## 通用規範與本站約定

Schema.org 與 JSON-LD 可以用多個 script 區塊或 `@graph` 表達多個實體；本站目前為了讓檢查與模板維護單純，每頁輸出一個 JSON-LD object。這是本站輸出約定，不是 Schema.org 或 Google 的限制。

Google 的 Article 文件沒有 required properties，只列出適用時建議提供的 `author`、`datePublished`、`dateModified`、`headline` 與 `image` 等欄位。本站 `site-check` 對文章類型、canonical、實體 ID、日期、作者、語言與可見內容的一致性所做的檢查，是本網站的品質閘門，不應寫成 Google 或 Schema.org 的必填規則。

## 網址與圖片規則

### 網址

JSON-LD 使用 canonical URL，而不是手動組合網址。這可以避免：

- `index.html` 與乾淨網址被視為兩個頁面。
- 文章頁與首頁使用不同網址版本。
- 部署到 GitHub Pages 後網址不一致。

網站網址由根目錄 `_config.yml` 的 `url` 管理：

```yaml
url: https://progress01.github.io
```

### 圖片

文章封面由 `cover` 取得，並轉成完整網址，例如：

```text
https://progress01.github.io/images/book_作品名稱.webp
```

圖片檔案仍然放在：

```text
source/images/
```

只改副檔名、使用 Windows 絕對路徑，或留下 Blogger 圖片網址，都會造成結構化資料與實際網站不一致。

## 日期的注意事項

目前 `_config.yml` 使用：

```yaml
updated_option: 'date'
```

因此沒有明確 `updated` 欄位的文章，`dateModified` 會穩定回退至發布日期，不會因 checkout 或檔案 mtime 漂移。若文章內容有實際修改日期，可以在 front matter 明確加入：

```yaml
updated: 2026-08-30 12:00:00
```

不要為了讓日期看起來漂亮而偽造修改時間；結構化資料應該反映實際內容狀態。

## 目前刻意沒有加入的欄位

以下項目目前不加入，避免資料不準確或增加維護負擔：

- `SearchAction`：目前搜尋是彈出式介面，還沒有穩定的獨立搜尋結果網址；而且 Google 已在 2024-11-21 全球移除 Sitelinks Search Box。Schema.org 的動作語義仍可合法使用，但加入它不會恢復 Google 的該搜尋框外觀。
- `aggregateRating`、`review`：網站沒有使用者評分資料，不應自行填寫。
- `wordCount`：網站目前的字數統計包含自訂規則，不一定等同搜尋引擎的字數定義。
- `BreadcrumbList`：目前先維持主題既有的麵包屑與分類連結，之後若需要搜尋結果呈現再獨立評估。
- `ImageObject`：文章封面目前是一個簡單的圖片 URL，沒有額外的圖片標題、作者或版權欄位需求。

JSON-LD 欄位不是越多越好，重點是資料和頁面實際內容一致。

## 日常維護方式

平常新增文章時，不需要手動修改 JSON-LD，只要確認：

1. `title`、`date`、`categories`、`tags` 填寫正確；標籤使用 `source/_data/content-tags.yml` 的 canonical 名稱。
2. 分類名稱和 `source/_data/content-categories.yml` 完全一致。
3. `cover` 的檔案真的存在於 `source/images/`。
4. 圖片使用網站路徑，不使用 Blogger URL 或 Windows 路徑。
5. 不在文章內另外貼上一段相同的 JSON-LD。

## 建站與驗證

完成文章或模板調整後，在專案根目錄執行：

```powershell
npm run verify
```

這會先執行內容檢查，再清理並重新產生 `public/`；不需要額外的 `--force` 參數。

建置後可用 PowerShell 檢查 JSON-LD 數量與格式：

```powershell
$pages = Get-ChildItem -LiteralPath 'public' -Recurse -Filter 'index.html'
$jsonLdCount = 0
$parseErrors = 0

foreach ($page in $pages) {
  $html = Get-Content -LiteralPath $page.FullName -Raw
  $blocks = [regex]::Matches($html, '(?s)<script type="application/ld\+json">(.*?)</script>')
  foreach ($block in $blocks) {
    $jsonLdCount++
    try {
      $null = $block.Groups[1].Value | ConvertFrom-Json
    } catch {
      $parseErrors++
      Write-Output "JSON-LD 解析失敗：$($page.FullName)"
    }
  }
}

Write-Output "頁面數：$($pages.Count)"
Write-Output "JSON-LD 區塊：$jsonLdCount"
Write-Output "解析錯誤：$parseErrors"
```

正常情況下，`解析錯誤` 應該是 `0`。另外抽查首頁和至少一篇文章頁，確認：

- 首頁是 `WebSite`。
- 文章頁是 `BlogPosting`。
- 文章的 `@id` 是 canonical URL 加上 `#article`，並與文章 Microdata 指向同一篇文章。
- `headline`、日期、作者與語言和頁面上可見內容一致。
- `url` 與 `<link rel="canonical">` 一致。
- 有代表文章的封面才輸出 `image`，圖片網址是網站的完整 HTTPS 網址；通用工作知識卡會省略。
- `articleSection` 和 `keywords` 與建置後的分類、canonical 標籤一致，未註冊標籤只在內容檢查中列 warning。
- 分類、標籤、彙整與 `page/<數字>/` 分頁是 `CollectionPage`；文章判斷優先於集合頁判斷。
- site-check 也會驗證 canonical、頁面類型、實體 ID、日期關係與圖片檔案，不只解析 JSON。

## 常見問題

### JSON-LD 解析失敗

優先檢查模板是否手動拼接了含引號、換行或特殊符號的文字。現行模板使用 `schema_json` helper 安全輸出 JSON 字串，不要改成直接把標題放進雙引號內。

### 文章沒有 image

檢查文章是否有 `cover`，以及該路徑是否對應到 `source/images/` 裡實際存在的檔案。沒有封面不是錯誤，JSON-LD 會省略 `image`。

### 日期看起來被更新

檢查文章是否有明確的 `updated`。沒有時應使用 `page.date`；`_config.yml` 的 `updated_option: 'date'` 會避免檔案 mtime 造成整站日期漂移。

### 搜尋結果沒有立刻出現特殊結果

JSON-LD 只是提供結構化資料，搜尋引擎是否顯示特殊結果仍由搜尋引擎自行判斷。網站建置成功不代表搜尋結果會立即更新，也不應為了追求特殊結果加入不真實的欄位。

## 官方參考與核對日期

- [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)：Article 沒有 required properties，欄位依頁面內容適用時提供。
- [Google General Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)：結構化資料必須代表頁面主要內容，且不保證一定顯示特殊搜尋結果。
- [Schema.org `publisher`](https://schema.org/publisher)：`publisher` 的值可為 `Person` 或 `Organization`。
- [Google：Farewell, Sitelinks Search Box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box)：Google 自 2024-11-21 起移除該搜尋框外觀。

以上官方資料於 2026-09-11（Asia/Taipei）核對。
