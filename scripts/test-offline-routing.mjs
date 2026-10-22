/**
 * Kvali — unit checks for local graph routing.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';

const { buildOfflineRoutingGraph, isOfflineRoutingGraph, routeOffline } = await import('../src/lib/offlineRouting.ts');

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

check('builds a routable graph from real OSM road elements', () => {
  const built = buildOfflineRoutingGraph([
    { type: 'node', id: 1, lat: 42.2679, lon: 42.6946 },
    { type: 'node', id: 2, lat: 42.2689, lon: 42.6946 },
    { type: 'node', id: 3, lat: 42.2699, lon: 42.6946 },
    {
      type: 'way',
      id: 10,
      nodes: [1, 2, 3],
      tags: { highway: 'residential', name: 'Test Road' },
    },
  ]);
  assert.ok(built);
  assert.equal(built.modes[0], 'car');
  assert.equal(isOfflineRoutingGraph(built), true);
  const route = routeOffline(built, built.nodes['1'], built.nodes['3'], 'car', preferences);
  assert.ok(route);
  assert.equal(route.steps[0].name, 'Test Road');
});

const onewayElements = (value) => [
  { type: 'node', id: 1, lat: 42.2679, lon: 42.6946 },
  { type: 'node', id: 2, lat: 42.2689, lon: 42.6946 },
  { type: 'node', id: 3, lat: 42.2699, lon: 42.6946 },
  {
    type: 'way',
    id: 20,
    nodes: [1, 2, 3],
    tags: { highway: 'residential', name: 'One Way', oneway: value },
  },
];

check('one-way roads only route with the way direction', () => {
  const built = buildOfflineRoutingGraph(onewayElements('yes'));
  assert.ok(built);
  assert.ok(isOfflineRoutingGraph(built));
  assert.ok(routeOffline(built, built.nodes['1'], built.nodes['3'], 'car', preferences));
  assert.equal(routeOffline(built, built.nodes['3'], built.nodes['1'], 'car', preferences), null);
});

check('reversed one-way roads only route against the way direction', () => {
  const built = buildOfflineRoutingGraph(onewayElements('-1'));
  assert.ok(built);
  assert.ok(isOfflineRoutingGraph(built));
  assert.ok(routeOffline(built, built.nodes['3'], built.nodes['1'], 'car', preferences));
  assert.equal(routeOffline(built, built.nodes['1'], built.nodes['3'], 'car', preferences), null);
});

console.log(`\n${passed} checks passed`);
