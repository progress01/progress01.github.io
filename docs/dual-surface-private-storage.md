# 雙面部落格私人保存與排除規則（WBS 2.3）

> **作者已撤回並否決本文件原先的外部私人保存方案。** 以下舊設計僅留作決策歷程，不再是施工指示；不得建立 `C:\Blog\blog-1988-private`、私人 records、manifest 或備份副本。現行核准方式是作者自行管理原件：兩筆 D 直接以核准文字替換公開來源內容，一筆 V 從公開來源移除，不另行保存副本。回復只依施工前 Git HEAD／歷史與施工前差異；本工作不清除歷史、remote clone 或 cache。見最新 [WBS 2.4 進度紀錄](personal-navigation-progress.md)。

日期：2026-09-26（Asia/Taipei）  
狀態：方案已保存；尚未建立私人目錄、複製或改動任何 microblog 原文。  
進場 HEAD：`2d4d9d0375c1aa82d4b6407fb13699a2810d714d`  
依據：[作者 2.2 決策](dual-surface-public-boundary-decisions.md)、[WBS 2.3/2.4 驗收](dual-surface-blog-wbs.md)、[公開資料流盤點](dual-surface-public-data-flow.md)、[驗收與回復規則](dual-surface-blog-validation-and-recovery.md)、[surface 契約](dual-surface-content-contract.md)。

## 1. 範圍與作者核准項目

本方案只涉及以下三筆 microblog，不涵蓋其他已核准公開資料：

| 決策 | microblog ID | 2.3 保存規則 | 尚未完成的作者確認 |
| --- | --- | --- | --- |
| D | `micro-e410b2604c189eb4`（2.2 M-14） | 私人區保存來源原件；2.4 公開來源保留相同 ID、date、tag，以作者核准的改寫 content 取代原文。 | 公開改寫文字必須在 2.4 動來源之前由作者確認。此文件不提案、不保存改寫文案。 |
| D | `micro-7a5980df9ed2f10a`（2.2 M-18） | 同上；原件留私，公開 replacement 保持原 ID、date、tag，僅使用核准版 content。 | 公開改寫文字必須在 2.4 動來源之前由作者確認。此文件不提案、不保存改寫文案。 |
| V | `micro-b66fecaa3574c31a`（2.2 M-17） | 私人區保存完整來源紀錄；2.4 從公開 microblog source 移除該筆，所有衍生輸出排除。此 ID 永久保留，不得再用於新紀錄。 | 若要改變既有 hash 錨點的預期（如新增公開替代／墓碑頁），需另行確認；本方案預設不提供能透露私人狀態的替代內容。 |

作者已核准其餘 19 筆 microblog 為 P，以及所有非 microblog 資料為 P。這些公開決定不授權在本包改寫、搬移或修改其他來源；WBS 2.3 只設計以上兩筆 D 和一筆 V 的安全操作規則。

## 2. 私人根目錄與排除邊界

首選私人根目錄為 repository 外的固定 sibling：`C:\Blog\blog-1988-private`。本次只確認此路徑目前不存在；沒有在 workspace 外建立目錄、檔案、ACL 或備份。WBS 2.4 若需建立或寫入該處，必須在執行前確認當次檔案系統權限與作者對私人位置的核准；不得以 workspace 權限假設可寫。

路徑驗收要求：

- canonical path 必須是 `C:\Blog\blog-1988-private` 本身，不是 repository 子目錄、junction、symlink 或指回專案的路徑；檢查並記錄 Windows reparse point／ACL 狀態。
- 私人根目錄不在 Git worktree、不在 `_config.yml` 的 `source_dir: source`、不在 `public_dir: public`、不在 `.deploy_git` 或任何部署 staging／同步範圍。不得在私人根目錄初始化 Git，也不複製進雲端公開同步位置。
- 只限作者帳戶讀寫的 ACL；若裝置支援並已核實，可使用系統磁碟加密。不得宣稱尚未檢查的裝置已加密。
- **不首選 repository 內 ignored 目錄。**目前 `.gitignore` 忽略 `public/`、`.deploy*/` 等，但 ignore 只影響一般 Git 加入行為，不是存取控制；新增另一條 ignore 規則仍不能防止 `source/` 靜態複製、Hexo plugin、手動 `git add -f`、打包、備份或誤同步。即使 repo 根層目錄不會由 Hexo 預設直接輸出，也仍位於 repository、版本控制和專案備份範圍，邊界較難證明。
- `public/` 與 `.deploy_git/` 目前在 repository 內且被 ignore；它們是建置／部署輸出，不是私人保存區。不得把原文暫放在其中。

