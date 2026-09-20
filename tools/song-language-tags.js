'use strict';

// 歌曲文章的語言標籤清單與檢查工具。
// 語言標籤只補充歌曲文章；書籍與其他分類不使用這組標籤。
const fs = require('fs');
const path = require('path');
const frontMatter = require('hexo-front-matter');

const ROOT = path.resolve(__dirname, '..');
const SONG_ROOT = path.join(ROOT, 'source', '_posts', '歌曲推薦');
const REPORT_PATH = path.join(ROOT, 'docs', 'tag-reorganization-review.json');
const LANGUAGE_TAGS = ['華語', '粵語', '台語', '英語', '日語', '韓語'];

const SONG_LANGUAGE_GROUPS = {
  華語: [
    '歌曲推薦-2375.md', '歌曲推薦-一世情緣.md', '歌曲推薦-一切再重來.md', '歌曲推薦-一千年以後.md',
    '歌曲推薦-一直很安靜.md', '歌曲推薦-一見鍾情.md', '歌曲推薦-一輩子的孤單.md', '歌曲推薦-上上籤.md',
    '歌曲推薦-不是我不明白.md', '歌曲推薦-你不在.md', '歌曲推薦-你好嗎.md', '歌曲推薦-像我這樣的人.md',
    '歌曲推薦-全世界我最喜歡你（可是你都不知道）.md', '歌曲推薦-其實我真的很在乎.md', '歌曲推薦-其實都沒有.md',
    '歌曲推薦-動不動就說愛我.md', '歌曲推薦-北極雪.md', '歌曲推薦-唯一.md', '歌曲推薦-噓.md',
    '歌曲推薦-回到過去.md', '歌曲推薦-因為寂寞.md', '歌曲推薦-因為愛.md', '歌曲推薦-夜行性動物.md',
    '歌曲推薦-如你所願.md', '歌曲推薦-就值得愛了.md', '歌曲推薦-就改天.md', '歌曲推薦-廣島之戀.md',
    '歌曲推薦-復刻回憶.md', '歌曲推薦-忘了你忘了我.md', '歌曲推薦-悄悄告訴她.md', '歌曲推薦-愛丫愛丫.md',
    '歌曲推薦-感謝勞力.md', '歌曲推薦-愫.md', '歌曲推薦-慢火車.md', '歌曲推薦-戀戀風塵.md',
    '歌曲推薦-戀曲1990.md', '歌曲推薦-我一個人住.md', '歌曲推薦-我們的故事.md', '歌曲推薦-我們的歌.md',
    '歌曲推薦-我在紐約打電話給你.md', '歌曲推薦-我為你傷心.md', '歌曲推薦-抱著你.md', '歌曲推薦-星月神話.md',
    '歌曲推薦-有沒有那麼一首歌會讓你想起我.md', '歌曲推薦-期待愛.md', '歌曲推薦-淚海.md', '歌曲推薦-無底洞.md',
    '歌曲推薦-無窮.md', '歌曲推薦-燃燒一瞬間.md', '歌曲推薦-理想.md', '歌曲推薦-留不住的故事.md',
    '歌曲推薦-第一個清晨.md', '歌曲推薦-答案.md', '歌曲推薦-給我一首歌的時間.md', '歌曲推薦-給電影人的情書.md',
    '歌曲推薦-練習.md', '歌曲推薦-老男孩.md', '歌曲推薦-若我告訴你其實我愛的只是你.md', '歌曲推薦-葉子.md',
    '歌曲推薦-藍色眼睛.md', '歌曲推薦-親愛的你啊.md', '歌曲推薦-說，你愛我.md', '歌曲推薦-逍遙嘆.md',
    '歌曲推薦-這些日子以來.md', '歌曲推薦-關於愛的定義.md', '歌曲推薦-靜靜的.md', '歌曲推薦-非常時期.md',
    '歌曲推薦-鴨子.md', '歌曲推薦-頌海.md'
  ],
  英語: [
    '歌曲推薦-Better-Man.md', '歌曲推薦-Free-Loop.md', '歌曲推薦-From-The-Start.md',
    '歌曲推薦-How-long-will-I-love-you.md', '歌曲推薦-Just Give Me A Reason.md',
    '歌曲推薦-Misread.md',
    '歌曲推薦-kiss-me.md', '歌曲推薦-miles are wide.md', '歌曲推薦-My-heart-will-go-on.md',
    '歌曲推薦-Nothing‘s-Gonna-Stop-Us-Now.md', '歌曲推薦-Right-here-waiting.md',
    '歌曲推薦-Tally.md', '歌曲推薦-the day you went away.md',
    '歌曲推薦-the-real-world.md',
    '歌曲推薦-Way-back-into-love.md', '歌曲推薦-When-you-say-nothing-at-all.md',
    '歌曲推薦-Wonderful-tonight.md', '歌曲推薦-You-are-not-alone.md'
  ],
  日語: [
    '歌曲推薦-free-magic.md', '歌曲推薦-Secret-of-my-heart.md', '歌曲推薦-tears.md',
    '歌曲推薦-それぞれに.md', '歌曲推薦-プラスティック・ラブ.md', '歌曲推薦-22才の別れ.md'
  ],
  韓語: [
    '歌曲推薦-All-for-you.md', '歌曲推薦-Candy.md', '歌曲推薦-Don-t-You-Worry.md',
    '歌曲推薦-Hyehwa-dong.md', '歌曲推薦-I will love you.md',
    '歌曲推薦-sailing back to you.md', '歌曲推薦-告白（고백합니다）.md',
    '歌曲推薦-舊愛.md', '歌曲推薦-시청-앞-지하철-역에서.md',
    '歌曲推薦-아로하.md', '歌曲推薦-잊어야 한다는 마음으로（忘記他這件事）.md'
  ],
  粵語: [
    '歌曲推薦-千千闋歌.md', '歌曲推薦-小風波.md', '歌曲推薦-好心分手.md'
  ],
  台語: [
    '歌曲推薦-I-love-you無望.md', '歌曲推薦-再會啦心愛的無緣的人.md',
    '歌曲推薦-放風吹.md', '歌曲推薦-愛作夢的人.md',
    '歌曲推薦-無眠.md', '歌曲推薦-茫茫到深更.md', '歌曲推薦-雲中月圓.md', '歌曲推薦-你講的話.md',
    '歌曲推薦-繁華攏是夢.md'
  ]
};

