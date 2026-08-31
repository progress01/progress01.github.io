# Hexo 同款網站安裝與 GitHub Pages 部署手冊

本手冊是依照目前這個部落格專案整理的「可帶到另一台電腦照做」版本。完成後，朋友可以在自己的電腦上：

1. 安裝相同的 Hexo、NexT 主題與套件。
2. 在本機預覽同樣的網站結構與功能。
3. 將網站原始碼放進自己的 GitHub repository。
4. 將產生後的網站發布到自己的 GitHub Pages。

本手冊以 Windows PowerShell 為主要範例；Git、Node.js、npm、Hexo 的核心指令在 macOS / Linux 也相同，只是安裝路徑和檔案複製指令略有不同。

---

## 0. 先理解這個專案的架構

這個專案不是只有一個「主題資料夾」，而是完整的 Hexo 原始碼專案。要做出同樣效果，必須保留設定、文章、圖片、自訂頁面、腳本與主題客製化。

目前的配置快照如下：

| 項目 | 目前設定 |
| --- | --- |
| Hexo | 8.1.1 |
| Hexo CLI | 4.3.2（可用 npx hexo，不一定要全域安裝） |
| Node.js | 目前這台電腦為 24.12.0；Hexo 8 至少需要 Node.js 20.19.0 |
| npm | 目前這台電腦為 11.6.2 |
| NexT | 8.27.0 |
| NexT Scheme | Gemini |
| 語言 / 時區 | zh-TW / Asia/Taipei |
| 網站網址 | https://progress01.github.io |
| GitHub Pages 分支 | main，根目錄 / |
| 原始碼分支 | source |
| 發布方式 | npm run deploy，由 hexo-deployer-git 發布 |

### 這個 repository 的兩個重要分支

| 分支 | 放什麼 | 怎麼更新 |
| --- | --- | --- |
| source | _config.yml、文章、圖片、主題、腳本與所有原始檔 | 用 git push origin source |
| main | Hexo 產生的 public 靜態網站檔案 | 用 npm run deploy 自動更新，不要手動編輯 |

因此，朋友要建立自己的網站時，必須把下列兩個地方都改成自己的資訊：

1. 本機 Git 的 origin：用來推送原始碼 source 分支。
2. _config.yml 的 deploy.repo：用來發布網站產物到 main 分支。

本專案目前這兩者指向同一個 GitHub repository，但使用不同分支。

> 重要：hexo-deployer-git 會用 --force 推送產物到 deploy.branch。這表示 npm run deploy 會覆蓋目標分支內容；目標分支只能放產生後的網站，不能拿來放手動維護的原始碼。

---

## 1. 開始前要準備的東西

朋友的電腦需要有：

- Git
- Node.js
- npm（會隨 Node.js 一起安裝）
- GitHub 帳號
- 一個自己的 GitHub Pages repository
- 編輯器，例如 Visual Studio Code

### 建議版本

安裝 Node.js 24.x 可以和目前專案環境最接近；至少要使用 Node.js 20.19.0 以上，因為本專案使用 Hexo 8。

安裝完成後，在 PowerShell 檢查：

~~~powershell
node --version
npm --version
git --version
~~~

版本不必和目前電腦的 patch 版本完全一樣，但 Node.js 不要低於 20.19.0。

### 設定 Git 作者資訊

第一次使用 Git 時設定一次即可：

~~~powershell
git config --global user.name "朋友的 GitHub 顯示名稱"
git config --global user.email "朋友的 GitHub 帳號信箱"
~~~

檢查設定：

~~~powershell
git config --global --list
~~~

這裡的 email 會寫進 commit 紀錄，不是 GitHub 登入密碼。

---

## 2. 建立朋友自己的 GitHub Pages repository

### 建議使用 User site

請朋友在 GitHub 建立一個名稱完全符合以下格式的 repository：

~~~text
朋友的 GitHub 使用者名稱.github.io
~~~

例如 GitHub 使用者名稱是 alice，repository 就必須叫：

~~~text
alice.github.io
~~~

完成後網站網址會是：

~~~text
https://alice.github.io/
~~~

建議建立時先不要勾選 README、.gitignore 或 License，讓 repository 保持空白，第一次由 Hexo 建立 main 部署分支。

