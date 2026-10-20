/**
 * Kvali — unit checks for route geometry and progress.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import {
  computeProgress,
  cumulativeDistances,
  findSharpCurveAhead,
  projectOnRoute,
  snapToRoute,
} from '../src/lib/navigation.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const straight = [
  [44.0, 42.0],
  [44.1, 42.0],
  [44.2, 42.0],
];

check('cumulative distances start at zero and grow', () => {
  const distances = cumulativeDistances(straight);
  assert.equal(distances.length, 3);
  assert.equal(distances[0], 0);
  assert.ok(distances[1] > 8 && distances[1] < 9, `got ${distances[1]}`);
  assert.ok(distances[2] > 16 && distances[2] < 17, `got ${distances[2]}`);
});

check('a point on the line has almost no offset', () => {
  const projection = projectOnRoute(straight, { latitude: 42, longitude: 44.05 });
  assert.ok(projection.offRouteKm < 0.001, `off ${projection.offRouteKm}`);
  assert.ok(projection.alongKm > 4 && projection.alongKm < 4.5, `along ${projection.alongKm}`);
});

check('an offset point reports its real distance from the route', () => {
  const projection = projectOnRoute(straight, { latitude: 42.01, longitude: 44.05 });
  assert.ok(projection.offRouteKm > 1 && projection.offRouteKm < 1.2, `off ${projection.offRouteKm}`);
});

check('snapping returns the closest line point and travel bearing', () => {
  const snapped = snapToRoute(straight, { latitude: 42.001, longitude: 44.15 });
  assert.ok(snapped);
  assert.ok(Math.abs(snapped.longitude - 44.15) < 0.001);
  assert.ok(Math.abs(snapped.latitude - 42) < 0.001);
  assert.ok(Math.abs(snapped.bearingDegrees - 90) < 1, `bearing ${snapped.bearingDegrees}`);
});

check('progress reports remaining distance and the next maneuver', () => {
  const route = {
    id: 'test',
    name: 'Test',
    distanceKm: 16.5,
    durationMinutes: 20,
    via: 'Test road',
    coordinates: straight,
    steps: [
      {
        instruction: 'Depart',
        name: 'A',
        distanceMeters: 0,
        durationSeconds: 0,
        maneuverType: 'depart',
        location: [44.0, 42.0],
      },
      {
        instruction: 'Turn',
        name: 'B',
        distanceMeters: 8200,
        durationSeconds: 600,
        maneuverType: 'turn',
        maneuverModifier: 'left',
        location: [44.1, 42.0],
      },
      {
        instruction: 'Arrive',
        name: 'C',
        distanceMeters: 8200,
        durationSeconds: 600,
        maneuverType: 'arrive',
        location: [44.2, 42.0],
      },
    ],
  };

  const atStart = computeProgress(route, { latitude: 42, longitude: 44.0 });
  assert.ok(atStart.remainingKm > 16 && atStart.remainingKm < 17);
  assert.equal(atStart.nextStep?.instruction, 'Turn');
  assert.ok(atStart.distanceToNextStepM > 8000 && atStart.distanceToNextStepM < 8300);

  const halfWay = computeProgress(route, { latitude: 42, longitude: 44.1 });
  assert.ok(halfWay.traveledKm > 8 && halfWay.traveledKm < 8.5);
  assert.equal(halfWay.nextStep?.instruction, 'Arrive');
});

check('a sharp bend is detected within the lookahead', () => {
  const turn = [
    [44.0, 42.0],
    [44.002, 42.0],
    [44.002, 42.0015],
  ];
  const curve = findSharpCurveAhead(turn, { latitude: 42, longitude: 44.0 });
  assert.ok(curve);
  assert.ok(curve.angleDeg > 80 && curve.angleDeg < 100, `angle ${curve.angleDeg}`);
  assert.ok(curve.distanceM > 130 && curve.distanceM < 200, `distance ${curve.distanceM}`);
});

check('a straight road has no sharp bend', () => {
  assert.equal(findSharpCurveAhead(straight, { latitude: 42, longitude: 44.0 }), null);
});

console.log(`\n${passed} checks passed`);
