/**
 * Kvali — route preference mapping.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import type { RoutePreferences } from '../types';

export type ValhallaCosting = 'auto' | 'bicycle' | 'pedestrian';

export function hasActiveRoutePreferences(preferences: RoutePreferences): boolean {
  return preferences.avoidTolls || preferences.avoidHighways || preferences.avoidUnpaved;
}

/**
 * Maps the app's three preferences onto Valhalla costing options. Valhalla is
 * used for preference-aware routes because the public OSRM profile does not
 * accept exclusions. Values are 1 (allow) or 0 (avoid).
 */
export function valhallaCostingOptions(
  costing: ValhallaCosting,
  preferences: RoutePreferences
): Record<string, number> {
  const useTolls = preferences.avoidTolls ? 0 : 1;
  const useHighways = preferences.avoidHighways ? 0 : 1;
  const useTracks = preferences.avoidUnpaved ? 0 : 1;

  if (costing === 'auto') {
    return { use_tolls: useTolls, use_highways: useHighways, use_tracks: useTracks };
  }

  if (costing === 'bicycle') {
    return {
      use_tolls: useTolls,
      use_highways: useHighways,
      use_tracks: useTracks,
      avoid_bad_surfaces: preferences.avoidUnpaved ? 1 : 0,
    };
  }

  return { use_trails: useTracks };
}
