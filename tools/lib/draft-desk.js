'use strict';

// 草稿夾只回答「還有什麼沒寫完、多久沒動」；哪天公開交給發表日曆。

const DRAFT_STATES = Object.freeze({
  writing: Object.freeze({ label: '寫作中', open: true }),
  stuck: Object.freeze({ label: '卡住', open: true }),
  dropped: Object.freeze({ label: '放下', open: false }),
  done: Object.freeze({ label: '完稿', open: false })
});

function textValue(value) {
  return value == null ? '' : String(value).trim();
}

function toDateKey(value) {
  if (value == null || value === '') return '';
  if (typeof value.format === 'function') return value.format('YYYY-MM-DD');
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function normalizeUrl(value) {
  const url = textValue(value);
  if (!url.startsWith('/')) return '';
  const pathname = url.split(/[?#]/, 1)[0];
  try {
    const decoded = decodeURI(pathname);
    return decoded.endsWith('/') ? decoded : `${decoded}/`;
  } catch (error) {
    return '';
  }
}

function postUrl(post) {
  return normalizeUrl('/' + String(post?.path || '').replace(/^\/+/, '').replace(/index\.html$/, ''));
}

// 上次動筆：手填的 last_edited 優先，否則用文章 front matter 的 updated（沒填時 Hexo 用發表日）。
function lastEditedOf(item, post) {
  return toDateKey(item.last_edited) || toDateKey(post?.updated) || toDateKey(post?.date) || toDateKey(item.date);
}

function buildDraftDesk({ desk, posts = [] } = {}) {
  if (!desk || !Array.isArray(desk.topics)) throw new TypeError('draft_desk_invalid');
  const byUrl = new Map(posts.map(post => [postUrl(post), post]));
  const entries = [];
  for (const topic of desk.topics) {
    for (const item of topic.items || []) {
      const state = textValue(item.state);
      if (!Object.prototype.hasOwnProperty.call(DRAFT_STATES, state)) throw new Error(`draft_desk_state_invalid: ${item.id}`);
      const url = textValue(item.url);
      const local = normalizeUrl(url);
      const post = local ? byUrl.get(local) : null;
      entries.push({
        id: textValue(item.id),
        title: textValue(post?.title) || textValue(item.title),
        topic: textValue(topic.name),
        url,
        state,
        stateLabel: DRAFT_STATES[state].label,
        open: DRAFT_STATES[state].open,
        next: textValue(item.next),
        started: toDateKey(item.date),
        lastEdited: lastEditedOf(item, post),
        resolved: toDateKey(item.resolved_date),
        postUrl: post ? local : ''
      });
    }
  }
  const byOldest = (left, right) => left.lastEdited.localeCompare(right.lastEdited) || left.id.localeCompare(right.id);
  const byNewest = (left, right) => (right.resolved || right.lastEdited).localeCompare(left.resolved || left.lastEdited) || left.id.localeCompare(right.id);
  return {
    open: entries.filter(entry => entry.open).sort(byOldest),
    dropped: entries.filter(entry => entry.state === 'dropped').sort(byNewest),
    done: entries.filter(entry => entry.state === 'done').sort(byNewest),
    byPostUrl: new Map(entries.filter(entry => entry.postUrl && entry.state !== 'done').map(entry => [entry.postUrl, entry]))
  };
}

module.exports = Object.freeze({ DRAFT_STATES, buildDraftDesk, postUrl, normalizeUrl });
