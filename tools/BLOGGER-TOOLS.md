# Blogger 工具操作

這四個維護工具都採用明確範圍：`--post source/_posts/<file>.md` 可重複指定文章，`--all` 表示整站 Blogger 維護，兩者不能同時使用。`--write` 必須搭配其中一種範圍；單獨 `--write` 會拒絕。省略 `--write` 是 dry run，不寫入檔案；restore dry run 也不下載圖片。Python 圖片工具需要 `tools/requirements-blogger.txt` 的 Pillow；共享 front matter 分類使用 npm 的真實 `js-yaml`，restore 也需要既有 Node 依賴。

## 一般流程

先以相同範圍預覽，確認實際待改集合，再用 `--write` 套用：

```powershell
node tools/restore-blogger-images.js --feed=<feed.json> --post source/_posts/<file>.md
node tools/restore-blogger-images.js --feed=<feed.json> --post source/_posts/<file>.md --write

python tools/normalize-blogger-imports.py --post source/_posts/<file>.md
python tools/normalize-blogger-imports.py --post source/_posts/<file>.md --write

python tools/convert-images-to-webp.py --post source/_posts/<file>.md
python tools/convert-images-to-webp.py --post source/_posts/<file>.md --write

python tools/build-blogger-photo-wall.py --post source/_posts/<file>.md
python tools/build-blogger-photo-wall.py --post source/_posts/<file>.md --write
```

需要整站維護時，將每個命令的 `--post ...` 換成明確的 `--all`。converter 的 `--all --write` 會掃描 `source/images/` 的 raster 資產，並更新 `source/` 與 `themes/` 下的文字參照；只有在使用者要求整站遷移時才使用。restore 的選定寫入會下載圖片到最終路徑，依 feed 重建選定文章正文並保留 front matter，可能覆蓋本地正文修改，因此不能當作只補缺漏圖片的無損命令。`--overwrite-images` 只在明確要覆寫既有不同 WebP 時加上。

Blogger 匯入的歌曲文章若已有可用的本機封面，請在該單篇 front matter 手動補上相同的 `cover: /images/<path>.webp`；目前 normalizer 會保留歌曲 metadata，不會替歌曲自動推斷 cover。

匯入新文章的 planner 是獨立命令，先預覽實際缺漏集合：

```powershell
node tools/import-blogger-missing.js --feed=<feed.json>
node tools/import-blogger-missing.js --feed=<feed.json> --write
```

確認缺漏集合後才執行 importer 的 `--write`。它目前沒有單篇 `--post` 範圍；若只要修一篇，使用上面的四個 scoped 工具，不要以整個 feed 的 restore 覆蓋既有本地改稿。

## 測試

Python 工具測試獨立執行：

```powershell
npm run test:blogger
node --test tools/tests/restore-blogger-images.test.js
```

測試與 dry run 都不部署、不提交；內容寫入後由上層流程執行 `npm run verify`，若被其他工作區變更阻擋，回報實際錯誤與檔案。
