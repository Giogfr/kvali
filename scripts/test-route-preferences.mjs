/**
 * Kvali — unit checks for route preference mapping.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import {
  hasActiveRoutePreferences,
  valhallaCostingOptions,
} from '../src/lib/routePreferences.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const none = { avoidTolls: false, avoidHighways: false, avoidUnpaved: false };
const all = { avoidTolls: true, avoidHighways: true, avoidUnpaved: true };

check('preferences are inactive only when every toggle is off', () => {
  assert.equal(hasActiveRoutePreferences(none), false);
  assert.equal(hasActiveRoutePreferences({ ...none, avoidTolls: true }), true);
  assert.equal(hasActiveRoutePreferences({ ...none, avoidHighways: true }), true);
  assert.equal(hasActiveRoutePreferences({ ...none, avoidUnpaved: true }), true);
});

check('the default options allow tolls, highways and tracks', () => {
  assert.deepEqual(valhallaCostingOptions('auto', none), {
    use_tolls: 1,
    use_highways: 1,
    use_tracks: 1,
  });
});

check('auto preferences map to zero-valued costs', () => {
  assert.deepEqual(valhallaCostingOptions('auto', all), {
    use_tolls: 0,
    use_highways: 0,
    use_tracks: 0,
  });
});

check('bicycle adds a bad-surface penalty for unpaved avoidance', () => {
  const options = valhallaCostingOptions('bicycle', { ...none, avoidUnpaved: true });
  assert.equal(options.use_tracks, 0);
  assert.equal(options.avoid_bad_surfaces, 1);
  assert.equal(options.use_tolls, 1);
});

check('pedestrian uses trails rather than tracks', () => {
  assert.deepEqual(valhallaCostingOptions('pedestrian', none), { use_trails: 1 });
  assert.deepEqual(valhallaCostingOptions('pedestrian', all), { use_trails: 0 });
});

console.log(`\n${passed} checks passed`);
