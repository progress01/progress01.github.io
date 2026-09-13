'use strict';

const fs = require('fs');
const path = require('path');
const checker = require('../tools/excerpt-check');

const root = path.resolve(__dirname, '..');
const replacements = {
  'source/_posts/閱讀影評/不誤解、不離題，誰都喜歡你的精準表達技術(書籍閱讀紀錄).md': '《不誤解、不離題，誰都喜歡你的精準表達技術》讓我在職場摩擦後重新思考精準表達；書中整理的數字、先講結論等提醒，有些仍值得帶走。',
  'source/_posts/閱讀影評/反擊!-終結職場霸凌(書籍閱讀紀錄).md': '讀《反擊！終結職場霸凌》時，我一直對照自己被誤解與孤立的經驗，也重新思考遇到不合理要求時如何保護自己。',
  'source/_posts/閱讀影評/文學少女系列(輕小說閱讀紀錄).md': '朋友曾把《文學少女》介紹給我；作品把文學、青春傷痕與誤解交在一起，讓我在角色彼此理解時感到溫柔。',
  'source/_posts/閱讀影評/文學少女系列2(輕小說閱讀紀錄).md': '讀完正文後，我把《文學少女》番外也列入清單；不同角色與時間線補上未說完的故事，讓我重新看見心葉等人的成長。',
  'source/_posts/閱讀影評/以早乙女佳奈子為例.md': '《以早乙女佳奈子為例》不像急著推動劇情的電影；我記住的是人物、光線與顏色，像看完一幅仍會回想的畫。',
  'source/_posts/閱讀影評/去你的博士學位(書籍閱讀紀錄-短).md': '《去你的博士學位》把學術生涯的挫敗寫得很直接；跟著作者從拼命、憂鬱到想開，我也重新想像能力失去位置後如何自處。',
  'source/_posts/閱讀影評/去唱卡啦OK吧(觀影紀錄).md': '《去唱卡啦 OK 吧》記錄我第一次和只聊過幾句的朋友看電影；黑道卡拉 OK、少年變聲與即將分離的徬徨，意外成為一段細膩相遇。',
  'source/_posts/閱讀影評/失業白領的職場漂流.md': '我在對工作失望、開始投履歷時讀《失業白領的職場漂流》，更看見失業後重返職場的焦慮，也對自己的職涯不安有了具體映照。',
  'source/_posts/閱讀影評/全能遊戲設計師(網路小說閱讀紀錄).md': '我沿著作者作品讀到《全能遊戲設計師》；遊戲設計與作品史很有趣，但科技設定膨脹後，人物和故事的平衡也變難。',
  'source/_posts/閱讀影評/印度，Holy-Cow我的媽啊(書籍閱讀紀錄-短).md': '因為想找旅遊書，我讀了《印度，Holy Cow 我的媽啊》；照片與文字帶我看觀光景點和旅遊趣聞，卻不是深度旅行研究。',
  'source/_posts/閱讀影評/有氧減肥大迷思(書籍閱讀紀錄).md': '準備打排球時，我讀《有氧減肥大迷思》；它拆解減重與運動傷害，也提醒我在有氧和肌力間衡量身體負擔。',
  'source/_posts/閱讀影評/老婆請安分(網路小說閱讀紀錄).md': '我沿著作者作品讀《老婆請安分》；它沒有把穿越寫成改變世界，而是寫成遺憾修補，也讓愛情回到生活選擇。',
  'source/_posts/閱讀影評/我們的故事未完待續(觀影紀錄).md': '我從英文課報告的預告認識《我們的故事未完待續》，原本被配樂打動；電影最後以哀而不傷的方式談疾病、陪伴與告別。',
  'source/_posts/閱讀影評/我家不只賣咖啡：星巴克帝國(書籍閱讀紀錄-短).md': '我在書架偶然讀到《我家不只賣咖啡》；它從企業文化和經營分析星巴克，讓我理解咖啡之外的空間與體驗。',
  'source/_posts/閱讀影評/我家老婆來自一千年前(網路小說閱讀紀錄).md': '我因為其他作品的互文讀到《我家老婆來自一千年前》；古代人來到現代的設定，讓甜蜜落在一起適應日常的過程。',
  'source/_posts/閱讀影評/我媽媽做小姐的時陣是文藝少女(書籍閱讀紀錄).md': '我在整理教科書時偶然找到《我媽媽做小姐的時陣是文藝少女》，也想起自己對母親年輕故事的好奇；散文把記憶寫得細碎卻有力。',
  'source/_posts/閱讀影評/狂粉是怎麼煉成的(書籍閱讀紀錄-短).md': '去越南前我借了《狂粉是怎麼煉成的》；它用多種案例觀察粉絲、媒體與企業的互動，但不是學術總結。',
  'source/_posts/閱讀影評/車諾比的悲鳴(書籍閱讀紀錄-短).md': '《車諾比的悲鳴》原本只因書名吸引我，卻讓我花兩個月讀完；居民、科學家與軍人的訪談交織出災難裡無法整理的人生。',
  'source/_posts/閱讀影評/來自地獄的法官.md': '我因串流推薦看《來自地獄的法官》，一度想跳過處刑情節；它仍讓我思考，憤怒與懲罰之間能否守住原則。',
  'source/_posts/閱讀影評/武道宗師(網路小說閱讀紀錄—短).md': '我沿著烏賊作品讀《武道宗師》；這部很甜，卻也在感情線之外保留人物成長與都市武道的趣味。',
  'source/_posts/閱讀影評/近戰法師(網路小說閱讀紀錄).md': '我曾沉迷遊戲小說，《近戰法師》讓全息網遊、魔法與中國武術交錯；比起龐大設定，我更喜歡 NPC 和夥伴互動的清新感。',
  'source/_posts/閱讀影評/長夜餘火(網路小說閱讀紀錄—短).md': '我在《詭秘之主》後讀《長夜餘火》，原本對廢土題材有些遲疑；它讓我在瘋狂與荒蕪裡看見文明和理想留下的餘火。',
  'source/_posts/閱讀影評/非正常美食文.md': '我因喜歡《生活系遊戲》而讀《非正常美食文》，期待舊人物重逢；但讀完後，仍覺得美食與人物故事缺少收束的情感核心。',
  'source/_posts/閱讀影評/哈佛-✕-Google行為科學家的脫單指南(書籍閱讀紀錄—短).md': '我曾把終結單身當成願望，因書名讀《哈佛 ✕ Google 行為科學家的脫單指南》；它更像長久關係指南，仍把選擇留給讀者。',
  'source/_posts/閱讀影評/相信閱讀：天下文化25年的故事(書籍閱讀紀錄).md': '我為了換書讀《相信閱讀》，想知道天下文化如何在出版市場走下去；企業文化、選書與異業合作，讓我看見願景如何變成出版選擇。',
  'source/_posts/閱讀影評/若草物語-戀愛姐妹與無法戀愛的我.md': '我因串流跟播看完《若草物語》；四姊妹、貧窮與青梅竹馬的改編，讓我重新想像當代幸福不只等於戀愛與婚姻。',
  'source/_posts/閱讀影評/修真聊天群(網路小說閱讀紀錄-短).md': '我在推薦榜點開《修真聊天群》，看修真者用手機聊天；它把修仙放回現代生活，笑點之外也讓我重新想像修真故事的方向。',
  'source/_posts/閱讀影評/值得的等待.md': '《值得的等待》最吸引我的是開頭旁白，但多線故事沒有讓我感受到等待的重量；明亮溫暖的畫面，反而留下我期待落空的失落。',
  'source/_posts/閱讀影評/脂肪的祕密生命(書籍閱讀紀錄).md': '我在越南旅途中讀完《脂肪的祕密生命》；它用研究者與病人的故事介紹脂肪，讓健康議題變得容易靠近，也改變我原本的想像。',
  'source/_posts/閱讀影評/健康不平等(書籍閱讀紀錄).md': '疫情後我讀《健康不平等》，才發現公共衛生談的健康和日常想像不同；它用故事與專家觀點，讓我看到健康背後的社會環境。',
  'source/_posts/閱讀影評/偷書賊-建構統治者神話的文化洗劫與記憶消滅(書籍閱讀紀錄).md': '我曾因盲書推薦拿到《偷書賊》又放下，後來重新讀它；古籍、藏書票與文化掠奪交織成需要耐心拼湊的記憶與統治地圖。',
  'source/_posts/閱讀影評/基地.md': '讀完《基地》三部曲與外傳後，我仍在想自己是否感受到它的想像力；謝頓危機與世代更替，讓歷史本身成為故事主角。',
  'source/_posts/閱讀影評/排球少年(書籍閱讀紀錄).md': '《排球少年》陪我從大學打球讀到完結；我喜歡的不只是比賽，也包括角色在排球世界成長，以及漫畫和生活記憶交疊的感動。',
  'source/_posts/閱讀影評/梅艷芳(觀影紀錄).md': '我因為喜歡〈女人花〉看《梅艷芳》；這部傳記電影把她的成功、感情與舞台人生串起來，讓只知道名字的我更靠近她。',
  'source/_posts/閱讀影評/這個男人來自地球(觀影紀錄).md': '《這個男人來自地球》幾乎只靠幾個場景和對話，展開歷史、人類學與生命時間的辯論；未知在質疑中慢慢變得真實。'
};