如果朋友只想先測試，也可以使用公開 repository；請注意，GitHub Pages 網站和 repository 中的內容可能會被公開看到，不要放密碼、Personal Access Token、私人 API key 或不想公開的文章。

### 不要把 repository 名稱搞混

以下是三個不同的東西：

| 名稱 | 例子 | 用途 |
| --- | --- | --- |
| GitHub 使用者名稱 | alice | 帳號名稱 |
| 原始碼 repository | alice.github.io | 同時存放 source 原始碼與 main 網站產物 |
| 網站網址 | https://alice.github.io/ | 瀏覽器實際開啟的網址 |

---

## 3. 設定 GitHub 登入方式

推薦使用 SSH，這樣不需要把密碼或 Token 寫進 Hexo 設定檔。

### 3.1 產生 SSH 金鑰（Windows）

在 PowerShell 執行：

~~~powershell
ssh-keygen -t ed25519 -C "朋友的 GitHub 帳號信箱"
~~~

一路按 Enter 可以使用預設位置。若詢問 passphrase，可以設定一組自己記得住的密語，也可以依朋友的使用習慣留白。

顯示公開金鑰並複製到剪貼簿：

~~~powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
~~~

到 GitHub：

~~~text
右上角頭像 → Settings → SSH and GPG keys → New SSH key
~~~

Title 可以填「朋友的電腦」，Key 貼上剛才複製的內容，然後儲存。

測試 SSH：

~~~powershell
ssh -T git@github.com
~~~

第一次可能會詢問是否信任 GitHub，輸入 yes。若看到類似「成功驗證，但 GitHub 不提供 shell access」的訊息，代表驗證成功；那不是錯誤。

### 3.2 如果不使用 SSH

也可以使用 HTTPS repository URL，但 GitHub 已不接受一般帳號密碼進行 Git push。需要使用 Git Credential Manager 或 Personal Access Token。

不要把 Token 直接寫成下面這樣，也不要 commit：

~~~yaml
# 不要這樣做
repo: https://TOKEN@github.com/alice/alice.github.io.git
~~~

如果使用 HTTPS，讓 Git Credential Manager 在 push 時處理驗證，或改用 GitHub 官方建議的 Token / credential 設定方式。

---

## 4. 取得完整的 Hexo 原始碼

### 方法 A：從原始 GitHub repository 複製（推薦）

如果朋友可以讀取原本的原始碼 repository，在 PowerShell 執行：

~~~powershell
git clone --branch source https://github.com/progress01/progress01.github.io.git friend-blog
Set-Location friend-blog
~~~

這會取得目前網站的 source 分支。

原本的 origin 指向你的 repository，朋友要改成自己的 repository：

~~~powershell
git remote rename origin upstream
git remote add origin git@github.com:朋友使用者名稱/朋友使用者名稱.github.io.git
git remote -v
~~~

正常情況下應該看到：

~~~text
origin   git@github.com:朋友使用者名稱/朋友使用者名稱.github.io.git
upstream https://github.com/progress01/progress01.github.io.git
~~~

第一次將原始碼分支推到朋友自己的 repository：

~~~powershell
git push -u origin source
~~~

upstream 只是保留原本專案的來源，日後不需要同步時也可以不使用。朋友平常的原始碼推送都使用 origin。

### 方法 B：用 USB 或壓縮檔複製

如果朋友無法直接 clone，可以把整個專案資料夾複製過去。為了節省時間和容量，可以不帶以下資料夾／檔案：

- node_modules/
- public/
- .deploy_git/
- db.json

這些都是本機安裝、Hexo 建置或部署時產生的資料，之後可以重新產生。以下內容必須保留：

- _config.yml
- package.json
- package-lock.json
- .gitignore
- source/
- themes/next/
- scripts/
- tools/
- scaffolds/
- .github/（若要保留 Dependabot 設定）

若複製過去的資料夾沒有 .git，在專案根目錄執行：

~~~powershell
git init
git branch -M source
git remote add origin git@github.com:朋友使用者名稱/朋友使用者名稱.github.io.git
git add .
git commit -m "建立 Hexo 原始碼"
git push -u origin source
~~~

執行 git add . 前，先用 git status --short 檢查，不要把密碼、Token 或私人設定加入版本控制。

