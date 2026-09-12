---
title: Agentic Transaction｜Towards ACID-Compliant Agent Systems｜學習筆記
date: 2026-08-29 12:00:00
updated: '2026-09-11T19:02:32+08:00'
permalink: /learning/agentic-transaction-acid-agent/
categories: [觀念與實驗]
tags: [學習筆記, AI Agent, 資料庫, 工作流程, 驗證]
longform: true
learning: true
learning_status: 進行中
---

這是一篇針對〈Agentic Transaction: Towards ACID-Compliant Agent Systems〉的公開研究筆記，先把論文報告中的核心問題、形式化模型、系統機制與實務檢查清單整理起來。我真正想往下討論的，不只是代理系統如何提高可靠度，而是如何把這種「探索—執行—驗證—提交／重試」的結構，變成我推動各種工作流程時可以共同使用的底層方法。

它目前仍是研究摘記，不是已完成的論文評讀；本文已核對論文 v1 的正式定義、門檻與實驗表格，也核對開放原始碼 README 的結構與執行條件。獨立重現、程式碼與論文結果的完全對應，以及工程泛化性仍未完成核驗。

<!-- more -->

> **資料狀態：論文數據與專案 README 第一輪核對完成**
>
> 本文的正式定義、門檻、KramaBench 規模與論文表格已回到 [arXiv HTML v1](https://arxiv.org/html/2608.13900v1) 核對；專案的結構、執行條件與成本限制已回到 [TsinghuaDatabaseGroup/ACID-Agent README](https://github.com/TsinghuaDatabaseGroup/ACID-Agent) 核對。論文敘述有一處模型名稱與表格不一致，成本也只代表該實驗設定；本文不宣稱獨立重現或工程泛化已被證明。

## 論文基本資訊

- **論文標題**：Agentic Transaction: Towards ACID-Compliant Agent Systems
- **發表平台與編號**：arXiv:2608.13900v1 [cs.DB]
- **發表日期**：2026 年 8 月 14 日，已回到 [arXiv 原始頁面](https://arxiv.org/abs/2608.13900)核對
- **作者**：Zhaoyan Sun、Xiaoxiao Wang、Guoliang Li，已回到原始頁面核對
- **開放原始碼專案**：[TsinghuaDatabaseGroup/ACID-Agent](https://github.com/TsinghuaDatabaseGroup/ACID-Agent)，已確認 README 所列的 ACID-Agent、KramaBench、baseline harness、trace 與 cost logging；程式碼與論文結果的獨立重現仍未執行

## 一、研究背景與核心問題

大型語言模型驅動的自主代理，已經不只是回答問題，也可能執行長流程任務、呼叫工具、產生程式碼與修改工作區。當代理從「產生文字」走向「改變外部狀態」，它面對的可靠性問題就開始接近資料庫與分散式系統的問題。

目前先整理出四種風險：

1. **部分失敗與工作區污染**：代理執行數十步 API 呼叫或檔案寫入時，如果中途崩潰，可能留下未完成的修改、重複的外部副作用或不可逆的狀態。
2. **語義不一致與非確定性**：計畫即使在語法上可以執行，決策仍可能缺少證據；同一任務重複執行時，輸出也可能有很大差異。
3. **多 Agent 干擾**：多個子 Agent 並行時，提示詞、記憶、暫存檔案與工具配額可能互相覆蓋。
4. **長期狀態遺失**：代理狀態分散在 Context、終端輸出與臨時檔案中，長上下文壓縮後，可能無法可靠重構原本的事務語意。

報告把這些問題整理成 **Agentic Transaction**，嘗試將資料庫中的 ACID 原則重新解釋成適用於非確定性 LLM 代理的語義 ACID 保證。

## 二、Agentic Transaction 的形式化模型

論文 §2.1 的定義是：一個代理事務 τ，是代理與執行環境之間由 LLM 驅動的、有界且有限的互動序列：

> τ = ⟨ r₁, r₂, …, rₙ ⟩

在給定工具集 T 與技能集 S 的情況下，每一個步驟 `rᵢ = (cᵢ, aᵢ, fᵢ)` 包含：

- `cᵢ`：該步驟下的 LLM Context，包括可用工具與技能。
- `aᵢ`：代理呼叫工具或技能的 Action。
- `fᵢ`：執行環境回傳的 Feedback 或 Observation。

暫時可以把 Commit 理解成一個有條件的提交：只有在任務完成、後置條件通過，而且所有語義不變量仍然成立時，事務才可以提交。否則，中間效應必須回滾，或透過補償機制消除。

這裡最值得繼續確認的問題是：哪些效應真的能回滾？哪些只能設計補償？如果代理已經寄出郵件、扣款或呼叫外部物流，單純回復本地工作區並不能讓外部世界回到原狀。

## 三、語義 ACID 四大保證

| ACID 維度 | 代理事務中的暫時理解 | 主要系統挑戰 | 報告整理的技術方向 |
| --- | --- | --- | --- |
| 語義原子性 | 模型呼叫、工具執行與文件修改視為一個語義單元，只有驗證完成後才可見 | 外部 API 常常不是事務性資源，部分失敗會污染工作區 | 探索—執行—驗證循環、唯驗證效應提交、冪等鍵、WAL、檢查點與補償 |
| 語義一致性 | 最終成果必須滿足前置條件、後置條件與證據義務 | 計畫可能語法正確但語義無效，或使用過時觀察 | 置信度分歧驗證、多源可靠度信號、物化技能重用 |
| 語義隔離性 | 並行代理事務不應產生語義無效干擾，提交結果應接近可序列化執行 | 衝突不只發生在資料，也可能發生在 Prompt、記憶、暫存檔案與工具配額 | 獨立型、協同型、競爭型子 Agent 隔離、版本化工作區與快照 |
| 語義持久性 | 提交後的效應、證據與恢復資料必須持久化，不依賴短暫 Context | 長上下文壓縮可能使關鍵語義結構遺失 | 事務感知動態記憶、僅追加工作區與執行溯源日誌 |

我目前覺得這個轉換最有意思的地方，是 ACID 不再只是資料庫內部的資料正確性，而是開始處理「代理到底做了什麼、根據什麼做、失敗後能不能說清楚」這些語義層問題。

## 四、關鍵技術機制

### 1. 置信度分歧驗證

論文 §2.2.2 定義 confidence 為目標輸出平均 token log probability 的指數；§3.1 的實驗設定則說明，因為 API 型主模型沒有 token probability，研究使用本地 `Qwen3-0.6B` proxy 估計 confidence。對 decision，論文比較從探索摘要抽出的決策與實際執行的決策；對 code，才是比較有、沒有探索證據 context 時，決策相關程式碼片段的 confidence（[§2.2.2](https://arxiv.org/html/2608.13900v1#S2.SS2)、[§3.1](https://arxiv.org/html/2608.13900v1#S3.SS1)）。

論文 §2.2.2 與 §3.1 記載兩個實驗門檻（[§3.1](https://arxiv.org/html/2608.13900v1#S3.SS1)，不是通用信心標準）：

- **Decision Confidence Divergence**：分歧度低於 `0.25` 時，觸發 retry，論文將其解釋為執行決策沒有比替代方案獲得更強的證據支持。
- **Code Confidence Divergence**：最大分歧度低於 `0.50` 時，觸發 retry，論文將其解釋為生成程式碼缺乏證據支撐。
- 探索階段另有分歧度超過 `0.45` 時提前停止的設定；它和上述 retry 門檻不同。

這些數字是該研究設定中的操作門檻，不能當成通用的信心門檻。置信度分歧和真正正確性之間是否有穩定關聯，以及不同模型、任務與語言下是否仍然成立，仍是開放問題。

### 2. 失敗步驟隔離

傳統 ReAct 流程常常把失敗訊息直接堆回 Context，讓模型自己修正。報告認為，未經整理的錯誤嘗試可能造成注意力污染，讓後續決策持續受到錯誤路徑影響。

ACID-Agent 的整理方向是：

1. 驗證未通過的事務單元，不把完整執行歷史直接留在長期記憶。
2. 工作區透過版本快照回滾。
3. 只把整理過的結構化 Validation Feedback 傳給重試單元。

這裡可以連到我目前的 CMS 與網站維護工作：如果 AI 修改檔案時只留下最後結果，日後很難知道哪些修改是已確認的，哪些只是失敗嘗試留下的殘片。版本化、差異檢查與可回復工作區，可能會是代理協作的基本設施。

## 五、實驗結果與基準測試：已核對，保留論文矛盾

論文 §3.1 說明 KramaBench 包含六大領域、24 個資料來源、1,700 個真實資料檔案與 104 個自然語言資料科學任務；每項任務都需要處理異質資料與多步驟流程。以下表格依[論文 HTML v1 §3.1 Table 2](https://arxiv.org/html/2608.13900v1#S3.T2)核對。

### 1. 主實驗表現

| Agent 框架 | 底層模型 | 整體分數 | 平均程式碼步數 | Token 消耗 | 平均成本 |
| --- | --- | ---: | ---: | ---: | ---: |
| Claude Code（ReAct） | Qwen3.5-397B-A17B | 64.0% | 9.4 | 405K | $0.08 |
| Claude Code（ReAct） | GLM-5.2 | 74.2% | 8.8 | 289K | $0.12 |
| ACID-Agent | Qwen3.5-397B-A17B | 74.6% | 22.8 | 348K | $0.10 |
| ACID-Agent | GLM-5.2 | 77.4% | 22.5 | 367K | $0.61 |

在 Table 2 的 Qwen3.5-397B-A17B 條件下，ACID-Agent 的 74.6% 減去 Claude Code 的 64.0%，是 **10.6 個百分點**。論文 §3.2 的敘述寫成 10.6%，並把該比較的模型寫成 Qwen3.5-197B-A17B；這和 §3.1 的 397B 設定及 Table 2 不一致，本文以表格與實驗設定為準，保留這個原文矛盾，不擅自替論文判定正確版本。表中的成本是作者在該平台與設定下報告的數字，不是可跨供應商泛化的價格；README 也明確說明 API pricing is provider-specific。

### 2. 執行穩定度

論文 §3.2 的 [Table 3](https://arxiv.org/html/2608.13900v1#S3.T3) 以 **Environment 領域、Qwen3.5-397B-A17B、三次獨立執行**為條件，記載 Claude Code 的分數為 `63.9 ± 30.9`，ACID-Agent 為 `88.9 ± 18.6`。這裡的 `±` 是每個任務分數變異的平均值再開平方根，不是整體分數的標準差；在這組條件下，表格呈現 ACID-Agent 較低的任務層級變異，不能直接泛化到其他領域或模型。

三次重複的結果仍是論文自身的實驗證據，不等於本文已完成獨立重現。

### 3. 消融實驗

| 系統配置 | 得分 | 程式碼步數 | Token 消耗 | 成本 | 報告中的解讀 |
| --- | ---: | ---: | ---: | ---: | --- |
| DA-Agent，無 ACID 的 ReAct 基準 | 65.2% | 8.5 | 62K | $0.01 | 基礎基準線 |
| Claude Code，三次多數決 | 75.2% | 25.6 | 1,121K | $0.21 | Token 增加但仍落後 ACID-Agent |
| ACID-Agent，移除失敗隔離 | 78.3% | 20.1 | 333K | $0.10 | 報告認為失敗記憶污染很重要 |
| ACID-Agent 完整版 | 90.0% | 25.5 | 444K | $0.13 | 論文完整配置 |

論文 §3.3 的[Table 4](https://arxiv.org/html/2608.13900v1#S3.T4) 明確限定 **Environment 領域、Qwen3.5-397B-A17B**；因此這裡的 90.0% 不能和 Table 2 全域條件的 74.6% 直接比較。論文說移除失敗隔離使分數下降 11.7%，由 90.0% 到 78.3% 的表格差值也是 11.7 個百分點；這是消融結果，不能單獨證明因果已排除其他因素。

## 六、從學術 AI 驗證回到 Agentic Transaction

我前面原本把「AI 驗證」想成一個獨立流程：先問問題、找證據、測試輸出，再決定能不能使用。但讀到 Agentic Transaction 後，我開始覺得這樣還不夠。驗證不應該只是工作完成後的檢查，而應該是代理事務能不能提交的條件。

學術研究重視的是：問題與方法能不能說清楚、資料與分析能不能追溯、結果能不能被複核、限制能不能被承認。Agentic Transaction 則提供一個系統語言，把這些要求放進代理的執行生命週期。這和 [National Academies 對 foundation models 用於科學工作的整理](https://www.nationalacademies.org/read/29212/chapter/2)相互呼應：AI 可以加速文獻回顧、實驗規劃、資料分析與程式開發，但可靠性、有效性、可重現性與 VVUQ 仍然是關鍵缺口。

我目前想採用的對照是：

| 學術研究中的元素 | Agentic Transaction 中的元素 | 工作上的對應物 |
| --- | --- | --- |
| 研究問題與目的 | Transaction intent | 這次工作要改變什麼、交付什麼 |
| 資料、方法與研究設計 | Input、context、tool 與版本 | 來源、檔案、權限、prompt 與設定 |
| 分析或實驗 | Exploration–execution | 在暫存區提出方案、執行修改或產出 |
| 驗證、複核與限制 | Validation gate | 測試、來源查證、人工審查與失敗分類 |
| 發表或採用結果 | Commit | 合併變更、交付文件、發布或通知他人 |
| 實驗紀錄與方法揭露 | Durable trace | diff、輸出、證據、版本、責任人與決策紀錄 |

因此，我真正想推動的是：

> **不要讓 Agent 直接把「生成結果」當成「已完成工作」；要讓它先在交易邊界內探索與執行，經過驗證閘門後，才把結果提交到真實工作環境。**

這裡的「交易」不是把 LLM 假裝成傳統資料庫，而是借用資料庫最有用的控制思想：中間狀態不要直接公開，失敗不要默默留下污染，完成要有可持久化的證據，提交要有條件。

### 語義 ACID 如何支撐工作流程推動

傳統資料庫把多個更新包成 all-or-nothing 的操作，失敗時回滾，提交後保留永久紀錄；[PostgreSQL 的交易文件](https://www.postgresql.org/docs/18/tutorial-transactions.html)也用 `BEGIN`、`COMMIT`、`ROLLBACK` 與 `SAVEPOINT` 說明這個基本結構。Agentic Transaction 的難點在於，代理修改的不只是一列資料，還可能是檔案、程式碼、外部 API、文件內容與人的決策。

我會把四個語義保證改寫成工作語言：

| 語義保證 | 對工作流程的要求 | 可落地的控制 |
| --- | --- | --- |
| Semantic Atomicity | 一組相關變更不能只完成一半就被當成成果 | 暫存工作區、快照、diff、提交或回滾；不可逆副作用放在人工閘門後 |
| Semantic Consistency | 結果要符合前置條件、後置條件、來源與工作規格 | 驗收條件、schema、測試、來源查證與不變量檢查 |
| Semantic Isolation | 未完成或失敗的 Agent 狀態不能污染別人的工作 | 分支、沙盒、版本化 context、獨立暫存區與結構化合併 |
| Semantic Durability | 提交後不只留下最後檔案，也留下能追問的依據 | 版本、輸出、測試報告、引用、trace、責任人與決策紀錄 |

這樣一來，學術 AI 驗證就不再是事務外面的一張 checklist，而是直接進入 Semantic Consistency 與 Semantic Durability。驗證通過，才有資格提交；驗證不通過，就必須重試、修正、降級成人工處理，或停止這次事務。

### 一個我想實作的代理事務循環

```text
BEGIN：建立任務邊界、來源、版本與預期結果
  ↓
EXPLORE：理解資料，提出候選計畫，不修改正式環境
  ↓
EXECUTE：在快照／分支／沙盒中執行工具與檔案變更
  ↓
VALIDATE：檢查主張、資料、測試、格式、限制與副作用
  ↓
  ├─ 通過 → COMMIT：合併變更，保存證據與 trace
  ├─ 可修正 → RETRY：只傳遞結構化失敗原因，不重播全部污染歷史
  ├─ 可補償 → COMPENSATE：執行反向動作或人工收尾
  └─ 不可接受 → ROLLBACK：回復快照並停止提交
```

這個循環和論文摘要中的 transactional exploration–execution–validation cycles、commit-or-retry semantics 相符；開放原始碼 README 也列出 candidate、retry、evidence review、execution trace 與 cost logging 等模組。不過，專案有這些檔案不代表所有語義保證都已被證明，我仍要區分「論文提出的架構」、「程式碼中的實作」與「我的工作情境是否適用」。

### 驗證閘門要驗證什麼

我不想只用一個模糊的 confidence score 決定是否提交。比較實際的驗證閘門應該至少包含：

1. **輸入完整性**：來源、欄位、日期、權限與版本是否正確。
2. **主張可追溯**：重要結論、數字與引用是否能回到原始資料。
3. **操作正確性**：程式、公式、檔案或 API 是否真的執行成功。
4. **流程一致性**：結果是否符合前置條件、後置條件與使用者意圖。
5. **例外可處理**：缺值、衝突資料、格式變動、權限失敗與外部服務中斷時是否能安全停止。
6. **交付可接手**：別人能不能理解做了什麼、重做一次或從失敗點繼續。
7. **效益值得**：節省的時間或提升的品質，是否大於驗證與人工收尾的成本。

這和 [NIST AI RMF 的 TEVV 與 Measure 要求](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)很接近：測試集、指標、工具細節、部署情境、獨立複核與限制都要被記錄，而且上線後仍要持續監測。對我來說，最重要的轉換是：

> **驗證結果不是報告最後的一段文字，而是 Agent 能不能取得 COMMIT 權限的依據。**

### 失敗也要是交易的一部分

如果失敗只被當成「AI 再試一次」，工作流程很容易留下無法追溯的半成品。失敗應該被分成幾種可處理的狀態：

| 失敗類型 | 可能處理方式 |
| --- | --- |
| 輸入錯誤 | 回到資料來源、權限或任務定義修正 |
| 方法錯誤 | 回到探索階段，比較另一個方案 |
| 執行錯誤 | 保留錯誤證據，修正程式或工具呼叫後重試 |
| 驗證錯誤 | 不提交，縮小範圍、補測試或轉人工複核 |
| 不可逆副作用 | 停止自動執行，改由人工確認或補償流程處理 |

這裡也要保留論文目前最值得懷疑的地方：外部 API、寄信、扣款、物流與對外發布未必真的能 rollback。對這些操作，較實際的設計可能是 SAGA 式補償、預覽後確認，或把它們放在整個 Agent 事務的最後一個人工 commit gate。

## 七、實務落地檢查清單

如果要在既有 Agent 系統中導入類似的事務保障，目前先整理成以下工程問題：

- [ ] **工作區快照與版本化**：Agent 修改程式、檔案或刪除資料前，是否能建立快照並回滾？
- [ ] **外部 API 的冪等性與補償**：非唯讀 API 是否有 idempotency key？關鍵操作是否有反向補償函數？
- [ ] **失敗步驟的 Context pruning**：錯誤嘗試是否經過整理，才進入後續記憶？
- [ ] **多代理沙盒與分支隔離**：並行子 Agent 是否有獨立工作區，完成後再結構化合併？
- [ ] **驗證閘門**：重大決策是否有規則、測試、證據或輕量模型作為提交條件？
- [ ] **提交證據與溯源**：提交結果是否同時保存做了什麼、依據什麼、由哪個代理完成？
- [ ] **交易邊界**：是否清楚定義從哪一步開始、哪一步才算提交？
- [ ] **語義不變量**：除了程式沒有報錯，是否還有「來源正確、格式完整、沒有未授權變更」等條件？
- [ ] **提交狀態**：每個工作最後是否明確標記為 committed、retry、compensated 或 rolled back？
- [ ] **推動證據包**：是否能用基準線、測試結果、失敗紀錄與人工成本向團隊說明為什麼值得採用？

## 八、限制與開放問題

### 外部不可逆副作用

現實世界中的寄信、扣款、物流與實體操作，通常不能靠本地快照復原。未來可能需要分散式 SAGA 類型的補償協議，或把不可逆動作放在更嚴格的人工確認閘門之後。

### 輕量驗證模型的泛化

如果依賴較小模型計算 Token 機率分歧，它在不同領域、不同語言或高度主觀的創意任務上是否仍然有效，還需要更多實驗。

### 延遲與成本

驗證、快照、重試與補償都會增加流程長度。即使可靠度提高，也要衡量即時任務對延遲與 Token 成本的容忍度。

### 「語義一致」如何被定義

資料庫的一致性可以透過 schema、constraint 或 transaction rule 描述，但代理任務常常包含開放式目標。如何把「有充分證據」「沒有偏離意圖」「結果足以交付」寫成可驗證的條件，可能是整個概念最難落地的部分。

## 參考資料與待核對項目

1. Sun, Z., Wang, X., & Li, G. (2026). *Agentic Transaction: Towards ACID-Compliant Agent Systems*. arXiv preprint arXiv:2608.13900v1。
2. [ACID-Agent 開放原始碼專案](https://github.com/TsinghuaDatabaseGroup/ACID-Agent)，README 與專案結構已核對；尚未在本機執行其 Docker／模型環境，因此不宣稱可重現性。
3. Claude Code 與 Agentic Workflow 的技術資料，需回到官方文件確認版本與說法。
4. KramaBench 研究資料：正式名稱、六大領域、24 個資料來源、1,700 個資料檔案、104 項任務與 Table 2–4 已依論文核對；論文 §3.2 的 197B／397B 模型名稱矛盾仍保留待釐清。
5. [NIST AI RMF Core：Measure 與 TEVV](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)，補充測試集、指標、部署情境、獨立複核與持續監測。
6. [European Commission：Living guidelines on the responsible use of generative AI in research](https://research-and-innovation.ec.europa.eu/document/download/2b6cf7e5-36ac-41cb-aab5-0d32050143dc_en)，補充研究者責任、透明、交叉驗證、可重現與資料界線。
7. [National Academies：Foundation Models for Scientific Discovery and Innovation](https://www.nationalacademies.org/read/29212/chapter/2)，補充科學工作中的可靠性、有效性、可重現性與 VVUQ。
8. [PostgreSQL 18：Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)，補回傳統資料庫中的 atomic、commit、rollback 與 savepoint 基礎。

## 後續研究清單

- 若要繼續，將已核對的正式定義、語義 ACID 與 validation gate，和「學術驗證／系統提交」的個人對照整理成正式模型；目前不宣稱這是論文提出的等價模型。
- 若要繼續，針對論文 §3.2 的 197B／397B 敘述矛盾向原作者或後續版本查證；Table 2–4 的現有數字與條件已記錄在 `tmp/aeo-research-evidence.md`。
- 若要繼續，才在具備 Docker、資料集、模型與 API 條件時執行獨立重現；目前只核對 README 所列的程式結構與執行方式。
- 把「代理修改網站檔案」當成小型案例，整理一次快照、驗證、提交與回滾流程，並記錄哪些步驟可以自動化、哪些必須人工核准。
- 建立一份可重用的工作流程推動證據包，讓不同 AI 專案共用任務邊界、驗證閘門與交付紀錄。
- 比較 Agentic Transaction 與 Saga、工作流引擎、事件溯源及傳統資料庫交易的差異。

## 預先收集：先分清楚論文主張與實作證據

1. [Agentic Transaction: Towards ACID-Compliant Agent Systems](https://arxiv.org/html/2608.13900v1)：原始論文 HTML v1；已核對 Semantic Atomicity、Consistency、Isolation、Durability、0.25／0.50 門檻與 Table 2–4，並記錄 197B／397B 的原文矛盾。
2. [TsinghuaDatabaseGroup/ACID-Agent](https://github.com/TsinghuaDatabaseGroup/ACID-Agent)：開放原始碼專案；已核對 README 的執行架構、資料與輸出位置、Docker／模型需求及 provider-specific cost 說明，尚未獨立執行。
3. [PostgreSQL 18｜Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)：用來補回傳統交易的基本概念，先分清楚 `BEGIN`、`COMMIT`、`ROLLBACK` 與 `SAVEPOINT`，再判斷「ACID for Agents」到底是沿用、改寫還是借用資料庫術語。

## 搭配閱讀：從交易到可驗證的工作流程

這篇論文比較像核心概念：它提出 Agent 如何透過探索、執行、驗證與提交／重試，取得接近交易系統的可靠性。下面的材料則分別補上長流程的失敗處理、持久化執行、結果追溯與 Agent 評估。先不必一次全部讀完，可以依照自己的工作問題選擇。

### 第一階段：先理解交易為什麼需要補償

1. [SAGAS：Long-Lived Transactions](https://www.cs.princeton.edu/techreports/1987/070.pdf)：長時間交易的經典研究。適合用來理解為什麼跨系統、長流程工作通常不能依賴單一資料庫的全有或全無回滾，而要拆成多個可補償的局部交易。
2. [AWS：Saga Patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-patterns.html)：把 Saga 的 continuation、compensation、choreography 與 orchestration 說得比較工程化。讀這篇時可以對照 Agent 的 `RETRY`、`COMPENSATE` 與 `ROLLBACK`，並注意補償不一定等於恢復成完全相同的原狀。
3. [AWS：Transactional Outbox Pattern](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)：補充「狀態已提交但通知沒有送出」的 dual-write 問題。它適合對照 Agent 的 commit：不只要保存變更，也要保存後續事件、證據或工作佇列，而且消費端要能承受重複訊息。

讀完這一階段，我希望能回答：

> 如果 Agent 做到一半失敗，我要回復什麼、補償什麼、保留什麼，以及如何避免同一個副作用被重複執行？

### 第二階段：再看工作流如何持久化與恢復

4. [Temporal Durable Execution](https://docs.temporal.io/)：從實際工作流引擎理解長時間執行、狀態保存、重試、暫停與故障恢復。它可以幫我把「持久性」從抽象的 Semantic Durability，轉成可觀察的 workflow state、history、retry policy 與人工介入點。
5. [W3C PROV Primer](https://www.w3.org/TR/prov-primer/)：補上 provenance 的基本模型，整理一個結果涉及哪些 entity、activity 與 agent。對我的工作來說，就是追蹤哪份資料、哪個 prompt、哪個工具與哪次執行產生了最後的檔案或決策。
6. [The Turing Way](https://book.the-turing-way.org/)：以可重現、協作與研究倫理為主的開放手冊。它適合把「留下 trace」從工程要求轉成團隊習慣，思考別人能不能重做、接手與理解限制。

這一階段最值得帶回工作流程的，不是一定要導入 Temporal，而是學會把每一個步驟的輸入、輸出、狀態、失敗原因與恢復位置保存下來。

### 第三階段：最後建立 Agent 的實際評估方法

7. [HELM：Holistic Evaluation of Language Models](https://nyaspubs.onlinelibrary.wiley.com/doi/full/10.1111/nyas.15007)：提醒我不要用單一成功率代表模型品質，而要用不同情境與多個指標觀察準確性、穩健性、效率、偏誤與其他限制。
8. [τ-bench：A Benchmark for Tool-Agent-User Interaction](https://arxiv.org/abs/2406.12045)：聚焦 Agent 使用工具、遵守領域政策與和使用者多輪互動的能力，適合思考「任務完成」之外，是否也遵守了流程條件。
9. [Inspect AI](https://inspect.aisi.org.uk/?lang=en-US)：由英國 AI Security Institute 發展的開源評估框架，將資料集、Agent、工具、評分器與沙盒組合成可以執行的測試。它比較接近未來真的要做 Agent workflow eval 時的工具層。

這一階段可以對照我自己的驗證閘門：正常案例、邊界案例、失敗案例、人工基準線、可接受錯誤與不可接受副作用。

### 我會怎麼搭配這些材料

| 讀完的材料 | 回到 ACID-Agent 筆記時要補問的問題 |
| --- | --- |
| SAGAS／Transactional Outbox | 這一步是真的 rollback，還是只能 compensation？提交時是否同時保存狀態與事件？ |
| Temporal | Agent 中斷後能從哪個 checkpoint 恢復？哪些步驟可以安全重試？ |
| W3C PROV／The Turing Way | 能不能說明資料、活動、Agent 與最後成果之間的關係？別人能不能重做？ |
| HELM／τ-bench／Inspect | 測試的是模型回答、工具操作、政策遵循、流程完成，還是整個工作結果？ |

這些材料先作為搭配閱讀，不把不同領域的術語直接當成同義詞。Saga 的補償交易、Temporal 的 durable execution、W3C 的 provenance 與 ACID-Agent 的語義保證，彼此可以互相參照，但仍要回到各自的問題範圍與實作條件。

## 我的參考意見

這個題目最值得先保留的不是「代理也有 ACID」這句口號，而是把代理的工作拆成探索、執行、驗證、提交與失敗後處理。對我真正重要的轉換是：把學術上的驗證要求，變成 Agent 能否提交工作成果的系統條件；再把每次提交留下的證據，變成推動下一個工作流程時可以被團隊檢查的依據。

論文目前應先視為一個研究框架與設計假說，不能直接當成已經成熟的工程標準；閱讀順序應該是原論文定義 → 原始碼結構 → 實驗表格 → 自己的小案例。對我的網站工作來說，最容易落地的部分可能是修改前快照、驗證閘門、差異檢查、狀態標記與可追溯紀錄，而不是一開始就追求完整的語義交易系統。

## 相關工作筆記

- [AI 提問判斷順序｜從情境、目標到診斷、設計與驗證](/learning/ai-question-judgment-order/)：處理如何在 Agent 開始工作前，把情境、目標、限制與暫定假設分開。
- [Gemini Notebook Agent｜從資料庫到可交付文件的工作流](/learning/gemini-notebook-agent-office-workflow/)：處理資料庫、AI 產出、人工判斷、驗證與交付物之間的流程。
- [網站品質與軟體測試｜42 天鐵人挑戰學習路徑](/learning/website-quality-testing-roadmap/)：提供測試案例、缺陷、回歸與發布品質的工程語言。

## 更新紀錄

- **2026-08-29 22:09**：建立 Agentic Transaction 公開研究筆記，加入語義 ACID、失敗隔離、驗證閘門、基準測試與實務檢查清單；全文暫列為待核對整理。
- **2026-09-08**：把學術 AI 驗證流程放回 Agentic Transaction 的語義層，補上交易邊界、驗證閘門、提交／重試／補償／回滾、持久化 trace 與工作流程推動證據包。
- **2026-09-11 19:02:32+08:00**：依 arXiv HTML v1 與專案 README 核對正式定義、實驗門檻、KramaBench 規模與 Table 2–4；修正 10.6 個百分點、模型條件、成本與尚未獨立重現的界線，並保留論文內的 197B／397B 矛盾。
