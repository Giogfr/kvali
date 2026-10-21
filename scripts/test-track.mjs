/**
 * Kvali — unit checks for track recording.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import {
  MIN_TRACK_POINT_DISTANCE_M,
  shouldAppendTrackPoint,
  summariseTrack,
} from '../src/lib/trackRecording.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const kutaisi = { latitude: 42.2679, longitude: 42.6946 };
const nearKutaisi = { latitude: 42.2679, longitude: 42.69461 };

check('the first fix is always kept', () => {
  assert.equal(shouldAppendTrackPoint(null, kutaisi), true);
});

check('a stationary fix is dropped as jitter', () => {
  assert.equal(shouldAppendTrackPoint(kutaisi, nearKutaisi), false);
  assert.equal(MIN_TRACK_POINT_DISTANCE_M, 3);
});

check('real movement is kept', () => {
  assert.equal(
    shouldAppendTrackPoint(kutaisi, { latitude: 42.268, longitude: 42.6947 }),
    true
  );
});

check('non-finite coordinates are rejected', () => {
  assert.equal(shouldAppendTrackPoint(kutaisi, { latitude: Number.NaN, longitude: 42.7 }), false);
});

check('distance is the sum of real segments', () => {
  const summary = summariseTrack(
    [
      [42.6946, 42.2679],
      [44.8271, 41.7151],
    ],
    60 * 60 * 1000
  );
  assert.ok(summary.distanceKm > 150, `got ${summary.distanceKm}`);
  assert.ok(summary.distanceKm < 300, `got ${summary.distanceKm}`);
  assert.equal(summary.durationMinutes, 60);
  assert.ok(Math.abs(summary.avgSpeedKmh - summary.distanceKm) < 0.2);
});

check('a track with no movement reports zero, not a floor', () => {
  assert.deepEqual(summariseTrack([[42.6946, 42.2679]], 5 * 60 * 1000), {
    distanceKm: 0,
    durationMinutes: 5,
    avgSpeedKmh: 0,
  });
});

check('a track under a minute has no invented duration', () => {
  const summary = summariseTrack(
    [
      [42.6946, 42.2679],
      [42.6956, 42.2679],
    ],
    20 * 1000
  );
  assert.equal(summary.durationMinutes, 0);
  assert.equal(summary.avgSpeedKmh, 0);
  assert.ok(summary.distanceKm > 0);
});

check('distance is rounded to centimetres, speed to one decimal', () => {
  const summary = summariseTrack(
    [
      [42.6946, 42.2679],
      [42.6966, 42.2679],
    ],
    10 * 60 * 1000
  );
  assert.equal(summary.distanceKm, Math.round(summary.distanceKm * 100) / 100);
  assert.equal(summary.avgSpeedKmh, Math.round(summary.avgSpeedKmh * 10) / 10);
});

console.log(`\n${passed} checks passed`);
