# 文件索引

日常操作只需[網站維護更新手冊](../網站維護更新手冊.md)。以下供遇到特定問題時查詢；歷史文件中的完成狀態、路徑與指令代表當時情況。

## 操作與資料位置

| 文件 | 何時使用 |
| --- | --- |
| [日常操作詳解](maintenance/日常操作詳解.md) | 查圖片、草稿、紀錄欄位、預覽及發布故障處理 |
| [資料與程式位置](maintenance/資料與程式位置.md) | 不確定某個畫面讀取哪一份資料，或某個資料夾能否手動修改 |
| [內容欄位規格](dual-surface-content-contract.md) | 查 A／B 面、文章與紀錄的選填欄位 |
| [發布特殊情境](dual-surface-publishing-sop.md) | 查隱私與公開邊界等規格；一般發布仍依主手冊 |

## 技術查詢

| 文件 | 用途 |
| --- | --- |
| [JSON-LD 實作](<reference/Schema.org JSON-LD 實作手冊.md>) | 搜尋引擎結構化資料的模板與檢查規則 |
| [搜尋與導覽資料規格](personal-navigation-data-contract.md) | 搜尋索引、紀錄 ID、定位與去重 |
| [公開資料流](dual-surface-public-data-flow.md) | 資料如何產生公開頁面與索引 |
| [公開邊界決策](dual-surface-public-boundary-decisions.md)／[私有資料處理](dual-surface-private-storage.md) | 查公開輸出的限制 |
| [文案規格](dual-surface-copy-contract.md)／[視覺規格](dual-surface-visual-rules.md) | 修改介面時查詢；視覺規格也由驗證程式讀取 |
| [Blogger 工具](../tools/BLOGGER-TOOLS.md) | 只在匯入舊文章或修復匯入圖片時使用 |

## 規劃與歷史

- [目前進度紀錄](personal-navigation-progress.md)：網站功能與流程調整統一記在這裡，最新紀錄在上方。
- [動線規劃](personal-navigation-plan.md)、[雙面規劃](dual-surface-blog-plan.md)、[雙面 WBS](dual-surface-blog-wbs.md)：保留設計背景，不作為每次更新的工作清單。
- [已歸檔的報告](archive/README.md)：原本散落在根目錄的稽核、摘要驗收與架站手冊。
- [搬機驗收記錄](computer-restore-2026-10-10.md)：2026-10-10 的歷史還原，不代表目前帳號、預覽服務或線上狀態。
- 現存 `dual-surface-blog-10.*`、`*-review-*`、`*-verification.json`、`*-acceptance.json` 等檔案是過往驗收證據，維持原路徑供既有引用使用，不需要日常更新。

## 文件放置規則

日常入口留在專案根目錄；詳細操作放 `maintenance/`；新技術說明放 `reference/`；結案報告放 `archive/`。既有程式會讀取的規格與 JSON 證據維持原路徑。新增文件前先確認能否補在既有文件，避免同一流程出現多份不同版本。
