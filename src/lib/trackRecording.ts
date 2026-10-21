/**
 * Kvali — recorded track maths.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import { calculateDistanceKm } from './geo';

/** A fix closer than this to the previous one is GPS jitter, not movement. */
export const MIN_TRACK_POINT_DISTANCE_M = 3;

export interface TrackSummary {
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
}

export function shouldAppendTrackPoint(
  previous: { latitude: number; longitude: number } | null,
  next: { latitude: number; longitude: number },
  minMeters = MIN_TRACK_POINT_DISTANCE_M
): boolean {
  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return false;
  if (!previous) return true;
  const metres =
    calculateDistanceKm(
      previous.latitude,
      previous.longitude,
      next.latitude,
      next.longitude
    ) * 1000;
  return metres >= minMeters;
}

/**
 * Sums real segments only. There is no minimum distance or duration floor:
 * a track that did not move reports zero instead of a made-up number.
 */
export function summariseTrack(
  points: [number, number][],
  elapsedMs: number
): TrackSummary {
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    const [lon1, lat1] = points[i - 1];
    const [lon2, lat2] = points[i];
    distanceKm += calculateDistanceKm(lat1, lon1, lat2, lon2);
  }

  const durationMinutes = Math.max(0, Math.round(elapsedMs / 60000));
  const avgSpeedKmh =
    durationMinutes > 0 ? distanceKm / (durationMinutes / 60) : 0;

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes,
    avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
  };
}
