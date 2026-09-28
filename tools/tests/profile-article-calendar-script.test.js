'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const calendar = require('../../themes/next/source/js/profile-article-calendar');

const source = fs.readFileSync(path.resolve(__dirname, '../../themes/next/source/js/profile-article-calendar.js'), 'utf8');

test('profile calendar date helpers select the latest key and normalize ECharts click shapes', () => {
  assert.equal(calendar.latestDate({ '2026-02-01': [], '2026-09-27': [] }, '2026'), '2026-09-27');
  assert.equal(calendar.latestDate({ '2025-12-31': [] }, '2026'), '');
  assert.equal(calendar.countFor({ '2026-09-27': 2 }, '2026-09-27'), 2);
  assert.equal(calendar.countFor({ '2026-09-27': 'bad' }, '2026-09-27'), 0);
  assert.equal(calendar.normalizeDate(['2026-09-27', 2]), '2026-09-27');
  assert.equal(calendar.normalizeDate({ value: ['2026-07-01', 1] }), '2026-07-01');
  assert.equal(calendar.normalizeDate('not-a-date'), '');
});

test('initializer consumes embedded profile data, uses local Calendar, and reboots cleanly after PJAX', () => {
  assert.match(source, /data-profile-calendar-data/);
  assert.match(source, /global\.Calendar\?\.init/);
  assert.match(source, /visualMap:\s*\{\s*show:\s*false\s*\}/);
  assert.match(source, /global\.document\.addEventListener\('pjax:send', disposeAll\)/);
  assert.match(source, /global\.document\.addEventListener\('pjax:success', boot\)/);
  assert.match(source, /global\.addEventListener\('pagehide', disposeAll\)/);
  assert.match(source, /global\.addEventListener\('pageshow', boot\)/);
  assert.match(source, /instances\.has\(root\)/);
  assert.match(source, /\.dispose\?\./);
  assert.doesNotMatch(source, /fetch\s*\(|calendar-posts\.json|calendar\.json/);
});
