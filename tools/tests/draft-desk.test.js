'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDraftDesk } = require('../lib/draft-desk');

const posts = [
  { path: 'learning/old/', title: '舊題目（新標題）', date: '2026-08-29', updated: '2026-09-17 15:00:00' },
  { path: 'learning/fresh/', title: '剛動過', date: '2026-09-01', updated: '2026-10-20' },
  { path: 'learning/finished/', title: '寫完了', date: '2026-10-06', updated: '2026-10-06' }
];

function desk(items) {
  return { topics: [{ name: '主題', items }] };
}

test('open drafts sort by last edited, oldest first, and use the post title', () => {
  const result = buildDraftDesk({ posts, desk: desk([
    { id: 'fresh', date: '2026-09-01', url: '/learning/fresh/', title: '舊', state: 'writing' },
    { id: 'old', date: '2026-08-29', url: '/learning/old/', title: '舊', state: 'stuck', next: '補後記' }
  ]) });
  assert.deepEqual(result.open.map(entry => [entry.id, entry.lastEdited]), [['old', '2026-09-17'], ['fresh', '2026-10-20']]);
  assert.equal(result.open[0].title, '舊題目（新標題）');
  assert.equal(result.open[0].stateLabel, '卡住');
  assert.equal(result.open[0].next, '補後記');
});

test('manual last_edited wins over the post updated date', () => {
  const result = buildDraftDesk({ posts, desk: desk([
    { id: 'old', date: '2026-08-29', url: '/learning/old/', state: 'writing', last_edited: '2026-11-01' }
  ]) });
  assert.equal(result.open[0].lastEdited, '2026-11-01');
});

test('dropped and done leave the open list; done posts get no post-page line', () => {
  const result = buildDraftDesk({ posts, desk: desk([
    { id: 'old', date: '2026-08-29', url: '/learning/old/', state: 'dropped' },
    { id: 'finished', date: '2026-10-06', url: '/learning/finished/', state: 'done', resolved_date: '2026-10-06' }
  ]) });
  assert.equal(result.open.length, 0);
  assert.deepEqual(result.dropped.map(entry => entry.id), ['old']);
  assert.deepEqual(result.done.map(entry => entry.id), ['finished']);
  assert.ok(result.byPostUrl.has('/learning/old/'));
  assert.ok(!result.byPostUrl.has('/learning/finished/'));
});

test('unpublished drafts without a link stay on the desk', () => {
  const result = buildDraftDesk({ posts, desk: desk([
    { id: 'idea', date: '2026-11-01', title: '還沒公開的題目', state: 'writing', next: '先列大綱' }
  ]) });
  assert.equal(result.open[0].title, '還沒公開的題目');
  assert.equal(result.open[0].lastEdited, '2026-11-01');
  assert.equal(result.open[0].postUrl, '');
});

test('unknown states are rejected', () => {
  assert.throws(() => buildDraftDesk({ posts, desk: desk([{ id: 'x', date: '2026-01-01', state: 'learning' }]) }), /draft_desk_state_invalid/);
});
