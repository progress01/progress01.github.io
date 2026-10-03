# 雙面部落格內容面向與成熟度資料契約（WBS 1.1、8.1）

版本日期：2026-09-27（Asia/Taipei）
工作包：WBS 1.1「定義欄位規格」、WBS 8.1「成熟度資料契約」
狀態：面向規格、成熟度契約與共用 helper 已完成；WBS 8.2 探索中資訊呈現、8.3 新文章 scaffold、8.4 發布驗證訊息及 8.5 作者發布 SOP 均已完成；G8 通過。下一步 WBS 9.1。
適用施工：[雙面部落格 WBS](dual-surface-blog-wbs.md)；前置基準：[Git 與資料流](dual-surface-blog-baseline.md)、[路由與內容樣本](dual-surface-blog-samples.md)、[驗收與回復規則](dual-surface-blog-validation-and-recovery.md)。

本規格定義公開內容「在哪個面向可被入口、搜尋或清單找到」。A、B 都是公開呈現方式，不表示存取權限。本文的候選文章與樣本不構成作者的內容核准。

## 1. 欄位與正規值

欄位名稱固定為 `surfaces`，值是非空陣列；每個陣列元素必須是大小寫完全相符的字串。

| 值 | 面向 | 意義 |
| --- | --- | --- |
| `profile` | A 面 | 可在「工作與學習」履歷入口及其面向搜尋／清單中被找到。 |
| `memory` | B 面 | 可在 `/memory/` 的個人記憶探索及其面向搜尋／清單中被找到。 |

唯一正規順序為 `profile` 在前、`memory` 在後：

```yaml
surfaces: [profile]
surfaces: [memory]
surfaces: [profile, memory]
```

輸入 `[memory, profile]` 會正規化為 `[profile, memory]`。重複值去重，例如 `[memory, profile, memory]` 變為 `[profile, memory]`，同時由建置前內容檢查提出可定位的警告，供作者整理來源。去重不會產生第二筆內容。

## 2. 缺漏、空值與無效值

「欄位不存在」與「欄位明確給了無效值」是不同情況。只有欄位完全不存在才適用相容預設。

| 輸入 | 預期行為 |
| --- | --- |
| 舊文章省略 `surfaces` | 以 `[memory]` 解讀，維持既有文章承接至 B 面的相容規則。舊文身分由 surface 契約啟用前的既存來源／相容清單界定，不用文章日期或檔案時間猜新舊。 |
| 契約啟用後新文章省略欄位 | 建置前檢查錯誤；新文章必須明確填寫一個或兩個允許值。文章 scaffold 的 `surfaces: []` 是刻意未完成的阻擋占位，發布前必須換成合法值。 |
| 舊 microblog／standalone learning item 省略欄位 | 以 `[memory]` 解讀。既有私人性不能由此預設；其來源是否可公開仍是獨立決策。 |
| 舊 linked learning item 省略欄位 | 繼承其已解析的目標文章 `surfaces`，因此不擴大文章可見面向；目標文章按本文規則解析。 |
| 新 microblog／reading-desk item 省略欄位 | 建置前檢查錯誤；未來發布範本提供明確值。本工作包不改來源或範本。 |
| `surfaces: []` | 錯誤。新文章 scaffold 暫留此占位時代表尚未完成發布選擇；空陣列不是私人、隱藏、或「不顯示於任何面」的合法值。 |
| `surfaces: null`、裸 `surfaces:` | 錯誤；明確 null 不視為欄位缺漏。 |
| `surfaces: profile` 或單一字串 | 錯誤；欄位必須是陣列，即使只有一個值也一樣。 |
| 整數、布林、物件、混合型別或巢狀陣列 | 錯誤；不做隱式字串化或型別轉換。 |
| 未知值，例如 `private`、`work`、`PROFILE` | 錯誤；只接受精確的 `profile`、`memory`。 |
| 大小寫錯誤、值前後多空白，例如 `Profile`、` profile ` | 錯誤；不自動轉小寫或 trim，避免拼錯被靜默接受。 |
| 重複的允許值 | 正規化時依正規順序去重，並提出警告；不把它當成兩份內容。 |