另有一項既有歷史限制：`source/microblog.json` 目前是 Git 追蹤檔，且工作樹與 HEAD 相同，因此目前 HEAD 的 repository snapshot 包含公開來源版本。本方案與 2.4 移除可降低未來新版本再次帶入原文的風險，**不會清除先前 Git commit、remote clone、快取或備份裡可能已存在的內容**。本工作包不檢視或改寫 Git history，也不承諾遠端清除。若作者要求移除歷史內容，需獨立評估 Git history rewrite／remote 協調及其破壞性，另取明確授權後才能做。

## 3. 私人 manifest 與逐筆記錄格式

私人根目錄預定結構（本包僅定義，未建立）：

```text
C:\Blog\blog-1988-private\
  manifest.json
  records\micro-e410b2604c189eb4.json
  records\micro-7a5980df9ed2f10a.json
  records\micro-b66fecaa3574c31a.json
  backups\<UTC timestamp>\microblog.json
  staging\                 # 只供原子寫入暫存；完成後不留未核准副本
```

`manifest.json` 只記 private schema/version、三個永久保留 ID、D/V 決策、私人 record 相對路徑、遷移狀態、校驗演算法與上次驗證日期；可保存前後相鄰 record ID 以利 V 回復原順序，但不以陣列序號識別。Manifest 與 records 都留在私人根目錄，絕不放在公開 repository。狀態建議為 `planned` → `private-copy-verified` → `public-migration-verified`；任一步未驗證不可標後一狀態。

每筆 private record 使用 UTF-8 JSON（不含 BOM），保存整個原始物件，至少完整保留 `id`、`date`、`tag`、`content` 原值及來源中其他既有欄位。日期原樣保存，不轉時區；tag 與 content 不正規化、不渲染、不改換行。下列僅為**欄位結構示意**；角括號是說明占位，不是可直接匯入的紀錄，也不含原文或實際雜湊：

```json
{
  "schemaVersion": 1,
  "decision": "D",
  "recordId": "<與 originalRecord.id 相同的既有 microblog ID>",
  "source": {
    "path": "source/microblog.json",
    "recordFingerprint": {
      "algorithm": "SHA-256",
      "value": "<只存在私人目錄的原件指紋>"
    }
  },
  "originalRecord": {
    "id": "<既有 ID>",
    "date": "<原始日期字串>",
    "tag": "<原始 tag 值>",
    "content": "<原始內容；只可寫入私人 record>"
  },
  "publicReplacement": {
    "id": "<必須沿用相同 ID>",
    "date": "<沿用原 date>",
    "tag": "<沿用原 tag>",
    "content": "<作者核准後才填入的公開改寫；未核准時不得遷移>"
  },
  "publicApproval": {
    "authorApproved": false,
    "approvedAt": null
  },
  "migration": { "publicState": "planned", "verifiedAt": null }
}
```

D record 的 `publicReplacement` 只保存與來源同欄位形狀的公開紀錄（沿用原 ID/date/tag，只替換 content），作者確認狀態另存在 `publicApproval`；只有作者完成確認後 replacement 才能成為可用公開版本。未核准時不能以原文、AI 改寫或空字串填補後假裝遷移完成。V record 使用相同 `originalRecord` 與私有指紋，但 `decision: "V"`，不含公開 replacement，改以 `publicRemoval` 記錄 `publicState: "planned"`、來源移除時間與完成的公開輸出驗證項目。遷移前 `publicState` 不得標成 removed。若用同一 JSON schema，D/V 互斥欄位應由驗證器確保，但本包不實作程式。

私有 record 可另保存 `recordFingerprint`（例如對穩定序列化後完整原始 record 計算 SHA-256）作為完整性驗證；實際值只存在私人檔案。不可將原始 record hash、content hash 或可供猜測驗證的 digest 放入公開 repo、公開 manifest、progress、log、測試或 commit message，以免低熵文字被字典猜測驗證。此包不計算實際 hash，也不輸出原文／hash。

