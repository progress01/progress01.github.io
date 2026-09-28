'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkSource, checkOutput, readSources, contrastRatio } = require('../surface-visual-check');

const sourceRoot = path.resolve(__dirname, '../..');

test('visual token layer is loaded and defines shared plus distinct memory/profile scopes', () => {
  const result = checkSource(readSources(sourceRoot));
  assert.deepEqual(result.errors, []);
  assert.equal(result.contrastPairs.every(pair => pair.passes), true);
});

test('contrast checker enforces WCAG normal-text ratio for declared surface pairs', () => {
  assert.equal(contrastRatio('#4e626a', '#e8eef0') >= 4.5, true);
  assert.equal(contrastRatio('#a65f43', '#f1e4d1') < 4.5, true);
  assert.equal(contrastRatio('#806b60', '#ffffff') >= 4.5, true);
  const sources = readSources(sourceRoot);
  sources.tokens = sources.tokens.replaceAll('--surface-accent: #914a32;', '--surface-accent: #a65f43;');
  const result = checkSource(sources);
  assert.ok(result.errors.includes('contrast_below_4_5_memory_accent_panel'));
});

test('profile, homepage bridge, switch, thinking status and neutral article styles are guarded', () => {
  const sources = readSources(sourceRoot);
  sources.post = sources.post.replace('color: #806b60;', 'color: var(--surface-muted);');
  const result = checkSource(sources);
  assert.ok(result.errors.includes('post_surface_marker_must_remain_neutral'));
});

test('surface switch shows the destination A/B face in the cassette, matching its copy', () => {
  const surfaceSwitch = readSources(sourceRoot).switch;
  assert.match(surfaceSwitch, /\.surface-switch--memory \.surface-switch-cassette::before\s*\{\s*content:\s*'A';/);
  assert.match(surfaceSwitch, /\.surface-switch--profile \.surface-switch-cassette::before\s*\{\s*content:\s*'B';/);
  assert.doesNotMatch(surfaceSwitch, /surface-switch-current-side/);
  assert.match(surfaceSwitch, /\.surface-switch-cassette\s*\{[\s\S]*?radial-gradient\(circle at 8px 8px/);
  assert.match(surfaceSwitch, /radial-gradient\(circle at 26px 8px/);
  assert.match(surfaceSwitch, /var\(--surface-(?:accent|panel|border)/);
  assert.doesNotMatch(surfaceSwitch, /#[\da-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(surfaceSwitch, /@keyframes\b|\banimation(?:-[\w]+)?\s*:/i);
});

test('profile-only menu and path headings use readable Traditional Chinese UI typography', () => {
  const profile = readSources(sourceRoot).profile;
  const uiSans = 'system-ui, "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  assert.match(profile, /\.main-menu\[data-navigation-surface="profile"\] \.menu-item-profile-home > a,[\s\S]*?min-height:\s*48px;/);
  assert.ok(profile.includes(`font-family: ${uiSans};`));
  assert.match(profile, /font-size:\s*15px;[\s\S]*?font-weight:\s*500;[\s\S]*?line-height:\s*1\.6;/);
  assert.match(profile, /\.menu-item-profile-articles > a i[\s\S]*?margin-right:\s*12px;/);
  assert.match(profile, /\.profile-page \.profile-path h2\s*\{[^}]*margin-bottom:\s*20px;[^}]*font-weight:\s*600;[^}]*line-height:\s*1\.55;/s);
  assert.match(profile, /\.profile-page \.profile-calendar-gradient[\s\S]*?var\(--surface-accent-strong\)/);
  assert.match(profile, /\.profile-page \.profile-calendar-event-label/);
  assert.match(profile, /\.profile-page \.profile-calendar-day-control:focus-visible/);
  assert.doesNotMatch(profile, /#[\da-f]{3,8}\b|rgba?\(/i);
});

test('9.1 visual files reject animation while the dedicated 9.2 transition file is allowed', () => {
  const sources = readSources(sourceRoot);
  sources.profile += '\n@keyframes reveal { from { opacity: 0; } }\n';
  assert.ok(checkSource(sources).errors.includes('visual_styles_must_not_add_animation'));
  sources.profile = sources.profile.replace(/@keyframes reveal[\s\S]*$/, '');
  sources.transition += '\n@keyframes extra { from { opacity: .9; } }';
  assert.equal(checkSource(sources).errors.includes('visual_styles_must_not_add_animation'), false);
});

test('compiled CSS output contains token scopes and component hooks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-visual-css-'));
  try {
    fs.mkdirSync(path.join(root, 'css'));
    fs.writeFileSync(path.join(root, 'css', 'main.css'), [
      ...['paper', 'base', 'panel', 'ink', 'muted', 'border', 'accent', 'accent-strong', 'focus', 'shadow']
        .map(name => `--surface-${name}: #ffffff;`),
      '.main-inner.index{}', '.main-inner.profile-page{}', '.profile-page .profile-list-link{}', '.profile-page .profile-calendar-chart{}', '.profile-page .profile-calendar-event-label{}', '.surface-switch-link{}',
      '.surface-switch--memory .surface-switch-cassette::before{}', '.surface-switch--profile .surface-switch-cassette::before{}',
      '.main-menu[data-navigation-surface="profile"] .menu-item-profile-home > a{}', '.profile-page .profile-library-count{}'
    ].join('\n'));
    assert.deepEqual(checkOutput(root), []);
    fs.writeFileSync(path.join(root, 'css', 'main.css'), '.main-inner.index{}');
    assert.ok(checkOutput(root).some(error => error === 'visual_output_token_missing_panel'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