---

## 5. 安裝專案套件

進入專案根目錄後執行：

~~~powershell
npm ci
~~~

本專案有 package-lock.json，npm ci 會依照鎖定檔安裝同一組套件版本，適合在另一台電腦重建環境。

確認 Hexo：

~~~powershell
npx hexo version
~~~

應該可以看到 Hexo 8.x，並且專案中的 package.json 指定 Hexo 8.1.1。

### 不要重新執行 hexo init

這個專案已經是完整的 Hexo 專案。不要在它裡面再次執行：

~~~powershell
hexo init
~~~

這可能會覆蓋或混入新的預設檔案。

### 不要另外下載一份 NexT

目前主題已經完整放在：

~~~text
themes/next/
~~~

而且這個資料夾包含目前網站所使用的主題版本與客製化檔案。不要再執行 npm install hexo-theme-next，也不要用新下載的主題資料夾覆蓋它，否則網站畫面、選單、自訂模板或資料欄位可能不一致。

NexT 官方目前建議使用 Alternate Theme Config；但本專案是為了維持現有網站而直接版本控制 themes/next/_config.yml。朋友若要得到完全相同的畫面，先保持目前的做法，不要自行改成另一套設定方式。

---

## 6. 改成朋友自己的網站資訊

如果朋友只是要在本機查看完全相同的網站，可以先不改這一節。

如果朋友要發布自己的網站，至少修改根目錄的 _config.yml。

### 6.1 根目錄 _config.yml

找到並修改以下設定：

~~~yaml
title: "朋友的網站標題"
subtitle: "朋友的副標題"
description: "朋友的網站簡介"
author: 朋友的名字
language: zh-TW
timezone: Asia/Taipei

url: https://朋友使用者名稱.github.io
root: /

theme: next

deploy:
  type: git
  repo: git@github.com:朋友使用者名稱/朋友使用者名稱.github.io.git
  branch: main
~~~

其中最重要的是：

- url 要和朋友的實際 GitHub Pages 網址一致。
- repo 要是朋友自己的 repository，不可以繼續指向 progress01/progress01.github.io.git。
- branch: main 要和 GitHub Pages 的發布分支一致。
- User site 使用 root: /，不要擅自加 repository 子路徑。

### 6.2 如果朋友要使用 Project site

如果 repository 不叫朋友使用者名稱.github.io，而是例如 my-blog，網站通常會是：

~~~text
https://朋友使用者名稱.github.io/my-blog/
~~~

這時 _config.yml 至少要改成：

~~~yaml
url: https://朋友使用者名稱.github.io/my-blog
root: /my-blog/
~~~

圖片、CSS、JavaScript 和選單連結也必須測試。若只是要複製目前這個網站，建議優先使用 User site，設定最單純。

### 6.3 NexT 主題設定

主題設定位於：

~~~text
themes/next/_config.yml
~~~

目前和網站外觀最有關的設定包括：

- scheme: Gemini
- 左側 sidebar
- sidebar 寬度與顯示方式
- menu 導覽列
- 目錄 toc
- 閱讀進度條 reading_progress
- 回到頂端按鈕 back2top
- RSS 連結
- 日曆頁面所需的設定

朋友要使用同樣外觀時，先不要改這些設定。要改成自己的識別資料時，再處理：

- avatar.url
- social
- github_banner.permalink（目前未啟用）
- footer 文字或作者
- calendar.calendar_id 與 calendar.api_key

不要把你的私有 API key 或任何 Token 給朋友。Google Calendar 若要啟用，請朋友建立並限制自己的 API key；若不用該功能，維持關閉或保留現有佔位設定即可。

---

## 7. 專案中哪些檔案一定要保留

### 建議完整保留的檔案

