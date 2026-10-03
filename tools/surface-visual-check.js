'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, '..');
const TOKEN_NAMES = [
  'paper', 'base', 'panel', 'ink', 'muted', 'border', 'accent',
  'accent-strong', 'focus', 'shadow'
];
const FILES = {
  main: 'themes/next/source/css/main.styl',
  tokens: 'themes/next/source/css/_custom/dual-surface-visual.styl',
  home: 'themes/next/source/css/_custom/home.styl',
  profile: 'themes/next/source/css/_custom/profile.styl',
  switch: 'themes/next/source/css/_custom/surface-switch.styl',
  thinking: 'themes/next/source/css/_custom/thinking-status.styl',
  post: 'themes/next/source/css/_custom/post-surface.styl',
  transition: 'themes/next/source/css/_custom/surface-transition.styl',
  docs: 'docs/dual-surface-visual-rules.md'
};

function contrastRatio(foreground, background) {
  const luminance = hex => {
    const channels = hex.replace('#', '').match(/.{2}/g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function extractDeclarations(block) {
  return Object.fromEntries([...block.matchAll(/--surface-([\w-]+)\s*:\s*([^;]+);/g)]
    .map(match => [match[1], match[2].trim()]));
}

function selectorBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`, 's'));
  return match?.[1] || '';
}

function checkSource(sources) {
  const errors = [];
  const { main, tokens, home, profile, switch: surfaceSwitch, thinking, post, transition, docs } = sources;
  if (!main.includes("@import '_custom/dual-surface-visual';")) errors.push('visual_tokens_not_loaded');
  const tokenBlocks = {
    defaults: selectorBlock(tokens, ':root'),
    memory: selectorBlock(tokens, '.main-inner.index'),
    profile: selectorBlock(tokens, '.main-inner.profile-page')
  };
  for (const [scope, block] of Object.entries(tokenBlocks)) {
    const declarations = extractDeclarations(block);
    for (const token of TOKEN_NAMES) {
      if (!declarations[token]) errors.push(`token_missing_${scope}_${token}`);
    }
  }
  for (const token of ['panel', 'ink', 'accent']) {
    const memoryValue = extractDeclarations(tokenBlocks.memory)[token];
    const profileValue = extractDeclarations(tokenBlocks.profile)[token];
    if (!memoryValue || !profileValue || memoryValue.toLowerCase() === profileValue.toLowerCase()) {
      errors.push(`surface_token_not_distinct_${token}`);
    }
  }
  if (!/var\(--surface-/.test(profile)) errors.push('profile_does_not_use_tokens');
  if (/#(?:[\da-f]{3,8})\b|rgba?\(/i.test(profile)) errors.push('profile_visual_values_must_use_tokens');
  if (!/var\(--surface-/.test(home)) errors.push('home_does_not_use_tokens');
  if (!/\.index \.home-landing-label[\s\S]*?var\(--surface-accent\)/.test(home)) {
    errors.push('memory_home_labels_must_use_accent_token');
  }
  if (!/var\(--surface-/.test(surfaceSwitch)) errors.push('switch_does_not_use_tokens');
  if (!/\.profile-page\s+\.profile-thinking-label[\s\S]*?var\(--surface-muted\)/.test(thinking)) {
    errors.push('profile_thinking_does_not_use_profile_token');
  }
  if (/var\(--surface-/.test(post)) errors.push('post_surface_marker_must_remain_neutral');
  if (/\.post-thinking-status\s*\{[^}]*var\(--surface-/s.test(thinking)) {
    errors.push('article_thinking_status_must_remain_neutral');
  }
  if (/\.main-inner\.(?:index|profile-page)\s*\{/.test(post) ||
      /\.post-content[^{}]*\{[^}]*--surface-/s.test(tokens)) {
    errors.push('article_styles_must_not_receive_route_tokens');
  }
  if (!/\.profile-list-link:focus-visible/.test(profile) || !/\.profile-home-search-field:focus-within/.test(profile) ||
      !/\.profile-home-article-link:focus-visible/.test(profile) ||
      !/\.surface-switch-link:focus-visible/.test(surfaceSwitch) ||
      !/\.home-profile-bridge a:focus-visible/.test(home)) {
    errors.push('focus_visible_missing');
  }
  if ([tokens, home, profile, surfaceSwitch, thinking, post].some(source => /@keyframes\b|\banimation(?:-[\w]+)?\s*:/i.test(source))) {
    errors.push('visual_styles_must_not_add_animation');
  }
  if (!/@keyframes\b|\banimation(?:-[\w]+)?\s*:/i.test(transition)) errors.push('surface_transition_animation_missing');
  if (!docs.includes('WBS 9.1') || !docs.includes('9.2') || !docs.includes('9.3') || !docs.includes('9.5')) {
    errors.push('visual_rules_document_incomplete');
  }

  const memory = extractDeclarations(tokenBlocks.memory);
  const profileTokens = extractDeclarations(tokenBlocks.profile);
  const contrastPairs = [];
  const articleMarkerColor = post.match(/\.post-surface-marker\s*\{[^}]*color:\s*(#[\da-f]{6})/is)?.[1];
  if (!articleMarkerColor) errors.push('article_marker_text_color_missing');
  else contrastPairs.push(['article marker/white', articleMarkerColor, '#ffffff']);
  for (const [surface, values] of [['memory', memory], ['profile', profileTokens]]) {
    for (const [name, foreground] of [
      ['ink', values.ink], ['muted', values.muted], ['accent', values.accent],
      ['strong', values['accent-strong']], ['focus', values.focus]
    ]) {
      contrastPairs.push([`${surface} ${name}/panel`, foreground, values.panel]);
      contrastPairs.push([`${surface} ${name}/paper`, foreground, values.paper]);
    }
  }
  for (const [name, foreground, background] of contrastPairs) {
    if (!foreground || !background || !/^#[\da-f]{6}$/i.test(foreground) || !/^#[\da-f]{6}$/i.test(background)) continue;
    if (contrastRatio(foreground, background) < 4.5) errors.push(`contrast_below_4_5_${name.replaceAll(/[^a-z0-9]+/gi, '_')}`);
  }
  return { errors, contrastPairs: contrastPairs.map(([name, foreground, background]) => ({
    name, ratio: foreground && background ? Number(contrastRatio(foreground, background).toFixed(2)) : null,
    passes: Boolean(foreground && background && contrastRatio(foreground, background) >= 4.5)
  })) };
}

function readSources(sourceRoot) {
  return Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(path.join(sourceRoot, file), 'utf8')]));
}

function checkOutput(root) {
  const cssPath = path.join(root, 'css', 'main.css');
  let css;
  try { css = fs.readFileSync(cssPath, 'utf8'); }
  catch { return ['visual_output_css_unreadable']; }
  const errors = [];
  for (const token of TOKEN_NAMES) {
    if (!css.includes(`--surface-${token}:`)) errors.push(`visual_output_token_missing_${token}`);
  }
  for (const selector of [
    '.main-inner.index', '.main-inner.profile-page', '.profile-page .profile-list-link', '.profile-page .profile-home-search-field', '.profile-page .profile-home-article-link', '.surface-switch-link',
    '.surface-switch--memory .surface-switch-cassette::before', '.surface-switch--profile .surface-switch-cassette::before',
    '.main-menu[data-navigation-surface="profile"] .menu-item-profile-home > a', '.profile-page .profile-library-count'
  ]) {
    if (!css.includes(selector)) errors.push(`visual_output_selector_missing_${selector.replaceAll(/[^a-z0-9]+/gi, '_')}`);
  }
  if (css.includes('.surface-switch-current-side')) errors.push('visual_output_conflicting_current_side_badge');
  return errors;
}

function runCli(args = process.argv.slice(2)) {
  const rootIndex = args.indexOf('--root');
  const root = rootIndex >= 0 ? path.resolve(args[rootIndex + 1] || '') : null;
  let result;
  try { result = checkSource(readSources(DEFAULT_SOURCE_ROOT)); }
  catch (error) {
    console.error(`視覺規則檢查無法讀取來源：${error.message}`);
    return 2;
  }
  const errors = [...result.errors, ...(root ? checkOutput(root) : [])];
  if (errors.length) {
    console.error('雙面視覺規則檢查失敗：');
    errors.forEach(error => console.error(`- ${error}`));
    return 1;
  }
  const contrastSummary = result.contrastPairs.map(pair => `${pair.name} ${pair.ratio}:1`).join('、');
  console.log(`雙面視覺規則檢查通過：token／scope／文章中性／focus-visible 均符合；文字對比 ${contrastSummary}${root ? '；編譯 CSS selector/token 通過' : ''}。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { TOKEN_NAMES, contrastRatio, extractDeclarations, selectorBlock, checkSource, checkOutput, readSources, runCli };
