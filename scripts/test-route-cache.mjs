/**
 * Kvali — unit checks for the offline route cache.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const {
  clearSavedRoutes,
  loadSavedRoute,
  routeCacheKey,
  saveRoute,
  savedRouteCount,
} = await import('../src/lib/routeCache.ts');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const kutaisi = { latitude: 42.2679, longitude: 42.6946 };
const tbilisi = { latitude: 41.7151, longitude: 44.8271 };
const route = {
  id: 'osrm-route-0',
  coordinates: [
    [42.6946, 42.2679],
    [44.8271, 41.7151],
  ],
  distanceKm: 221.4,
  durationMinutes: 166,
};

function reset() {
  store.clear();
}

check('the same street rounds to one cache key', () => {
  const a = routeCacheKey(kutaisi, tbilisi, [], 'car');
  const b = routeCacheKey(
    { latitude: 42.26791, longitude: 42.69459 },
    { latitude: 41.71508, longitude: 44.82709 },
    [],
    'car'
  );
  assert.equal(a, b);
});

check('mode and waypoint order change the key', () => {
  const base = routeCacheKey(kutaisi, tbilisi, [], 'car');
  assert.notEqual(base, routeCacheKey(kutaisi, tbilisi, [], 'cycling'));
  assert.notEqual(base, routeCacheKey(kutaisi, tbilisi, [kutaisi], 'car'));
});

check('a saved route can be loaded again', () => {
  reset();
  saveRoute(kutaisi, tbilisi, [], 'car', [route]);
  const loaded = loadSavedRoute(kutaisi, tbilisi, [], 'car');
  assert.equal(loaded?.[0].distanceKm, 221.4);
});

check('saving the same key replaces instead of duplicating', () => {
  reset();
  saveRoute(kutaisi, tbilisi, [], 'car', [route]);
  saveRoute(kutaisi, tbilisi, [], 'car', [route]);
  assert.equal(savedRouteCount(), 1);
});

check('the cache keeps at most ten routes, newest first', () => {
  reset();
  for (let i = 0; i < 12; i++) {
    saveRoute(
      { latitude: 42 + i / 100, longitude: 42 },
      tbilisi,
      [],
      'car',
      [route]
    );
  }
  assert.equal(savedRouteCount(), 10);
  const newest = loadSavedRoute({ latitude: 42.11, longitude: 42 }, tbilisi, [], 'car');
  assert.ok(newest);
});

check('corrupt storage is treated as empty', () => {
  reset();
  store.set('kvali_saved_routes_v1', '{not json');
  assert.equal(savedRouteCount(), 0);
  assert.equal(loadSavedRoute(kutaisi, tbilisi, [], 'car'), null);
});

check('entries with bad points or modes are ignored', () => {
  reset();
  store.set(
    'kvali_saved_routes_v1',
    JSON.stringify([
      { key: 'bad', savedAt: 1, origin: { latitude: 'x' }, destination: tbilisi, waypoints: [], mode: 'car', routes: [route] },
      { key: 'bad-mode', savedAt: 1, origin: kutaisi, destination: tbilisi, waypoints: [], mode: 'boat', routes: [route] },
      { key: 'good', savedAt: 1, origin: kutaisi, destination: tbilisi, waypoints: [], mode: 'car', routes: [route] },
    ])
  );
  assert.equal(savedRouteCount(), 1);
});

check('clearing removes every cached route', () => {
  reset();
  saveRoute(kutaisi, tbilisi, [], 'car', [route]);
  clearSavedRoutes();
  assert.equal(savedRouteCount(), 0);
});

console.log(`\n${passed} checks passed`);
