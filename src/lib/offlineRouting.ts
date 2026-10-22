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

export interface OfflineGraphNode {
  latitude: number;
  longitude: number;
}

export interface OfflineGraphEdge {
  to: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
  instruction?: string;
  instructionKa?: string;
  maneuverType?: string;
  maneuverModifier?: string;
  toll?: boolean;
  highway?: boolean;
  unpaved?: boolean;
}

export interface OfflineRoutingGraph {
  version: 1;
  modes: TravelMode[];
  nodes: Record<string, OfflineGraphNode>;
  edges: Record<string, OfflineGraphEdge[]>;
}

const MAX_SNAP_DISTANCE_KM = 5;
const OFFLINE_GRAPH_STORAGE_KEY = 'kvali_offline_routing_graph_v1';
const MAX_BUILT_GRAPH_NODES = 25000;

interface OsmNodeElement {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OsmWayElement {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

type OsmRoadElement = OsmNodeElement | OsmWayElement;

/**
 * Reads the staged graph adapter used by the web shell.
 *
 * Production-sized graphs belong in the native offline package; keeping the
 * loader small means the planner can use an installed graph without making
 * localStorage itself part of the routing algorithm.
 */
export function loadOfflineRoutingGraph(): OfflineRoutingGraph | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_GRAPH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isOfflineRoutingGraph(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOfflineRoutingGraph(graph: OfflineRoutingGraph): boolean {
  if (!isOfflineRoutingGraph(graph)) return false;
  try {
    window.localStorage.setItem(OFFLINE_GRAPH_STORAGE_KEY, JSON.stringify(graph));
    return true;
  } catch {
    return false;
  }
}

const CAR_ROAD_TYPES = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'road',
  'track',
]);

const ROAD_SPEED_KMH: Record<string, number> = {
  motorway: 100,
  motorway_link: 60,
  trunk: 90,
  trunk_link: 55,
  primary: 70,
  primary_link: 45,
  secondary: 60,
  secondary_link: 40,
  tertiary: 45,
  tertiary_link: 35,
  unclassified: 35,
  residential: 30,
  living_street: 15,
  service: 15,
  road: 30,
  track: 12,
};

const UNPAVED_SURFACES = new Set(['unpaved', 'gravel', 'dirt', 'ground', 'sand', 'mud', 'fine_gravel']);

function osmDistanceMeters(a: OsmNodeElement, b: OsmNodeElement): number {
  return calculateDistanceKm(a.lat, a.lon, b.lat, b.lon) * 1000;
}

/** Builds a small car graph from real Overpass OSM node/way elements. */
export function buildOfflineRoutingGraph(elements: unknown): OfflineRoutingGraph | null {
  if (!Array.isArray(elements)) return null;
  const nodes = new Map<number, OsmNodeElement>();
  const ways: OsmWayElement[] = [];
  for (const element of elements as unknown[]) {
    if (!element || typeof element !== 'object') continue;
    const value = element as Partial<OsmRoadElement>;
    if (value.type === 'node' && Number.isFinite(value.id) && Number.isFinite(value.lat) && Number.isFinite(value.lon)) {
      nodes.set(value.id as number, value as OsmNodeElement);
    } else if (
      value.type === 'way' &&
      Number.isFinite(value.id) &&
      Array.isArray(value.nodes) &&
      value.nodes.length > 1
    ) {
      const tags = value.tags || {};
      if (CAR_ROAD_TYPES.has(tags.highway || '') && tags.access !== 'no' && tags.motor_vehicle !== 'no') {
        ways.push(value as OsmWayElement);
      }
    }
  }
  if (nodes.size === 0 || ways.length === 0) return null;

  const graphNodes: Record<string, OfflineGraphNode> = {};
  const edges: Record<string, OfflineGraphEdge[]> = {};
  const ensureNode = (node: OsmNodeElement) => {
    const id = String(node.id);
    if (!graphNodes[id]) {
      graphNodes[id] = { latitude: node.lat, longitude: node.lon };
      edges[id] = [];
    }
    return id;
  };

  for (const way of ways) {
    const tags = way.tags || {};
    const highway = tags.highway || 'road';
    const speedKmh = Number(tags.maxspeed?.match(/[0-9]+(?:\.[0-9]+)?/)?.[0]) || ROAD_SPEED_KMH[highway] || 30;
    const unpaved = UNPAVED_SURFACES.has(tags.surface || '') || tags.tracktype === 'grade5';
    const highwayFlag = highway.includes('motorway') || highway === 'trunk' || highway === 'primary' || highway === 'secondary';
    const addSegment = (from: OsmNodeElement, to: OsmNodeElement) => {
      const distanceMeters = osmDistanceMeters(from, to);
      if (!Number.isFinite(distanceMeters) || distanceMeters < 1) return;
      const fromId = ensureNode(from);
      const toId = ensureNode(to);
      const edge: OfflineGraphEdge = {
        to: toId,
        distanceMeters,
        durationSeconds: Math.max(1, (distanceMeters / 1000 / speedKmh) * 3600),
        name: tags.name || tags.ref || 'Road',
        highway: highwayFlag,
        unpaved,
        toll: tags.toll === 'yes',
        instruction: `Continue on ${tags.name || tags.ref || 'the mapped road'}`,
        instructionKa: `${tags.name || tags.ref || 'მონიშნულ გზაზე'}-ზე გააგრძელეთ`,
      };
      edges[fromId].push(edge);
    };
    const points = way.nodes.map((id) => nodes.get(id)).filter((node): node is OsmNodeElement => !!node);
    const oneway = tags.oneway === 'yes' || tags.oneway === '1';
    const reversed = tags.oneway === '-1';
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      if (oneway) {
        addSegment(from, to);
      } else if (reversed) {
        addSegment(to, from);
      } else {
        addSegment(from, to);
        addSegment(to, from);
      }
    }
  }