未知或錯誤值不得靜默改成 `memory`。預設只供「欄位不存在的合格舊資料」相容，不能掩蓋新資料錯誤。

## 3. 適用資料類型

### 已發布文章 posts

- 所有作為文章內容記錄的已發布 post 均使用此欄位，包括一般文章、工作知識、學習文章及站務文章。
- 現有文章缺欄位時按舊文相容規則為 `[memory]`。新文章 scaffold 以 `surfaces: []` 阻止遺漏選擇；發布前必須明確選擇，不能根據分類、標籤、檔名或 `work_knowledge`／`learning` 等其他欄位推測面向。
- `draft: true`、`published: false` 或尚未進入公開建置的內容，不因設定 `surfaces` 而自動公開；發佈狀態與面向判斷彼此獨立。

### microblog

- 每筆要進入公開索引或可瀏覽入口的 microblog 記錄使用 `surfaces`；值依 JSON 陣列規則序列化，例如 `"surfaces": ["memory"]`。
- 基準中既有缺欄位紀錄相容解讀為 `[memory]`；新紀錄在範本／檢查流程啟用後必須明確填寫。
- 不因 `surfaces` 新增、編輯或排序而重算、替換既有 `id`。`published`／`draft` 仍控制是否進索引，`surfaces` 不變更其公開狀態。

### reading-desk learning item

- 沒有指向本站已發布文章的 item 是 standalone learning item，需有自己的 `surfaces`；舊 item 缺欄位預設 `[memory]`，新 item 必須明確填寫。
- item 的 `url` 若指向本站且可正規化到已發布文章，即為 linked learning item。外部 URL 或沒有文章目標的 item 屬 standalone；本站 URL 指向不存在／未發布文章屬無效引用，不能降級成 standalone 以繞過檢查。
- 新 linked item 必須明確設定非空 `surfaces`，而且必須是目標文章正規化後面向的子集合。不可藉 learning item 擴大文章資格。例如目標只有 `[profile]`，linked item 可為 `[profile]`，不得為 `[memory]` 或 `[profile, memory]`。
- 既有 linked item 欄位缺漏時繼承目標文章面向，視為相等子集合，避免舊資料因新增規則而擴大範圍。繼承後仍需檢查目標存在及已發布。
- 合併 linked item 到文章搜尋紀錄時，文章本身的 `surfaces` 不被 item 擴大；item 附註／加入事件只在 item 自己聲明的面向可見。整體搜尋仍為同一文章一筆，不能複製第二個文章結果。
- standalone item 使用自身面向。它可依索引既有方式連到 `/reading/` 或安全外部來源，但不能因此取得文章 permalink 或被當作文章首頁策展項目。

### pages 與站務

- 功能頁面（例如 `/`、`/random/`、`/reading/`、`/photos/`、`/calendar/`、`/status/`、分類／標籤導覽頁及未來 `/profile/`）是固定路由與入口，不是可被隨機抽取或被文章清單收錄的內容紀錄；它們不使用 `surfaces`。其面向由路由／版型提供，不能以缺欄位預設套用。
- 若未來頁面含可獨立搜尋、引用的長篇內容，應先明確設計其內容記錄型別；不能把功能頁默默當成 post 或以 `surfaces` 欄位改變頁面路由。
- 分類為「站務」的已發布文章仍是 posts，欄位適用；舊文章缺欄位相容為 `[memory]`，新文需明確設定。但 `surfaces` 不會推翻現有「站務」隨機排除規則。站務是否可出現在一般搜尋／清單由面向過濾和各入口原有站務規則共同決定，若要改變需另列工作範圍與驗收。

