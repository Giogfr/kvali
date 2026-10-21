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
