# 新電腦還原記錄（2026-10-10）

由 2026-10-08 的 Git bundle 還原 `source` 分支，備份提交為
`75d308fa24c030c5069fcd2fbb271b9a69a26c0c`。已核對 bundle SHA256
與 GitHub 遠端 source 提交一致。

新電腦使用 Node.js 24.12.0，依 package-lock.json 執行 npm ci。
網站維持 https://progress01.github.io/；原始資料保存於 source，網站產物發布至 main。

## 搬機修正

- Git 的自動換行轉換會影響 frontmatter 解析與正文雜湊驗證。
  `.gitattributes` 明定一般文字檔使用 LF，固定功能頁 scaffold 保留檢查要求的 CRLF。
- 校驗清單中 10 篇文章的正文雜湊與備份提交不一致。逐篇以 Git blob
  核對正文完全相同後，更新 docs/tag-reorganization-review.json 的這 10 個雜湊值。
  文章內容、分類、日期、標籤及網址沒有修改。
- GitHub CLI 已完成 progress01 帳號登入，並設定為 Git 的 HTTPS 登入工具。

## 驗收

搬機後完整 npm run verify 通過：272 個測試、281 篇文章網址、391 個 HTML。
本機 Hexo server 啟動成功，首頁與圖片的 HTTP 請求成功。
新增換行規則後，npm run deploy 中的完整 verify 再次通過。
網站產物已推送至 main，發布提交為 `1615bb002a869b7ee2eaf05df0d1721931541d8b`。
GitHub Pages 已回報 built，對應工作 success：
https://github.com/progress01/progress01.github.io/actions/runs/38032362328

## 持續更新

在專案根目錄操作：

```powershell
git status -sb
git pull --ff-only origin source
# 編輯文章及圖片
npm.cmd run verify
npm.cmd run server
```

預覽確認後停止 server，再檢查差異、提交本次修改，並發布：

```powershell
git diff
# git add 加入本次實際修改的檔案
git commit -m "更新部落格"
git push origin source
npm.cmd run deploy
```

發布前確認當次使用者授權。若正在使用 Codex，依 AGENTS.md 的部署要求執行。
日後重新 clone 時，先安裝 Git 與 Node.js 24，登入 GitHub，再使用：

```powershell
git clone -b source https://github.com/progress01/progress01.github.io.git
cd progress01.github.io
npm.cmd ci
npm.cmd run verify
```

Python 3.11 與 tools/requirements-blogger.txt 僅在需要 Blogger／圖片工具時補裝。
