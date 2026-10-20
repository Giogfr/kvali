/**
 * Kvali — unit checks for school-zone alert windows.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { isSchoolZoneActive } from '../src/lib/alertSchedule.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

// 2026-01-05 is a Monday.
const monday = (hour, minute = 0) => new Date(2026, 0, 5, hour, minute);

check('school zones are active on weekday mornings', () => {
  assert.equal(isSchoolZoneActive(monday(7, 59)), false);
  assert.equal(isSchoolZoneActive(monday(8, 0)), true);
  assert.equal(isSchoolZoneActive(monday(12, 30)), true);
});

check('school zones close at 16:00', () => {
  assert.equal(isSchoolZoneActive(monday(15, 59)), true);
  assert.equal(isSchoolZoneActive(monday(16, 0)), false);
  assert.equal(isSchoolZoneActive(monday(18, 0)), false);
});

check('weekends never show school-zone alerts', () => {
  const saturday = new Date(2026, 0, 10, 12, 0);
  const sunday = new Date(2026, 0, 11, 12, 0);
  assert.equal(isSchoolZoneActive(saturday), false);
  assert.equal(isSchoolZoneActive(sunday), false);
});

check('every weekday follows the same window', () => {
  for (let day = 5; day <= 9; day += 1) {
    const date = new Date(2026, 0, day, 9, 0);
    assert.equal(isSchoolZoneActive(date), true, date.toDateString());
  }
});

console.log(`\n${passed} checks passed`);
