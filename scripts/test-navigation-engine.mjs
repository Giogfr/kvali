/**
 * Unit checks for the pure navigation engine. Run with: node scripts/test-navigation-engine.mjs
 */

/**
 * Kvali — unit checks for the navigation engine.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { OffRouteDetector, resolveBearing } from '../src/lib/navigationEngine.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('stays quiet when inside the urban threshold', () => {
  const d = new OffRouteDetector();
  assert.equal(d.update(20, 40, 0).reroute, false);
  assert.equal(d.update(49, 40, 5000).reroute, false);
});

check('debounces a deviation for three seconds', () => {
  const d = new OffRouteDetector();
  assert.equal(d.update(80, 40, 1000).reroute, false);
  assert.equal(d.update(80, 40, 3000).reroute, false);
  assert.equal(d.update(80, 40, 4001).reroute, true);
});

check('honours the reroute cooldown', () => {
  const d = new OffRouteDetector();
  d.update(80, 40, 0);
  assert.equal(d.update(80, 40, 4000).reroute, true);
  assert.equal(d.update(80, 40, 5000).reroute, false);
  assert.equal(d.update(80, 40, 18000).reroute, false);
  assert.equal(d.update(80, 40, 19001).reroute, true);
});

check('raises the threshold at highway speed', () => {
  const d = new OffRouteDetector();
  assert.equal(d.update(100, 100, 0).thresholdM, 150);
  assert.equal(d.update(100, 100, 5000).reroute, false);
  const highway = new OffRouteDetector();
  highway.update(170, 100, 0);
  assert.equal(highway.update(170, 100, 3001).reroute, true);
});

check('clears pending state when reset', () => {
  const d = new OffRouteDetector();
  d.update(80, 40, 0);
  d.reset();
  assert.equal(d.update(80, 40, 10000).reroute, false);
});

check('resolves the three rotation modes', () => {
  assert.equal(resolveBearing('north', 120, 200), 0);
  assert.equal(resolveBearing('direction', 120, 200), 120);
  assert.equal(resolveBearing('compass', 120, 200), 200);
  assert.equal(resolveBearing('direction', null), 0);
});

console.log(`\n${passed}/6 checks passed`);