| 路徑 | 用途 |
| --- | --- |
| _config.yml | Hexo 網站名稱、網址、路徑、外掛與部署設定 |
| package.json | 套件版本範圍與 npm run 指令 |
| package-lock.json | 確保另一台電腦安裝相同依賴版本 |
| .gitignore | 忽略 node_modules、public、部署暫存資料 |
| source/_posts/ | 一般文章 |
| source/images/ | 文章、圖牆與主題圖片 |
| source/_data/ | 分類、標籤與自訂資料 |
| source/life-index.json | 首頁「現在的我」等內容 |
| source/microblog.json | 碎碎念資料 |
| source/reading-log/ | 首頁／閱讀索引自訂頁面 |
| source/status/ | 碎碎念頁面 |
| source/calendar/ | 熱力圖與日曆頁面 |
| source/photos/ | 圖牆頁面 |
| themes/next/ | NexT 主題與目前客製化模板、CSS、JavaScript |
| scripts/ | 分類、標籤、日曆、熱門文章等產生器 |
| tools/ | 內容與圖片檢查工具 |
| scaffolds/ | hexo new 建立文章時使用的樣板 |

### 不需要複製或不應手動修改的內容

| 路徑 | 原因 |
| --- | --- |
| node_modules/ | npm 安裝產物，使用 npm ci 重新建立 |
| public/ | Hexo 建站產物，使用 npm run build 重新建立 |
| .deploy_git/ | Git 部署器的本機暫存 repository |
| db.json | Hexo 本機資料快取 |

若這些資料夾在本機存在，不代表它們需要 commit。.gitignore 已經忽略它們。

---

## 8. 第一次建置與本機預覽

在專案根目錄執行：

~~~powershell
npm run verify
~~~

這個指令會依序執行：

1. tools/content-check.js，檢查內容分類、JSON、圖片路徑等。
2. Hexo generate，產生 public/ 網站檔案。

如果成功，啟動本機伺服器：

~~~powershell
npx hexo server --port 4003
~~~

在瀏覽器開啟：

~~~text
http://localhost:4003/
~~~

測試完畢後回到 PowerShell，按 Ctrl + C 停止伺服器。

### 第一次至少要檢查這些頁面

~~~text
/
/categories/
/tags/
/reading-log/
/photos/
/random/
/calendar/
/reading/
~~~

另外抽查：

- 一篇有封面的文章。
- 一篇沒有封面的文章。
- 一張圖牆圖片。
- 手機寬度下是否可以閱讀。
- 選單連結是否仍指向正確網址。
- 搜尋是否可以找到文章。
- 日曆日期是否依文章日期產生。

---

## 9. 第一次發布到朋友的 GitHub Pages

### 9.1 先確認原始碼設定

先確認 _config.yml 中的部署設定已經是朋友自己的 repository：

~~~powershell
Select-String -Path _config.yml -Pattern '^url:|^  repo:|^  branch:'
~~~

應該看到類似：

~~~text
url: https://alice.github.io
  repo: git@github.com:alice/alice.github.io.git
  branch: main
~~~

### 9.2 推送原始碼分支

先查看修改內容：

~~~powershell
git status --short
~~~

確認沒有密碼、Token、私人資料或不應上傳的檔案後：

~~~powershell
git add .
git commit -m "建立 Hexo 網站設定"
git push -u origin source
~~~

這一步只會把原始碼推到 source，不會直接讓 Pages 網站更新。

### 9.3 發布產物到 main

先確認剛才的本機建置成功，再執行：

~~~powershell
npm run deploy
~~~

第一次執行時可能會：

- 建立 .deploy_git/。
- 將 public/ 複製到部署暫存 repository。
- 建立或覆蓋遠端 main 分支。
- 詢問 SSH 或 HTTPS 驗證。

看到部署成功後，GitHub repository 應該會出現 main 分支。

### 9.4 在 GitHub 開啟 Pages

到朋友的 repository：

~~~text
Settings → Pages
~~~

在 Build and deployment 設定：

~~~text
Source：Deploy from a branch
Branch：main
Folder：/(root)
~~~

按 Save，等待 GitHub Pages 完成部署。最後開啟：

~~~text
https://朋友使用者名稱.github.io/
~~~

如果 Pages 設定畫面暫時看不到 main，先確認 npm run deploy 真的成功並且遠端有 main 分支，再重新整理設定頁面。

---

## 10. 日後每次更新的標準流程

日常更新建議照這個順序：

~~~powershell
# 1. 修改 source/ 或必要的設定檔

# 2. 內容檢查與建置
npm run verify

# 3. 本機預覽（需要時才做）
npx hexo server --port 4003

# 4. 儲存原始碼修改
git status --short
git add .
git commit -m "更新文章或網站設定"
git push origin source

