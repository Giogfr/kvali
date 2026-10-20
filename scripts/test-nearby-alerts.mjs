/**
 * Kvali — unit checks for nearby alert ordering.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { nearbyAlerts } from '../src/lib/alerts.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

function alert(id, latitude, longitude, category = 'fixed_speed_camera') {
  return {
    id,
    category,
    latitude,
    longitude,
    roadName: 'Test road',
    roadNameKa: 'სატესტო გზა',
    warningDistanceMeters: 500,
    source: 'mapped',
    lastUpdatedText: 'today',
    description: 'Test',
    descriptionKa: 'ტესტი',
  };
}

const origin = { latitude: 42, longitude: 44 };

check('alerts are ordered by real distance', () => {
  const result = nearbyAlerts(
    [
      alert('far', 42.02, 44),
      alert('near', 42.001, 44),
      alert('middle', 42.005, 44),
    ],
    origin
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ['near', 'middle', 'far']
  );
});

check('alerts beyond the radius are dropped', () => {
  const result = nearbyAlerts(
    [alert('close', 42.001, 44), alert('distant', 42.1, 44)],
    origin,
    5000
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ['close']
  );
});

check('the limit is respected', () => {
  const result = nearbyAlerts(
    [
      alert('a', 42.001, 44),
      alert('b', 42.002, 44),
      alert('c', 42.003, 44),
      alert('d', 42.004, 44),
    ],
    origin,
    5000,
    2
  );
  assert.equal(result.length, 2);
});

check('a zero limit returns nothing', () => {
  assert.deepEqual(nearbyAlerts([alert('a', 42.001, 44)], origin, 5000, 0), []);
});

check('the input array is not mutated', () => {
  const input = [alert('far', 42.02, 44), alert('near', 42.001, 44)];
  const ids = input.map((item) => item.id);
  nearbyAlerts(input, origin);
  assert.deepEqual(
    input.map((item) => item.id),
    ids
  );
});

check('distance is reported in metres', () => {
  const [result] = nearbyAlerts([alert('a', 42.001, 44)], origin);
  assert.ok(result.distanceM > 100 && result.distanceM < 120, `got ${result.distanceM}`);
});

console.log(`\n${passed} checks passed`);
