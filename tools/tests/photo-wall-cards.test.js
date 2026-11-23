'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { buildPhotoWall } = require('../../scripts/photo-wall-cards');
const { initializePhotoWall } = require('../../themes/next/source/js/photo-wall');

const controls = '<nav>' + ['all', 'music', 'books', 'films'].map(key => `<button data-photo-wall-filter="${key}"><span>0</span></button>`).join('') + '</nav>';
function card(name, href = `https://open.spotify.com/track/${name}`) {
  return `<div class="ig-card"><a href="${href}" target="_blank"><img loading="lazy" decoding="async" src="/images/${name}.webp" alt="Artist - ${name} - Album"></a></div>`;
}
function section(key, names) {
  return `<section id="photo-wall-${key}" data-photo-wall-section="${key}"><header><h2 id="photo-wall-${key}-title">${key}</h2></header><div class="ig-grid" data-photo-wall-grid="${key}">${names.map(name => card(name)).join('')}</div></section>`;
}
function post(name, date, extra = {}) {
  return { title: `歌曲推薦-${name}`, path: `posts/${name}/`, cover: `/images/${name}.webp`, date: new Date(date + 'T04:00:00Z'), ...extra };
}
const posts = [post('new', '2026-11-20'), post('old', '2026-10-20'), post('book', '2026-08-20'), post('film', '2025-12-20')];
const fixture = controls + section('music', ['old', 'new']) + section('books', ['book']) + section('films', ['film']);

test('generates a continuous grid with captions and native month anchors without month headings', () => {
  const result = buildPhotoWall(fixture, posts);
  const $ = cheerio.load(result.content);
  assert.equal($('.ig-card').length, 4);
  assert.equal($('[data-photo-wall-caption]').length, 4);
  const first = $('[data-photo-wall-section="music"] .ig-card').first();
  assert.equal(first.children('a').attr('href'), 'https://open.spotify.com/track/new');
  assert.equal(first.children('a').attr('target'), '_blank');
  assert.equal(first.find('img').attr('loading'), 'lazy');
  assert.equal(first.find('.photo-wall-card__title a').attr('href'), '/posts/new/');
  assert.equal(first.find('.photo-wall-card__title').text(), 'new');
  assert.equal(first.find('.photo-wall-card__artist').text(), 'Artist');
  assert.equal(first.find('time').attr('datetime'), '2026-11-20');
  assert.equal($('[data-photo-wall-grid="music"]').children('.ig-card').length, 2);
  assert.equal($('[data-photo-wall-month], h3, h4, select').length, 0);
  assert.equal(first.attr('id'), 'photo-wall-music-2026-11');
  assert.equal($('[data-photo-wall-section="music"] [data-photo-wall-jump]').length, 1);
  assert.equal($('[data-photo-wall-jump][open]').length, 0);
  $('[data-photo-wall-jump] a').each((_, link) => assert.equal($($(link).attr('href')).length, 1));
  assert.equal($('[data-photo-wall-section="books"] .photo-wall-card__artist').length, 0);
  const again = buildPhotoWall(result.content, posts).content;
  assert.equal(again, result.content);
  const edited = buildPhotoWall(again, posts.map(item => item.path === 'posts/new/' ? post('new', '2026-09-01') : item));
  const changed = cheerio.load(edited.content);
  assert.deepEqual(changed('[data-photo-wall-grid="music"]').children('.ig-card').map((_, el) => changed(el).attr('id')).get(), ['photo-wall-music-2026-10', 'photo-wall-music-2026-09']);
  assert.equal(changed('[data-photo-wall-caption]').length, 4);
});

test('allows optional HTML card labels, escapes text and retains an unmatched manual card', () => {
  const manual = card('manual').replace('class="ig-card"', 'class="ig-card" data-title="手動標題 &amp; 字樣" data-artist="自訂歌手"');
  const result = buildPhotoWall(controls + section('music', []).replace('</div></section>', manual + '</div></section>'), []);
  const $ = cheerio.load(result.content);
  assert.equal($('.photo-wall-card__title').text(), '手動標題 & 字樣');
  assert.equal($('.photo-wall-card__artist').text(), '自訂歌手');
  assert.equal($('.ig-card').length, 1);
  assert.equal($('[data-photo-wall-jump]').length, 0);
  assert.equal(result.unmatched.length, 1);
  const unsafe = buildPhotoWall(controls + section('music', ['new']), [post('new', '2026-11-20', {title: '歌曲推薦-<script>bad()</script>'})]);
  const safe = cheerio.load(unsafe.content);
  assert.equal(safe('.photo-wall-card__title script').length, 0);
  assert.equal(safe('.photo-wall-card__title').text(), '<script>bad()</script>');
});