// 「神話」是國語主歌搭配韓語副歌，沒有單一語言標籤可準確代表，保留歌曲推薦即可。
const LANGUAGE_UNCERTAIN = new Map([
  ['歌曲推薦-神話.md', '國語與韓語混唱，暫不貼單一語言標籤。'],
  ['歌曲推薦-kungtari-shabara.md', '使用者提供內容未直接說明演唱語言，暫不貼單一語言標籤。'],
  ['歌曲推薦-Angel.md', '使用者提供內容未直接說明演唱語言，暫不貼單一語言標籤。']
]);

function list(value) {
  return value == null ? [] : Array.isArray(value) ? value.map(String) : [String(value)];
}

function songFiles(root = ROOT) {
  const directory = path.join(root, 'source', '_posts', '歌曲推薦');
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => path.join(directory, entry.name))
    .sort();
}

function languageMap() {
  const map = new Map();
  for (const [language, names] of Object.entries(SONG_LANGUAGE_GROUPS)) {
    for (const name of names) {
      if (map.has(name)) throw new Error(`歌曲重複指定語言：${name}`);
      map.set(name, language);
    }
  }
  return map;
}

function replaceTags(raw, tags) {
  const serialized = `tags: [${tags.map(tag => JSON.stringify(tag)).join(', ')}]`;
  if (!/^tags\s*:/m.test(raw)) throw new Error('文章沒有 tags 欄位。');
  return raw.replace(/^tags\s*:.*$/m, serialized);
}

