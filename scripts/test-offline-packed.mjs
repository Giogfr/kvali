import assert from 'node:assert/strict';
import { parsePackedRoutingGraph, routePackedOffline } from '../src/lib/offlinePackedRouting.ts';

const graph = parsePackedRoutingGraph({
  version: 2,
  country: 'GE',
  profile: 'car',
  nodes: [[41000000, 44000000], [41001000, 44000000], [41002000, 44000000]],
  offsets: [0, 1, 2, 2],
  edges: [[1, 100, 10, 0, 0], [2, 100, 10, 0, 0]],
  names: ['Test road'],
  bbox: [41, 44, 41.02, 44],
  stats: { nodes: 3, edges: 2, ways: 1 },
});

assert.ok(graph, 'valid nationwide graph should parse');
const route = routePackedOffline(graph, { latitude: 41, longitude: 44 }, { latitude: 41.02, longitude: 44 }, 'car', {
  avoidTolls: false,
  avoidHighways: false,
  avoidUnpaved: false,
});
assert.ok(route, 'packed graph should route');
assert.equal(route.coordinates.length, 3);
assert.equal(route.distanceKm, 0.2);
assert.equal(route.steps.length, 2);
assert.equal(parsePackedRoutingGraph({ ...graph, version: 1 }), null, 'wrong graph version must be rejected');
console.log('Offline packed routing tests passed');
