# 雙面部落格公開邊界作者決策表（WBS 2.2）

建立日期：2026-09-25（Asia/Taipei）  
進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`  
依據：[WBS](dual-surface-blog-wbs.md)、[公開資料流盤點](dual-surface-public-data-flow.md)、[內容面向契約](dual-surface-content-contract.md)、[路由與樣本](dual-surface-blog-samples.md)、[驗收與回復規則](dual-surface-blog-validation-and-recovery.md)、[不可變原則](dual-surface-blog-wbs.md#2-不可變更的施工原則)。

## 狀態與使用方式

此表是作者決策表，不是 AI 分類結果。凡未明確選定並記錄的項目一律 **HOLD**；不會因現況已能在 `public/` 開啟，就推定作者再次核准，也不會因內容像工作／生活／學習，就自動判為可公開或私人。本文件不複製文章、microblog、learning 附註或圖片原文／影像，不列姓名、雇主、客戶或未公開專案資訊。

每列的作者選項均為：

- **P — 保留公開**：作者確認此來源可公開；下一步不搬私人原文，後續由 WBS 3.2 另行決定公開面向。
- **D — 去識別後公開**：作者確認可公開經整理的版本；如原始內容需保留，WBS 2.3 必須先決定 Git／建置來源之外的私人保存方式，2.4 僅依核准方案保留原件、建立去識別公開版並維持核准的 URL／ID。
- **V — 轉私人**：作者確認不得公開；WBS 2.3 先確定不在 repository、`source/`、`public/` 或部署輸出內的私人保存位置，WBS 2.4 才能遷移／移除公開來源並保存可恢復副本。既有 URL／ID 的失效或替代方式需另核准。
- **R — 需逐項複查**：維持 HOLD，不改來源、不搬移、不新增 `surfaces`；作者逐項審閱後再記錄 P／D／V。

決策填寫格式：`選項（P/D/V/R）｜核准範圍與例外｜作者確認日期`。範圍不清、第三方資料、原始素材缺漏或 URL／ID 影響未決時，選 R 並 HOLD。公開決策與 A/B 面向是兩個階段；**A/B 不是隱私控制**。

## 作者決定更新（2026-09-26，非碎碎念範圍已定案）

作者已確認以下邊界：

1. **只有 microblog 需要 P／D／V 判斷。**不適合公開的 microblog 可選 D（去識別後公開）或 V（轉私人）；其餘內容不使用 D 或 V。
2. **文章 P-01–P-06、reading-desk learning item L-01–L-24、圖片 I-01／I-02，以及功能與衍生輸出 O-01–O-04 全部定案為 P（直接公開）。**下方各盤點表保留施工前的風險摘要作為歷史依據；其中「R／未決 HOLD」不再適用於這些非 microblog 項目，以本節作者決定為準。
3. **I-01／I-02 的 568 張圖片保留公開。**作者將圖片視為個人保存兼分享內容，並表示已有出處標示；既有路徑、原圖／縮圖與文章引用不因公開邊界階段搬移或刪除。出處標示不被記錄成第三方授權證明；EXIF、人物同意等可另作非阻塞的網站維護檢查，但不再是 WBS 2.2 的 HOLD，也不得未經另行授權修改圖片。
4. **公開衍生輸出維持公開並跟隨來源。**若某筆 microblog 最終選 D 或 V，`/status/`、`/microblog.json`、`navigation-index.json` 及其他含該筆資料的公開輸出必須同步只保留核准公開版或排除該筆；不能只從畫面隱藏。

作者已於 2026-09-26 核准 microblog 首輪建議：19 筆 P、M-14／M-18 為 D、M-17 為 V。至此 WBS 2.2 的公開邊界已完成，不再有未決內容分類；V microblog 的私人保存位置、公開舊錨點處理及 ID 保存方式屬 WBS 2.3，尚未設計或執行。

## 已確認原則（不重問）

以下是既有規劃已確認的公開底線，不是逐篇文章的公開許可：

1. 純負面宣洩、不適合公開的未整理情緒不公開；人事摩擦、可辨識的同事／主管／客戶／親友衝突不公開。
2. 未公開專案名稱、內部流程、帳號、數字、文件或商業資訊不公開；他人故事與隱私不公開，即使作者本人不介意。
3. 公開碎片需整理出脈絡與反思，去掉他人隱私及未公開專案細節；原始情緒／內部資料留在私人來源。
4. 探索中內容可以公開，但須標示思考狀態、最近校準日期與適用邊界；成熟度與展示面向分開決定。
5. `profile`／`memory` 是可公開內容的展示面向，不是權限；B 面不稱私人模式。私人內容不得放入公開建置來源或依賴 CSS、搜尋、sitemap、按鍵或 `published` 狀態隱藏。
6. 保留既有文章 permalink、日期、正文與 microblog 持久 ID；任何例外需作者另行核准，不在本表預先假設可更改。

原則來源為已確認的 [WBS 不可變施工原則](dual-surface-blog-wbs.md#2-不可變更的施工原則)、[跨角色設計審查決議](dual-surface-blog-wbs.md#5-模擬跨角色設計審查) 及 [內容判斷標準](dual-surface-blog-plan.md#4-內容判斷標準與範例)。

## A. 文章來源批次

盤點基準為版本化舊文清單 `tools/data/legacy-surfaces.v1.json`：共 271 篇。manifest 只代表 2026-09-25 基準既有紀錄可按舊文契約缺少 `surfaces`，**不代表公開邊界或 A/B 核准**。目前舊快照中文章頁與衍生索引／feed 可公開請求；各列所有選項未決均是 HOLD。

| 決策 ID／來源範圍與穩定識別 | 數量／目前暴露面 | 保守建議與中性風險摘要 | 作者選項／狀態 |
| --- | --- | --- | --- |
| P-01 `source/_posts/實驗室/**`；依 manifest 精確來源相對路徑逐篇識別 | 32 篇；文章 permalink、首頁／archive/category/tag、`random.json`、`calendar-posts.json`、`navigation-index.json`、`search.xml`、Atom、sitemap 等依各輸出規則可暴露。 | **R**。技術／工作／學習題材混合，需檢查是否含內部流程、專案情境、第三方資訊或未校準結論；檔名／分類不作決定。工作知識系列 01–07 是這批內的優先逐篇核對子集，見 P-02。 | P / D / V / R；未決 HOLD。 |
| P-02 `source/_posts/實驗室/` 中與 L-18–L-24（`reading-topic-17`–`23`）各自 permalink 對應的七篇來源；以 manifest 相對路徑及 front matter permalink 識別 | 7 篇；除 P-01 所列文章頁與搜尋／feed 等外，亦由 `source/reading-desk.yml` 的七個 linked item 引用並出現在閱讀台／reading-desk JSON／導航索引。 | **R**。作者需確認每篇是否已充分抽象／去識別，避免真實工作背景可反推單位、人員、客戶或未公開專案；不摘錄內容。 | P / D / V / R；未決 HOLD。 |
| P-03 `source/_posts/歌曲推薦/**`；manifest 路徑 | 121 篇；文章頁、分類／tag、搜尋／navigation index、隨機資料（保留既有排除規則）、feed 等。 | **R** 批次初篩，再對特例選 P/D/V。考量個人資訊、第三方作品／連結及圖像授權；此建議不是判定需下架。 | P / D / V / R；未決 HOLD。 |
| P-04 `source/_posts/閱讀影評/**`；manifest 路徑 | 106 篇；文章頁、分類／tag、搜尋／索引、feed；部分文章可能被其他資料引用。 | **R**。逐篇確認引用、第三方作品資訊、外部連結及私人閱讀脈絡；不據標題推定公開資格。 | P / D / V / R；未決 HOLD。 |
| P-05 `source/_posts/隨筆/**`；manifest 路徑 | 10 篇；文章頁、生活／分類清單、搜尋／索引、日曆與 feed 等。 | **R**。生活內容可能含關係、人際、地點、時間組合；依已確認原則，公開碎片須有脈絡／反思並去除他人隱私。 | P / D / V / R；未決 HOLD。 |
| P-06 根目錄 `source/_posts/*.md`（manifest 根層 2 篇；穩定來源相對路徑） | 2 篇站務／入口文章；文章頁、首頁／archive、搜尋／feed 等。 | **R**。檢查是否含只供管理的網址、配置或不應公開的操作細節；現有「站務」類別不等於公開許可或私人標籤。 | P / D / V / R；未決 HOLD。 |

P-02 是 P-01 的子集，不另外增加文章總數。其可對照既有配對 URL 為 `/work/from-real-work-to-features/`、`/work/meeting-transcripts-to-judgment-model/`、`/work/two-project-mental-models/`、`/work/risk-based-review/`、`/work/transferable-project-capabilities/`、`/work/ai-external-mentor-dual-track/`、`/work/pm-sa-foundation-map/`；文章日期均為 2026-09-17（文章發表日期，不是實際工作事件日期）。實際來源檔名請以 manifest／front matter permalink 為準。表格內數量合計（扣除 P-02 重疊）271 篇。

## B. Microblog（22 筆，逐 ID 決策）

穩定識別為 `source/microblog.json` 的既有 `id`；日期是紀錄日期。這些 ID 亦可能出現在 `/status/#<id>`、`/microblog.json`、`navigation-index.json`；公開快照／清單不是重新核准。下表只列 ID 與日期，不列原文。每筆保守建議 **R**：作者逐筆確認是否有需整理的個人情緒、人際、時序、工作或第三方脈絡；摘要僅是待查風險類型，不表示已發現問題。

| 決策 ID／穩定來源識別 | 日期 | 目前暴露面 | 保守建議／選項／狀態 |
| --- | --- | --- | --- |
| M-01 `micro-6fb6d85537a4a5ef` | 2026-09-21 | `/status/`、`/microblog.json`、可能進 `navigation-index.json` | R；P / D / V / R，HOLD。 |
| M-02 `micro-eb32bead8a7f4ba4` | 2026-09-21 | 同上 | R；P / D / V / R，HOLD。 |
| M-03 `micro-58d6fcb8366d0ea2` | 2026-09-14 | 同上 | R；P / D / V / R，HOLD。 |
| M-04 `micro-56bb6eec75c50bcd` | 2026-09-13 | 同上；固定驗收錨點 `/status/#micro-56bb6eec75c50bcd` | R；P / D / V / R，HOLD。 |
| M-05 `micro-6180bbcc81eac7a6` | 2026-09-13 | `/status/`、`/microblog.json`、可能進 `navigation-index.json` | R；P / D / V / R，HOLD。 |
| M-06 `micro-7c64c6de2457cd8c` | 2026-09-13 | 同上 | R；P / D / V / R，HOLD。 |
| M-07 `micro-103d0f8677c205f2` | 2026-09-13 | 同上 | R；P / D / V / R，HOLD。 |
| M-08 `micro-4c2a555765850db9` | 2026-09-13 | 同上 | R；P / D / V / R，HOLD。 |
| M-09 `micro-7490c58b3f36e65e` | 2026-09-13 | 同上 | R；P / D / V / R，HOLD。 |
| M-10 `micro-0580962024b4e39b` | 2026-09-13 | 同上 | R；P / D / V / R，HOLD。 |
| M-11 `micro-3a42a89c827ed2db` | 2026-09-13 | 同上 | R；P / D / V / R，HOLD。 |
| M-12 `micro-4063048ba963f601` | 2026-09-04 | 同上 | R；P / D / V / R，HOLD。 |
| M-13 `micro-4f9df5a059cc3daf` | 2026-09-04 | 同上 | R；P / D / V / R，HOLD。 |
| M-14 `micro-e410b2604c189eb4` | 2026-09-04 | 同上 | R；P / D / V / R，HOLD。 |
| M-15 `micro-ca4c6e02fb6679d1` | 2026-09-03 | 同上 | R；P / D / V / R，HOLD。 |
| M-16 `micro-24781abe30531cae` | 2026-08-31 | 同上 | R；P / D / V / R，HOLD。 |
| M-17 `micro-b66fecaa3574c31a` | 2026-08-28 | 同上 | R；P / D / V / R，HOLD。 |
| M-18 `micro-7a5980df9ed2f10a` | 2026-08-28 | 同上 | R；P / D / V / R，HOLD。 |
| M-19 `micro-bbc9536698dcf2e3` | 2026-08-26 | 同上 | R；P / D / V / R，HOLD。 |
| M-20 `micro-5a371042f6b6d3a3` | 2026-08-26 | 同上 | R；P / D / V / R，HOLD。 |
| M-21 `micro-5cca573a3c022cbc` | 2026-02-05 | 同上 | R；P / D / V / R，HOLD。 |
| M-22 `micro-1f120a0ce64684fb` | 2026-01-21 | 同上 | R；P / D / V / R，HOLD。 |

### Microblog 作者核准結果（2026-09-26，不改來源）

下表不複製原文；作者已核准整批結果，本階段仍不直接修改來源。

| 決定 | 決策 ID／穩定 ID | 中性理由 | 核准狀態 |
| --- | --- | --- | --- |
| P | M-01–M-13、M-15–M-16、M-19–M-22（共 19 筆） | 作品推薦、技術／學習想法、自我反思或一般生活感受；未見需要轉私人才能處理的明確內容。 | 已核准。 |
| D | M-14 `micro-e410b2604c189eb4` | 目前是缺少觀察脈絡的單句自我評價；補上觸發情境、理解或下一步後公開，不轉私人。 | 已核准分類；公開改寫文字在 2.4 施工前確認。 |
| D | M-18 `micro-7a5980df9ed2f10a` | 同時含直接的管理批評與可保留的方法反思；去除指向他人的批評及現場細節，保留「文件、資訊對齊、抽象需求拆解」的通用觀察。 | 已核准分類；公開改寫文字在 2.4 施工前確認。 |
| V | M-17 `micro-b66fecaa3574c31a` | 主要是未整理的工作情緒、人事摩擦與內部執行細節，符合既定不公開原則；原文先安全保存，再從所有公開輸出排除。 | 已核准。 |

WBS 2.2 已完成；D 的實際文字、V 的私人保存位置與舊錨點處理，分別在 2.3／2.4 依規則執行，不在本表直接改資料。

## C. Reading-desk learning items（24 筆，逐 item 決策）

穩定識別為 `source/reading-desk.yml` 的 item `id`（不是陣列序號）；日期為加入草稿夾日期。已連結文章的 item 還會帶出目標文章 URL／搜尋索引資料；standalone item 可能以 JSON／索引自身呈現。表內不列標題、note 或內文。所有項目先建議 **R**，作者逐筆確認學習進度、引用、私人工作／生活脈絡及目標文章範圍；其中目標文章若選 D/V，必須一併決定 linked item 的處理。所有選項均 HOLD。

| 決策 ID／穩定來源識別 | 加入草稿夾日期 | 目前暴露面 | 保守建議／選項／狀態 |
| --- | --- | --- | --- |
| L-01 `reading-topic-01` | 2026-08-29 | `/reading/`、`reading-desk.json`、可能進 `navigation-index.json`；目標 URL 由來源欄位核對 | R；P / D / V / R，HOLD。 |
| L-02 `reading-topic-02` | 2026-08-29 | 同上 | R；P / D / V / R，HOLD。 |
| L-03 `reading-topic-03` | 2026-08-29 | 同上 | R；P / D / V / R，HOLD。 |
| L-04 `reading-topic-04` | 2026-08-31 | 同上 | R；P / D / V / R，HOLD。 |
| L-05 `reading-topic-05` | 2026-08-31 | 同上 | R；P / D / V / R，HOLD。 |
| L-06 `reading-topic-06` | 2026-08-31 | 同上 | R；P / D / V / R，HOLD。 |
| L-07 `reading-topic-07` | 2026-09-04 | 同上；連結 `/learning/website-quality-testing-roadmap/`；與文章去重配對 | R；P / D / V / R，HOLD。 |
| L-08 `reading-topic-08` | 2026-09-04 | `/reading/`、JSON／導航索引及 linked URL（若仍連結） | R；P / D / V / R，HOLD。 |
| L-09 `reading-topic-09` | 2026-09-04 | 同上 | R；P / D / V / R，HOLD。 |
| L-10 `reading-topic-10` | 2026-09-04 | 同上 | R；P / D / V / R，HOLD。 |
| L-11 `reading-topic-11` | 2026-09-04 | 同上 | R；P / D / V / R，HOLD。 |
| L-12 `reading-topic-12` | 2026-09-06 | 同上 | R；P / D / V / R，HOLD。 |
| L-13 `reading-topic-13` | 2026-09-06 | 同上 | R；P / D / V / R，HOLD。 |
| L-14 `reading-topic-14` | 2026-09-07 | 同上 | R；P / D / V / R，HOLD。 |
| L-15 `reading-topic-15` | 2026-09-08 | 同上 | R；P / D / V / R，HOLD。 |
| L-16 `reading-topic-16` | 2026-09-17 | 同上 | R；P / D / V / R，HOLD。 |
| L-17 `reading-topic-24` | 2026-09-19 | 同上 | R；P / D / V / R，HOLD。 |
| L-18 `reading-topic-17` | 2026-09-17 | 同上；連結 `/work/from-real-work-to-features/` | R；P / D / V / R，HOLD。 |
| L-19 `reading-topic-18` | 2026-09-17 | 同上；連結 `/work/meeting-transcripts-to-judgment-model/` | R；P / D / V / R，HOLD。 |
| L-20 `reading-topic-19` | 2026-09-17 | 同上；連結 `/work/two-project-mental-models/` | R；P / D / V / R，HOLD。 |
| L-21 `reading-topic-20` | 2026-09-17 | 同上；連結 `/work/risk-based-review/` | R；P / D / V / R，HOLD。 |
| L-22 `reading-topic-21` | 2026-09-17 | 同上；連結 `/work/transferable-project-capabilities/` | R；P / D / V / R，HOLD。 |
| L-23 `reading-topic-22` | 2026-09-17 | 同上；連結 `/work/ai-external-mentor-dual-track/` | R；P / D / V / R，HOLD。 |
| L-24 `reading-topic-23` | 2026-09-17 | 同上；連結 `/work/pm-sa-foundation-map/` | R；P / D / V / R，HOLD。 |

## D. 圖片與其他公開輸出批次

圖片共 568 檔；未逐張視覺檢查，也未讀取 EXIF／metadata。以來源路徑分成直接放在 `source/images/` 下的 244 檔與 `source/images/blogger-import/**` 下的 324 檔（含子資料夾與縮圖）；此為檔案位置批次，不代表內容類型。所有圖檔在舊快照有相對路徑，但不能據此判斷授權、人物／地點或目前來源一致性。

| 決策 ID／來源範圍與識別 | 目前暴露面 | 保守建議／作者選項／狀態 |
| --- | --- | --- |
| I-01 `source/images/*`（直接子檔 244 個；以完整相對路徑識別） | `/images/...` 可直接請求；文章、圖牆或頁面可能引用；來源相對路徑均在舊 public 快照找到。 | **R** 批次檢查來源、人物／地點、EXIF、第三方權利與同圖原檔／縮圖關係；不逐張代作者判讀。P / D / V / R，HOLD。 |
| I-02 `source/images/blogger-import/**`（324 個，含縮圖；以完整相對路徑識別） | 原圖／匯入圖及縮圖可由靜態 URL 直接請求，並可能被文章引用。 | **R**；先確認來源與授權、辨識資訊、metadata 及縮圖／原圖是否均可公開。P / D / V / R，HOLD。 |
| O-01 功能頁 Markdown：`source/random/`、`reading/`、`reading-log/`、`photos/`、`calendar/`、`status/`、`categories/`、`tags/` 等 | 各頁 HTML 直接可請求；頁面可內嵌資料或 fetch JSON。頁面不屬於 posts，`surfaces` 不會自動隱藏頁面內容。 | **R** 檢視頁面內嵌文案、路由、圖片與 fetch 資料是否只承載已核准公開內容；逐類決定哪些功能頁維持公開。P / D / V / R，HOLD。 |
| O-02 原始 `source/microblog.json`、`source/reading-desk.yml` 與各自轉製 JSON | `/microblog.json`、`/reading-desk.json`、`/navigation-index.json` 可直接請求；`/status/`、`/reading/` 間接呈現。raw 與 derived 必須一致處理。 | **R**，必須跟各 ID/item 決策同步；若有 V/D，不可只從 UI 隱藏。P / D / V / R，HOLD。 |
| O-03 `life-index.json`、`content-categories.json`、`calendar.json`、`calendar-posts.json`、`random.json`、`navigation-index.json` | 直接 JSON endpoint 加上 `/reading-log/`、`/calendar/`、`/random/`、搜尋等呈現；部分包含文章 URL、標題、分類、日期或全文。 | **R**，依核准來源逐筆傳播排除／去識別規則；calendar 日期／分類和站務 metadata 不能視為天然匿名。P / D / V / R，HOLD。 |
| O-04 `search.xml`、Atom `atom.xml`、archive/category/tag、首頁與 sitemap | 搜尋 XML、含正文 feed、清單 HTML、文章 permalink 及 sitemap 可獨立請求；不列 sitemap 或搜尋 UI 不呈現不構成私有。 | **R**；決定來源邊界後，2.4/2.5 驗證每一輸出是否移除 V、使用 D 的核准版並保留 P。若現有外掛無法依決策篩選，需在 2.3 設定輸出層方案。P / D / V / R，HOLD。 |

## 若選不同選項，後續工作會如何處理

| 作者決定 | WBS 2.3 | WBS 2.4（只執行已核准項） | URL／ID 與衍生輸出 |
| --- | --- | --- | --- |
| P 保留公開 | 私人儲存方案不適用該筆；保留公開來源，另確認公開副本及索引規則。 | 不搬該來源；將其列入允許公開測試集合。面向分類仍等 WBS 3.2。 | 文章 URL／microblog ID／learning ID 維持；所有被核准公開的 JSON、索引、頁面、feed 等依規則呈現。 |
| D 去識別後公開 | 先定私人原件保存位置、排除 Git/Hexo/public 的規則，以及可追溯但不洩密的公開副本做法。 | 保存原件至作者核准私人位置；按核准文字／圖像建立去識別公開版本。沒有原文與 ID/URL 對應方案不得改寫。 | 優先保留文章 permalink／microblog ID/item ID；公開與私人副本分離。search、feed、JSON、HTML、圖片、sitemap 都需只含核准版，禁止另一衍生層洩漏原件。 |
| V 轉私人 | 確定專案外（或明確不納入 Git／建置的忽略位置）及備份／回復方法，先驗證不會進 `source/` 或部署。 | 先保存可恢復副本，再移除公開來源或作核准搬移；未核准項完全不動。 | 既有文章 URL 可能失效／404，既有外站連結亦受影響；microblog/item ID 保存於私人副本且不重用。是否留安全替代頁／redirect 需單獨確認。從 search.xml、Atom、random/calendar/navigation JSON、HTML、sitemap、圖片 references 全面排除。 |
| R 需逐項複查 | 不建立搬移規則。 | 不更動來源、內容、日期、permalink、ID 或 surfaces；繼續 HOLD。 | 所有現行 URL／ID 保持目前工作樹不變；此狀態不是重新確認它們已可公開。 |

以上每種決定都只解決公開邊界，不能直接推導 `profile`／`memory`。私人決定在來源已排除前不得靠 A/B、CSS、UI、搜尋 filter 或 sitemap 處理。

## 請作者最少回答的批次問題

可直接回覆編號與選項；不確定的批次可選 R，不必一次清完：

1. **P-01/P-02 工作知識與實驗室文章：** 對已抽象化的系列文章，是否同意先維持整批 HOLD、逐篇檢查工作／他人線索？哪些已可 P，哪些需 D 或 V？是否授權只把「已公開的通用方法」批次列入 P，其餘逐篇審查？
2. **P-03/P-04/P-05/P-06 其餘文章：** 歌曲、影評、生活隨筆、站務文章是否可先以「保留公開但遇到第三方／人際脈絡即逐篇 R」作批次規則？若否，請指定整批 P/D/V/R 或需拆分的子範圍。
3. **M-01–M-22 microblog：** 是否全部逐 ID 複查？能否先把沒有未公開工作／人際／定位細節且脈絡完整者列 P，需補脈絡者 D，其餘 R/V？請勿以 emoji/tag 代替讀文決策。
4. **L-01–L-24 learning：** 可否按 linked／standalone 及內容範圍批次審核？尤其 linked work items（L-18–L-24）是否需與其七篇文章綁定同一公開決策？是否允許把學習進度／note 一併公開，或只公開文章而移除 learning item/note？
5. **I-01/I-02 圖片：** 是否先保留所有路徑與引用不動，改由作者按可安全批次（例如已公開圖牆／匯入縮圖）核可？EXIF、人物、地點及授權未核前是否一律 R？
6. **O-01–O-04 公開輸出：** 是否確認它們不是各自的獨立內容審核，而應嚴格跟隨上述來源決策過濾？若來源已選 V/D，是否接受相應 JSON／search.xml／Atom／HTML/sitemap 必須同步排除私人原文，即使造成舊搜尋結果或外部連結失效？

## HOLD 與本工作包邊界

- 當前所有 P-、M-、L-、I-、O- 決策尚未得到本輪作者答覆，均為 **HOLD**。這份文件沒有讓任何原始內容新增公開許可。
- 未取得決策前不可開始 WBS 2.3 的私人儲存位置設計（以外的通用規則盤點除外）、WBS 2.4 搬移／改寫／移除、WBS 2.5 公開輸出洩漏稽核或 WBS 3.1/3.2 surface 實際歸類；尤其不能預先補 front matter。
- 未在本包逐篇讀取文章正文、microblog 文字、learning note 或圖像內容；沒有檢 EXIF。穩定識別與日期以 manifest/source metadata 為準；可能需要作者看原件的項目只以中性風險類型描述。
- 舊 `public/` 只用來說明路徑暴露，不代表最新建置或線上狀態。未建置、未部署、不使用額度重置券。