## 4. Profile 封面與 A 文章庫

- `/` 與 `/profile/` 是 A 面文章首頁：依已發布文章的 `surfaces` 選出含 `profile` 的文章，按完整發表時間由新到舊顯示日期與標題，每篇只連到原文章 URL。清單上方搜尋欄依文章標題與標籤即時篩選，不預載全站搜尋索引；無 JavaScript 時仍顯示完整清單；首頁不載入 ECharts，也不引用 B 面全站日曆資料。文章更新日期仍由內容檢查驗證，但不在首頁另列更新事件；不顯示摘要、標籤或人工 featured 清單。
- `/profile/articles/` 是 A 面完整文章庫：顯示全部含 `profile` 的已發布文章，依日期新到舊；標籤篩選與計數只讀文章既有 front matter tags，不推導面向或新增標籤。
- `source/_data/profile-home.yml` 中的舊三路徑人工策展資料保留作內部歷史／驗證資料，不是正式 UI，不是文章分類欄位，也不能替文章宣告面向。
- 每個引用必須是目前存在、已發布的本站文章 URL，且該文章解析後的 `surfaces` 必須包含 `profile`。引用不存在、未發布、重複或不含 `profile` 的文章都應由驗證器報錯並定位策展項目。
- 封面與文章庫均以文章 URL 去重，兩頁只引用同一篇文章的原 permalink，不複製正文、不改 canonical；兩頁是不同用途，不是同一列表的重複路由。
- 舊策展資料的存在不會縮小 A 面列表；文章資格只依已發布狀態與明確的 `profile` surface 決定。

## 5. 面向與公開權限完全分離

- `surfaces` 只表示公開內容在 A、B 哪些入口可被推薦、搜尋或列入面向清單；它不是 ACL、登入、密碼或私密旗標。
- `surfaces: [profile]` 不會使文章比 B 面更私密；`surfaces: [memory]` 也不代表不會被外部訪客直接開啟。
- 私人內容不得置於會被公開建置的來源或產物中，包括文章公開來源、`source/microblog.json`、`source/reading-desk.yml` 或 `public/`。CSS 隱藏、排除索引、`published: false` 的前端過濾或空面向陣列都不能取代私人存放邊界。
- `published: false`／`draft: true` 不是隱私權限。特別是位於 `source/` 的 JSON／YAML 仍可能被複製至公開輸出；若資料不能公開，必須在來源邊界排除或移至不參與公開建置的位置，不能只靠索引器略過該筆。
- `published`／`draft` 等發佈狀態和「是否有權公開」必須先於面向篩選；只有確定可公開的內容才進入公開索引，再以 `surfaces` 決定其公開入口。

## 6. 各入口如何消費同一欄位

所有產生器及瀏覽器入口共用同一套正規化結果，不自行由分類、標籤、頁面路徑或檔名推導面向。

| 消費者 | 未來面向規則 |
| --- | --- |
| 隨機抽籤 `/`、`/random/` | B 面入口只從包含 `memory` 的已公開文章抽取；雙面文章仍是一個候選。保留既有 type／站務等排除條件。只含 `profile` 的文章不進 B 面抽籤。 |
| 搜尋 | 維持一份全站索引，每筆文章只有一筆記錄並帶正規化 `surfaces`。從 A 面開啟預設篩 `profile`，從 B 面開啟預設篩 `memory`；可切換「全部公開內容」。雙面文章在任一範圍均不得重複。Standalone learning item 依其面向；linked item 不擴大目標文章面向。 |
| 面向文章清單／最近文章 | A 面只取含 `profile` 的文章，B 面只取含 `memory` 的文章；「全部公開」清單不因面向重複同一文章。保留各清單本身的排序、分類與日期語意；面向規則只限定資格。 |
| A 面文章列表 | 顯示含 `profile` 的已發布文章，依日期新到舊、URL 唯一；標籤篩選只使用文章既有 tags。舊 `profile-home.yml` 三路徑資料不渲染。 |
| 固定功能頁與站務排除 | 路由頁本身不讀取或繼承文章 `surfaces`。站務 post 即使有 `memory` 也仍受既有隨機排除規則；搜尋／清單按其各自明確規則處理。 |

