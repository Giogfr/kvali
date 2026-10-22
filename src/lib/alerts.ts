/**
 * Kvali — ordering of nearby road alerts for the driving HUD.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import { calculateDistanceKm } from './geo';
import type { RoadAlert } from '../types';

export interface NearbyAlert extends RoadAlert {
  distanceM: number;
}

/** Keeps permanent map data and only currently valid temporary reports. */
export function activeAlerts(alerts: RoadAlert[], now = Date.now()): RoadAlert[] {
  return alerts.filter((alert) => !Number.isFinite(alert.expiresAt) || (alert.expiresAt as number) > now);
}

/**
 * Returns the closest alerts to a position, up to `limit`, ignoring anything
 * farther than `maxM`. The input array is not mutated.
 */
export function nearbyAlerts(
  alerts: RoadAlert[],
  position: { latitude: number; longitude: number },
  maxM = 5000,
  limit = 3
): NearbyAlert[] {
  if (limit <= 0) return [];

  return alerts
    .map((alert) => ({
      ...alert,
      distanceM:
        calculateDistanceKm(
          position.latitude,
          position.longitude,
          alert.latitude,
          alert.longitude
        ) * 1000,
    }))
    .filter((alert) => alert.distanceM <= maxM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}