  const used = new Set<string>();
  for (const [id, list] of Object.entries(edges)) {
    if (list.length === 0) continue;
    used.add(id);
    for (const edge of list) used.add(edge.to);
  }
  if (used.size === 0 || used.size > MAX_BUILT_GRAPH_NODES) return null;
  for (const id of Object.keys(graphNodes)) {
    if (!used.has(id)) {
      delete graphNodes[id];
      delete edges[id];
    } else {
      edges[id] = (edges[id] || []).filter((edge) => used.has(edge.to));
    }
  }
  const graph: OfflineRoutingGraph = { version: 1, modes: ['car'], nodes: graphNodes, edges };
  return isOfflineRoutingGraph(graph) ? graph : null;
}

function validNode(node: unknown): node is OfflineGraphNode {
  if (!node || typeof node !== 'object') return false;
  const value = node as OfflineGraphNode;
  return Number.isFinite(value.latitude) && Number.isFinite(value.longitude);
}

function validEdge(edge: unknown, nodes: Record<string, OfflineGraphNode>): edge is OfflineGraphEdge {
  if (!edge || typeof edge !== 'object') return false;
  const value = edge as OfflineGraphEdge;
  return (
    typeof value.to === 'string' &&
    !!nodes[value.to] &&
    Number.isFinite(value.distanceMeters) &&
    value.distanceMeters >= 0 &&
    Number.isFinite(value.durationSeconds) &&
    value.durationSeconds >= 0
  );
}

export function isOfflineRoutingGraph(value: unknown): value is OfflineRoutingGraph {
  if (!value || typeof value !== 'object') return false;
  const graph = value as OfflineRoutingGraph;
  if (graph.version !== 1 || !Array.isArray(graph.modes) || graph.modes.length === 0) return false;
  if (!graph.modes.every((mode) => mode === 'car' || mode === 'walking' || mode === 'cycling')) return false;
  if (!graph.nodes || typeof graph.nodes !== 'object') return false;
  if (!Object.values(graph.nodes).every(validNode)) return false;
  if (!graph.edges || typeof graph.edges !== 'object') return false;
  return Object.entries(graph.edges).every(
    ([from, edges]) => !!graph.nodes[from] && Array.isArray(edges) && edges.every((edge) => validEdge(edge, graph.nodes))
  );
}