function browser(url = 'https://example.test/photos/') {
  const dom = new JSDOM(buildPhotoWall(fixture, posts).content, {url, runScripts:'outside-only'});
  dom.window.scrollTo = () => {};
  return dom;
}
function visibleCards(doc) {
  return [...doc.querySelectorAll('[data-photo-wall-section]')].filter(section => !section.hidden)
    .flatMap(section => [...section.querySelectorAll('.ig-card')]);
}
function click(dom, selector) { dom.window.document.querySelector(selector).click(); }

// Run the actual theme methods: a copied approximation would miss regressions
// where NexT's scroll handler overwrites the wall's selected category.
function installThemeTOC(dom, ids) {
  const win = dom.window;
  const toc = win.document.createElement('nav');
  toc.className = 'post-toc';
  toc.innerHTML = '<ol class="nav">' + ids.map(id => `<li class="nav-item"><a class="nav-link" href="#${id}"><span>${id}</span></a></li>`).join('') + '</ol>';
  win.document.body.appendChild(toc);
  win.NexT = {};
  win.CONFIG = {scheme:'Gemini'};
  win.anime = () => { throw new Error('Wall TOC should handle its own scroll'); };
  win.eval(fs.readFileSync(path.resolve(__dirname, '../../themes/next/source/js/utils.js'), 'utf8'));
  win.NexT.utils.registerSidebarTOC();
  win.NexT.utils.registerScrollPercent();
  return toc;
}

test('orange TOC state follows category changes and remains correct after theme scroll updates', () => {
  const dom = browser(); const win = dom.window; const doc = win.document;
  const keys = ['music', 'books', 'films'];
  let scrollY = 0;
  Object.defineProperty(win, 'scrollY', {get:() => scrollY});
  win.setTimeout = callback => callback();
  const headings = keys.map(key => doc.getElementById(`photo-wall-${key}-title`));
  function absoluteTop(heading) {
    const visible = headings.filter(item => !item.closest('[hidden]'));
    return 200 + visible.indexOf(heading) * 1000;
  }
  for (const heading of headings) {
    // As in a browser, hidden headings report top=0 rather than a scroll position.
    heading.getBoundingClientRect = () => ({top:heading.closest('[hidden]') ? 0 : absoluteTop(heading) - scrollY});
    heading.scrollIntoView = () => { scrollY = absoluteTop(heading); };
  }
  const toc = installThemeTOC(dom, headings.map(item => item.id));
  initializePhotoWall(win, doc);
  function assertActive(key) {
    assert.deepEqual([...toc.querySelectorAll('.active-current a')].map(link => link.hash), [`#photo-wall-${key}-title`]);
    assert.equal(toc.querySelectorAll('.active').length, 1);
  }
  assertActive('music');
  // The author's reported sequence, including repeat clicks at the same offset.
  for (const key of ['films', 'books', 'music', 'films', 'books', 'books']) {
    toc.querySelector(`a[href="#photo-wall-${key}-title"] span`).click();
    assertActive(key);
    win.dispatchEvent(new win.Event('scroll'));
    assertActive(key);
  }
  // Category controls also need an immediate refresh even if no scroll occurs.
  for (const key of ['films', 'music', 'books']) {
    click(dom, `[data-photo-wall-filter="${key}"]`);
    assertActive(key);
  }
  click(dom, '[data-photo-wall-filter="all"]');
  for (const key of ['films', 'books', 'music']) {
    toc.querySelector(`a[href="#photo-wall-${key}-title"]`).click();
    assert.equal(visibleCards(doc).length, 4);
    assertActive(key);
  }
  for (const [position, key] of [[250, 'music'], [1250, 'books'], [2250, 'films'], [1250, 'books']]) {
    scrollY = position;
    win.dispatchEvent(new win.Event('scroll'));
    assertActive(key);
  }
  // Back/forward navigation also updates the category and its active TOC item.
  win.history.replaceState(null, '', '/photos/#photo-wall-music-title');
  win.dispatchEvent(new win.PopStateEvent('popstate'));
  assertActive('music');
  dom.window.close();
});

