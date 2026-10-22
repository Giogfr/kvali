/**
 * Reader and route engine for the nationwide graph emitted by
 * scripts/build-georgia-routing-graph.py.
 */

import type { RealRouteResult, RouteStep } from './services';
import type { RoutePreferences, TravelMode } from '../types';
import { calculateDistanceKm } from './geo';

export const PACKED_GRAPH_VERSION = 2;
export const PACKED_EDGE_HIGHWAY = 1;
export const PACKED_EDGE_UNPAVED = 2;
export const PACKED_EDGE_TOLL = 4;

export interface PackedRoutingGraph {
  version: 2;
  country: 'GE';
  profile: 'car';
  nodes: [number, number][];
  offsets: number[];
  edges: [number, number, number, number, number][];
  names: string[];
  bbox: [number, number, number, number];
  stats?: { nodes: number; edges: number; ways: number };
  grid: Map<string, number[]>;
}

function isIntegerArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((item) => Number.isInteger(item));
}

function gridKey(latitude: number, longitude: number): string {
  return `${Math.floor(latitude * 10)}:${Math.floor(longitude * 10)}`;
}

function validPackedGraph(value: unknown): value is Omit<PackedRoutingGraph, 'grid'> {
  if (!value || typeof value !== 'object') return false;
  const graph = value as Partial<PackedRoutingGraph>;
  if (graph.version !== PACKED_GRAPH_VERSION || graph.country !== 'GE' || graph.profile !== 'car') return false;
  if (!Array.isArray(graph.nodes) || graph.nodes.some((node) => !isIntegerArray(node, 2))) return false;
  if (!Array.isArray(graph.offsets) || graph.offsets.length !== graph.nodes.length + 1) return false;
  if (!graph.offsets.every((offset) => Number.isInteger(offset) && offset >= 0)) return false;
  if (!Array.isArray(graph.edges) || !graph.edges.every((edge) => isIntegerArray(edge, 5))) return false;
  if (graph.offsets.at(-1) !== graph.edges.length) return false;
  if (!Array.isArray(graph.names) || !graph.names.every((name) => typeof name === 'string')) return false;
  if (!Array.isArray(graph.bbox) || graph.bbox.length !== 4 || !graph.bbox.every(Number.isFinite)) return false;
  return graph.edges.every(([target, distance, duration, flags, name]) => (
    target >= 0 && target < graph.nodes!.length && distance >= 1 && duration >= 1 && flags >= 0 && name >= 0 && name < graph.names!.length
  ));
}

export function parsePackedRoutingGraph(value: unknown): PackedRoutingGraph | null {
  if (!validPackedGraph(value)) return null;
  const graph: PackedRoutingGraph = { ...value, grid: new Map() };
  graph.nodes.forEach(([latMicro, lonMicro], index) => {
    const key = gridKey(latMicro / 1_000_000, lonMicro / 1_000_000);
    const bucket = graph.grid.get(key) || [];
    bucket.push(index);
    graph.grid.set(key, bucket);
  });
  return graph;
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
          const [latMicro, lonMicro] = graph.nodes[index];
          const distanceKm = calculateDistanceKm(point.latitude, point.longitude, latMicro / 1_000_000, lonMicro / 1_000_000);
          if (distanceKm < bestKm) {
            bestKm = distanceKm;
            best = index;
          }
        }
      }
    }
    if (best !== null && bestKm <= 5) return best;
  }
  return bestKm <= 5 ? best : null;
}

function edgeAllowed(edge: [number, number, number, number, number], preferences: RoutePreferences): boolean {
  const flags = edge[3];
  return !(
    (preferences.avoidTolls && (flags & PACKED_EDGE_TOLL) !== 0) ||
    (preferences.avoidHighways && (flags & PACKED_EDGE_HIGHWAY) !== 0) ||
    (preferences.avoidUnpaved && (flags & PACKED_EDGE_UNPAVED) !== 0)
  );
}

function shortestPath(graph: PackedRoutingGraph, start: number, goal: number, preferences: RoutePreferences): number[] | null {
  const distances = new Float64Array(graph.nodes.length);
  distances.fill(Infinity);
  const previous = new Int32Array(graph.nodes.length);
  previous.fill(-1);
  const pending: [number, number][] = [[0, start]];
  distances[start] = 0;
  while (pending.length > 0) {
    pending.sort((a, b) => a[0] - b[0]);
    const [distance, current] = pending.shift()!;
    if (distance !== distances[current]) continue;
    if (current === goal) break;
    for (let position = graph.offsets[current]; position < graph.offsets[current + 1]; position += 1) {
      const edge = graph.edges[position];
      if (!edgeAllowed(edge, preferences)) continue;
      const nextDistance = distance + edge[2];
      if (nextDistance >= distances[edge[0]]) continue;
      distances[edge[0]] = nextDistance;
      previous[edge[0]] = current;
      pending.push([nextDistance, edge[0]]);
    }
  }
  if (!Number.isFinite(distances[goal])) return null;
  const path = [goal];
  while (path[0] !== start) {
    const parent = previous[path[0]];
    if (parent < 0) return null;
    path.unshift(parent);
  }
  return path;
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
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = nearestNode(graph, points[segmentIndex]);
    const goal = nearestNode(graph, points[segmentIndex + 1]);
    if (start === null || goal === null) return null;
    const path = shortestPath(graph, start, goal, preferences);
    if (!path) return null;
    path.forEach((node, index) => {
      if (segmentIndex > 0 && index === 0) return;
      const [lat, lon] = graph.nodes[node];
      coordinates.push([lon / 1_000_000, lat / 1_000_000]);
    });
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      const edge = graph.edges.slice(graph.offsets[from], graph.offsets[from + 1]).find((candidate) => candidate[0] === to && edgeAllowed(candidate, preferences));
      if (!edge) return null;
      const [lat, lon] = graph.nodes[to];
      const name = graph.names[edge[4]] || 'Road';
      distanceMeters += edge[1];
      durationSeconds += edge[2];
      steps.push({
        instruction: `Continue on ${name}`,
        instructionKa: `${name}-ზე გააგრძელეთ`,
        name,
        distanceMeters: edge[1],
        durationSeconds: edge[2],
        maneuverType: 'continue',
        location: [lon / 1_000_000, lat / 1_000_000],
      });
    }
  }
  return {
    id: `offline-national-${Date.now()}`,
    name: 'Offline route',
    nameKa: 'ოფლაინ მარშრუტი',
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    durationMinutes: Math.ceil(durationSeconds / 60),
    coordinates,
    steps,
    via: steps.find((step) => step.name !== 'Road')?.name || 'mapped roads',
    viaKa: steps.find((step) => step.name !== 'Road')?.name || 'მონიშნული გზები',
    isRealService: false,
  };
}
