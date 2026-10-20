/**
 * Kvali — unit checks for GPX serialisation.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { trackToGpx } from '../src/lib/gpx.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const track = {
  id: 'track-1',
  title: 'Morning & evening <ride>',
  date: '2026-02-03',
  distanceKm: 12.3,
  durationMinutes: 40,
  avgSpeedKmh: 18.5,
  coordinates: [
    [42.6946, 42.2679],
    [42.7, 42.272],
  ],
};

check('a GPX 1.1 document with a creator is produced', () => {
  const xml = trackToGpx(track);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('version="1.1"'));
  assert.ok(xml.includes('creator="Kvali"'));
  assert.ok(xml.includes('xmlns="http://www.topografix.com/GPX/1/1"'));
});

check('every coordinate becomes a trkpt with lat then lon', () => {
  const xml = trackToGpx(track);
  assert.equal((xml.match(/<trkpt /g) || []).length, 2);
  assert.ok(xml.includes('<trkpt lat="42.267900" lon="42.694600"></trkpt>'));
  assert.ok(xml.includes('<trkpt lat="42.272000" lon="42.700000"></trkpt>'));
});

check('titles are XML-escaped', () => {
  const xml = trackToGpx(track);
  assert.ok(xml.includes('Morning &amp; evening &lt;ride&gt;'));
  assert.ok(!xml.includes('Morning & evening <ride>'));
});

check('the track date is kept in metadata', () => {
  const xml = trackToGpx(track);
  assert.ok(xml.includes('<time>2026-02-03T00:00:00Z</time>'));
});

check('an invalid date falls back to a real timestamp', () => {
  const xml = trackToGpx({ ...track, date: 'not-a-date' });
  assert.ok(/<time>\d{4}-\d{2}-\d{2}T/.test(xml));
  assert.ok(!xml.includes('not-a-date'));
});

check('invalid coordinates are skipped instead of written', () => {
  const xml = trackToGpx({
    ...track,
    coordinates: [
      [42.6946, 42.2679],
      [Number.NaN, 42.27],
      [42.7, 42.272],
    ],
  });
  assert.equal((xml.match(/<trkpt /g) || []).length, 2);
});

console.log(`\n${passed} checks passed`);
