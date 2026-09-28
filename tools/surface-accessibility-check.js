'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const ROUTES = ['index.html', 'profile/index.html', 'profile/articles/index.html', 'memory/index.html'];
const SOURCE_FILES = {
  layout: 'themes/next/layout/_layout.njk',
  switch: 'themes/next/source/css/_custom/surface-switch.styl',
  home: 'themes/next/source/css/_custom/home.styl',
  accessibility: 'themes/next/source/css/_custom/accessibility.styl',
  transition: 'themes/next/source/css/_custom/surface-transition.styl',
  transitionJs: 'themes/next/source/js/surface-transition.js',
  mainCss: 'themes/next/source/css/main.styl',
  boot: 'themes/next/source/js/next-boot.js'
};

function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

function accessibleName($, element) {
  const node = $(element);
  const label = text(node.attr('aria-label'));
  if (label) return label;
  const labelledby = text(node.attr('aria-labelledby'));
  if (labelledby) return labelledby.split(/\s+/).map(id => text($(`#${cssEscape(id)}`).first().text())).join(' ').trim();
  const title = text(node.attr('title'));
  if (title) return title;
  const imageText = node.find('img').map((_, img) => text($(img).attr('alt'))).get().filter(Boolean).join(' ');
  return text(node.text()) || imageText;
}

