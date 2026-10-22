/**
 * Kvali — validates a real published nationwide routing package.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parsePackedRoutingGraph, routePackedOffline } from '../src/lib/offlinePackedRouting.ts';

const artifact = process.argv[2];
if (!artifact) {
  console.error('Usage: bun scripts/test-nationwide-graph.mjs <graph.kvr.gz>');
  process.exit(2);
}

const raw = gunzipSync(readFileSync(artifact));
const graph = parsePackedRoutingGraph(
  raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
);
assert.ok(graph, 'nationwide graph must pass validation');
assert.ok(graph.nodeCount > 100_000, 'graph must contain country-scale road coverage');
assert.ok(graph.edgeCount > 200_000, 'graph must contain country-scale routing edges');
assert.ok(graph.names.length > 1_000, 'graph must retain real road names');

const route = routePackedOffline(
  graph,
  { latitude: 41.7151, longitude: 44.8271 },
  { latitude: 41.6168, longitude: 41.6367 },
  'car',
  { avoidTolls: false, avoidHighways: false, avoidUnpaved: false }
);
assert.ok(route, 'Tbilisi-to-Batumi route must be available');
assert.ok(route.distanceKm > 300 && route.distanceKm < 500, 'long-distance route must be plausible');
console.log(
  JSON.stringify({
    nodes: graph.nodeCount,
    edges: graph.edgeCount,
    names: graph.names.length,
    distanceKm: route.distanceKm,
  })
);
