# ACID-Agent 研究主張核對表

核對日期：2026-09-11（Asia/Taipei）。核對範圍是 arXiv HTML v1 與 ACID-Agent 專案 README；沒有在本機執行 Docker、模型或 KramaBench，因此不宣稱獨立重現。

| 原主張或待釐清的解讀 | 原文位置／條件 | 結果／處置 |
| --- | --- | --- |
| 代理事務是有限的 LLM／環境互動，通過任務條件與語義不變量才提交 | [論文 §2.1](https://arxiv.org/html/2608.13900v1#S2.SS1) | 已確認；文章改稱論文 §2.1 定義，並保留作者自己的工作化理解。 |
| Decision / Code confidence divergence 門檻為 0.25／0.50 | [論文 §2.2.2](https://arxiv.org/html/2608.13900v1#S2.SS2)、[§3.1](https://arxiv.org/html/2608.13900v1#S3.SS1)；API 主模型無 token probability，使用 local Qwen3-0.6B proxy | 已確認為該實驗的 retry 操作門檻；未寫成通用標準。Decision 比較探索決策與執行決策，Code 才比較有／無探索證據。 |
| 探索分歧度超過 0.45 時停止 | [論文 §3.1](https://arxiv.org/html/2608.13900v1#S3.SS1) | 已確認；文章與 0.25／0.50 的 retry 門檻分開說明。 |
| KramaBench 有六大領域、24 個資料庫、約 1,700 檔案、104 任務 | [論文 §3.1](https://arxiv.org/html/2608.13900v1#S3.SS1) | 原文是 24 個 **data sources**、1,700 個真實資料檔案、104 個自然語言資料科學任務；文章修正「資料庫」為「資料來源」。 |
| Table 2 的主實驗分數、步驟、token 與成本 | [論文 §3.1 Table 2](https://arxiv.org/html/2608.13900v1#S3.T2)；Qwen3.5-397B-A17B／GLM-5.2 條件 | 表內數字逐項吻合；文章保留作者在該平台與設定下報告的成本。 |
| ACID-Agent 提升 10.6% | 摘要與 [論文 §3.2](https://arxiv.org/html/2608.13900v1#S3.SS2)；Table 2 的 Qwen3.5-397B 條件為 74.6−64.0 | Table 2 支持 **10.6 個百分點**；§3.2 文字寫 10.6% 且寫 Qwen3.5-197B，與 §3.1／Table 2 的 397B 不一致，文章保留矛盾，不擅自判定。 |
| Table 3 的 `±` 是整體分數標準差 | [論文 §3.2 Table 3](https://arxiv.org/html/2608.13900v1#S3.T3)；Environment、Qwen3.5-397B-A17B、三次執行 | 不支持該解讀；表註定義為每任務變異平均值的平方根，文章已修正並限制解讀範圍。 |
| Table 4 的 90.0 可直接和 Table 2 的 74.6 比較 | [論文 §3.3 Table 4](https://arxiv.org/html/2608.13900v1#S3.T4)；Environment、Qwen3.5-397B-A17B | 不支持直接比較；兩表 scope 不同。90.0−78.3 為 11.7 個百分點，文章不把消融差異寫成已證明的單一因果。 |
| 表格成本是普遍價格或可直接重現的數字 | [論文 Table 2–4](https://arxiv.org/html/2608.13900v1#S3.T2)、[專案 README](https://github.com/TsinghuaDatabaseGroup/ACID-Agent) 的 reproducibility／pricing 說明 | 僅作該實驗設定的作者報告；README 說明 provider-specific pricing。未執行，故不宣稱成本或結果可獨立重現。 |
| README／專案有 ACID-Agent、KramaBench、baseline harness、trace／cost logging 與 Docker／local scorer 說明 | [專案 README](https://github.com/TsinghuaDatabaseGroup/ACID-Agent) | 已核對 README 所列結構、執行條件與限制；未宣稱已完成整份程式碼審核或論文結果的完全對應。 |
| Figure 3 可與 KramaBench 表格合併解讀 | [論文 §3.2](https://arxiv.org/html/2608.13900v1#S3.SS2) | 不採用此解讀；Figure 3 是不同研究脈絡的 AgenticDataBench 10 tasks，文章未將它混入 KramaBench 數字。 |
