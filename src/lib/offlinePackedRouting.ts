/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import type { RealRouteResult, RouteStep } from './services';
import type { RoutePreferences, TravelMode } from '../types';
import { calculateDistanceKm } from './geo';

export const PACKED_GRAPH_VERSION = 3;
export const PACKED_EDGE_HIGHWAY = 1;
export const PACKED_EDGE_UNPAVED = 2;
export const PACKED_EDGE_TOLL = 4;

const MAGIC = 'KVRG';
const HEADER_BYTES = 60;
const PROFILE_CAR = 1;
const MAX_SNAP_DISTANCE_KM = 5;

export interface PackedRoutingGraph {
  version: 3;
  country: 'GE';
  profile: 'car';
  nodeCount: number;
  edgeCount: number;
  nodeLat: Int32Array;
  nodeLon: Int32Array;
  offsets: Uint32Array;
  targets: Uint32Array;
  distances: Uint32Array;
  durations: Uint32Array;
  nameIndexes: Uint32Array;
  geometryOffsets: Uint32Array;
  geometryLat: Int32Array;
  geometryLon: Int32Array;
  flags: Uint8Array;
  names: string[];
  bbox: [number, number, number, number];
  grid: Map<string, number[]>;
}

function gridKey(latitude: number, longitude: number): string {
  return `${Math.floor(latitude * 10)}:${Math.floor(longitude * 10)}`;
}

/** Reads the binary KVRG v3 package produced by the routing graph builder. */
export function parsePackedRoutingGraph(buffer: ArrayBuffer): PackedRoutingGraph | null {
  try {
    if (buffer.byteLength < HEADER_BYTES) return null;
    const header = new DataView(buffer, 0, HEADER_BYTES);
    const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
    if (magic !== MAGIC) return null;
    const version = header.getUint16(4, true);
    const profile = header.getUint8(6);
    if (version !== PACKED_GRAPH_VERSION || profile !== PROFILE_CAR) return null;

    const nodeCount = header.getUint32(8, true);
    const edgeCount = header.getUint32(12, true);
    const nameCount = header.getUint32(16, true);
    const geometryPointCount = header.getUint32(20, true);
    const bbox: [number, number, number, number] = [
      header.getFloat64(24, true),
      header.getFloat64(32, true),
      header.getFloat64(40, true),
      header.getFloat64(48, true),
    ];
    const namesByteLength = header.getUint32(56, true);
    if (nodeCount === 0 || edgeCount === 0 || nameCount === 0 || geometryPointCount === 0) return null;

    const expected =
      HEADER_BYTES +
      nodeCount * 8 +
      (nodeCount + 1) * 4 +
      edgeCount * 4 * 4 +
      (edgeCount + 1) * 4 +
      geometryPointCount * 8 +
      edgeCount +
      namesByteLength;
    if (buffer.byteLength !== expected) return null;

    let cursor = HEADER_BYTES;
    const take = (bytes: number): number => {
      const start = cursor;
      cursor += bytes;
      return start;
    };

    const nodeLat = new Int32Array(buffer, take(nodeCount * 4), nodeCount);
    const nodeLon = new Int32Array(buffer, take(nodeCount * 4), nodeCount);
    const offsets = new Uint32Array(buffer, take((nodeCount + 1) * 4), nodeCount + 1);
    const targets = new Uint32Array(buffer, take(edgeCount * 4), edgeCount);
    const distances = new Uint32Array(buffer, take(edgeCount * 4), edgeCount);
    const durations = new Uint32Array(buffer, take(edgeCount * 4), edgeCount);
    const nameIndexes = new Uint32Array(buffer, take(edgeCount * 4), edgeCount);
    const geometryOffsets = new Uint32Array(buffer, take((edgeCount + 1) * 4), edgeCount + 1);
    const geometryLat = new Int32Array(buffer, take(geometryPointCount * 4), geometryPointCount);
    const geometryLon = new Int32Array(buffer, take(geometryPointCount * 4), geometryPointCount);
    const flags = new Uint8Array(buffer, take(edgeCount), edgeCount);
    const names = new TextDecoder().decode(new Uint8Array(buffer, cursor, namesByteLength)).split('\0');

    if (names.length !== nameCount) return null;
    if (offsets[0] !== 0 || offsets[nodeCount] !== edgeCount) return null;
    if (geometryOffsets[0] !== 0 || geometryOffsets[edgeCount] !== geometryPointCount) return null;

    for (let index = 0; index < nodeCount; index += 1) {
      if (offsets[index] > offsets[index + 1]) return null;
    }
    for (let index = 0; index < edgeCount; index += 1) {
      if (
        targets[index] >= nodeCount ||
        distances[index] < 1 ||
        durations[index] < 1 ||
        nameIndexes[index] >= nameCount ||
        (flags[index] & ~(PACKED_EDGE_HIGHWAY | PACKED_EDGE_UNPAVED | PACKED_EDGE_TOLL)) !== 0 ||
        geometryOffsets[index] >= geometryOffsets[index + 1]
      ) {
        return null;
      }
    }
    if (bbox.some((value) => !Number.isFinite(value))) return null;

    const grid = new Map<string, number[]>();
    for (let index = 0; index < nodeCount; index += 1) {
      const key = gridKey(nodeLat[index] / 1_000_000, nodeLon[index] / 1_000_000);
      const bucket = grid.get(key);
      if (bucket) bucket.push(index);
      else grid.set(key, [index]);
    }

    return {
      version: 3,
      country: 'GE',
      profile: 'car',
      nodeCount,
      edgeCount,
      nodeLat,
      nodeLon,
      offsets,
      targets,
      distances,
      durations,
      nameIndexes,
      geometryOffsets,
      geometryLat,
      geometryLon,
      flags,
      names,
      bbox,
      grid,
    };
  } catch {
    return null;
  }
}

