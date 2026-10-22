/**
 * Kvali — unit checks for translation parity.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { TRANSLATIONS } from '../src/lib/translations.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const en = TRANSLATIONS.en;
const ka = TRANSLATIONS.ka;

check('English and Georgian expose the same keys', () => {
  const missingInKa = Object.keys(en).filter((key) => !(key in ka));
  const missingInEn = Object.keys(ka).filter((key) => !(key in en));
  assert.deepEqual(missingInKa, [], `missing in ka: ${missingInKa.join(', ')}`);
  assert.deepEqual(missingInEn, [], `missing in en: ${missingInEn.join(', ')}`);
});

check('no translation is empty', () => {
  for (const language of ['en', 'ka']) {
    for (const [key, value] of Object.entries(TRANSLATIONS[language])) {
      assert.equal(typeof value, 'string', `${language}.${key} is not a string`);
      assert.ok(value.trim().length > 0, `${language}.${key} is empty`);
    }
  }
});

check('the dictionary still covers the whole interface', () => {
  assert.ok(Object.keys(en).length >= 200, `only ${Object.keys(en).length} keys`);
});

check('no Georgian string is left in English', () => {
  const identicalAllowed = new Set([
    'km',
    'mi',
    'Kvali',
    'GPS',
    'OSM',
    'OSRM',
    'OpenStreetMap',
    'English',
    'Android Auto',
    '3D',
    '2D',
  ]);
  const untranslated = Object.keys(en).filter(
    (key) => en[key] === ka[key] && !identicalAllowed.has(en[key])
  );
  assert.deepEqual(untranslated, [], `untranslated: ${untranslated.join(', ')}`);
});

console.log(`\n${passed} checks passed`);
