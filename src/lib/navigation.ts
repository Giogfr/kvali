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

/** Projects a point onto a polyline, returning distance-along and distance-away. */
export function projectOnRoute(
  coords: [number, number][],
  point: { latitude: number; longitude: number },
  cumulative?: number[]
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

    if (offKm < best.offRouteKm) {
      const segKm = cum[i] - cum[i - 1];
      best = { alongKm: cum[i - 1] + segKm * t, offRouteKm: offKm };
    }
  }

  return best;
}

/**
 * Works out the next maneuver by seeing where each step's location falls along
 * the route and picking the first one that is still ahead of the user.
 */
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
    const stepAlong = projectOnRoute(coords, { latitude: lat, longitude: lng }, cumulative).alongKm;
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
    const stepAlong = projectOnRoute(coords, { latitude: lat, longitude: lng }, cumulative).alongKm;
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
