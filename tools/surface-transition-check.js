'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'themes/next/source/js/surface-transition.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'themes/next/source/css/_custom/surface-transition.styl'), 'utf8');
const scripts = fs.readFileSync(path.join(root, 'themes/next/layout/_scripts/index.njk'), 'utf8');
const main = fs.readFileSync(path.join(root, 'themes/next/source/css/main.styl'), 'utf8');
const checks = [
  [scripts.includes("next_js('surface-transition.js', { pjax: true })"), 'transition_js_not_loaded'],
  [main.includes("@import '_custom/surface-transition';"), 'transition_css_not_loaded'],
  [! /preventDefault\s*\(|setTimeout\s*\(/.test(js) && /onAnimationEnd/.test(js), 'navigation_gate_or_delay_or_cleanup_missing'],
  [/sessionStorage/.test(js) && /try\s*\{\s*[^}]*sessionStorage/.test(js), 'storage_not_guarded'],
  [/__surfaceTransitionInstalled/.test(js) && /pjax:success/.test(js), 'pjax_install_not_idempotent'],
  [/prefers-reduced-motion:\s*reduce/.test(css) && /animation:\s*none\s*!important/.test(css) && /animation-duration:\s*0s\s*!important/.test(css) && /transition-duration:\s*0s\s*!important/.test(css) && /transform:\s*none\s*!important/.test(css), 'reduced_motion_css_incomplete'],
  [/opacity:\s*\.86/.test(css) && /180ms/.test(css) && /surface-transition-enter/.test(css), 'animation_contract_invalid'],
  [/\.main-inner\.surface-transition-enter\.index/.test(css) && /\.main-inner\.surface-transition-enter\.profile-page/.test(css), 'route_scope_incomplete'],
  [/schema:\s*'surface-transition'/.test(js) && /timestamp/.test(js) && /TTL = 4500/.test(js), 'intent_contract_incomplete']
];
const errors = checks.filter(([passed]) => !passed).map(([, error]) => error);
const rootIndex = process.argv.indexOf('--root');
if (rootIndex >= 0) {
  const outputRoot = path.resolve(process.argv[rootIndex + 1] || '');
  const outputCss = path.join(outputRoot, 'css/main.css');
  try {
    const generatedCss = fs.readFileSync(outputCss, 'utf8');
    for (const selector of ['surface-transition-enter', 'surface-transition-enter--profile']) {
      if (!generatedCss.includes(selector)) errors.push(`output_missing_${selector}`);
    }
    if (!/animation-duration:\s*0s\s*!important/.test(generatedCss) || !/transition-duration:\s*0s\s*!important/.test(generatedCss) || !/transform:\s*none\s*!important/.test(generatedCss)) errors.push('output_reduced_motion_incomplete');
    const html = [];
    const walk = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.html')) html.push(fs.readFileSync(file, 'utf8'));
      }
    };
    walk(outputRoot);
    if (!html.some(page => /surface-switch[^>]*data-current-surface="memory"/.test(page))) errors.push('output_memory_marker_missing');
    if (!html.some(page => /surface-switch[^>]*data-current-surface="profile"/.test(page))) errors.push('output_profile_marker_missing');
    if (!html.some(page => /data-target-surface="profile"/.test(page))) errors.push('output_profile_target_missing');
    if (!html.some(page => /data-target-surface="memory"/.test(page))) errors.push('output_memory_target_missing');
  } catch (error) { errors.push(`output_unreadable_${error.code || 'unknown'}`); }
}
if (errors.length) {
  console.error(`翻面互動檢查失敗：\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`翻面互動 source${rootIndex >= 0 ? '／output' : ''} 檢查通過（${checks.length} 項 contract）。`);
}
