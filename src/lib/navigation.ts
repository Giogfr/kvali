/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Turns a raw GPS fix plus a route geometry into live navigation progress:
 * how far along the route the user is, what to do next, and whether they have
 * drifted off the route.
 */

import type { RouteAlternative } from '../types';
import type { RouteStep } from './services';

export interface NavigationProgress {
  position: { latitude: number; longitude: number };
  /** Distance covered along the route, in km. */
  traveledKm: number;
  /** Distance left to the destination, in km. */
  remainingKm: number;
  /** Estimated time left, in minutes. */
  remainingMinutes: number;
  /** The maneuver coming up next, if any. */
  nextStep: RouteStep | null;
  /** Distance to the upcoming maneuver, in metres. */
  distanceToNextStepM: number;
  /** How far the user currently is from the route line, in metres. */
  offRouteM: number;
}

const EARTH_RADIUS_KM = 6371;

function segmentLengthKm(a: [number, number], b: [number, number]): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Running distance from the start of the polyline to each vertex, in km. */
export function cumulativeDistances(coords: [number, number][]): number[] {
  const out: number[] = new Array(coords.length);
  out[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    out[i] = out[i - 1] + segmentLengthKm(coords[i - 1], coords[i]);
  }
  return out;
}

function toLocalMeters(
  lng: number,
  lat: number,
  latRef: number
): { x: number; y: number } {
  return {
    x: lng * Math.cos((latRef * Math.PI) / 180) * 111320,
    y: lat * 110540,
  };
}

interface Projection {
  alongKm: number;
  offRouteKm: number;
}

/**
 * Projects a point onto a polyline, returning distance-along and distance-away.
 * `minAlongKm` ignores earlier passes of the same line, which matters on loops
 * and out-and-back stretches where a later vertex sits next to an earlier one.
 */
