const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '../../themes/next/layout/index.njk'),
  'utf8'
);
const themeConfig = fs.readFileSync(
  path.join(__dirname, '../../themes/next/_config.yml'),
  'utf8'
);
const languageSource = fs.readFileSync(
  path.join(__dirname, '../../themes/next/languages/zh-TW.yml'),
  'utf8'
);
const homeStyles = fs.readFileSync(
  path.join(__dirname, '../../themes/next/source/css/_custom/home.styl'),
  'utf8'
);
const randomGeneratorSource = fs.readFileSync(
  path.join(__dirname, '../../scripts/random-generator.js'),
  'utf8'
);

function randomGenerator() {
  let callback;
  const warnings = [];
  const generatorRequire = id => {
    if (id === '../tools/lib/content-surfaces') return require('../lib/content-surfaces');
    if (id === '../tools/data/legacy-surfaces.v1.json') return require('../data/legacy-surfaces.v1.json');
    throw new Error('Unexpected generator dependency: ' + id);
  };
  vm.runInNewContext(randomGeneratorSource, {
    require: generatorRequire,
    hexo: {
      extend: { generator: { register: (_name, fn) => { callback = fn; } } },
      log: { warn: message => warnings.push(message) }
    }
  });
  return { run: posts => JSON.parse(callback({ posts }).data), warnings };
}

assert(source.includes('{% set is_home_landing = page.current == 1 %}'), '首頁第一頁與舊分頁必須分流');
assert(source.includes('home-legacy-archive-notice'), '舊首頁分頁必須保留文章區引導');
assert(source.includes('href="/archives/"'), '首頁必須保留全部文章入口');
assert(!source.includes('最近留下的紀錄'), '首頁第一頁不應再顯示最新文章流水標題');

const entryStart = source.indexOf('<nav class="home-landing-entry-grid"');
const entryEnd = source.indexOf('</nav>', entryStart);
const entryMarkup = source.slice(entryStart, entryEnd);
assert(entryMarkup.includes('href="/archives/"'), '首頁入口必須連到全部文章');
assert(!entryMarkup.includes('href="/random/"'), '首頁入口不應與主要隨機卡重複');

const menuStart = themeConfig.indexOf('\nmenu:');
const menuEnd = themeConfig.indexOf('\n# Enable / Disable menu icons', menuStart);
const menuConfig = themeConfig.slice(menuStart, menuEnd);
assert(menuConfig.includes('archives: /archives/'), '主選單必須包含全部文章');
assert(!menuConfig.includes('\n  random:'), '主選單不應再重複顯示隨機文章');
assert(menuConfig.indexOf('reading:') < menuConfig.indexOf('reading_desk:'), '生活索引應排在草稿夾之前');
assert(menuConfig.indexOf('reading_desk:') < menuConfig.indexOf('photos:'), '草稿夾應排在記憶圖牆之前');
assert(languageSource.includes('calendar: 更新日曆'), '日曆選單應使用容易理解的名稱');
assert(source.includes('class="home-outro-cassette"'), '首頁底部必須保留錄音帶器材線稿');
assert(source.includes('class="home-outro-headphones"'), '首頁底部必須保留耳機器材線稿');
assert(source.includes('class="home-outro" aria-hidden="true"'), '純裝飾頁尾必須從輔助技術隱藏');
assert(!source.includes('home-outro-person'), '頁尾裝飾不應再包含人物');
assert(!source.includes('home-outro-scene'), '頁尾裝飾不應偽裝成可點擊控制項');
assert(!source.includes("scene.classList.add('is-playing')"), '靜態頁尾不應保留播放腳本');
assert(homeStyles.includes('.index .home-outro-art'), '首頁插圖必須提供響應式樣式');
assert(!homeStyles.includes('@keyframes home-outro'), '靜態頁尾不應保留動畫關鍵影格');
assert(source.includes('id="home-random-visual"'), '首頁隨機卡必須保留文章類型視覺區');
assert(source.includes('function renderVisual(record)'), '首頁隨機卡必須依文章類型更新視覺');
assert(homeStyles.includes('grid-template-columns: minmax(0, 1fr) 168px'), '桌面隨機卡必須保留緊湊的文字與視覺比例');

const desktopVisualIndex = homeStyles.indexOf('.index .home-random-visual img');
const mobileVisualMedia = homeStyles.indexOf('@media (max-width: 767px)', desktopVisualIndex);
const mobileVisualStart = homeStyles.indexOf('.index .home-random-visual img {', mobileVisualMedia);
const mobileVisualEnd = homeStyles.indexOf('}', mobileVisualStart);
const mobileVisualStyles = homeStyles.slice(mobileVisualStart, mobileVisualEnd);
assert(mobileVisualMedia >= 0 && mobileVisualStart >= 0 && mobileVisualEnd > mobileVisualStart, '手機隨機縮圖規則缺失');
assert(/padding:\s*0/.test(mobileVisualStyles), '手機隨機縮圖不應保留分類專用內距');
assert(/object-fit:\s*cover/.test(mobileVisualStyles), '手機隨機縮圖必須統一裁切填滿');
assert(/object-position:\s*center/.test(mobileVisualStyles), '手機隨機縮圖必須置中裁切');

