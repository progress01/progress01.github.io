'use strict';

// 依文章正文與已確認的內容性質重整 front matter 標籤。
// 預設只產生逐篇審查報告；加入 --write 才會寫回文章標籤。

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const frontMatter = require('hexo-front-matter');

const ROOT = path.resolve(__dirname, '..');
const POSTS_ROOT = path.join(ROOT, 'source', '_posts');
const REPORT_PATH = path.join(ROOT, 'docs', 'tag-reorganization-review.json');

const LAB_RULES = {
  '實驗室/Agentic-Transaction-ACID-Agent-學習筆記.md': {
    tags: ['研究筆記', 'AI Agent'],
    basis: '正文以論文與 README 為來源，整理 Agent transaction 的探索、執行、驗證與提交流程，並標示尚未獨立重現。'
  },
  '實驗室/AI提問判斷順序-情境目標與問題類型.md': {
    tags: ['方法整理', '提問方法'],
    basis: '正文提出情境、目標、限制、暫定假設與驗證順序，形成可重複使用的提問框架。'
  },
  '實驗室/CMS前後台理解-欄位對照與規格審查.md': {
    tags: ['觀念釐清'],
    basis: '正文先拆開內容建模、欄位、關聯與生命週期，仍是持續核對中的概念工作手冊。',
    uncertain: true
  },
  '實驗室/Gemini-Notebook-Agent-文件產出工作流.md': {
    tags: ['研究筆記', 'AI Agent'],
    basis: '正文整理外部產品資料與尚待驗證的文件產出流程，沒有宣稱已完成實測。'
  },
  '實驗室/LIS-Research-1965-2025-內容分析學習筆記.md': {
    tags: ['研究筆記', '內容分析'],
    basis: '正文以研究文章的摘要、方法與初步結果建立待核對問題，仍保留研究狀態。'
  },
  '實驗室/Web-自動化測試-Python-Pytest與Playwright.md': {
    tags: ['學習規劃', 'Web 自動化'],
    basis: '正文列出學習階段、工具範圍與尚未完成的過關條件，屬學習路徑而非完成紀錄。'
  },
  '實驗室/life-check-tool.md': {
    tags: ['觀念釐清'],
    basis: '正文把工具展示改成存檔點的問題與設計判斷，重點是釐清設計取捨。'
  },
  '實驗室/在台灣設立實驗室十一年-思考方式筆記.md': {
    tags: ['觀念釐清', '思考方式'],
    basis: '正文觀察外部文章如何處理成果、疲累、責任與角色變化，尚未形成實證方法。'
  },
  '實驗室/排球攻擊揮臂機制.md': {
    tags: ['觀念釐清'],
    basis: '正文把擊球點、身體展開與出手順序重新放回動作節奏，並保留症狀假說的不確定性。'
  },
  '實驗室/混排攻擊與防守站位.md': {
    tags: ['觀念釐清'],
    basis: '正文先拆出主要防守、次要責任與補位方向，仍在建立問題地圖。'
  },
  '實驗室/測試基本功-User-Story-Test-Case與Bug-Report.md': {
    tags: ['方法整理', '測試案例'],
    basis: '正文整理 User Story、Test Case、Bug Report 與驗收條件的操作框架，雖是系列初期仍已形成可重用方法。'
  },
  '實驗室/測試設計-等價類別邊界值與風險導向測試.md': {
    tags: ['方法整理', '測試設計'],
    basis: '正文整理等價類別、邊界值、決策表與風險排序的測試方法。'
  },
  '實驗室/痠痛改善研究-從下背肩膀與小腿開始.md': {
    tags: ['研究筆記'],
    basis: '正文以部位、誘發情境、介入方式與隔天反應建立待驗證觀察，明確不把內容當成診斷。',
    uncertain: true
  },
  '實驗室/發布品質-Git-CICD與Release-Checklist.md': {
    tags: ['方法整理', 'CI/CD'],
    basis: '正文把版本、環境、測試證據、發布判斷與回復流程整理成可交接的框架。'
  },
  '實驗室/網站品質與軟體測試-從需求到上線驗證的學習路徑.md': {
    tags: ['學習規劃', '網站品質'],
    basis: '正文是 42 天學習挑戰的階段地圖與過關條件，明確標示尚未完成實作。'
  },
  '實驗室/簡報製作與Open-Slide學習筆記.md': {
    tags: ['學習規劃', '簡報'],
    basis: '正文從資料與外部方法建立簡報學習流程，並為後續報告設定尚未完成的練習。'
  },
  '實驗室/討論GEO篇一.md': {
    tags: ['觀念釐清'],
    basis: '正文釐清 GEO、AEO、SEO 與 Schema 的差異及不能保證的範圍。'
  }
};

const WORK_RULES = {
  '實驗室/工作知識-API需求排查紀錄.md': { tags: ['問題排查'], basis: '正文從外部來源、後台、排程、API 到前台建立資料流來定位異常。' },
  '實驗室/工作知識-上稿與表格排查紀錄.md': { tags: ['問題排查'], basis: '正文逐層區分 HTML、CSS、資料、編輯器與檔案權限造成的前台差異。' },
  '實驗室/工作知識-專案報價與成本估算.md': { tags: ['方法整理'], basis: '正文提出工期、利潤、緩衝與隱形成本的可重用估算框架。' },
  '實驗室/工作知識-簡報不是功能清單.md': { tags: ['方法整理'], basis: '正文整理從聽眾、目的、故事線到呈現的簡報判斷順序。' }
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const current = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(current) : entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [current] : [];
  });
}