function nearestNode(graph: PackedRoutingGraph, point: { latitude: number; longitude: number }): number | null {
  const centerLat = Math.floor(point.latitude * 10);
  const centerLon = Math.floor(point.longitude * 10);
  let best: number | null = null;
  let bestKm = Infinity;
  // A cell is about 11 km tall. Two rings cover the 5 km snap limit even at
  // the eastern/western edge of Georgia.
  for (let radius = 0; radius <= 1; radius += 1) {
    for (let lat = centerLat - radius; lat <= centerLat + radius; lat += 1) {
      for (let lon = centerLon - radius; lon <= centerLon + radius; lon += 1) {
        for (const index of graph.grid.get(`${lat}:${lon}`) || []) {
          const distanceKm = calculateDistanceKm(
            point.latitude,
            point.longitude,
            graph.nodeLat[index] / 1_000_000,
            graph.nodeLon[index] / 1_000_000
          );
          if (distanceKm < bestKm) {
            bestKm = distanceKm;
            best = index;
          }
        }
      }
    }
    if (best !== null && bestKm <= MAX_SNAP_DISTANCE_KM) return best;
  }
  return bestKm <= MAX_SNAP_DISTANCE_KM ? best : null;
}

function edgeAllowed(graph: PackedRoutingGraph, edge: number, preferences: RoutePreferences): boolean {
  const flags = graph.flags[edge];
  return !(
    (preferences.avoidTolls && (flags & PACKED_EDGE_TOLL) !== 0) ||
    (preferences.avoidHighways && (flags & PACKED_EDGE_HIGHWAY) !== 0) ||
    (preferences.avoidUnpaved && (flags & PACKED_EDGE_UNPAVED) !== 0)
  );
}

/**
 * Dijkstra over travel time. The heap and the visited arrays are typed or
 * numeric so a country-sized graph does not allocate per-node objects.
 */
