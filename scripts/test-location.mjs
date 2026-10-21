/**
 * Kvali — unit checks for location normalisation.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { normaliseLocation } from '../src/lib/locationMath.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const raw = {
  latitude: 42.26791234,
  longitude: 42.69461234,
  accuracy: 12.6,
  speed: 13.89,
  heading: 271.4,
  timestamp: 1767225600000,
};

check('metres per second become rounded kilometres per hour', () => {
  assert.equal(normaliseLocation(raw, 0).speedKmh, 50);
});

check('accuracy is rounded to whole metres', () => {
  assert.equal(normaliseLocation(raw, 0).accuracyMeters, 13);
});

check('coordinates are kept to six decimals', () => {
  const result = normaliseLocation(raw, 0);
  assert.equal(result.latitude, 42.267912);
  assert.equal(result.longitude, 42.694612);
});

check('heading is passed through unchanged', () => {
  assert.equal(normaliseLocation(raw, 0).headingDegrees, 271.4);
});

check('a missing timestamp falls back to the supplied clock', () => {
  assert.equal(normaliseLocation({ ...raw, timestamp: null }, 1234).timestamp, 1234);
  assert.equal(normaliseLocation(raw, 0).timestamp, 1767225600000);
});

check('NaN speed, heading and accuracy become null', () => {
  const result = normaliseLocation(
    { ...raw, speed: Number.NaN, heading: Number.NaN, accuracy: Number.NaN },
    0
  );
  assert.equal(result.speedKmh, null);
  assert.equal(result.headingDegrees, null);
  assert.equal(result.accuracyMeters, null);
});

check('zero speed stays zero rather than becoming null', () => {
  assert.equal(normaliseLocation({ ...raw, speed: 0 }, 0).speedKmh, 0);
});

console.log(`\n${passed} checks passed`);