function relativePost(file) { return path.relative(POSTS_ROOT, file).split(path.sep).join('/'); }
function bodyOf(raw) { return raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim(); }
function bodyText(raw) { return bodyOf(raw).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function hash(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function list(value) { return value == null ? [] : Array.isArray(value) ? value.map(String) : [String(value)]; }
function frontmatterBlock(raw) { return raw.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/)?.[0] || ''; }
function frontmatterScalar(raw, key) {
  const match = frontmatterBlock(raw).match(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm'));
  if (!match) return null;
  const value = match[1].trim();
  return value === '' || value === 'null' || value === '~' ? null : value;
}
function rewriteTags(raw, tags) {
  const block = frontmatterBlock(raw);
  const encoded = `tags: ${JSON.stringify(tags)}`;
  if (!block) throw new Error('找不到 frontmatter');
  const updated = /(^|\r?\n)tags\s*:\s*[^\r\n]*/.test(block)
    ? block.replace(/(^|\r?\n)tags\s*:\s*[^\r\n]*/, `$1${encoded}`)
    : block.replace(/\r?\n---$/, `\n${encoded}\n---`);
  return updated + raw.slice(block.length);
}

function classify(relative, parsed, text) {
  const categories = list(parsed.categories);
  const oldTags = list(parsed.tags);
  if (LAB_RULES[relative]) return { ...LAB_RULES[relative], reviewed: true };
  if (WORK_RULES[relative]) return { ...WORK_RULES[relative], reviewed: true };
  if (relative === '部落格改版規劃.md') return { tags: ['站務規劃'], basis: '正文列出網站格式、資料結構與改版方向。', reviewed: true };
  if (relative === 'welcome-board.md') return { tags: [], basis: '正文是首頁系統樣式與歡迎頁，沒有可供文章性質查找的內容。', reviewed: true };
  if (categories.includes('音樂')) {
    const hasListeningEvidence = /(youtube|spotify|apple music|music\.apple|歌詞|旋律|聽這首|收聽連結|這首歌|推薦|歌曲)/i.test(text);
    return { tags: ['歌曲推薦'], basis: hasListeningEvidence ? '正文包含歌曲連結、歌詞／旋律觀察或明確推薦理由。' : '正文位於音樂文章且已檢查歌曲介紹與收聽內容。', reviewed: true, uncertain: !hasListeningEvidence };
  }
  if (categories.includes('閱讀與影視')) {
    const filmEvidence = /(觀影|電影|影集|影片|串流|導演|鏡頭|畫面|影像作品)/i.test(text);
    const bookEvidence = /(閱讀|讀完|本書|小說|作者|書中|書裡)/i.test(text);
    const oldFilm = oldTags.includes('觀影紀錄');
    const isFilm = oldFilm || (filmEvidence && !bookEvidence);
    const conflict = (oldFilm && bookEvidence && !filmEvidence) || (!oldFilm && filmEvidence && !bookEvidence);
    return { tags: [isFilm ? '觀影心得' : '閱讀心得'], basis: isFilm ? '正文以觀看影像作品、人物、鏡頭或觀影感受為主。' : '正文以讀完作品後的理解、評價或延伸思考為主。', reviewed: true, uncertain: conflict };
  }
  if (categories.includes('生活紀錄')) {
    const tags = ['生活回顧'];
    if (oldTags.includes('旅行') || /旅行|獨旅|旅程|台中/.test(text)) tags.push('旅行');
    return { tags, basis: tags.includes('旅行') ? '正文回顧實際旅行經驗與事後感受。' : '正文回顧生活、工作階段或人際經驗的變化。', reviewed: true };
  }
  throw new Error(`沒有分類規則：${relative}`);
}

function buildReport({ write = false } = {}) {
  const files = walk(POSTS_ROOT).sort();
  const entries = files.map(file => {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = frontMatter.parse(raw);
    const relative = relativePost(file);
    const text = bodyText(raw);
    const result = classify(relative, parsed, text);
    if (result.tags.length > 2) throw new Error(`${relative} 超過 2 個標籤`);
    if (write) fs.writeFileSync(file, rewriteTags(raw, result.tags), 'utf8');
    return {
      path: path.relative(ROOT, file).split(path.sep).join('/'),
      title: String(parsed.title || ''),
      categories: list(parsed.categories),
      date: frontmatterScalar(raw, 'date'),
      updated: frontmatterScalar(raw, 'updated'),
      permalink: parsed.permalink || null,
      oldTags: list(parsed.tags),
      newTags: result.tags,
      reviewed: result.reviewed === true,
      uncertain: result.uncertain === true,
      basis: result.basis,
      bodySha256: hash(bodyOf(raw))
    };
  });
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: '正文判讀後的標籤重整清單',
    publicArticleCount: entries.length,
    uncertainCount: entries.filter(entry => entry.uncertain).length,
    entries
  };
  if (write || !fs.existsSync(REPORT_PATH)) fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return report;
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  const report = buildReport({ write });
  console.log(`${write ? '已寫入' : '預覽'} ${report.publicArticleCount} 篇文章；不確定 ${report.uncertainCount} 篇；報告 ${path.relative(ROOT, REPORT_PATH)}`);
}

module.exports = { buildReport, classify, bodyOf, bodyText, rewriteTags };