function nearestNode(graph: OfflineRoutingGraph, point: { latitude: number; longitude: number }): string | null {
  let bestId: string | null = null;
  let bestKm = Infinity;
  for (const [id, node] of Object.entries(graph.nodes)) {
    const distanceKm = calculateDistanceKm(point.latitude, point.longitude, node.latitude, node.longitude);
    if (distanceKm < bestKm) {
      bestKm = distanceKm;
      bestId = id;
    }
  }
  return bestKm <= MAX_SNAP_DISTANCE_KM ? bestId : null;
}

function edgeAllowed(edge: OfflineGraphEdge, preferences: RoutePreferences): boolean {
  return !(
    (preferences.avoidTolls && edge.toll) ||
    (preferences.avoidHighways && edge.highway) ||
    (preferences.avoidUnpaved && edge.unpaved)
  );
}

function shortestPath(
  graph: OfflineRoutingGraph,
  start: string,
  goal: string,
  preferences: RoutePreferences
): string[] | null {
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  const pending: { id: string; distance: number }[] = [{ id: start, distance: 0 }];

  while (pending.length > 0) {
    pending.sort((a, b) => a.distance - b.distance);
    const current = pending.shift()!;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === goal) break;

    for (const edge of graph.edges[current.id] || []) {
      if (!edgeAllowed(edge, preferences)) continue;
      const nextDistance = current.distance + edge.durationSeconds;
      if (nextDistance >= (distances.get(edge.to) ?? Infinity)) continue;
      distances.set(edge.to, nextDistance);
      previous.set(edge.to, current.id);
      pending.push({ id: edge.to, distance: nextDistance });
    }
  }

  if (!distances.has(goal)) return null;
  const path = [goal];
  while (path[0] !== start) {
    const parent = previous.get(path[0]);
    if (!parent) return null;
    path.unshift(parent);
  }
  return path;
}

function segmentRoute(
  graph: OfflineRoutingGraph,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  mode: TravelMode,
  preferences: RoutePreferences
): { path: string[]; steps: RouteStep[]; distanceMeters: number; durationSeconds: number } | null {
  if (!graph.modes.includes(mode)) return null;
  const start = nearestNode(graph, origin);
  const goal = nearestNode(graph, destination);
  if (!start || !goal) return null;
  const path = shortestPath(graph, start, goal, preferences);
  if (!path) return null;

  const steps: RouteStep[] = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const edge = (graph.edges[from] || []).find((candidate) => candidate.to === to && edgeAllowed(candidate, preferences));
    if (!edge) return null;
    const target = graph.nodes[to];
    distanceMeters += edge.distanceMeters;
    durationSeconds += edge.durationSeconds;
    steps.push({
      instruction: edge.instruction || (edge.name ? `Continue on ${edge.name}` : 'Continue on the mapped route'),
      instructionKa: edge.instructionKa || (edge.name ? `${edge.name}-ზე გააგრძელეთ` : 'გააგრძელეთ მონიშნულ მარშრუტზე'),
      name: edge.name || 'Road',
      distanceMeters: edge.distanceMeters,
      durationSeconds: edge.durationSeconds,
      maneuverType: edge.maneuverType || 'continue',
      maneuverModifier: edge.maneuverModifier,
      location: [target.longitude, target.latitude],
    });
  }
  return { path, steps, distanceMeters, durationSeconds };
}

export function routeOffline(
  graph: OfflineRoutingGraph,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  mode: TravelMode,
  preferences: RoutePreferences,
  waypoints: { latitude: number; longitude: number }[] = []
): RealRouteResult | null {
  if (!isOfflineRoutingGraph(graph)) return null;
  const points = [origin, ...waypoints, destination];
  const coordinates: [number, number][] = [];
  const steps: RouteStep[] = [];
  let distanceMeters = 0;
  let durationSeconds = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = segmentRoute(graph, points[i], points[i + 1], mode, preferences);
    if (!segment) return null;
    segment.path.forEach((nodeId, index) => {
      if (i > 0 && index === 0) return;
      const node = graph.nodes[nodeId];
      coordinates.push([node.longitude, node.latitude]);
    });
    steps.push(...segment.steps);
    distanceMeters += segment.distanceMeters;
    durationSeconds += segment.durationSeconds;
  }

  return {
    id: `offline-${mode}-${Date.now()}`,
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