跨入口引用文章時保留一個來源檔、一個 permalink 及一個 canonical URL。A/B 的切換由路由和普通連結決定；`surfaces` 不產生另一版正文或另一個網址。

## 7. 需後續確認與實作的項目

- 本規格尚未決定任何現有文章、microblog 或 learning item 的實際 A／B 資格；文章清單及私人邊界仍須依 WBS 2.2、3.2 逐項確認。
- 舊文相容集合的機械化識別方式須在實作驗證器時定案：應以此規格啟用前的版本化清單／基準識別為依據，不可拿文章日期或檔案時間猜測。WBS 1.1 不實作此機制。
- 新文章 scaffold 已提供明確面向占位；microblog 與 reading-desk 新項目的範本／檢查流程仍待後續工作落實。
- `/profile/` 與 `profile-home.yml` 的實際建置及策展資料依各自 WBS 工作包維護；本契約不替作者核准新的策展選文。
- linked learning item 附註依自身子集合面向呈現的資料模型尚待 WBS 1.2／1.3 轉成 helper 與測試；本文件定義預期，不宣稱程式已遵守。

## 8. 文章思考成熟度欄位（WBS 8.1）

本節只適用於文章 front matter。思考成熟度是文章目前整理狀態的明確聲明，與文章在哪個公開面向出現、能否公開、學習項目狀態及首頁策展狀態各自獨立。不得依文章日期、分類、標籤、正文或其他狀態自動推定成熟度。

### 8.1 唯一允許狀態與完整範例

目前唯一允許的 `thinking_status` 值是大小寫及空白完全相符的 `exploring`：

```yaml
thinking_status: exploring
thinking_updated: 2026-09-27
thinking_boundary: 目前只整理個人實作經驗，尚未涵蓋大型團隊情境。
```

只要提供 `thinking_status: exploring`，就必須同時提供 `thinking_updated` 與 `thinking_boundary`。成熟或不需聲明成熟度的文章省略整組三個欄位；三欄全缺是合法預設，不輸出任何狀態。不得新增 `stable`、`published`、`revising` 等狀態值，也不得替既有或新文章自動補值。

### 8.2 欄位格式及錯誤

| 欄位 | 規則 |
| --- | --- |
| `thinking_status` | 必須是精確字串 `exploring`；大小寫不同、前後空白、未知字串、`undefined`、`null` 或非字串均錯誤。 |
| `thinking_updated` | 必須是真正存在的西曆（Gregorian）日期字串 `YYYY-MM-DD`。只接受四位年、兩位月日與連字號；拒絕 Date 物件、datetime、斜線、空白包裹及不存在的日期（包括無效閏日）。 |
| `thinking_boundary` | 必須是字串；前後空白會 trim，trim 後不得為空。 |

欄位是否「缺少」依文章 front matter 的 own property 判斷。三欄真正缺少時為合法預設；若沒有 `thinking_status`，但 `thinking_updated` 或 `thinking_boundary` 有明確欄位（即使值為 `undefined`、`null` 或空字串），屬孤兒欄位並報錯。若狀態存在但同伴缺少、錯型或空值，亦報錯。錯誤需提供穩定 code、來源上下文及欄位名稱，訊息不得回顯文章正文或欄位內容。

共用 helper 可回傳正規化狀態、日期、trim 後邊界及最小顯示布林值；它不修改 front matter，也不驗證此工作包以外的額外欄位。相對日期矛盾由 WBS 8.4 發布驗證處理；WBS 8.1 只驗證欄位格式與條件依賴。

### 8.4 發布驗證訊息