## 4. 備份、原子寫入與復原

1. 2.4 開始前，先驗證私人目錄 canonical path、ACL、可用容量及不在任何 Git／Hexo／deploy path；目錄缺失時只有取得當次外部寫入權限後才建立。不能驗證即停止，不回退到 repo ignored 目錄。
2. 先唯讀讀取現有 `source/microblog.json`，在私人側建立待遷移 record 副本；保存完整原始物件和來源關聯。對完整來源檔另做一份私人備份（原位不移動），保留原始位元組以便精確回復。不得把 record 內容或 hash 顯示在命令輸出。
3. 寫入時先在同一磁碟私人 `staging/` 以唯一暫存檔完成 UTF-8 序列化、schema／ID／必要欄位驗證及私人指紋核對，再以原子 rename 移入 `records/`；若目標已存在，不覆寫，先停下比對／請作者決定。完成後再生成 manifest 臨時檔並原子替換，確保記錄檔先於 manifest 宣告遷移。
4. 私人 record、manifest、source 備份及遷移狀態分開保存；每次變更前做唯讀複核，確認預期三筆 ID 唯一、D/V 不混淆、19 筆 P 仍保持原值與順序。私有備份至少保留一份不與公開 build 同路徑的副本；備份媒介是否同步到其他裝置由作者另定，未設定就標未知。
5. 只有私人副本和備份驗證成功後，才可進入 2.4。若 copy、parse、hash、寫入、rename、ACL 或來源匹配任一失敗，停止公開來源修改，保存遮蔽後錯誤證據；私人側清除未完成的 staging 檔需先確認它是本輪建立、且目標精確落於私人 staging。不得執行廣域刪除。
6. 若 2.4 公開來源修改後測試失敗，在任何發布前以私人來源備份做檔案級回復：只恢復本輪改動的 `source/microblog.json`，先比較目前差異並保留期間新增／修改的其他記錄；若無法可靠合併，停止並請作者處理。重建／檢查後確認三筆原始 ID、19 筆 P、數量／順序及公開輸出符合回復基準。禁止 `git reset --hard`、`git checkout --`、`git clean`。

## 5. D／V 逐筆保護規則

| 項目 | 私人保存 | 2.4 公開來源操作 | 穩定識別與回復 |
| --- | --- | --- | --- |
| M-14 `micro-e410b2604c189eb4` | 永久保留完整原件；private D record 另存核准 replacement 與核准日期。 | 只有作者先核准具體文字，才以相同 array 位置替換 content；id/date/tag 及其他原欄位不變。 | 公開端維持舊 ID/hash anchor；私有 original 以同一 ID 配對，不建立新 ID。回復用私人原件精確還原 content。 |
| M-18 `micro-7a5980df9ed2f10a` | 同上。 | 同上。 | 同上。 |
| M-17 `micro-b66fecaa3574c31a` | 永久保留完整原件及該 ID；保存其遷移狀態／原位鄰接 ID。 | 從公開 JSON 陣列移除該物件，不以空 content、`published:false`、遮罩或 placeholder 取代；不改其他記錄。 | 舊 ID 保留於私人 manifest 且永不重用。既有 `/status/#<ID>` 到訪時頁面仍存在但找不到該卡片；不建立透露「私人」的公開 tombstone。若作者不接受失效錨點，需在 2.4 前另行決定。 |

陣列位置只用來維持現存列表排序，不是紀錄身分。V 回復時使用備份及前後鄰接 ID 找回適當位置；若來源已變動且無法確定位置，不猜測、不覆蓋新資料，轉 HOLD 請作者確認。任何 P／D/V 決策都不改既有 ID 分配規則；被移除 ID 永不重用。

## 6. 2.4 公開排除／replacement 輸出清單

2.4 修改來源後，必須在乾淨的暫存建置輸出逐項驗證；舊 `public/` 與 `.deploy_git/` 是 2026-09-23 左右建立的舊快照，不可當成已更新或清除。至少檢查：

