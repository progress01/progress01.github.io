const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    errors.push(`${relativePath} 不是有效的 JSON：${error.message}`);
    return null;
  }
}

function listMarkdownFiles(directory) {
  const absoluteDirectory = path.join(root, directory);
  const files = [];

  function walk(currentDirectory) {
    fs.readdirSync(currentDirectory, { withFileTypes: true }).forEach(entry => {
      const currentPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) walk(currentPath);
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(currentPath);
    });
  }

  walk(absoluteDirectory);
  return files;
}

function parseInlineList(value) {
  if (!value || value.trim() === '[]') return [];
  const list = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  return list.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

const categoryText = read('source/_data/content-categories.yml').replace(/^#.*(?:\r?\n|$)/gm, '');
const categoryBlocks = categoryText.split(/\r?\n(?=- name:)/).filter(block => /^- name:/.test(block.trim()));
const categories = categoryBlocks.map(block => {
  const value = key => {
    const match = block.match(new RegExp(`^  ${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : '';
  };
  const nameMatch = block.match(/^- name:\s*(.+)$/m);
  return { name: nameMatch ? nameMatch[1].trim() : '', code: value('code'), icon: value('icon'), url: value('url') };
});
const categoryNames = categories.map(category => category.name);
const duplicatedCategories = categoryNames.filter((name, index) => categoryNames.indexOf(name) !== index);
if (!categories.length) errors.push('content-categories.yml 沒有分類設定。');
if (duplicatedCategories.length) errors.push(`分類名稱重複：${[...new Set(duplicatedCategories)].join('、')}`);
categories.forEach(category => {
  ['name', 'code', 'icon', 'url'].forEach(key => {
    if (!category[key]) errors.push(`分類「${category.name || '(未命名)'}」缺少 ${key}。`);
  });
});

const lifeIndex = readJson('source/life-index.json');
if (lifeIndex) {
  ['listen', 'watch'].forEach(key => {
    const item = lifeIndex.current && lifeIndex.current[key];
    if (!item || !item.title || !item.url) errors.push(`life-index.json 的 current.${key} 缺少 title 或 url。`);
  });
}

const microblog = readJson('source/microblog.json');
if (microblog) {
  if (!Array.isArray(microblog)) {
    errors.push('microblog.json 必須是陣列。');
  } else {
    microblog.forEach((item, index) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ''))) errors.push(`microblog.json 第 ${index + 1} 筆日期格式錯誤。`);
      if (!String(item.tag || '').trim()) errors.push(`microblog.json 第 ${index + 1} 筆缺少 tag。`);
      if (typeof item.content !== 'string') errors.push(`microblog.json 第 ${index + 1} 筆 content 必須是文字。`);
    });
  }
}

const allowedCategories = new Set([...categoryNames, '站務']);
listMarkdownFiles('source/_posts').forEach(file => {
  const relativePath = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    errors.push(`${relativePath} 找不到 frontmatter。`);
    return;
  }
  const categoriesLine = frontmatter[1].match(/^categories:\s*(.*)$/m);
  const postCategories = categoriesLine ? parseInlineList(categoriesLine[1]) : [];
  if (!postCategories.length) errors.push(`${relativePath} 沒有設定 categories。`);
  postCategories.forEach(category => {
    if (!allowedCategories.has(category)) errors.push(`${relativePath} 使用未設定的分類「${category}」。`);
  });

  const coverLine = frontmatter[1].match(/^cover:\s*(.*)$/m);
  if (coverLine) {
    const cover = coverLine[1].trim().replace(/^['"]|['"]$/g, '');
    const relativeCoverPath = decodeURIComponent(cover).replace(/^\//, '').replaceAll('/', path.sep);
    const sourceCoverPath = path.join(root, 'source', relativeCoverPath);
    if (!cover.startsWith('/images/') || !fs.existsSync(sourceCoverPath)) {
      errors.push(`${relativePath} 的 cover 圖片不存在或不是 /images/ 路徑：${cover}`);
    }
  }
});

const photoWall = read('source/photos/index.md');
const imageReferences = [...photoWall.matchAll(/src=["'](\/images\/[^"']+)["']/g)].map(match => match[1]);
imageReferences.forEach(reference => {
  const relativeImagePath = decodeURIComponent(reference).replace(/^\//, '').replaceAll('/', path.sep);
  const sourceImagePath = path.join(root, 'source', relativeImagePath);
  if (!fs.existsSync(sourceImagePath)) errors.push(`圖牆圖片不存在：${reference}`);
});

if (errors.length) {
  console.error('內容檢查失敗：');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`內容檢查通過：${categories.length} 個分類、${microblog ? microblog.length : 0} 則碎碎念、${imageReferences.length} 個圖牆圖片路徑。`);