- `npm run check:content` 掃描所有 `source/_posts` 文章，直接重用 `tools/lib/thinking-status.js`。三個 thinking 欄位全缺仍是合法預設；部分、錯型或非法欄位使檢查失敗，不批次補值。
- 成熟度錯誤訊息固定包含來源相對路徑、欄位名稱、穩定錯誤 code 與繁體中文修正方式。訊息不回顯正文或 `thinking_boundary` 的實際內容。surface 錯誤亦包含來源、欄位、code 與明確的合法值修正方式；舊文相容清單與缺欄預設維持不變。
- 只有合法的 `exploring` 三欄組合會進行相對日期檢查：`thinking_updated` 不早於文章 `date` 的字面日曆日期；若有合法 `updated`，不晚於其日曆日期；並且不晚於 Asia/Taipei 今日。日期比較忽略時區時間部分，按欄位所寫日曆日判定。
- 若文章 `date` 無效，或明確提供的 `updated` 無效，相對日期檢查不執行；原有欄位檢查負責指出格式錯誤，避免連鎖誤報。檢查器支援注入時鐘，以固定台北今日進行測試。
- 每篇文章依穩定路徑順序掃描，surface 與 thinking 問題可並列回報，不會在第一個錯誤處停止整體掃描。

### 8.3 與面向、公開性及其他狀態的邊界

- 思考成熟度與 `surfaces` 完全獨立；同一組 thinking 欄位搭配 `profile`、`memory`、雙面或未填 surface，解析結果相同。成熟度 helper 不讀取或寫入 `surfaces`、分類、標籤或其他資料狀態。
- `exploring` 不是公開許可，也不是隱私保護。探索中的文章只有在作者已決定可公開、且來源會進公開建置時，才可能公開；不得由此狀態推論文章可以上線。
- 本契約的文章 `thinking_status` 與 linked／standalone learning item 的面向規則無關，也不改變學習資料自己的欄位或狀態。
- `source/_data/profile-home.yml` 策展項目的 `status` 是策展資料狀態，不是文章成熟度；不得修改或拿它代替文章的 `thinking_status`。
- 8.1 建立成熟度資料契約與純 helper／測試；8.2 呈現、8.3 文章 scaffold、8.4 發布驗證及 8.5 作者發布 SOP 均已完成。新文章 scaffold 僅以 YAML 註解說明探索中欄位，成熟文章省略整組 thinking 欄位；G8 已通過。

## 9. 新文章 scaffold（WBS 8.3）

`scaffolds/post.md` 與 `scaffolds/draft.md` 的 `surfaces: []` 是未完成、會阻擋發布的提醒占位，不是合法面向，也不代表私人或不公開；發布前須改成 `[memory]`、`[profile]` 或 `[profile, memory]`。註解依序提醒公開判斷、面向、探索中成熟度欄位及首頁策展為選填；提示只在 front matter，成熟文章省略整組 thinking 欄位。首頁策展不在 scaffold 預填，文章發布也不會自動成為 A 面代表作。固定功能頁使用 `scaffolds/page.md`，不加入文章面向欄位。

## 10. 作者發布 SOP（WBS 8.5）

一般文章的發布順序與作者操作方式見[一般文章發布 SOP](dual-surface-publishing-sop.md)。該流程依序分開判斷公開資格、文章面向、成熟度聲明與 A 面首頁策展；一般文章全部置於公開來源，不建立 repository 內私人目錄，且 A／B 入口不產生第二篇文章或第二個 URL。成熟文章省略整組成熟度欄位，探索中才填完整三欄並遵守 8.4 日期規則；首頁策展選填，不自動加入文章或要求額外摘要。發布候選前的 `verify` 會 clean/build 並改寫 `public/`；部署仍是獨立外部操作，需當次明確授權。本 SOP 不宣稱已部署，也不涵蓋 WBS 9.1 視覺規則。