{
  const generator = randomGenerator();
  const collection = values => ({ toArray: () => values.map(name => ({ name })) });
  const result = generator.run([
      {
        path: 'song/', source: 'source/_posts/歌曲推薦/song.md', title: '歌曲', cover: '/images/song.webp',
        surfaces: ['memory'],
        categories: collection(['音樂']), tags: collection(['歌曲推薦']), date: { format: () => '2026-09-21' }
      },
      {
        path: 'study/', source: 'source/_posts/實驗室/study.md', title: '學習', learning: true,
        surfaces: ['memory'],
        learning_status: '進行中', cover: 'https://example.com/unsafe.jpg', categories: collection(['觀念與實驗']),
        tags: collection(['研究筆記']), date: { format: () => '2026-09-20' }
      },
      {
        path: 'movie/', source: 'source/_posts/閱讀影評/movie.md', title: '電影（觀影紀錄）',
        surfaces: ['memory'],
        cover: '/images/movie.webp', categories: collection(['閱讀與影視']), tags: collection(['觀影心得']),
        date: { format: () => '2026-09-19' }
      }
    ]);
  const generated = result;
  assert.deepStrictEqual(Array.from(generated, item => item.kind), ['audio', 'learning', 'watch']);
  assert.strictEqual(generated[0].cover, '/images/song.webp', '站內封面應提供給首頁視覺');
  assert.strictEqual(generated[1].cover, '', '學習筆記與外部封面都不應載入首頁視覺');
  assert.strictEqual(generated[1].note, '進行中');
}

{
  const generator = randomGenerator();
  const categories = values => ({ toArray: () => values.map(name => ({ name })) });
  const post = (source, path, surfaces, extra = {}) => {
    const entry = { source, path, title: path || '文章', categories: categories(['一般']), tags: [],
      date: { format: () => '2026-09-25' }, ...extra };
    if (surfaces !== undefined) entry.surfaces = surfaces;
    return entry;
  };
  const records = generator.run([
    post('source/_posts/memory.md', 'memory/', ['memory']),
    post('source/_posts/profile-only.md', 'profile-only/', ['profile']),
    post('source/_posts/both.md', 'both/', ['memory', 'profile']),
    post('source/_posts/welcome-board.md', 'legacy/', undefined),
    post('source/_posts/random-control.md', 'control/', [], { type: 'random' }),
    post('source/_posts/site-news.md', 'site-news/', [], { categories: categories(['站務']) }),
    post('source/_posts/no-path.md', '', [])
  ]);
  assert.deepStrictEqual(Array.from(records, item => item.url), ['/memory/', '/both/', '/legacy/']);
  assert(!records.some(item => item.url === '/profile-only/'), 'profile-only posts must be excluded');
  assert(records.some(item => item.url === '/both/'), 'dual-surface article remains eligible');
  assert(records.some(item => item.url === '/legacy/'), 'manifested legacy article defaults to memory');
  assert(records.every(item => !Object.hasOwn(item, 'surfaces')), 'random.json record schema stays unchanged');

  assert.throws(() => generator.run([post('source/_posts/new-post.md', 'new-post/', undefined)]), /source\/\_posts\/new-post\.md \[missing_surfaces\]/);
  assert.throws(() => generator.run([post('source/_posts/invalid-post.md', 'invalid-post/', ['PROFILE'])]), /source\/\_posts\/invalid-post\.md \[unknown_surface\]/);
  assert.deepStrictEqual(generator.run([
    post('source/_posts/only-profile.md', 'only-profile/', ['profile']),
    post('source/_posts/control.md', 'control/', [], { type: 'random' })
  ]), [], 'no eligible memory articles produces an empty list');
}

const logicStart = source.indexOf('          function randomItem(items)');
const logicEnd = source.indexOf('          function cleanTitle(value)', logicStart);
assert(logicStart >= 0 && logicEnd > logicStart, '首頁隨機文章核心函式缺失');
const randomLogic = source.slice(logicStart, logicEnd);

function createContext(sessionStorage) {
  const context = {
    records: [],
    selectionKey: 'home-random-selection-v1',
    window: { sessionStorage },
    Math: Object.create(Math),
    Array,
    String,
    Error
  };
  context.Math.random = () => 0;
  vm.runInNewContext(randomLogic, context);
  return context;
}

{
  const context = createContext({ getItem: () => '', setItem: () => {} });
  const records = context.validRecords([
    { title: '可用文章', url: '/article/', categories: ['生活紀錄'] },
    { title: '外部網址', url: 'https://example.com/', categories: ['生活紀錄'] },
    { url: '/missing-title/' },
    null
  ]);
  assert.strictEqual(records.length, 1, '只接受有標題的站內文章');
  assert.strictEqual(records[0].url, '/article/');
}

{
  const context = createContext({ getItem: () => '/remembered/', setItem: () => {} });
  context.records = [
    { title: '目前文章', url: '/current/', categories: ['工作知識'] },
    { title: '另一篇', url: '/next/', categories: ['生活紀錄'] }
  ];
  assert.strictEqual(context.savedSelection(), '/remembered/', '返回首頁時應讀回原本抽到的文章');
  assert.strictEqual(context.chooseRecord('/current/').url, '/next/', '換一篇時不能立即抽回目前文章');
}

{
  const context = createContext({
    getItem: () => { throw new Error('storage blocked'); },
    setItem: () => { throw new Error('storage blocked'); }
  });
  assert.strictEqual(context.savedSelection(), '', '工作階段儲存不可用時應安全退回空值');
  assert.doesNotThrow(() => context.saveSelection('/article/'));
}
