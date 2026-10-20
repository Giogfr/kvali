/**
 * Kvali — unit checks for Georgian address normalization.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import {
  extractPostcodes,
  findCity,
  normalizeAddress,
  normalizeGeorgianText,
} from '../src/lib/georgianAddress.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('Mtavruli is converted to Mkhedruli', () => {
  assert.equal(normalizeGeorgianText('ᲥᲣᲗᲐᲘᲡᲘ'), 'ქუთაისი');
  assert.equal(normalizeGeorgianText('ᲗᲑᲘᲚᲘᲡᲘ, ᲠᲣᲡᲗᲐᲕᲔᲚᲘᲡ ᲥᲐᲚᲐᲥᲘ'), 'თბილისი, რუსთაველის ქალაქი');
});

check('whitespace and quotes are normalized', () => {
  assert.equal(normalizeGeorgianText('  ქუთაისი\u00a0  “ცენტრი”  '), 'ქუთაისი "ცენტრი"');
  assert.equal(normalizeGeorgianText('თბილისი — რუსთავი'), 'თბილისი - რუსთავი');
});

check('four-digit postcodes are extracted once', () => {
  assert.deepEqual(extractPostcodes('0105, თბილისი 0105'), ['0105']);
  assert.deepEqual(extractPostcodes('ქ. ქუთაისი 4600'), ['4600']);
  assert.deepEqual(extractPostcodes('0012 test'), []);
  assert.deepEqual(extractPostcodes('12345'), []);
});

check('cities are found in Georgian and English', () => {
  assert.equal(findCity('ქუთაისი, ცენტრი')?.en, 'Kutaisi');
  assert.equal(findCity('Tbilisi, Rustaveli Avenue')?.en, 'Tbilisi');
  assert.equal(findCity('TBILISI')?.en, 'Tbilisi');
  assert.equal(findCity('უცნობი ადგილი'), null);
});

check('a city that disagrees with the coordinates is flagged', () => {
  const result = normalizeAddress({
    text: 'თბილისი, რუსთაველის გამზირი',
    latitude: 42.2679,
    longitude: 42.6946,
  });
  assert.equal(result.city, 'Tbilisi');
  assert.equal(result.coordinateMismatch, true);
});

check('matching coordinates are not flagged', () => {
  const result = normalizeAddress({
    text: 'ქუთაისი, ცენტრი',
    latitude: 42.2679,
    longitude: 42.6946,
  });
  assert.equal(result.city, 'Kutaisi');
  assert.equal(result.coordinateMismatch, false);
});

check('missing coordinates never cause a mismatch', () => {
  const result = normalizeAddress({ text: 'ბათუმი, ბულვარი' });
  assert.equal(result.city, 'Batumi');
  assert.equal(result.coordinateMismatch, false);
});

console.log(`\n${passed} checks passed`);
