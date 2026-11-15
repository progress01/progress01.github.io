'use strict';

// 外部連結檢查的純邏輯：從文章抓網址、判斷回應、讀略過清單、產生報告。
// 連網的部分在 tools/check-external-links.js，這裡不碰網路，方便測試。

const SKIP_HOSTS = new Set(['localhost', '127.0.0.1', 'example.com', 'example.org', 'example.net']);

// Markdown 連結 [文字](網址) 和 HTML href="網址"：網址可以有中文，也可以有一層成對括號。
const MARKDOWN_LINK = /\]\((https?:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+"[^"]*")?\)/g;
const HREF_LINK = /href\s*=\s*["'](https?:\/\/[^"'\s]+)["']/gi;
// 其他直接寫出來的網址：只收半形字元，遇到中文、空白、引號或角括號就結束。
const URL_PATTERN = /https?:\/\/[!-~]+/g;
const BARE_STOP = /[<>"'`\]]/;

function trimUrl(raw) {
  let url = raw.replace(/[.,;:!?*_~]+$/, '');
  // Markdown 連結 [文字](網址) 的右括號不算網址；網址自己有成對括號（維基百科常見）才保留。
  while (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
    url = url.slice(0, -1).replace(/[.,;:!?*_~]+$/, '');
  }
  return url;
}

// 把程式碼區塊和行內程式碼換成空白，保留行數，讓行號仍然對得上。
function blankCode(text) {
  const lines = text.split(/\r?\n/);
  let fence = null;
  return lines.map(line => {
    const marker = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return '';
    }
    if (marker) { fence = marker[1]; return ''; }
    return line.replace(/(`+)[^`]*?\1/g, match => ' '.repeat(match.length));
  });
}

function extractLinks(text) {
  const found = [];
  blankCode(text).forEach((source, index) => {
    const hits = [];
    let line = source;
    // 先抓有明確邊界的寫法，抓過的位置換成空白，避免下面又抓一次。
    for (const pattern of [MARKDOWN_LINK, HREF_LINK]) {
      line = line.replace(pattern, (match, url, offset) => {
        hits.push({ url, offset });
        return ' '.repeat(match.length);
      });
    }
    for (const match of line.matchAll(URL_PATTERN)) {
      const stop = match[0].search(BARE_STOP);
      hits.push({ url: trimUrl(stop >= 0 ? match[0].slice(0, stop) : match[0]), offset: match.index });
    }
    for (const { url } of hits.sort((a, b) => a.offset - b.offset)) {
      let parsed;
      try { parsed = new URL(url); } catch { continue; }
      if (!parsed.hostname.includes('.') || SKIP_HOSTS.has(parsed.hostname)) continue;
      found.push({ url, line: index + 1 });
    }
  });
  return found;
}

function readTitle(text) {
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const title = front && front[1].match(/^title:\s*(.+)$/m);
  return title ? title[1].trim().replace(/^(['"])(.*)\1$/, '$2') : '';
}

// 略過清單：一行一個網址；結尾加 * 代表開頭相同的都略過；# 後面是註解。
function parseIgnoreList(text) {
  return String(text || '').split(/\r?\n/)
    .map(line => line.replace(/(^|\s)#.*$/, '').trim())
    .filter(Boolean);
}

function isIgnored(url, rules) {
  return rules.some(rule => rule.endsWith('*') ? url.startsWith(rule.slice(0, -1)) : url === rule);
}

const BROKEN = 'broken';
const CHECK = 'check';
const OK = 'ok';

const STATUS_TEXT = {
  400: '網站說要求有誤（400）',
  401: '要登入才能看（401）',
  403: '網站拒絕程式連線（403），用瀏覽器開可能正常',
  404: '找不到頁面（404）',
  405: '網站不接受這種連線方式（405）',
  410: '頁面已經刪除（410）',
  429: '連太多次被暫時擋下（429），下次再跑一次看看',
};

function pathOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, '') + parsed.search;
  } catch { return ''; }
}

// result 是 { status, finalUrl } 或 { error: { code } }。
function classify(url, result) {
  if (result.error) {
    const code = result.error.code || '';
    if (code === 'ENOTFOUND') return { kind: BROKEN, reason: '網域不存在（找不到這個網站）' };
    if (code === 'TIMEOUT') return { kind: CHECK, reason: '等太久沒有回應，可能只是當下太慢' };
    if (/CERT|SSL|TLS/i.test(code)) return { kind: CHECK, reason: `網站的安全憑證有問題（${code}）` };
    return { kind: CHECK, reason: `連不上（${code || '原因不明'}），可能網站暫時有狀況` };
  }
  const { status } = result;
  if (status === 404 || status === 410) return { kind: BROKEN, reason: STATUS_TEXT[status] };
  if (status >= 500) return { kind: CHECK, reason: `網站自己出錯（${status}），可能暫時性` };
  if (status >= 400) return { kind: CHECK, reason: STATUS_TEXT[status] || `網站回應 ${status}` };
  if (result.finalUrl && pathOf(url) !== '' && pathOf(result.finalUrl) === '') {
    return { kind: CHECK, reason: `被轉到網站首頁（${result.finalUrl}），原文可能已經不在` };
  }
  return { kind: OK, reason: '' };
}

function formatDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// items: [{ url, kind, reason, places: [{ file, title, line }] }]
function buildReport({ date, items, postCount, ignoredCount }) {
  const broken = items.filter(item => item.kind === BROKEN);
  const check = items.filter(item => item.kind === CHECK);
  const lines = [
    `# 外部連結檢查 ${formatDate(date)}`,
    '',
    `檢查了 ${postCount} 篇文章裡的 ${items.length} 個外部網址${ignoredCount ? `（另有 ${ignoredCount} 個在略過清單裡，沒有檢查）` : ''}。`,
    '',
    `- 確定壞了：${broken.length} 個`,
    `- 要你點開確認：${check.length} 個`,
    `- 正常：${items.length - broken.length - check.length} 個`,
    '',
  ];

  function section(title, note, list) {
    lines.push(`## ${title}`, '');
    if (!list.length) { lines.push('沒有。', ''); return; }
    lines.push(note, '');
    const byFile = new Map();
    for (const item of list) {
      for (const place of item.places) {
        if (!byFile.has(place.file)) byFile.set(place.file, { title: place.title, entries: [] });
        byFile.get(place.file).entries.push({ ...item, line: place.line });
      }
    }
    for (const [file, group] of [...byFile].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${group.title || file}`, '', `\`${file}\``, '');
      for (const entry of group.entries.sort((a, b) => a.line - b.line)) {
        lines.push(`- 第 ${entry.line} 行：${entry.url}`, `  - ${entry.reason}`);
      }
      lines.push('');
    }
  }

  section('確定壞了', '這些連結已經打不開。可以換成網路檔案館的備份、換一個來源、拿掉，或在旁邊註明「原連結已失效」。', broken);
  section('要你點開確認', '程式判斷不了，請用瀏覽器點開看看。正常的話可以不用管；老是出現在這裡的，可以加進略過清單。', check);

  lines.push(
    '## 略過清單',
    '',
    '確認沒問題、但每次都被列出來的網址，可以寫進 `blog-1988/tools/data/external-link-ignore.txt`。一行一個網址；結尾加 `*` 代表開頭相同的都略過。',
    '',
  );
  return lines.join('\n');
}

module.exports = {
  BROKEN,
  CHECK,
  OK,
  extractLinks,
  readTitle,
  parseIgnoreList,
  isIgnored,
  classify,
  buildReport,
  formatDate,
};
