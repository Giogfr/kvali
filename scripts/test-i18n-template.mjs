/**
 * Kvali — unit checks for translation placeholders.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { fillTemplate } from '../src/lib/i18n.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('a placeholder is replaced with its value', () => {
  assert.equal(fillTemplate('Imported {count} tracks', { count: 3 }), 'Imported 3 tracks');
});

check('every occurrence is replaced', () => {
  assert.equal(fillTemplate('{name} to {name}', { name: 'Kutaisi' }), 'Kutaisi to Kutaisi');
});

check('unknown placeholders stay visible', () => {
  assert.equal(fillTemplate('Hello {name}', {}), 'Hello {name}');
  assert.equal(fillTemplate('Hello {name}', { other: 1 }), 'Hello {name}');
});

check('zero and empty values are still substituted', () => {
  assert.equal(fillTemplate('skipped {skipped}', { skipped: 0 }), 'skipped 0');
  assert.equal(fillTemplate('[{name}]', { name: '' }), '[]');
});

console.log(`\n${passed} checks passed`);
