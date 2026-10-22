import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parsePackedRoutingGraph, routePackedOffline } from '../src/lib/offlinePackedRouting.ts';

const artifact = process.argv[2];
if (!artifact) {
  console.error('Usage: bun scripts/test-nationwide-graph.mjs <graph.json.gz>');
  process.exit(2);
}

const graph = parsePackedRoutingGraph(JSON.parse(gunzipSync(readFileSync(artifact)).toString('utf8')));
assert.ok(graph, 'nationwide graph must pass validation');
assert.ok(graph.nodes.length > 1_000_000, 'graph must contain country-scale road coverage');
assert.ok(graph.edges.length > 2_000_000, 'graph must contain country-scale routing edges');

const route = routePackedOffline(
  graph,
  { latitude: 41.7151, longitude: 44.8271 },
  { latitude: 41.6168, longitude: 41.6367 },
  'car',
  { avoidTolls: false, avoidHighways: false, avoidUnpaved: false },
);
assert.ok(route, 'Tbilisi-to-Batumi route must be available');
assert.ok(route.distanceKm > 300 && route.distanceKm < 500, 'long-distance route must be plausible');
console.log(JSON.stringify({ nodes: graph.nodes.length, edges: graph.edges.length, distanceKm: route.distanceKm }));
