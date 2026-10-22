/**
 * Kvali — unit checks for the packed nationwide routing graph.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { parsePackedRoutingGraph, routePackedOffline } from '../src/lib/offlinePackedRouting.ts';

const HEADER_BYTES = 60;

function packGraph({ nodes, edges, names, bbox, version = 3 }) {
  const geometryPointCount = edges.reduce((total, edge) => total + edge.geometry.length, 0);
  const namesBytes = new TextEncoder().encode(names.join('\0'));
  const size =
    HEADER_BYTES +
    nodes.length * 8 +
    (nodes.length + 1) * 4 +
    edges.length * 4 * 4 +
    (edges.length + 1) * 4 +
    geometryPointCount * 8 +
    edges.length +
    namesBytes.length;
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  new Uint8Array(buffer, 0, 4).set(new TextEncoder().encode('KVRG'));
  view.setUint16(4, version, true);
  view.setUint8(6, 1);
  view.setUint32(8, nodes.length, true);
  view.setUint32(12, edges.length, true);
  view.setUint32(16, names.length, true);
  view.setUint32(20, geometryPointCount, true);
  view.setFloat64(24, bbox[0], true);
  view.setFloat64(32, bbox[1], true);
  view.setFloat64(40, bbox[2], true);
  view.setFloat64(48, bbox[3], true);
  view.setUint32(56, namesBytes.length, true);

  let cursor = HEADER_BYTES;
  const writeInt32 = (values) => {
    new Int32Array(buffer, cursor, values.length).set(values);
    cursor += values.length * 4;
  };
  const writeUint32 = (values) => {
    new Uint32Array(buffer, cursor, values.length).set(values);
    cursor += values.length * 4;
  };
  const bySource = nodes.map(() => []);
  edges.forEach((edge) => bySource[edge.from].push(edge));
  const offsets = [0];
  for (const list of bySource) offsets.push(offsets[offsets.length - 1] + list.length);
  const rows = bySource.flat();
  const geometryOffsets = [0];
  for (const edge of rows) geometryOffsets.push(geometryOffsets[geometryOffsets.length - 1] + edge.geometry.length);

  writeInt32(nodes.map((node) => Math.round(node[0] * 1_000_000)));
  writeInt32(nodes.map((node) => Math.round(node[1] * 1_000_000)));
  writeUint32(offsets);
  writeUint32(rows.map((edge) => edge.to));
  writeUint32(rows.map((edge) => edge.distance));
  writeUint32(rows.map((edge) => edge.duration));
  writeUint32(rows.map((edge) => edge.name));
  writeUint32(geometryOffsets);
  writeInt32(rows.flatMap((edge) => edge.geometry.map((point) => Math.round(point[0] * 1_000_000))));
  writeInt32(rows.flatMap((edge) => edge.geometry.map((point) => Math.round(point[1] * 1_000_000))));
  new Uint8Array(buffer, cursor, rows.length).set(rows.map((edge) => edge.flags || 0));
  cursor += rows.length;
  new Uint8Array(buffer, cursor, namesBytes.length).set(namesBytes);
  return buffer;
}

const nodes = [
  [41.0, 44.0],
  [41.01, 44.0],
  [41.02, 44.0],
];
const names = ['Test road'];
const buffer = packGraph({
  nodes,
  names,
  bbox: [41, 44, 41.02, 44],
  edges: [
    { from: 0, to: 1, distance: 1112, duration: 134, name: 0, geometry: [[41.01, 44.0]] },
    { from: 1, to: 2, distance: 1112, duration: 134, name: 0, geometry: [[41.02, 44.0]] },
  ],
});

const graph = parsePackedRoutingGraph(buffer);
assert.ok(graph, 'valid nationwide graph should parse');
assert.equal(graph.nodeCount, 3);
assert.equal(graph.edgeCount, 2);

const route = routePackedOffline(
  graph,
  { latitude: 41, longitude: 44 },
  { latitude: 41.02, longitude: 44 },
  'car',
  { avoidTolls: false, avoidHighways: false, avoidUnpaved: false }
);
assert.ok(route, 'packed graph should route');
assert.equal(route.coordinates.length, 3);
assert.ok(route.distanceKm > 2 && route.distanceKm < 2.5);
assert.equal(route.steps.length, 2);
assert.equal(route.via, 'Test road');

assert.equal(parsePackedRoutingGraph(packGraph({ nodes, names, bbox: [41, 44, 41.02, 44], version: 2, edges: [] })), null);
assert.equal(parsePackedRoutingGraph(buffer.slice(0, buffer.byteLength - 1)), null, 'truncated package must be rejected');

const withToll = packGraph({
  nodes,
  names,
  bbox: [41, 44, 41.02, 44],
  edges: [
    { from: 0, to: 1, distance: 1112, duration: 134, name: 0, flags: 4, geometry: [[41.01, 44.0]] },
    { from: 1, to: 2, distance: 1112, duration: 134, name: 0, geometry: [[41.02, 44.0]] },
  ],
});
const tollGraph = parsePackedRoutingGraph(withToll);
assert.ok(tollGraph);
assert.equal(
  routePackedOffline(tollGraph, { latitude: 41, longitude: 44 }, { latitude: 41.02, longitude: 44 }, 'car', {
    avoidTolls: true,
    avoidHighways: false,
    avoidUnpaved: false,
  }),
  null,
  'avoiding tolls must skip a toll road'
);

const mergeGraph = parsePackedRoutingGraph(
  packGraph({
    nodes: [
      [41.0, 44.0],
      [41.01, 44.0],
      [41.02, 44.0],
      [41.03, 44.0],
    ],
    names: ['Long road'],
    bbox: [41, 44, 41.03, 44],
    edges: [
      { from: 0, to: 1, distance: 1112, duration: 134, name: 0, geometry: [[41.01, 44.0]] },
      { from: 1, to: 2, distance: 1112, duration: 134, name: 0, geometry: [[41.02, 44.0]] },
      { from: 2, to: 3, distance: 1112, duration: 134, name: 0, geometry: [[41.03, 44.0]] },
    ],
  })
);
assert.ok(mergeGraph);
const mergeRoute = routePackedOffline(
  mergeGraph,
  { latitude: 41.0, longitude: 44.0 },
  { latitude: 41.03, longitude: 44.0 },
  'car',
  { avoidTolls: false, avoidHighways: false, avoidUnpaved: false }
);
assert.ok(mergeRoute);
assert.equal(mergeRoute.steps.length, 2, 'continuing on the same road should merge steps');
assert.equal(mergeRoute.steps[1].distanceMeters, 2224, 'merged step should cover both following edges');

const turnGraph = parsePackedRoutingGraph(
  packGraph({
    nodes: [
      [41.0, 44.0],
      [41.0, 44.01],
      [41.01, 44.01],
    ],
    names: ['East road', 'North road'],
    bbox: [41, 44, 41.01, 44.01],
    edges: [
      { from: 0, to: 1, distance: 839, duration: 100, name: 0, geometry: [[41.0, 44.01]] },
      { from: 1, to: 2, distance: 1112, duration: 134, name: 1, geometry: [[41.01, 44.01]] },
    ],
  })
);
assert.ok(turnGraph);
const turnRoute = routePackedOffline(
  turnGraph,
  { latitude: 41.0, longitude: 44.0 },
  { latitude: 41.01, longitude: 44.01 },
  'car',
  { avoidTolls: false, avoidHighways: false, avoidUnpaved: false }
);
assert.ok(turnRoute, 'turn graph should route');
assert.match(turnRoute.steps[0].instruction, /^Head on East road$/, 'first instruction should be a departure');
assert.match(turnRoute.steps[1].instruction, /^Turn left onto North road$/, 'east-to-north should turn left');
assert.match(turnRoute.steps[1].instructionKa, /მოუხვიეთ მარცხნივ/, 'Georgian turn instruction should match');

console.log('Offline packed routing tests passed');
