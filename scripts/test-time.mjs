/**
 * Kvali — unit checks for time and ETA formatting.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { etaFromNow, formatClockTime, formatDurationMinutes } from '../src/lib/time.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('clock time is zero-padded 24-hour local time', () => {
  assert.equal(formatClockTime(new Date(2026, 0, 1, 9, 5)), '09:05');
  assert.equal(formatClockTime(new Date(2026, 0, 1, 23, 59)), '23:59');
  assert.equal(formatClockTime(new Date(2026, 0, 1, 0, 0)), '00:00');
});

check('ETA adds the remaining minutes to the supplied clock', () => {
  const now = new Date(2026, 0, 1, 10, 30);
  assert.equal(etaFromNow(45, now).getTime(), new Date(2026, 0, 1, 11, 15).getTime());
  assert.equal(etaFromNow(0, now).getTime(), now.getTime());
});

check('negative and invalid ETAs clamp to now', () => {
  const now = new Date(2026, 0, 1, 10, 30);
  assert.equal(etaFromNow(-10, now).getTime(), now.getTime());
  assert.equal(etaFromNow(Number.NaN, now).getTime(), now.getTime());
});

check('durations under an hour use minutes', () => {
  assert.equal(formatDurationMinutes(0), '0 min');
  assert.equal(formatDurationMinutes(45.4), '45 min');
  assert.equal(formatDurationMinutes(59), '59 min');
});

check('whole hours drop the minute part', () => {
  assert.equal(formatDurationMinutes(60), '1 h');
  assert.equal(formatDurationMinutes(120), '2 h');
  assert.equal(formatDurationMinutes(180), '3 h');
});

check('mixed durations show hours and minutes', () => {
  assert.equal(formatDurationMinutes(75), '1 h 15 min');
  assert.equal(formatDurationMinutes(135), '2 h 15 min');
  assert.equal(formatDurationMinutes(75.6), '1 h 16 min');
  assert.equal(formatDurationMinutes(-5), '0 min');
});

console.log(`\n${passed} checks passed`);