function cssEscape(value) { return String(value).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1'); }

function checkSource(sources) {
  const errors = [];
  const { layout, switch: switchCss, home, accessibility, transition, transitionJs, mainCss, boot } = sources;
  if (!/<body\b[^>]*>\s*<a\b(?=[^>]*class="skip-link")(?=[^>]*href="#main-content")[^>]*>\s*跳到主要內容\s*<\/a>/s.test(layout)) errors.push('skip_link_missing_or_not_first');
  if ((layout.match(/id="main-content"/g) || []).length !== 1 || !/class="main-inner[^\"]*"\s+id="main-content"\s+tabindex="-1"/.test(layout)) errors.push('main_skip_target_invalid');
  if (!/min-height:\s*44px/.test(switchCss) || !/min-width:\s*44px/.test(switchCss)) errors.push('surface_switch_target_too_small');
  if (!/\.surface-switch-link:focus-visible/.test(switchCss) || !/outline:\s*3px/.test(switchCss)) errors.push('surface_switch_focus_missing');
  if (!/\.index \.home-profile-bridge a\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s.test(home)) errors.push('home_bridge_target_too_small');
  if (!/\.home-profile-bridge a:focus-visible/.test(home)) errors.push('home_bridge_focus_missing');
  if (!mainCss.includes("@import '_custom/accessibility';")) errors.push('accessibility_styles_not_loaded');
  if (!/\.skip-link:focus-visible/.test(accessibility) || /transition|animation|@keyframes|transform\s*:/.test(accessibility)) errors.push('skip_link_focus_style_invalid');
  if (!/\[role="button"\]\[tabindex="0"\]:focus-visible/.test(accessibility)) errors.push('role_button_focus_missing');
  if (!/prefers-reduced-motion:\s*reduce[\s\S]*?animation-duration:\s*0s[\s\S]*?transform:\s*none/s.test(transition)) errors.push('reduced_motion_css_incomplete');
  if (!/if\s*\(reduced\(\)\)\s*return;[\s\S]*?sessionStorage\.setItem/.test(transitionJs) || !/if\s*\(reduced\(\)\)\s*return;[\s\S]*?main\.classList\.add/.test(transitionJs)) errors.push('reduced_motion_intent_or_class_guard_missing');
  if (/preventDefault\s*\(/.test(transitionJs)) errors.push('surface_anchor_navigation_intercepted');
  if (!/\[role="button"\]\[tabindex="0"\]/.test(boot) || !/event\.key === 'Enter'[\s\S]*?button\.click\(\)/.test(boot) || !/event\.key === ' '[\s\S]*?button\.click\(\)/.test(boot) || !/dataset\.spacePressed/.test(boot)) errors.push('role_button_keyboard_support_missing');
  return errors;
}

function checkHtml(html, file, { article = false } = {}) {
  const errors = [];
  const $ = cheerio.load(html);
  const skip = $('body > .skip-link');
  const target = $('#main-content');
  if (skip.length !== 1 || skip.attr('href') !== '#main-content' || accessibleName($, skip[0]) !== '跳到主要內容') errors.push('skip_link_invalid');
  if (target.length !== 1 || target.attr('tabindex') !== '-1' || target[0]?.tagName !== 'div') errors.push('skip_target_invalid');
  if ($('main').length !== 1) errors.push('main_landmark_count_invalid');

  const ids = new Map();
  $('[id]').each((_, element) => ids.set(element.attribs.id, (ids.get(element.attribs.id) || 0) + 1));
  if ([...ids.values()].some(count => count > 1)) errors.push('duplicate_id');
  $('[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-activedescendant]').each((_, element) => {
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'aria-activedescendant']) {
      for (const id of text($(element).attr(attr)).split(/\s+/).filter(Boolean)) {
        if (!ids.has(id)) errors.push(attr === 'aria-labelledby' ? 'missing_label_target' : 'missing_aria_target');
      }
    }
  });
  $('[tabindex]').each((_, element) => { if (Number($(element).attr('tabindex')) > 0) errors.push('positive_tabindex'); });

  const controls = $('.surface-switch');
  const switchLink = controls.find('a.surface-switch-link');
  if (!article) {
    if (controls.length !== 1 || controls.attr('aria-label') !== '雙面導覽' || switchLink.length !== 1 || !accessibleName($, switchLink[0])) errors.push('surface_switch_name_invalid');
    if (controls.length && target.length && controls.first().closest('.main-inner')[0] !== target[0]) errors.push('surface_control_outside_main');
    const mainInner = $('.main-inner');
    const heading = mainInner.find('h1').first();
    if (controls.length && heading.length && controls.first().index() > heading.index()) errors.push('surface_control_after_page_heading');
  }

  const coreControls = $('.surface-switch a, .home-profile-bridge a, .profile-list-link, [data-profile-tag-filters] button, .profile-calendar-day-control, .profile-calendar-article, .profile-navigation a, .post-surface-marker a, .site-nav [role="button"], .site-brand-container [role="button"], .sidebar-toggle, .back-to-top');
  coreControls.each((_, element) => {
    const node = $(element);
    if (!accessibleName($, element)) errors.push('empty_name');
    const isRoleButton = node.attr('role') === 'button';
    if (isRoleButton && node.attr('tabindex') !== '0') errors.push('role_button_not_focusable');
  });

  if (file === 'memory/index.html') {
    const bridge = $('.home-profile-bridge');
    const bridgeLink = bridge.children('a');
    if (bridge.length !== 1 || bridge.attr('aria-labelledby') !== 'home-profile-bridge-title' || bridgeLink.length !== 1 || !accessibleName($, bridgeLink[0])) errors.push('home_bridge_semantics_invalid');
  }
  if ((file === 'index.html' || file === 'profile/index.html') && $('[data-profile-article-calendar]').length) {
    const calendar = $('[data-profile-article-calendar]');
    const chart = calendar.find('#profile-calendar-chart');
    const scroll = calendar.find('.profile-calendar-scroll');
    const controls = calendar.find('[data-profile-calendar-controls]');
    const fallback = calendar.find('[data-profile-calendar-fallback] a');
    if (chart.length !== 1 || chart.attr('role') !== 'img' || !text(chart.attr('aria-label'))) errors.push('profile_calendar_chart_name_invalid');
    if (scroll.length !== 1 || scroll.attr('tabindex') !== '0' || !text(scroll.attr('aria-label'))) errors.push('profile_calendar_scroll_name_invalid');
    if (controls.length !== 1 || controls.attr('role') !== 'group' || !text(controls.attr('aria-label'))) errors.push('profile_calendar_controls_name_invalid');
    if (calendar.find('.profile-calendar-day-control').toArray().some(button => !text($(button).attr('aria-label')) || $(button).attr('type') !== 'button')) errors.push('profile_calendar_day_button_name_invalid');
    if (calendar.find('.profile-calendar-article').toArray().some(link => !['發表', '更新'].includes(text($(link).find('.profile-calendar-event-label').text())) || !text($(link).find('.profile-calendar-article-title').text()))) errors.push('profile_calendar_event_label_invalid');
    if (fallback.length !== 1 || fallback.attr('href') !== '/profile/articles/') errors.push('profile_calendar_fallback_link_invalid');
  }
  if (article) {
    const marker = $('.post-surface-marker').first();
    const thinking = $('.post-thinking-status').first();
    const postBody = $('.post-body').first();
    const documentOrder = element => $('*').toArray().indexOf(element);
    if (marker.length !== 1 || !text(marker.attr('aria-label'))) errors.push('article_marker_missing_name');
    if (postBody.length !== 1 || (marker.length && documentOrder(marker[0]) >= documentOrder(postBody[0]))) errors.push('article_marker_order_invalid');
    if (thinking.length && (postBody.length !== 1 || documentOrder(thinking[0]) >= documentOrder(postBody[0]))) errors.push('article_thinking_order_invalid');
    if (thinking.length && (!text(thinking.attr('aria-labelledby')) || !accessibleName($, thinking[0]))) errors.push('article_thinking_name_invalid');
  }
  return [...new Set(errors)];
}