const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'excerpt-batch-a.json'), 'utf8'));
const results = [];
for (const relative of list) {
  if (!Object.prototype.hasOwnProperty.call(replacements, relative)) throw new Error(`missing handwritten replacement: ${relative}`);
  const file = path.join(root, relative);
  const original = fs.readFileSync(file, 'utf8');
  const frontmatter = original.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error(`missing frontmatter: ${relative}`);
  const body = original.slice(frontmatter[0].length);
  const marker = body.search(/<!-- ?more ?-->/i);
  if (marker < 0) throw new Error(`missing more marker: ${relative}`);
  const before = body.slice(0, marker);
  const trailing = (before.match(/(?:\r?\n[ \t]*)*$/) || [''])[0];
  const oldExcerpt = before.slice(0, before.length - trailing.length).trim();
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  const updated = `${frontmatter[0]}${replacements[relative]}${trailing || `${newline}${newline}`}${body.slice(marker)}`;
  if (updated === original) throw new Error(`replacement unchanged: ${relative}`);
  fs.writeFileSync(file, updated, 'utf8');
  const report = checker.inspectExcerpt(updated, relative);
  results.push({ file: relative, oldExcerpt, newExcerpt: replacements[relative], movedDetails: '核心閱讀動機與評價保留在新引言；其餘原有細節仍保留於 marker 後正文，未重複貼回。', checkStatus: report.ok ? (report.warnings.length ? 'WARN' : 'PASS') : 'FAIL' });
}
fs.writeFileSync(path.join(__dirname, 'excerpt-batch-a-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`updated ${results.length} posts`);
