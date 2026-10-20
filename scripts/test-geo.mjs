/**
 * Kvali — unit checks for distance and unit formatting.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { calculateDistanceKm, formatDistance, formatSpeed } from '../src/lib/geo.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('identical points have zero distance', () => {
  assert.equal(calculateDistanceKm(42.2679, 42.6946, 42.2679, 42.6946), 0);
});

check('one degree of latitude is about 111 km', () => {
  const km = calculateDistanceKm(42, 42, 43, 42);
  assert.ok(km > 110 && km < 112, `got ${km}`);
});

check('Tbilisi to Kutaisi is about 220 km', () => {
  const km = calculateDistanceKm(41.7151, 44.8271, 42.2679, 42.6946);
  assert.ok(km > 180 && km < 240, `got ${km}`);
});

check('metric distance switches from metres to kilometres', () => {
  assert.equal(formatDistance(0.5, 'metric'), '500 m');
  assert.equal(formatDistance(0.999, 'metric'), '999 m');
  assert.equal(formatDistance(1.234, 'metric'), '1.2 km');
});

check('imperial distance switches from feet to miles', () => {
  assert.equal(formatDistance(0.05, 'imperial'), '164 ft');
  assert.equal(formatDistance(1, 'imperial'), '0.6 mi');
  assert.equal(formatDistance(5, 'imperial'), '3.1 mi');
});

check('speed rounds to whole units', () => {
  assert.equal(formatSpeed(49.6, 'metric'), '50 km/h');
  assert.equal(formatSpeed(49.6, 'imperial'), '31 mph');
  assert.equal(formatSpeed(0, 'metric'), '0 km/h');
});

console.log(`\n${passed}/6 checks passed`);