function checkOutput(root) {
  const errors = [];
  for (const file of ROUTES) {
    let html;
    try { html = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
    catch { errors.push(`route_unreadable:${file}`); continue; }
    errors.push(...checkHtml(html, file).map(code => `${code}:${file}`));
  }
  let articleFile;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.html') && !articleFile) {
        const html = fs.readFileSync(file, 'utf8');
        if (html.includes('post-surface-marker') && html.includes('post-content-single')) articleFile = { file, html };
      }
    }
  };
  try { walk(root); } catch { errors.push('article_scan_failed'); }
  if (!articleFile) errors.push('ordinary_article_not_found');
  else {
    const rel = path.relative(root, articleFile.file).split(path.sep).join('/');
    errors.push(...checkHtml(articleFile.html, rel, { article: true }).map(code => `${code}:${rel}`));
  }
  const cssPath = path.join(root, 'css', 'main.css');
  try {
    const css = fs.readFileSync(cssPath, 'utf8');
    const rule = selector => {
      const index = css.indexOf(`${selector} {`);
      if (index < 0) return '';
      const start = css.indexOf('{', index);
      const end = css.indexOf('}', start);
      return start >= 0 && end >= 0 ? css.slice(start + 1, end) : '';
    };
    const switchRule = rule('.surface-switch-link');
    const bridgeRule = rule('.index .home-profile-bridge a');
    if (!/\.profile-calendar-day-control:focus-visible/.test(css)) errors.push('compiled_profile_calendar_focus_missing');
    if (!/min-height:\s*44px/.test(switchRule) || !/min-width:\s*44px/.test(switchRule)) errors.push('compiled_surface_switch_target_too_small');
    if (!/min-height:\s*44px/.test(bridgeRule) || !/min-width:\s*44px/.test(bridgeRule)) errors.push('compiled_bridge_target_too_small');
    if (!/\.skip-link:focus-visible/.test(css)) errors.push('compiled_skip_focus_missing');
    if (!/prefers-reduced-motion:\s*reduce/.test(css) || !/animation-duration:\s*0s/.test(css) || !/transform:\s*none/.test(css)) errors.push('compiled_reduced_motion_incomplete');
  } catch { errors.push('compiled_css_unreadable'); }
  return errors;
}

function readSources(sourceRoot = DEFAULT_SOURCE_ROOT) {
  return Object.fromEntries(Object.entries(SOURCE_FILES).map(([key, file]) => [key, fs.readFileSync(path.join(sourceRoot, file), 'utf8')]));
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  const sourceRootIndex = args.indexOf('--source-root');
  const sourceRoot = sourceRootIndex >= 0 ? path.resolve(args[sourceRootIndex + 1] || '') : DEFAULT_SOURCE_ROOT;
  let errors;
  try { errors = checkSource(readSources(sourceRoot)); }
  catch (error) { console.error(`無障礙來源檢查無法讀取：${error.message}`); return 2; }
  if (rootIndex >= 0) errors.push(...checkOutput(path.resolve(args[rootIndex + 1] || '')));
  if (errors.length) {
    console.error('雙面核心旅程無障礙檢查失敗：');
    [...new Set(errors)].forEach(error => console.error(`- ${error}`));
    return 1;
  }
  console.log(`雙面核心旅程無障礙檢查通過：來源合約${rootIndex >= 0 ? `、${ROUTES.length} 路由與一般文章輸出` : ''}。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { ROUTES, SOURCE_FILES, accessibleName, checkSource, checkHtml, checkOutput, readSources, runCli };