test('theme TOC keeps ordinary article heading order and skips absent targets', () => {
  const dom = new JSDOM('<h2 id="one">one</h2><h3 id="two">two</h3><h2 id="three">three</h2>', {runScripts:'outside-only'});
  const win = dom.window; const doc = win.document;
  let scrollY = 0;
  for (const [index, id] of ['one', 'two', 'three'].entries()) {
    doc.getElementById(id).getBoundingClientRect = () => ({top:200 + index * 1000 - scrollY});
  }
  const toc = installThemeTOC(dom, ['one', 'two', 'missing', 'three']);
  for (const [position, id] of [[0, 'one'], [210, 'one'], [1210, 'two'], [2210, 'three'], [100, 'one']]) {
    scrollY = position;
    win.NexT.utils.updateActiveNav();
    assert.equal(toc.querySelector('.active-current a').hash, `#${id}`);
  }
  dom.window.close();
});

test('shows every month in a category, with an all-category overview and no month controls', () => {
  const dom = browser(); const doc = dom.window.document;
  initializePhotoWall(dom.window, doc);
  assert.equal(visibleCards(doc).length, 2);
  assert.equal(doc.querySelectorAll('select, [data-photo-wall-newer], [data-photo-wall-older]').length, 0);
  click(dom, '[data-photo-wall-filter="all"]');
  assert.equal(visibleCards(doc).length, 4);
  click(dom, '[data-photo-wall-filter="books"]');
  assert.equal(visibleCards(doc).length, 1);
  click(dom, '[data-photo-wall-filter="music"]');
  assert.equal(visibleCards(doc).length, 2);
  dom.window.close();
});

test('restores continuous-wall position and still filters when storage is unavailable', () => {
  const dom = browser('https://example.test/photos/#photo-wall-books');
  var scroll;
  dom.window.sessionStorage.setItem('photo-wall-view-state-v3', JSON.stringify({url:'/photos/#photo-wall-books',scrollY:432}));
  dom.window.scrollTo = value => { scroll = value.top; };
  dom.window.setTimeout = callback => callback();
  initializePhotoWall(dom.window, dom.window.document);
  assert.equal(visibleCards(dom.window.document).length, 1);
  assert.equal(scroll, 432);
  Object.defineProperty(dom.window, 'sessionStorage', {get() { throw new Error('disabled'); }});
  click(dom, '[data-photo-wall-filter="music"]');
  assert.equal(visibleCards(dom.window.document).length, 2);
  dom.window.close();
  const invalid = browser('https://example.test/photos/?month=1900-99#photo-wall-unknown');
  initializePhotoWall(invalid.window, invalid.window.document);
  assert.equal(visibleCards(invalid.window.document).length, 2);
  assert.equal(new URL(invalid.window.location.href).searchParams.has('month'), false);
  invalid.window.close();
});

test('table-of-contents hashes reveal their category before scrolling to the heading', () => {
  const dom = browser();
  const doc = dom.window.document;
  const section = doc.querySelector('[data-photo-wall-section="books"]');
  const heading = doc.getElementById('photo-wall-books-title');
  var scrolled = false;
  heading.scrollIntoView = () => { assert.equal(section.hidden, false); scrolled = true; };
  dom.window.setTimeout = callback => callback();
  initializePhotoWall(dom.window, doc);
  dom.window.history.replaceState(null, '', '/photos/#photo-wall-books-title');
  dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.equal(scrolled, true);
  assert.equal(visibleCards(doc).length, 1);
  dom.window.close();
});