function shortestPath(
  graph: PackedRoutingGraph,
  start: number,
  goal: number,
  preferences: RoutePreferences
): { nodes: number[]; edges: number[] } | null {
  const distances = new Float64Array(graph.nodeCount);
  distances.fill(Infinity);
  const previousNode = new Int32Array(graph.nodeCount);
  previousNode.fill(-1);
  const previousEdge = new Int32Array(graph.nodeCount);
  previousEdge.fill(-1);

  const heapDistance: number[] = [];
  const heapNode: number[] = [];
  const push = (distance: number, node: number) => {
    let child = heapDistance.length;
    heapDistance.push(distance);
    heapNode.push(node);
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (heapDistance[parent] <= heapDistance[child]) break;
      [heapDistance[parent], heapDistance[child]] = [heapDistance[child], heapDistance[parent]];
      [heapNode[parent], heapNode[child]] = [heapNode[child], heapNode[parent]];
      child = parent;
    }
  };
  const pop = (): boolean => {
    if (heapDistance.length === 0) return false;
    const lastDistance = heapDistance.pop()!;
    const lastNode = heapNode.pop()!;
    if (heapDistance.length === 0) return true;
    heapDistance[0] = lastDistance;
    heapNode[0] = lastNode;
    let parent = 0;
    const length = heapDistance.length;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < length && heapDistance[left] < heapDistance[smallest]) smallest = left;
      if (right < length && heapDistance[right] < heapDistance[smallest]) smallest = right;
      if (smallest === parent) break;
      [heapDistance[parent], heapDistance[smallest]] = [heapDistance[smallest], heapDistance[parent]];
      [heapNode[parent], heapNode[smallest]] = [heapNode[smallest], heapNode[parent]];
      parent = smallest;
    }
    return true;
  };

  distances[start] = 0;
  push(0, start);
  while (heapDistance.length > 0) {
    const distance = heapDistance[0];
    const current = heapNode[0];
    pop();
    if (distance !== distances[current]) continue;
    if (current === goal) break;
    const end = graph.offsets[current + 1];
    for (let edge = graph.offsets[current]; edge < end; edge += 1) {
      if (!edgeAllowed(graph, edge, preferences)) continue;
      const next = graph.targets[edge];
      const nextDistance = distance + graph.durations[edge];
      if (nextDistance >= distances[next]) continue;
      distances[next] = nextDistance;
      previousNode[next] = current;
      previousEdge[next] = edge;
      push(nextDistance, next);
    }
  }

  if (!Number.isFinite(distances[goal])) return null;
  const nodes = [goal];
  const edges: number[] = [];
  let current = goal;
  while (current !== start) {
    const edge = previousEdge[current];
    const parent = previousNode[current];
    if (edge < 0 || parent < 0) return null;
    edges.push(edge);
    nodes.push(parent);
    current = parent;
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges };
}

export function routePackedOffline(
  graph: PackedRoutingGraph,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  mode: TravelMode,
  preferences: RoutePreferences,
  waypoints: { latitude: number; longitude: number }[] = []
): RealRouteResult | null {
  if (mode !== 'car') return null;
  const points = [origin, ...waypoints, destination];
  const coordinates: [number, number][] = [];
  const steps: RouteStep[] = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  let longestName = '';
  let longestDistance = 0;

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = nearestNode(graph, points[segmentIndex]);
    const goal = nearestNode(graph, points[segmentIndex + 1]);
    if (start === null || goal === null) return null;
    const path = shortestPath(graph, start, goal, preferences);
    if (!path) return null;

    if (coordinates.length === 0) {
      coordinates.push([graph.nodeLon[start] / 1_000_000, graph.nodeLat[start] / 1_000_000]);
    }
    for (const edge of path.edges) {
      for (let point = graph.geometryOffsets[edge]; point < graph.geometryOffsets[edge + 1]; point += 1) {
        coordinates.push([
          graph.geometryLon[point] / 1_000_000,
          graph.geometryLat[point] / 1_000_000,
        ]);
      }
      const name = graph.names[graph.nameIndexes[edge]] || 'Road';
      const distance = graph.distances[edge];
      const duration = graph.durations[edge];
      distanceMeters += distance;
      durationSeconds += duration;
      if (distance > longestDistance && name !== 'Road') {
        longestDistance = distance;
        longestName = name;
      }
      const target = graph.targets[edge];
      steps.push({
        instruction: `Continue on ${name}`,
        instructionKa: `${name}-ზე გააგრძელეთ`,
        name,
        distanceMeters: distance,
        durationSeconds: duration,
        maneuverType: 'continue',
        location: [graph.nodeLon[target] / 1_000_000, graph.nodeLat[target] / 1_000_000],
      });
    }
  }

  if (coordinates.length < 2) return null;
  return {
    id: `offline-national-${Date.now()}`,
    name: 'Offline route',
    nameKa: 'ოფლაინ მარშრუტი',
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    durationMinutes: Math.ceil(durationSeconds / 60),
    coordinates,
    steps,
    via: longestName || 'mapped roads',
    viaKa: longestName || 'მონიშნული გზები',
    isRealService: false,
  };
}
