// 將 source/reading-desk.yml 提供給閱讀台頁面。

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

hexo.extend.generator.register('reading_desk_json', function(locals) {
  const sourceFile = path.join(hexo.source_dir, 'reading-desk.yml');
  const readingDesk = yaml.load(fs.readFileSync(sourceFile, 'utf8')) || {};
  const normalizeDate = value => {
    if (value && typeof value.format === 'function') return value.format('YYYY-MM-DD');
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const text = String(value || '').trim();
    const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/);
    return isoDate ? isoDate[0] : text.slice(0, 10);
  };
  const output = {
    ...readingDesk,
    topics: (readingDesk.topics || []).map(topic => ({
      ...topic,
      items: (topic.items || []).map(item => ({ ...item, date: normalizeDate(item.date) }))
    }))
  };

  return {
    path: 'reading-desk.json',
    data: JSON.stringify(output)
  };
});
