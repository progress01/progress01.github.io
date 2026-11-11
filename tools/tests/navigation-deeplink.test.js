'use strict';
const fs = require('fs');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const extract = (page, name) => fs.readFileSync('source/' + page + '/index.md', 'utf8').match(new RegExp('    function ' + name + '\\([^]*?\\n    \\}'))[0];

test('microblog deep link expands past page 20, preserves IDs after reorder, and reports deleted targets', () => {
  const nodes = new Map();
  const data = Array.from({ length: 42 }, (_, index) => ({ id: 'micro-' + index, content: 'record ' + index }));
  const context = {
    data, query: 'old query', search: { value: 'old query' }, pageSize: 20, visibleLimit: 20,
    list: { isConnected: true }, summary: {}, location: { hash: '#micro-38' },
    document: { getElementById: id => nodes.get(id) },
    render() {
      nodes.clear();
      for (const item of context.data.slice(0, context.visibleLimit)) {
        const details = { open: false };
        nodes.set(item.id, { text: item.content, closest: () => details, details,
          focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } });
      }
    }
  };
  vm.runInNewContext(extract('status', 'locateEntry'), context);
  context.locateEntry();
  assert.equal(context.visibleLimit, 39);
  assert.equal(context.search.value, '');
  assert.equal(context.query, '');
  assert.equal(nodes.get('micro-38').details.open, true);
  assert.equal(nodes.get('micro-38').scrolled, true);
  context.data = [ { ...data[38], content: 'edited text' }, ...data.filter(item => item.id !== 'micro-38') ];
  context.locateEntry();
  assert.equal(context.visibleLimit, 20);
  assert.equal(nodes.get('micro-38').text, 'edited text');
  context.location.hash = '#micro-deleted';
  context.locateEntry();
  assert.match(context.summary.textContent, /不存在/);
});

test('draft deep link opens the collapsed section that holds the card and ignores other ids', () => {
  const details = { open: false };
  const card = { classList: { contains: name => name === 'draft-desk-card' }, closest: () => details,
    focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } };
  const other = { classList: { contains: () => false }, closest: () => null };
  const context = { location: { hash: '#reading-topic-25' },
    document: { getElementById: id => ({ 'reading-topic-25': card, 'main-content': other })[id] || null } };
  vm.runInNewContext(extract('reading', 'locateDraft'), context);
  context.locateDraft();
  assert.equal(details.open, true); assert.equal(card.focused, true); assert.equal(card.scrolled, true);
  context.location.hash = '#main-content'; context.locateDraft();
  context.location.hash = '#reading-deleted'; context.locateDraft();
});