function classifySongs(root = ROOT) {
  const map = languageMap();
  const files = songFiles(root);
  const names = new Set(files.map(file => path.basename(file)));
  const errors = [];
  for (const name of map.keys()) if (!names.has(name)) errors.push(`語言清單找不到歌曲：${name}`);
  for (const name of LANGUAGE_UNCERTAIN.keys()) if (!names.has(name)) errors.push(`不確定清單找不到歌曲：${name}`);
  const entries = files.map(file => {
    const name = path.basename(file);
    const language = map.get(name) || null;
    if (!language && !LANGUAGE_UNCERTAIN.has(name)) errors.push(`歌曲未判定語言：${name}`);
    return { file, name, language, uncertainReason: LANGUAGE_UNCERTAIN.get(name) || null };
  });
  return { entries, errors };
}

function updateReport(root, entries) {
  const reportPath = path.join(root, 'docs', 'tag-reorganization-review.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const byPath = new Map(report.entries.map(entry => [entry.path, entry]));
  for (const item of entries) {
    const reportEntry = byPath.get(`source/_posts/歌曲推薦/${item.name}`);
    if (!reportEntry) throw new Error(`逐篇清單找不到歌曲：${item.name}`);
    reportEntry.newTags = item.language ? ['歌曲推薦', item.language] : ['歌曲推薦'];
    reportEntry.languageTag = item.language;
    reportEntry.languageBasis = item.language
      ? `依正文中的歌手、曲名與歌曲說明判定為${item.language}。`
      : item.uncertainReason;
    reportEntry.uncertain = Boolean(item.uncertainReason);
  }
  report.uncertainCount = report.entries.filter(entry => entry.uncertain).length;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
}

function writeSongs(root = ROOT) {
  const result = classifySongs(root);
  if (result.errors.length) return result;
  for (const item of result.entries) {
    const raw = fs.readFileSync(item.file, 'utf8');
    const parsed = frontMatter.parse(raw);
    const tags = ['歌曲推薦'];
    if (item.language) tags.push(item.language);
    const existing = list(parsed.tags);
    if (existing.length && existing[0] !== '歌曲推薦') result.errors.push(`${item.name} 的既有第一標籤不是歌曲推薦。`);
    if (JSON.stringify(existing) !== JSON.stringify(tags)) fs.writeFileSync(item.file, replaceTags(raw, tags));
  }
  if (!result.errors.length) updateReport(root, result.entries);
  return result;
}

function checkSongLanguages(root = ROOT) {
  const result = classifySongs(root);
  const errors = [...result.errors];
  for (const item of result.entries) {
    const parsed = frontMatter.parse(fs.readFileSync(item.file, 'utf8'));
    const tags = list(parsed.tags);
    const expected = item.language ? ['歌曲推薦', item.language] : ['歌曲推薦'];
    if (JSON.stringify(tags) !== JSON.stringify(expected)) errors.push(`${item.name} 的 tags 應為 ${JSON.stringify(expected)}，實際為 ${JSON.stringify(tags)}。`);
    if (tags.some(tag => !['歌曲推薦', ...LANGUAGE_TAGS].includes(tag))) errors.push(`${item.name} 使用未註冊歌曲語言標籤。`);
  }
  return { errors, entries: result.entries };
}

if (require.main === module) {
  const shouldWrite = process.argv.includes('--write');
  const result = shouldWrite ? writeSongs() : checkSongLanguages();
  if (result.errors.length) {
    console.error('歌曲語言標籤檢查失敗：\n' + result.errors.map(error => '- ' + error).join('\n'));
    process.exitCode = 1;
  } else {
    const counts = result.entries.reduce((out, item) => {
      const key = item.language || '未加語言標籤'; out[key] = (out[key] || 0) + 1; return out;
    }, {});
    console.log(`${shouldWrite ? '歌曲語言標籤已更新' : '歌曲語言標籤檢查通過'}：${result.entries.length} 篇歌曲；${JSON.stringify(counts)}`);
  }
}

module.exports = {
  LANGUAGE_TAGS,
  SONG_LANGUAGE_GROUPS,
  LANGUAGE_UNCERTAIN,
  classifySongs,
  checkSongLanguages,
  writeSongs
};
