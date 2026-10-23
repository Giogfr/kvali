/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { searchOfflineIndex } from '../src/lib/offlineSearch.ts';

const index = {
  entries: [
    ['Tbilisi', 'Tbilisi', 'city', 41.6934, 44.8015, 100],
    ['Batumi', 'Batumi', 'city', 41.6423, 41.6398, 100],
    ['Rustaveli Avenue', 'Rustaveli Avenue', 'primary', 41.6985, 44.7992, 26],
    ['Rustaveli 14', '', 'address', 41.7002, 44.7939, 8],
    ['SPAR', 'SPAR', 'supermarket', 41.6997, 44.8011, 26],
    ['SPAR', 'SPAR', 'supermarket', 41.6412, 41.6362, 26],
    ['Ibis Tbilisi Airport', 'Ibis Tbilisi Airport', 'hotel', 41.6777, 44.9545, 26],
    ['Tbilisi International Airport', 'Tbilisi International Airport', 'aerodrome', 41.6692, 44.9547, 40],
    ['\u10e0\u10e3\u10e1\u10d7\u10d0\u10d5\u10d4\u10da\u10d8', 'Rustaveli', 'primary', 41.7006, 44.7906, 26],
  ],
};

const tbilisi = searchOfflineIndex(index, 'tbilisi');
assert.equal(tbilisi[0]?.name, 'Tbilisi');
assert.equal(tbilisi[0]?.category, 'city');

assert.equal(searchOfflineIndex(index, 't')[0], undefined, 'one character should not search');
assert.equal(searchOfflineIndex(index, 'tb')[0]?.name, 'Tbilisi');
assert.equal(
  searchOfflineIndex(index, 'tbilisi airport')[0]?.category,
  'aerodrome',
  'an airport should outrank a hotel named after it'
);
assert.ok(
  searchOfflineIndex(index, 'supermarket').some((row) => row.name === 'SPAR'),
  'the kind should be searchable'
);

const rustaveli = searchOfflineIndex(index, 'rustaveli');
assert.equal(rustaveli[0]?.category, 'primary', 'street should outrank an address');
assert.ok(rustaveli.some((row) => row.name === 'Rustaveli Avenue'));
assert.ok(rustaveli.some((row) => row.name === 'Rustaveli 14'));

const address = searchOfflineIndex(index, 'rustaveli, 14');
assert.equal(address[0]?.name, 'Rustaveli 14');
assert.equal(address.length, 1);

const nearBatumi = searchOfflineIndex(index, 'spar', { latitude: 41.64, longitude: 41.63 });
assert.equal(nearBatumi[0]?.latitude, 41.6412);

const georgian = searchOfflineIndex(index, '\u10e0\u10e3\u10e1\u10d7\u10d0\u10d5\u10d4\u10da\u10d8', undefined, 'ka');
assert.equal(georgian[0]?.name, '\u10e0\u10e3\u10e1\u10d7\u10d0\u10d5\u10d4\u10da\u10d8');
assert.equal(georgian[0]?.displayName, 'Rustaveli');

const english = searchOfflineIndex(index, 'rustaveli', undefined, 'en');
assert.ok(english.some((row) => row.name === 'Rustaveli Avenue'));

assert.equal(searchOfflineIndex(index, 'a', undefined, 'en', 2).length, 0);
assert.equal(searchOfflineIndex(index, 's', undefined, 'en', 2).length, 0);
assert.equal(searchOfflineIndex(index, 'sp', undefined, 'en', 1).length, 1);

console.log('Offline search tests passed');
