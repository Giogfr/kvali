/**
 * Kvali — unit checks for cached offline collections.
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
  key: (index) => [...store.keys()][index] || null,
  get length() {
    return store.size;
  },
};

const { readCache, readCachedValues, writeCache } = await import('../src/lib/offlineCache.ts');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('reads one cached collection', () => {
  store.clear();
  writeCache('poi:42.27,42.69', [{ id: 'one' }]);
  assert.deepEqual(readCache('poi:42.27,42.69', 1000), [{ id: 'one' }]);
});

check('collects cached collections under one prefix', () => {
  store.clear();
  writeCache('poi:one', [{ id: 'one' }, { id: 'shared' }]);
  writeCache('poi:two', [{ id: 'two' }, { id: 'shared' }]);
  assert.deepEqual(readCachedValues('poi:', 1000), [
    { id: 'one' },
    { id: 'shared' },
    { id: 'two' },
    { id: 'shared' },
  ]);
});

check('ignores expired collections', () => {
  store.clear();
  store.set(
    'kvali_offline_cache_poi:old',
    JSON.stringify({ savedAt: Date.now() - 5000, data: [{ id: 'old' }] })
  );
  assert.deepEqual(readCachedValues('poi:', 1000), []);
});

check('ignores malformed collections without losing valid ones', () => {
  store.clear();
  store.set('kvali_offline_cache_poi:bad', '{broken');
  writeCache('poi:good', [{ id: 'good' }]);
  assert.deepEqual(readCachedValues('poi:', 1000), [{ id: 'good' }]);
});

console.log(`\n${passed} checks passed`);
