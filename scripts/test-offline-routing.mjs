/**
 * Kvali — unit checks for local graph routing.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';

const { isOfflineRoutingGraph, routeOffline } = await import('../src/lib/offlineRouting.ts');

const preferences = { avoidTolls: false, avoidHighways: false, avoidUnpaved: false };
const graph = {
  version: 1,
  modes: ['car'],
  nodes: {
    a: { latitude: 42.2679, longitude: 42.6946 },
    b: { latitude: 42.2689, longitude: 42.6946 },
    c: { latitude: 42.2699, longitude: 42.6946 },
    d: { latitude: 42.2689, longitude: 42.6956 },
  },
  edges: {
    a: [{ to: 'b', distanceMeters: 110, durationSeconds: 10, name: 'Main Road' }],
    b: [
      { to: 'c', distanceMeters: 110, durationSeconds: 10, name: 'Main Road' },
      { to: 'd', distanceMeters: 90, durationSeconds: 4, name: 'Fast Road', highway: true },
    ],
    d: [{ to: 'c', distanceMeters: 90, durationSeconds: 4, name: 'Fast Road', highway: true }],
    c: [],
  },
};

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check('validates a graph with nodes and edges', () => {
  assert.equal(isOfflineRoutingGraph(graph), true);
});

check('finds the fastest local route', () => {
  const route = routeOffline(graph, graph.nodes.a, graph.nodes.c, 'car', preferences);
  assert.equal(route?.distanceKm, 0.29);
  assert.equal(route?.steps.length, 3);
  assert.equal(route?.coordinates.length, 4);
});

check('honours avoid-highways preferences', () => {
  const route = routeOffline(graph, graph.nodes.a, graph.nodes.c, 'car', {
    ...preferences,
    avoidHighways: true,
  });
  assert.equal(route?.distanceKm, 0.22);
});

check('rejects unsupported travel modes', () => {
  assert.equal(routeOffline(graph, graph.nodes.a, graph.nodes.c, 'walking', preferences), null);
});

check('rejects points too far from the graph', () => {
  assert.equal(
    routeOffline(graph, { latitude: 41, longitude: 44 }, graph.nodes.c, 'car', preferences),
    null
  );
});

check('rejects malformed graph data', () => {
  assert.equal(isOfflineRoutingGraph({ ...graph, version: 2 }), false);
});

console.log(`\n${passed} checks passed`);
