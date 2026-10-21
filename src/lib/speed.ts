/**
 * Kvali — speed limits.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import type { UnitSystem } from '../types';

/** Drivers get a small margin before the sign turns red. */
export const OVERSPEED_TOLERANCE_KMH = 5;

export function speedForDisplay(speedKmh: number, units: UnitSystem): number {
  return Math.round(units === 'imperial' ? speedKmh * 0.621371 : speedKmh);
}

export function speedLimitForDisplay(
  limitKmh: number | null,
  units: UnitSystem
): number | null {
  if (limitKmh === null || !Number.isFinite(limitKmh)) return null;
  return speedForDisplay(limitKmh, units);
}

/** How close a mapped limit has to be before the HUD treats it as relevant. */
export const SPEED_LIMIT_SCOPE_M = 300;

/**
 * Limits come from mapped alerts, not from the road graph, so a sign 2 km away
 * must not be shown as if it applied to the road under the wheels.
 */
export function limitInScope(
  limitKmh: number | null | undefined,
  distanceM: number,
  maxM = SPEED_LIMIT_SCOPE_M
): number | null {
  if (limitKmh === null || limitKmh === undefined) return null;
  if (!Number.isFinite(limitKmh) || limitKmh <= 0) return null;
  if (!Number.isFinite(distanceM) || distanceM > maxM) return null;
  return limitKmh;
}

/**
 * Compares in km/h so the tolerance does not change with the display units.
 * A missing limit is never treated as unlimited; it simply cannot be exceeded.
 */
export function isOverspeeding(
  speedKmh: number | null,
  limitKmh: number | null,
  toleranceKmh = OVERSPEED_TOLERANCE_KMH
): boolean {
  if (speedKmh === null || limitKmh === null) return false;
  if (!Number.isFinite(speedKmh) || !Number.isFinite(limitKmh)) return false;
  return speedKmh > limitKmh + toleranceKmh;
}