# 5. 發布產生後的網站
npm run deploy
~~~

請記住：

- git push origin source 是保存原始碼。
- npm run deploy 是更新 GitHub Pages 網站。
- 只執行其中一個，另一邊不一定會同步。
- 不要手動修改 main 分支中的 HTML、CSS 或 JavaScript。
- 不要手動修改 public/；下一次建置會覆蓋它。

### 新增文章

~~~powershell
npx hexo new post "文章標題"
~~~

檔案會建立在：

~~~text
source/_posts/
~~~

文章 front matter 範例：

~~~yaml
---
title: 文章標題
date: 2026-08-31 12:00:00
categories: [閱讀與影視]
tags: [閱讀紀錄]
---
~~~

新增文章後一定要執行：

~~~powershell
npm run verify
~~~

### 新增草稿

~~~powershell
npx hexo new draft "草稿標題"
npx hexo server --drafts --port 4003
~~~

草稿位於 source/_drafts/，不會在一般建置中公開。確認完成後，再移到 source/_posts/。

---

## 11. 內容與圖片的注意事項

### 圖片路徑

圖片放在：

~~~text
source/images/
~~~

文章內使用網站路徑：

~~~markdown
![圖片說明](/images/example.webp)
~~~

不要把朋友電腦上的 Windows 絕對路徑寫進文章：

~~~markdown
<!-- 不要這樣 -->
![圖片](C:\Users\Alice\Desktop\photo.png)
~~~

檔案名稱大小寫要完全一致。Windows 本機可能不容易發現大小寫錯誤，但部署到網站後可能造成圖片破圖。

### 分類與標籤

目前網站的內容分類設定在：

~~~text
source/_data/content-categories.yml
~~~

文章 front matter 中的分類名稱，必須和設定檔中的名稱完全一致。新增分類時，要同步處理分類設定與文章 front matter。

### 自訂頁面

這個網站不是只靠 NexT 預設頁面，還有自訂的閱讀索引、碎碎念、圖牆、隨機文章和日曆頁面。若朋友想要「同樣功能」，不要只複製 themes/next/，也要保留 source/ 和 scripts/。

若朋友只想使用同樣外觀、不要你的個人內容，可以替換：

- source/_posts/ 中的文章。
- source/images/ 中的圖片。
- source/microblog.json。
- source/life-index.json。
- source/reading-desk.yml。
- 文章中的作者、連結與封面。

替換前先備份；不要一開始就刪除整個 source/，因為自訂頁面的版面和 JavaScript 也在裡面。

---

## 12. 常見錯誤與處理方式

### npm ci 失敗

先檢查：

~~~powershell
node --version
npm --version
~~~

確認 Node.js 至少是 20.19.0，再確認目前位置是專案根目錄，而且有 package-lock.json。

不要先任意刪除或修改 package-lock.json。如果依賴真的要升級，應該另外建立升級 commit，不要為了在朋友電腦安裝而改掉鎖定版本。

### hexo 不是可辨識的命令

本專案使用本機依賴，請改用：

~~~powershell
npx hexo version
npx hexo server --port 4003
~~~

或使用 npm run verify、npm run deploy。不需要依賴全域的 Hexo 版本。

### npm run verify 顯示未知分類

檢查文章 front matter 的 categories，是否和 source/_data/content-categories.yml 的名稱完全相同，包含中文、空白與標點符號。

### 圖片破圖

依序檢查：

1. 圖片是否真的位於 source/images/。
2. Markdown 路徑是否使用 /images/...。
3. 副檔名是否正確，例如 .webp 和 .png 不可混用。
4. 檔名大小寫是否完全相同。
5. npm run verify 後是否重新啟動本機伺服器。

### git push origin source 被拒絕

檢查遠端：

~~~powershell
git remote -v
git branch --show-current
~~~

如果目前不在 source 分支：

~~~powershell
git switch source
~~~

如果朋友的 repository 已經有不相干的 README commit，先不要使用 --force 覆蓋；先確認 repository 內容和分支歷史，再決定要合併或重新建立空白 repository。

### npm run deploy 驗證失敗或 Permission denied

先測試 SSH：

~~~powershell
ssh -T git@github.com
~~~

再檢查 _config.yml：

