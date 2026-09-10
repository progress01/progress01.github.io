const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('精簡搜尋清單仍保留全部與各分類最新十篇，跨分類不重複', () => {
  let helper;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../scripts/search-recent-posts.js'), 'utf8'), {
    hexo: { extend: { helper: { register: (_, callback) => { helper = callback; } } } }
  });
  const posts = Array.from({ length: 240 }, (_, rank) => ({
    rank,
    categories: { toArray: () => (rank < 12 ? ['音樂'] : rank < 18 ? ['音樂', '閱讀'] : ['閱讀']).map(name => ({ name })) }
  }));
  const records = helper.call({ site: {
    data: { 'content-categories': [{ name: '音樂' }, { name: '閱讀' }, { name: '無文章' }] },
    posts: { sort: () => ({ toArray: () => posts }) }
  } });
  assert.equal(records.length, 20);
  assert.equal(new Set(records.map(record => record.rank)).size, records.length);
  assert.deepEqual(Array.from(records.filter(record => record.rank < 10), record => record.rank), [...Array(10).keys()]);
  for (const category of ['音樂', '閱讀']) {
    const matches = post => post.categories.toArray().some(item => item.name === category);
    assert.deepEqual(Array.from(records.filter(record => matches(record.post)).slice(0, 10), record => record.rank),
      posts.filter(matches).slice(0, 10).map(post => post.rank));
  }
});