test('real sidebar clicks switch hidden categories before NexT can intercept them, including repeated clicks', () => {
  const dom = browser();
  const doc = dom.window.document;
  const toc = doc.createElement('nav');
  toc.className = 'post-toc';
  toc.innerHTML = ['music', 'books', 'films'].map(key => `<a class="nav-link" href="#photo-wall-${key}-title"><span>${key}</span></a>`).join('');
  doc.body.appendChild(toc);
  var themeCalls = 0;
  // Model the actual NexT listener, installed before our initializer. It would
  // measure a hidden target and pushState without dispatching hashchange.
  toc.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); themeCalls++;
    dom.window.history.pushState(null, '', link.href);
  }));
  const scrolled = [];
  for (const key of ['music', 'books', 'films']) {
    const heading = doc.getElementById(`photo-wall-${key}-title`);
    heading.scrollIntoView = () => {
      assert.equal(heading.closest('section').hidden, false);
      scrolled.push(key);
    };
  }
  dom.window.setTimeout = callback => callback();
  initializePhotoWall(dom.window, doc);
  for (const key of ['books', 'films', 'music', 'music']) {
    toc.querySelector(`a[href="#photo-wall-${key}-title"] span`).click();
    assert.equal(doc.querySelector(`[data-photo-wall-section="${key}"]`).hidden, false);
    assert.equal(dom.window.location.hash, `#photo-wall-${key}-title`);
  }
  assert.deepEqual(scrolled, ['books', 'films', 'music', 'music']);
  assert.equal(themeCalls, 0);
  assert.equal(visibleCards(doc).length, 2);
  click(dom, '[data-photo-wall-filter="all"]');
  toc.querySelector('a[href="#photo-wall-books-title"]').click();
  assert.equal(visibleCards(doc).length, 4);
  dom.window.close();
});

test('sidebar interception ignores modified clicks, outside links and non-wall targets', () => {
  const dom = browser(); const doc = dom.window.document;
  const toc = doc.createElement('nav'); toc.className = 'post-toc';
  toc.innerHTML = '<a href="#photo-wall-books-title">books</a><a href="#other">other</a><a href="https://elsewhere.test/#photo-wall-books-title">outside</a><div id="other"></div>';
  doc.body.appendChild(toc);
  initializePhotoWall(dom.window, doc);
  for (const [link, options] of [[toc.children[0], {ctrlKey:true}], [toc.children[1], {}], [toc.children[2], {}]]) {
    const event = new dom.window.MouseEvent('click', {bubbles:true,cancelable:true,...options});
    // Prevent JSDOM's navigation separately, after checking our capture handler.
    var intercepted;
    link.addEventListener('click', e => { intercepted = e.defaultPrevented; e.preventDefault(); }, {once:true});
    link.dispatchEvent(event);
    assert.equal(intercepted, false);
  }
  assert.equal(visibleCards(doc).length, 2);
  dom.window.close();
});

test('the reported mixed month-query/hash URL jumps to its card without hiding other months', () => {
  const dom = browser('https://example.test/photos/?month=2026-11#photo-wall-music-2026-10');
  const doc = dom.window.document;
  const card = doc.getElementById('photo-wall-music-2026-10');
  var scrolled = false;
  card.scrollIntoView = () => { assert.equal(card.closest('section').hidden, false); scrolled = true; };
  dom.window.setTimeout = callback => callback();
  initializePhotoWall(dom.window, doc);
  assert.equal(scrolled, true);
  assert.equal(new URL(dom.window.location.href).searchParams.has('month'), false);
  assert.equal(visibleCards(doc).length, 2);
  click(dom, '[data-photo-wall-filter="all"]');
  dom.window.history.replaceState(null, '', '/photos/#photo-wall-books-2026-08');
  dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.equal(visibleCards(doc).length, 4);
  Object.defineProperty(dom.window, 'scrollY', {value:654});
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  const returned = browser(dom.window.location.href);
  returned.window.sessionStorage.setItem('photo-wall-view-state-v3', dom.window.sessionStorage.getItem('photo-wall-view-state-v3'));
  returned.window.setTimeout = callback => callback();
  var restoredScroll;
  returned.window.scrollTo = options => { restoredScroll = options.top; };
  initializePhotoWall(returned.window, returned.window.document);
  assert.equal(visibleCards(returned.window.document).length, 4);
  assert.equal(restoredScroll, 654);
  returned.window.close();
  dom.window.close();
});
