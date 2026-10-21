/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Stores routes that were calculated while online so navigation keeps working
 * in offline mode. Only real routes returned by the routing services are
 * stored; nothing here is generated locally.
 */

import type { RealRouteResult } from './services';
import type { RoutePreferences } from '../types';

export type TravelModeKey = 'car' | 'walking' | 'cycling';

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface SavedRoute {
  key: string;
  savedAt: number;
  origin: LatLng;
  destination: LatLng;
  waypoints: LatLng[];
  mode: TravelModeKey;
  routes: RealRouteResult[];
}

const STORAGE_KEY = 'kvali_saved_routes_v1';
const MAX_ENTRIES = 10;
// ~110 metres at Georgian latitudes: close enough that the saved route still
// starts on the same street, while surviving normal GPS drift.
const COORD_PRECISION = 3;
const MODES: TravelModeKey[] = ['car', 'walking', 'cycling'];

function isPoint(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const point = value as LatLng;
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function isSavedRoute(value: unknown): value is SavedRoute {
  if (!value || typeof value !== 'object') return false;
  const entry = value as SavedRoute;
  return (
    typeof entry.key === 'string' &&
    Number.isFinite(entry.savedAt) &&
    isPoint(entry.origin) &&
    isPoint(entry.destination) &&
    Array.isArray(entry.waypoints) &&
    entry.waypoints.every(isPoint) &&
    MODES.includes(entry.mode) &&
    Array.isArray(entry.routes) &&
    entry.routes.length > 0 &&
    entry.routes.every(
      (route) =>
        !!route &&
        Array.isArray(route.coordinates) &&
        route.coordinates.length > 1 &&
        Number.isFinite(route.distanceKm) &&
        Number.isFinite(route.durationMinutes)
    )
  );
}


function rounded(value: number): number {
  return Number(value.toFixed(COORD_PRECISION));
}

function pointKey(point: LatLng): string {
  return `${rounded(point.latitude)},${rounded(point.longitude)}`;
}

function preferenceKey(preferences?: RoutePreferences): string {
  if (!preferences) return 'default';
  return [
    preferences.avoidTolls ? 1 : 0,
    preferences.avoidHighways ? 1 : 0,
    preferences.avoidUnpaved ? 1 : 0,
  ].join('');
}

export function routeCacheKey(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  mode: TravelModeKey,
  preferences?: RoutePreferences
): string {
  return [
    mode,
    preferenceKey(preferences),
    pointKey(origin),
    ...waypoints.map(pointKey),
    pointKey(destination),
  ].join('|');
}

function readAll(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedRoute);
  } catch {
    return [];
  }
}

function writeAll(entries: SavedRoute[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage is full: keep the newest few routes rather than failing silently.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 3)));
    } catch {
      /* routing still works, it just will not be available offline */
    }
  }
}

export function loadSavedRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  mode: TravelModeKey,
  preferences?: RoutePreferences
): RealRouteResult[] | null {
  const key = routeCacheKey(origin, destination, waypoints, mode, preferences);
  const entry = readAll().find((item) => item.key === key);
  return entry ? entry.routes : null;
}

export function saveRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  mode: TravelModeKey,
  routes: RealRouteResult[],
  preferences?: RoutePreferences
): void {
  if (routes.length === 0) return;
  const key = routeCacheKey(origin, destination, waypoints, mode, preferences);
  const entries = readAll().filter((entry) => entry.key !== key);
  entries.unshift({
    key,
    savedAt: Date.now(),
    origin,
    destination,
    waypoints,
    mode,
    routes,
  });
  writeAll(entries);
}

export function clearSavedRoutes(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function savedRouteCount(): number {
  return readAll().length;
}