~~~yaml
deploy:
  type: git
  repo: git@github.com:朋友使用者名稱/朋友使用者名稱.github.io.git
  branch: main
~~~

確認：

- repository 名稱沒有打錯。
- SSH key 是加在正確的 GitHub 帳號。
- 朋友對該 repository 有寫入權限。
- deploy.repo 不是原本網站的 repository。

### GitHub Pages 顯示 404

依序檢查：

1. npm run deploy 是否成功。
2. GitHub repository 是否真的有 main 分支。
3. Settings → Pages 是否選 Deploy from a branch。
4. Branch 是否選 main。
5. Folder 是否選 /(root)。
6. User site repository 是否真的叫 朋友使用者名稱.github.io。
7. _config.yml 的 url 是否沒有殘留 progress01.github.io。
8. 如果是 Project site，url 與 root 是否包含正確子路徑。

### 發布後畫面還是舊的

先確認：

~~~powershell
git log --oneline --all -5
~~~

本機重新建置：

~~~powershell
npm run verify
npm run deploy
~~~

再用瀏覽器強制重新整理或無痕視窗測試。GitHub Pages 也可能需要一些時間處理最新 commit。

### 不小心把網站部署到錯的 repository

立刻停止再執行 npm run deploy，先檢查：

~~~powershell
Select-String -Path _config.yml -Pattern '^  repo:|^  branch:'
git remote -v
~~~

不要用 git reset --hard 解決；先修正 _config.yml 和 Git remote，再判斷是否需要恢復錯誤的部署分支。

---

## 13. 交付前檢查清單

### 電腦環境

- [ ] node --version 至少是 20.19.0。
- [ ] npm --version 可以正常執行。
- [ ] git --version 可以正常執行。
- [ ] Git 作者姓名與 email 已設定。
- [ ] GitHub SSH 驗證成功，或 HTTPS credential 已設定。

### 專案

- [ ] npm ci 成功。
- [ ] npx hexo version 顯示 Hexo 8.x。
- [ ] themes/next/ 存在。
- [ ] package-lock.json 沒有被不必要地修改。
- [ ] npm run verify 成功。
- [ ] 本機首頁、文章、分類、標籤、圖片、搜尋與自訂頁面正常。

### GitHub

- [ ] repository 名稱正確。
- [ ] origin 指向朋友自己的 repository。
- [ ] _config.yml 的 url 是朋友自己的網址。
- [ ] _config.yml 的 deploy.repo 是朋友自己的 repository。
- [ ] 原始碼已推送到 source。
- [ ] npm run deploy 成功。
- [ ] main 分支已產生網站檔案。
- [ ] Pages 設定為 main + /(root)。
- [ ] 網站網址可以開啟。

---

## 14. 最短版指令總表

第一次安裝：

~~~powershell
git clone --branch source https://github.com/progress01/progress01.github.io.git friend-blog
Set-Location friend-blog
git remote rename origin upstream
git remote add origin git@github.com:朋友使用者名稱/朋友使用者名稱.github.io.git
npm ci
npm run verify
npx hexo server --port 4003
~~~

確認 _config.yml 已改成朋友自己的網址和 repository 後：

~~~powershell
git add .
git commit -m "建立朋友的 Hexo 網站"
git push -u origin source
npm run deploy
~~~

最後到 GitHub：

~~~text
Settings → Pages → Deploy from a branch → main → /(root) → Save
~~~

日後更新：

~~~powershell
npm run verify
git add .
git commit -m "更新網站內容"
git push origin source
npm run deploy
~~~

---

## 15. 官方參考文件

- [Hexo 官方文件](https://hexo.io/docs/)
- [Hexo 安裝與 Node.js 版本要求](https://hexo.io/docs/)
- [Hexo GitHub Pages 部署](https://hexo.io/docs/github-pages)
- [Hexo One-Command Deployment](https://hexo.io/docs/one-command-deployment)
- [NexT 安裝](https://theme-next.js.org/docs/getting-started/installation)
- [NexT 設定方式](https://theme-next.js.org/docs/getting-started/configuration)
- [GitHub Pages 設定發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub 使用 SSH 連線](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

這份手冊的原則只有三個：

~~~text
保留完整原始碼
先 verify 再 deploy
永遠確認 deploy.repo 是自己的 repository
~~~