| 輸出／消費者 | 2.4 預期 | 驗證要求 |
| --- | --- | --- |
| `source/microblog.json` 與靜態公開 `/microblog.json` | M-14/M-18 使用核准 replacement，原件字串不在公開 JSON；M-17 不存在；其餘 19 P 原值與 ID 不變。 | 解析 JSON 比較 ID 集合、順序和核准欄位；以私人原件作比對時只回報 hit/no-hit，不將原文或 hash 印出。 |
| `/status/` | 保留功能路由及 19 P、2 D 公開版；不呈現 M-17。 | 頁面 fetch 應使用過濾後公開 JSON；未知舊 hash 不得反向載回私人原文；既有 D hash 仍只指向相同 ID 的公開改寫卡。 |
| `/reading-log/` | 保留頁面功能；若此頁讀取 microblog，必須只呈現過濾後資料。 | 在實際生成頁與瀏覽器行為確認不含 V／D 原件。 |
| `/navigation-index.json`、搜尋覆層及所有直接索引 | 只收 P 與核准 D public replacement；排除 V 和 D 原件。 | 機器可讀索引抽查 ID、內容來源和錨點，並做遮蔽式私人文字 hit/no-hit 測試；搜索不得經快取／舊 index 命中原件。 |
| 搜尋 XML、Atom feed、calendar、random、recent-list、sitemap 及其他 JSON/HTML | 按 WBS 2.1 現況，這些目前多依 posts 產生而不含 microblog；2.4 仍需掃描，防止新增消費者或共用索引把原文帶入。 | 遍歷新生成 `public/` 中所有文字型 HTML／JSON／XML／RSS／Atom／sitemap；掃描來源複製、頁面 bundle 和所有找到的 consumer；私人原文字串不得命中。只報結果摘要，不把測試字串放到 repo。 |
| `.deploy_git/`／部署遠端 | 本工作包不 deploy、不推送、不以舊 deploy clone 代表新輸出。 | 2.4 本機驗收前不把 `.deploy_git/` 推送；部署是另一個明確授權工作包。若該目錄將來作為 deploy staging，必須確認生成內容為本次 sanitized build。 |

目前 2.1 盤點確認 `/microblog.json`、`/status/`、`/reading-log/`、`/navigation-index.json` 是明確 microblog 暴露／消費路徑；sitemap filter 排除 raw `microblog.json` 不會阻止 URL 被直接請求。`search.xml`、Atom 和其他端點不是現行明確 microblog consumer，但列入全輸出掃描，避免假設性漏項。舊 public 快照不參與清除證據。

## 7. WBS 2.4 前置門檻與 HOLD

以下條件全部達成前不得遷移：

1. 作者確認使用 `C:\Blog\blog-1988-private` 這個外部位置，並在 2.4 開始時取得所需的外部建立／寫入權限；目錄 canonical path、ACL、加密狀態（若聲稱）及非 junction 證據已保存。此文件本身沒有建立目錄。
2. 作者對 M-14、M-18 各自的最終公開改寫文字逐筆核准；日期、tag、ID 的保留規則確認。未核准時 D 原件留在當前 source、私人設計保留，該筆 HOLD，不能用原文代替公開版。
3. 確認 M-17 舊錨點在公開頁面變成未匹配 hash 的可接受性；不製作暗示其原因的公開說明。若需替代頁／轉址，另定內容及 URL 行為後再做。
4. 以唯讀檢查取得當時最新版 `source/microblog.json`、19 P 的 ID／欄位指紋（不在 repo 記錄私人 hash）及 Git diff；確認要改的仍只有核准三筆，新增其他作者修改就停下。
5. 私人逐筆副本、完整來源備份、schema、ID 唯一性、私有指紋及備份可讀性驗證通過；不輸出敏感 record、hash、指令回顯或 log。
6. 明確確認既有 Git history／remote 可能仍有原件。此流程只防未來版本再次輸出，不清洗過往 commit；若作者要求歷史清除，先另開授權範圍，不將之混入 2.4。
7. 2.4 先只修改 `source/microblog.json` 中三筆核准資料；目標測試、乾淨暫存 build 與第 6 節輸出稽核通過前不得部署。19 P、既有 URL 及所有不相關原始欄位保持不變。

目前已知待決：外部私人目錄尚未建立且 2.4 需當次寫入權限；兩筆 D 公開文案仍未核准；V 舊 hash 的未匹配行為須作者確認；歷史 Git/remote 原件是否需要另行清除未知。本包完成的是保存位置與排除規則設計，**下一個明確狀態為 HOLD，不能自動開始 2.4**。
