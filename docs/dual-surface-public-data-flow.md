# 雙面部落格公開資料流盤點（WBS 2.1）

盤點日期：2026-09-25（Asia/Taipei）  
進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`  
依據：[施工基準](dual-surface-blog-baseline.md)、[路由與樣本](dual-surface-blog-samples.md)、[surface 契約](dual-surface-content-contract.md)、[驗收與回復規則](dual-surface-blog-validation-and-recovery.md)、[WBS](dual-surface-blog-wbs.md)。

本文件是依來源、程式、設定與當時可用 `public/` 快照作成的唯讀盤點；沒有建置，不代表快照等同目前來源重新生成的結果，也不代表線上部署狀態。只列資料類型與暴露面，不抄錄敏感原文、不判定任何紀錄應公開或轉私。

## 公開邊界結論

- A／B `surfaces` 是公開內容的入口／清單資格，不是 ACL。直接 permalink、靜態檔案、JSON、搜尋 XML、Atom feed、圖片、sitemap 或已渲染頁面是否含資料，必須由各自來源邊界與序列化器控制；只在抽籤／搜尋過濾不能使其他路徑私有。
- `_config.yml` 設定 `render_drafts: false`、`future: true`。本次 `source/_drafts` 有兩個目錄但沒有檔案；一般草稿目前不渲染，但改變 `render_drafts` 會改變風險。未來日期文章在目前 `future: true` 下沒有被排除的設定保護。
- 已核對 568 個 `source/images/` 圖片檔（168 PNG、351 WebP、48 JPG、1 SVG），同路徑皆可在舊 `public/` 快照找到。圖片內容、EXIF、人物／地點與授權狀況沒有在本包檢視或判定。
- Hexo 特殊 `_data` 檔案不是直接以原路徑複製到 `public/`；但被程式讀取的分類資料會另輸出 JSON。根目錄 `source/microblog.json`、`life-index.json` 在舊快照有同名公開路徑；其 SHA-256 與目前來源不同，所以只能確認路徑存在，不能把快照內容說成目前來源的原樣副本。`reading-desk.yml` 沒有同名 public 路徑，但產生器另輸出 `reading-desk.json`。

## 來源 → 處理 → 公開輸出

| 來源／資料型別 | 現有處理器、設定與公開資格控制 | 公開輸出、直接請求與間接呈現 | 日期／ID／隱私風險（供 2.2 判斷） |
| --- | --- | --- | --- |
| `source/_posts/**/*.md` | Hexo 讀為 posts；正常可發布與否依 front matter／Hexo `published`、`draft` 與 post collection 控制。`_config.yml` 的 `future: true` 允許未來日期內容進入生成流程。文章目錄、permalink 與文章本身目前沒有 `surfaces` 過濾。 | 每篇文章可由其 permalink 直接請求；亦可出現在首頁／分頁、archive、category、tag、`random.json`、`calendar-posts.json`、`navigation-index.json`、`search.xml`、Atom feed、sitemap。各輸出範圍依各自生成器，不是由同一隱私閘門控制。 | `date` 是文章發表日，`updated` 是更新日；permalink 是穩定公開入口。需由作者按內容類型判斷是否保留公開、去識別或移至私人位置，不由分類／檔名推定。 |
| `source/_drafts/` | Hexo 草稿 collection；目前 `render_drafts: false`。本次目錄內沒有草稿檔。切換設定、發布草稿或有其他自訂複製器時需重新核對，不以「草稿」一詞當隱私保證。 | 本次無草稿文章 public 路徑可驗；設定開啟草稿渲染時，草稿可能成為可請求文章並進入衍生索引。 | 本次沒有草稿內容可分類；未來逐項決定公開／去識別／私人，發布狀態與公開權限分開處理。 |
| 未來日期 post | `_config.yml` `future: true`；來源仍是 `_posts`，通常走一般文章生成及索引流程。 | 未來日期文章可以出現在 HTML、搜尋／抽籤／feed 等一般輸出；日期不會成為保護措施。 | 發表日期可在未來；不能用日期或檔案時間推斷內容公開資格或舊文身分。 |
| `source/microblog.json` | Hexo 對 source 根目錄靜態資產複製；`source/status/index.md` fetch `/microblog.json`，`scripts/navigation-index.js` 將它交給 `tools/lib/navigation-index.js` 建搜尋索引。`published`／`draft` 只在部分索引／呈現處理；不阻止原 JSON 靜態 URL 存在。 | `/microblog.json` 可直接請求；`/status/` 顯示紀錄並以 `id` 供 DOM/hash 定位；microblog 文字亦可能進 `navigation-index.json`。目前 sitemap filter 排除這個資料端點，但排除 sitemap 不會阻止直接請求。 | `id` 是持久識別，不可因文字編輯／排序改寫；`date` 是紀錄日期。每筆需由作者判斷公開／去識別／私人，面向篩選不能保護原 JSON。 |
| `source/reading-desk.yml` | `scripts/reading-desk-generator.js` 解析 YAML、只正規化日期格式後輸出 JSON；navigation index generator 也讀取 YAML，將 linked item 合併文章或將 standalone item 加入索引。`source/reading/index.md` 讀取 JSON。 | 舊快照沒有 `public/reading-desk.yml`，有 `/reading-desk.json`；閱讀台頁 `/reading/` 透過 JSON 顯示題目、附註、狀態與錨點。相同資料亦可能進 `navigation-index.json`。`reading-desk.json` 被 sitemap filter 排除，但仍是公開輸出。 | item `id` 用於定位／去重；item `date` 是加入草稿夾日期，非文章發表日。來源 YAML 未複製不代表資料私有，轉出的 JSON／HTML 仍可公開。 |
| `source/_data/content-categories.yml`、`content-tags.yml`、`calendar.json` | Hexo 將 `_data` 載入 site data；`scripts/content-categories-generator.js` 將分類設定 JSON 化。分類也供搜尋 filter／生活索引頁讀取；tag taxonomy 由相關工具與文章分類／標籤使用。未找到專案自訂腳本直接引用 `_data/calendar.json`；其實際其他依賴未知。 | 舊快照沒有 `public/_data/*.yml` 或 `public/_data/calendar.json` 原路徑；有 `/content-categories.json`（分類設定轉出）。文章分類／標籤另間接出現在分類／標籤頁、搜尋、抽籤、日曆資料。 | 類別／標籤名稱及導覽 metadata 本身是公開描述；`_data` 原路徑不出現不代表被它生成的 JSON／HTML 不含資訊。`calendar.json` 在本地來源存在但用途需另核實。 |
| `source/images/**/*` | Hexo 靜態檔案複製；文章、圖牆及其他頁面以 `/images/...` 引用。檔案類型本次盤點為 PNG／WebP／JPG／SVG，未逐張讀取／檢驗 metadata。 | 舊快照中 568/568 個來源相對路徑存在；已知頁面可能內嵌 thumbnail 或連結，所有 `public/images/...` 仍可直接請求，不依賴頁面連結或搜尋索引。 | 圖片可能涉及可辨識人物／地點、嵌入 metadata、第三方權利或原圖／轉檔並存等風險類型；不得以「只在圖牆」或 A/B 篩選當隱私邊界。 |
| `source/life-index.json` | 根目錄靜態資產；`source/reading-log/index.md` fetch `/life-index.json`，同頁亦 fetch `microblog.json`、`content-categories.json`、`calendar.json`。 | 舊快照有 `/life-index.json`；生活索引 `/reading-log/` 間接呈現其內容。sitemap filter 排除 life-index JSON，但不移除檔案。 | 生活／收藏 metadata、URL 與狀態可直接從 JSON 請求；欄位日期語意依其 schema，不能拿面向或 sitemap 排除推定私有。 |
| 功能頁 Markdown：`random/`、`reading/`、`reading-log/`、`photos/`、`calendar/`、`status/`、`categories/`、`tags/` 等 | Hexo 將 `source/**/index.md` 渲染成 HTML。頁面內 JS 會 fetch 對應的 JSON；自訂頁面的可見範圍由來源頁、生成檔與瀏覽器程式共同決定。頁面不是 `posts`，目前 content-check 不掃描 pages，也不對其設 `surfaces`。 | `/random/`、`/reading/`、`/reading-log/`、`/photos/`、`/calendar/`、`/status/`、`/categories/`、`/tags/` 舊快照均存在；頁面可直接請求，內嵌頁面文字與 client side data 不因面向自動移除。`/profile/` 尚不存在。 | 固定路由本身不採文章面向；但頁面內嵌文字、連結、圖片或 fetch 資料仍是公開呈現。頁面建置資格由 source page／Hexo 而非 article `surfaces` 控制。 |
| `scripts/random-generator.js` → 隨機入口 | 從 `locals.posts` 建立 `random.json`；略過沒有路徑、`type: random`、分類「站務」；未判斷 private/surfaces。`source/random/index.md` 與首頁使用此資料，頁面依分類抽取並保留最近抽取狀態。 | 舊快照 `/random.json`、`/random/`、首頁 `/` 存在；JSON 可直接請求，摘要／標題／網址可被入口直接呈現。 | 使用文章 `date`、permalink、分類與摘要；原有站務排除只是產品行為，不是隱私保護。未來 A/B 過濾只能是隨機清單資格一層。 |
| `scripts/calendar-generator.js` → 發表日資料 | 從 `locals.posts` 產生 `/calendar.json` 日期計數與 `/calendar-posts.json` 的文章標題、路徑、分類、發表日；`source/calendar/index.md` fetch 兩檔。 | 舊快照兩個 JSON 與 `/calendar/` 均存在；日期統計與文章明細可直接請求，頁面再呈現可點選文章卡。 | 使用 post 發表日而非實際事件日期；明細暴露文章 title／URL/category。sitemap filter 未列 calendar JSON 為排除項；舊快照檢查未見其路徑列入 sitemap。 |
| `scripts/content-categories-generator.js` → 瀏覽器分類資料 | 從 `site.data['content-categories']`（來源 `_data/content-categories.yml`）序列化 `/content-categories.json`；random、reading-log 和搜尋介面讀取。 | 舊快照 JSON 存在；分類設定可直接請求，也會間接呈現在頁面按鈕／導覽。 | 分類只是導覽 metadata，不是公開資格或隱私標籤；未來若面向過濾，須另明確實作而不能由分類推論。 |
| `scripts/navigation-index.js` + `tools/lib/navigation-index.js` → 統一搜尋索引 | 從 Hexo 已發布文章、microblog JSON、reading-desk YAML 建 `/navigation-index.json`。文章全文／段落、microblog 記錄、learning 附註可被索引；同 URL learning item 併入文章紀錄，未解析／未發布連結被排除於索引並警告。這只控制索引，不會移除來源靜態檔。 | 舊快照 `/navigation-index.json` 存在；主題 `local-search.js` fetch 該檔並在搜尋覆層呈現全文結果。直接 URL 可請求。 | 文章 `date` 是發表事件、microblog `date` 是記錄日、learning item `date` 是加入日，索引分別標示日期類型；ID/permalink 用於穩定定位。搜尋排除不代表 raw source、HTML 或其他 JSON 已排除。 |
| `scripts/search-recent-posts.js` → 搜尋空白狀態 | 依全部 `site.posts` 日期排序，嵌入最新 10 篇與各分類最新 10 篇聯集；`_partials/search/index.njk` 產生初始卡片，主題 JS 控制搜尋。無 private/surface filter。 | 最近文章標題、分類、日期與 permalink 隨頁面 HTML 輸出；即使未搜尋也可在 HTML 中找到。 | 使用發表日期排序；首頁／搜尋最近清單與完整索引是不同資料流。未來要做 A/B，該 HTML 片段需另加消費端篩選，單改 navigation index 不夠。 |
| `hexo-generator-searchdb` → `search.xml` | `_config.yml` 設定 `search.path: search.xml`、`field: post`、`content: true`、`format: html`；套件另生成搜尋 XML。主題有載入 local search 依賴，而本專案搜尋 JS 實際覆寫載入函式改 fetch navigation index。 | 舊快照 `/search.xml` 存在且可直接請求；生成 XML 仍是額外可公開資料面，不因目前 UI 使用 navigation index 而消失。 | 設定允許納入文章內容；具體項目由套件生成規則決定。面向若只加在另一個索引，不會自動過濾此 XML。 |
| `hexo-generator-feed` → Atom feed | `_config.yml` 設 `type: atom`、`path: atom.xml`、`limit: 20`、`content: true`；依 post feed 規則輸出。 | 舊快照 `/atom.xml` 存在，可直接被瀏覽器、RSS reader 或其他客戶端取得；不是只在網頁內顯示的資料。 | 最多 20 筆、含正文的 feed 是獨立完整內容出口；面向與公開邊界需在 feed 生成層另外控制。 |
| Archive／category／tag pages | Hexo archive、category、tag generator 與 NexT `archive.njk`、`category.njk`、`tag.njk`／內容瀏覽 partial；基於文章的日期、分類、tag 生成。未見使用 `surfaces` 的既有過濾。 | 舊快照 `/archives/`、`/categories/`、`/tags/` 及其索引存在；每個 permalink/category/tag 頁都可直接請求並列出文章。 | archive 使用發表日；category/tag 是作者 metadata 而非公開／私人的區隔。即使隨機或搜尋排除某篇，這些清單仍可能提供入口。 |
| sitemap generator + `scripts/sitemap-filter.js` | `_config.yml` 設輸出 `sitemap.xml`。filter 只把 `reading-desk.json`、`microblog.json`、`life-index.json` 的 page `sitemap` 設 false；它是搜尋引擎 URL 清單控制，不是檔案輸出 filter。 | 舊快照 `/sitemap.xml` 存在；本次抽查的三個排除 endpoint 與 random/navigation/calendar/content-categories/search/feed endpoints 都未在快照 sitemap 找到，但檔案本身仍存在。sitemap 可揭露被提交的 HTML URL。 | 不在 sitemap 不等於未公開；直接 URL、外站引用或其他索引仍可存取。各 post/page URL 是否入 sitemap 由 plugin 與 page metadata 控制，不受 A/B 面向自然影響。 |

## 舊 `public/` 快照的唯讀存在性摘要

下列是檢查當時的路徑狀態，僅為快照證據；沒有重建或逐筆比對來源內容。

| 檢查項目 | 快照狀態 |
| --- | --- |
| HTML：`/`、`/random/`、`/archives/`、`/categories/`、`/tags/`、`/reading-log/`、`/reading/`、`/photos/`、`/calendar/`、`/status/` | 10/10 路徑存在。 |
| 固定樣本 `/work/from-real-work-to-features/`、`/learning/website-quality-testing-roadmap/` | 兩個 HTML 路徑存在。 |
| 規劃入口 `/profile/` | `public/profile/index.html` 不存在；來源頁也不存在。 |
| Root-level feeds／index／資料端點：`atom.xml`、`search.xml`、`sitemap.xml`、`random.json`、`navigation-index.json`、`reading-desk.json`、`content-categories.json`、`calendar.json`、`calendar-posts.json`、`microblog.json`、`life-index.json` | 11/11 路徑存在。 |
| 原始來源路徑 | `public/reading-desk.yml`、`public/_data/calendar.json`、`public/_data/content-categories.yml`、`public/_data/content-tags.yml` 均不存在；reading-desk 有轉換後 JSON。`microblog.json` 與 `life-index.json` 雖有同名 snapshot，但雜湊與目前來源不同，未能證明內容相同。 |
| 圖片來源路徑 | 568/568 個 `source/images/` 相對路徑在 `public/` 存在。 |

## surfaces 未來應用的層次與不能取代的保護

1. **公開資格先於面向。** 先決定來源是否可以出現在任何公開建置／靜態檔；私人資料不能留在 `source/` 公開路徑，再期待後續 filter 處理。
2. **面向只控制入口與公開集合。** 按契約將共用正規化結果接到文章清單、搜尋索引、隨機資料、recent list、archive/category/tag（若納入範圍）及 profile-home 策展等消費層；每一層都要明確過濾，否則不會自動生效。
3. **所有會序列化內容的出口要獨立檢查。** `microblog.json`、`reading-desk.json`、`navigation-index.json`、`random.json`、`search.xml`、Atom feed、calendar detail JSON、頁面 HTML、圖片和 sitemap 必須分別依 WBS 的公開決定排除或篩選。A/B 不會阻止直接 permalink、JSON/XML URL、圖片路徑或從既有連結到達頁面。
4. **`published`／draft、sitemap 排除和 UI 隱藏都不是隱私。** `published: false` 在 `source/` JSON/YAML 上亦不能保證檔案未被複製；不列 sitemap 也不阻止直接請求；沒有頁面連結仍可被猜測或外部引用。

目前 1.4 的 `content-check` 只驗欄位與引用，不改公開輸出。現有產生器／主題尚未消費 `surfaces`；本文不宣稱 A/B 過濾已實作。

## WBS 2.2 作者需判斷的類型與風險

以下是待作者逐項／逐批核准的**風險類型**，不是對任何具體文章、紀錄或圖片的判定：

| 類型 | 需考量的風險 | 2.2 可選處理 |
| --- | --- | --- |
| 工作知識／專案經驗文章 | 可能帶有雇主、客戶、內部流程、未公開專案或可反推身分的細節。 | 保留公開（必要時去識別）、先去識別後公開、轉私人保存。 |
| 生活／隨筆／歌曲／閱讀影評文章 | 涉及他人姓名／關係、地點與時間組合、個人生活細節或第三方作品／連結。 | 保留公開、去識別／降低定位細節、轉私人保存。 |
| 學習筆記與 reading-desk 附註 | 原始來源、個人進度、尚未驗證結論、引用內容及 item note 可能比文章摘要暴露更多脈絡。 | 保留公開、修整來源／附註後公開、轉私人保存。 |
| microblog | 短句可能帶明確時序、人際或即時情緒；ID 錨點持久且 raw JSON、status page、搜尋索引皆可暴露。 | 保留公開、去識別／移除可定位資訊、轉私人保存；另保留或淘汰時核定 ID／錨點影響。 |
| 原始／轉製圖片 | 人像、位置、時間、EXIF、文件截圖、未遮蔽識別資訊、原圖與 WebP／縮圖並存。 | 保留公開、遮蔽／去 metadata 後公開、移到不參與建置的私人位置。 |
| 根 JSON/YAML、feed、搜尋／索引／日曆輸出 | 同一筆內容可能經靜態複製及多個產生器重複暴露；刪掉 UI 入口不會刪掉其他 URL。 | 決定來源是否可進公開系統，再規定所有衍生輸出的排除與驗證方式；不以 A/B 或不列 sitemap 代替。 |
| 功能頁與頁面內嵌內容 | 自訂 Markdown 可能把資料直接編進 HTML，或透過 JS fetch 公開 JSON；它不屬於文章 `surfaces`。 | 保留頁面公開但檢視嵌入資料；去識別；或把不應公開內容從公開來源移開。 |

2.2 的決策應記錄到「哪個來源／記錄集合、保留公開／去識別／轉私人、是否需改衍生輸出、既有 URL／ID 影響、作者確認」。本盤點沒有複製任何可能敏感的原文，也不替作者預選選項。

## 未知與限制

- `public/` 是已存在的快照，無法從路徑存在推論它與目前來源一致；本次 microblog、life-index 雜湊已證明兩者不完全相同。沒有 build、HTTP 或線上檢查。
- `source/_data/calendar.json` 沒有找到本專案自訂程式直接引用，public 同路徑不存在；是否被未搜尋到的 Hexo/theme/plugin 擴充使用未知，需另行確認。
- 沒有檢查圖片 EXIF、圖像內容、文章全文、microblog 原文或學習附註的敏感性；2.2 必須由作者做公開決策。
- 目前各 consumer 尚未使用 `surfaces`；除 WBS 1.4 的建置前欄位驗證外，本文不表示資料已按面向篩除。