export function projectOnRoute(
  coords: [number, number][],
  point: { latitude: number; longitude: number },
  cumulative?: number[],
  minAlongKm = -Infinity
): Projection {
  if (coords.length === 0) return { alongKm: 0, offRouteKm: Infinity };
  if (coords.length === 1) {
    return {
      alongKm: 0,
      offRouteKm: segmentLengthKm(coords[0], [point.longitude, point.latitude]),
    };
  }

  const cum = cumulative ?? cumulativeDistances(coords);
  const latRef = point.latitude;
  const p = toLocalMeters(point.longitude, point.latitude, latRef);

  let best = { alongKm: 0, offRouteKm: Infinity };

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const la = toLocalMeters(a[0], a[1], latRef);
    const lb = toLocalMeters(b[0], b[1], latRef);

    const dx = lb.x - la.x;
    const dy = lb.y - la.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((p.x - la.x) * dx + (p.y - la.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = la.x + dx * t;
    const projY = la.y + dy * t;
    const offM = Math.hypot(p.x - projX, p.y - projY);
    const offKm = offM / 1000;

    const segKm = cum[i] - cum[i - 1];
    const alongKm = cum[i - 1] + segKm * t;

    if (offKm < best.offRouteKm && alongKm >= minAlongKm) {
      best = { alongKm, offRouteKm: offKm };
    }
  }

  return best;
}

export interface SnappedPosition {
  longitude: number;
  latitude: number;
  bearingDegrees: number;
  offRouteM: number;
}

/**
 * Returns the closest point on the route polyline, plus the segment bearing.
 * Used to keep the vehicle marker on the drawn road instead of floating beside it.
 */
export function snapToRoute(
  coords: [number, number][],
  point: { latitude: number; longitude: number }
): SnappedPosition | null {
  if (coords.length === 0) return null;

  const latRef = point.latitude;
  const p = toLocalMeters(point.longitude, point.latitude, latRef);

  if (coords.length === 1) {
    return {
      longitude: coords[0][0],
      latitude: coords[0][1],
      bearingDegrees: 0,
      offRouteM: segmentLengthKm(coords[0], [point.longitude, point.latitude]) * 1000,
    };
  }

  let best: SnappedPosition = {
    longitude: coords[0][0],
    latitude: coords[0][1],
    bearingDegrees: 0,
    offRouteM: Infinity,
  };

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const la = toLocalMeters(a[0], a[1], latRef);
    const lb = toLocalMeters(b[0], b[1], latRef);
    const dx = lb.x - la.x;
    const dy = lb.y - la.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((p.x - la.x) * dx + (p.y - la.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = la.x + dx * t;
    const projY = la.y + dy * t;
    const offM = Math.hypot(p.x - projX, p.y - projY);

    if (offM < best.offRouteM) {
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      const bearing =
        (Math.atan2((b[0] - a[0]) * Math.cos((latRef * Math.PI) / 180), b[1] - a[1]) * 180) /
        Math.PI;
      best = {
        longitude: lng,
        latitude: lat,
        bearingDegrees: (bearing + 360) % 360,
        offRouteM: offM,
      };
    }
  }

  return best;
}

export interface SharpCurveAhead {
  distanceM: number;
  location: [number, number];
  angleDeg: number;
}

function segmentBearing(a: [number, number], b: [number, number], latRef: number): number {
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Finds the nearest sharp bend on the route ahead of the driver. Purely derived
 * from the route geometry, so it works offline and never invents road data.
 */
export function findSharpCurveAhead(
  coords: [number, number][],
  point: { latitude: number; longitude: number },
  lookaheadM = 300
): SharpCurveAhead | null {
  if (coords.length < 3) return null;

  const cumulative = cumulativeDistances(coords);
  const { alongKm } = projectOnRoute(coords, point, cumulative);
  const traveledM = alongKm * 1000;

  let best: SharpCurveAhead | null = null;

  for (let i = 1; i < coords.length - 1; i++) {
    const distanceM = cumulative[i] * 1000 - traveledM;
    if (distanceM < 10 || distanceM > lookaheadM) continue;

    const incoming = segmentBearing(coords[i - 1], coords[i], point.latitude);
    const outgoing = segmentBearing(coords[i], coords[i + 1], point.latitude);
    let turn = Math.abs(outgoing - incoming);
    if (turn > 180) turn = 360 - turn;

    if (turn >= 55 && (!best || distanceM < best.distanceM)) {
      best = { distanceM, location: coords[i], angleDeg: turn };
    }
  }

  return best;
}


export function computeProgress(
  route: RouteAlternative,
  position: { latitude: number; longitude: number }
): NavigationProgress {
  const coords = route.coordinates;
  const cumulative = cumulativeDistances(coords);
  const totalKm = cumulative[cumulative.length - 1] || route.distanceKm;

  const { alongKm, offRouteKm } = projectOnRoute(coords, position, cumulative);
  const traveledKm = Math.min(alongKm, totalKm);
  const remainingKm = Math.max(0, totalKm - traveledKm);

  const remainingMinutes =
    totalKm > 0 ? Math.max(0, (remainingKm / totalKm) * route.durationMinutes) : 0;

  const steps = route.steps ?? [];
  let nextStep: RouteStep | null = null;
  let distanceToNextStepM = 0;

  // Step 0 is the departure instruction; the interesting maneuvers start at 1.
  for (let i = 1; i < steps.length; i++) {
    const [lng, lat] = steps[i].location;
    const stepAlong = projectOnRoute(
      coords,
      { latitude: lat, longitude: lng },
      cumulative,
      traveledKm
    ).alongKm;
    const aheadM = (stepAlong - traveledKm) * 1000;

    if (aheadM > 15) {
      nextStep = steps[i];
      distanceToNextStepM = aheadM;
      break;
    }
  }

  if (!nextStep && steps.length > 0) {
    // Past the last known maneuver: point at the arrival instruction.
    nextStep = steps[steps.length - 1];
    const [lng, lat] = nextStep.location;
    const stepAlong = projectOnRoute(
      coords,
      { latitude: lat, longitude: lng },
      cumulative,
      traveledKm
    ).alongKm;
    distanceToNextStepM = Math.max(0, (stepAlong - traveledKm) * 1000);
  }

  return {
    position,
    traveledKm,
    remainingKm,
    remainingMinutes,
    nextStep,
    distanceToNextStepM,
    offRouteM: offRouteKm * 1000,
  };
}
