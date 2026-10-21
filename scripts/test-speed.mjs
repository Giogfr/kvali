/**
 * Kvali — unit checks for speed display and over-speed detection.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import {
  OVERSPEED_TOLERANCE_KMH,
  isOverspeeding,
  speedForDisplay,
  speedLimitForDisplay,
  limitInScope,
  SPEED_LIMIT_SCOPE_M,
} from '../src/lib/speed.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('metric speeds are rounded kilometres per hour', () => {
  assert.equal(speedForDisplay(49.6, 'metric'), 50);
});

check('imperial speeds are rounded miles per hour', () => {
  assert.equal(speedForDisplay(80, 'imperial'), 50);
});

check('a missing limit stays missing', () => {
  assert.equal(speedLimitForDisplay(null, 'metric'), null);
  assert.equal(speedLimitForDisplay(Number.NaN, 'imperial'), null);
});

check('the limit uses the same units as the speedometer', () => {
  assert.equal(speedLimitForDisplay(50, 'imperial'), 31);
});

check('the tolerance is five km/h', () => {
  assert.equal(OVERSPEED_TOLERANCE_KMH, 5);
  assert.equal(isOverspeeding(54, 50), false);
  assert.equal(isOverspeeding(55, 50), false);
  assert.equal(isOverspeeding(56, 50), true);
});

check('a missing speed or limit cannot be over the limit', () => {
  assert.equal(isOverspeeding(null, 50), false);
  assert.equal(isOverspeeding(80, null), false);
});

check('the tolerance does not shrink in imperial mode', () => {
  // 60 mph is 96.5 km/h, well over a 50 km/h limit even though 60 > 50 only
  // by ten display units.
  assert.equal(isOverspeeding(96.5, 50), true);
  assert.equal(isOverspeeding(84, 80), false);
});

check('a limit only counts while its sign is close', () => {
  assert.equal(SPEED_LIMIT_SCOPE_M, 300);
  assert.equal(limitInScope(60, 120), 60);
  assert.equal(limitInScope(60, 300), 60);
  assert.equal(limitInScope(60, 301), null);
  assert.equal(limitInScope(undefined, 10), null);
  assert.equal(limitInScope(0, 10), null);
  assert.equal(limitInScope(60, Number.NaN), null);
});

console.log(`\n${passed} checks passed`);
