'use strict';

// 草稿夾頁（{% draft_desk %}）與文章頁「還沒完稿」那一行共用同一份整理結果。

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { escapeHTML } = require('hexo-util');
const { buildDraftDesk, postUrl } = require('../tools/lib/draft-desk');

let cached = null;
hexo.on('generateBefore', () => { cached = null; });

function draftDesk() {
  if (cached) return cached;
  const desk = yaml.load(fs.readFileSync(path.join(hexo.source_dir, 'reading-desk.yml'), 'utf8')) || {};
  cached = buildDraftDesk({ desk, posts: hexo.locals.get('posts').toArray() });
  return cached;
}

function card(entry) {
  const title = escapeHTML(entry.title || '未命名草稿');
  const heading = entry.url ? `<a href="${escapeHTML(entry.url)}">${title}</a>` : title;
  const dates = [`上次動筆 <time datetime="${entry.lastEdited}">${entry.lastEdited || '未標日期'}</time>`];
  if (entry.state === 'done' && entry.resolved) dates.push(`完稿 <time datetime="${entry.resolved}">${entry.resolved}</time>`);
  const next = entry.state === 'done' ? '' : `<p class="draft-desk-next"><span>下一步</span>${entry.next ? escapeHTML(entry.next) : '還沒寫'}</p>`;
  return `<article class="draft-desk-card is-${entry.state}" id="${escapeHTML(entry.id)}" tabindex="-1">`
    + `<div class="draft-desk-card-meta"><span class="draft-desk-state">${entry.stateLabel}</span><span>${escapeHTML(entry.topic)}</span></div>`
    + `<p class="draft-desk-title">${heading}</p>${next}<p class="draft-desk-dates">${dates.join('・')}</p></article>`;
}

function section(id, title, note, entries, collapsed) {
  const body = entries.length
    ? `<div class="draft-desk-list">${entries.map(card).join('')}</div>`
    : '<p class="draft-desk-empty">目前沒有。</p>';
  const heading = `<span>${entries.length} 篇</span><h2>${title}</h2><small>${note}</small>`;
  if (!collapsed) return `<section class="draft-desk-section" id="${id}"><div class="draft-desk-heading">${heading}</div>${body}</section>`;
  return `<details class="draft-desk-section" id="${id}"><summary class="draft-desk-heading">${heading}</summary>${body}</details>`;
}

hexo.extend.tag.register('draft_desk', function() {
  const desk = draftDesk();
  return `<div class="draft-desk">`
    + section('draft-open', '還沒完稿', '最久沒動的排最上面', desk.open, false)
    + section('draft-dropped', '放下', '先停在這裡', desk.dropped, true)
    + section('draft-done', '完稿', '最近寫完的在上面', desk.done, true)
    + `</div>`;
});

hexo.extend.helper.register('draft_desk_entry', function(post) {
  return draftDesk().byPostUrl.get(postUrl(post)) || null;
});
