/**
 * Kvali — navigation engine.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 *
 * The off-route detector follows the behaviour of established navigation
 * engines: a wider threshold at highway speed, a short debounce so a single
 * bad GPS fix cannot trigger a reroute, and a cooldown between reroutes. It is
 * deliberately independent of React so it can be tested in isolation.
 */

export interface OffRouteConfig {
  /** Allowed deviation in a built-up area, in metres. */
  urbanThresholdM: number;
  /** Allowed deviation at highway speed, in metres. */
  highwayThresholdM: number;
  /** Speed above which the highway threshold applies, in km/h. */
  highwaySpeedKmh: number;
  /** How long the deviation must persist before rerouting, in milliseconds. */
  debounceMs: number;
  /** Minimum time between two reroutes, in milliseconds. */
  cooldownMs: number;
}

export const DEFAULT_OFF_ROUTE_CONFIG: OffRouteConfig = {
  urbanThresholdM: 50,
  highwayThresholdM: 150,
  highwaySpeedKmh: 80,
  debounceMs: 3000,
  cooldownMs: 15000,
};

export interface OffRouteDecision {
  /** True when the caller should recalculate the route now. */
  reroute: boolean;
  /** The threshold that applies at the current speed. */
  thresholdM: number;
  /** How long the driver has been outside the threshold, in milliseconds. */
  offRouteForMs: number;
}

export class OffRouteDetector {
  private readonly config: OffRouteConfig;
  private offRouteSince: number | null = null;
  private lastRerouteAt = Number.NEGATIVE_INFINITY;

  constructor(config: Partial<OffRouteConfig> = {}) {
    this.config = { ...DEFAULT_OFF_ROUTE_CONFIG, ...config };
  }

  /**
   * Feed one GPS update. Returns whether a reroute is due, without performing
   * any I/O. Calling it repeatedly with the same deviation does not re-trigger
   * until the cooldown has elapsed.
   */
  update(offRouteM: number, speedKmh: number, now: number = Date.now()): OffRouteDecision {
    const thresholdM =
      speedKmh > this.config.highwaySpeedKmh
        ? this.config.highwayThresholdM
        : this.config.urbanThresholdM;

    if (!Number.isFinite(offRouteM) || offRouteM < thresholdM) {
      this.offRouteSince = null;
      return { reroute: false, thresholdM, offRouteForMs: 0 };
    }

    if (this.offRouteSince === null) {
      this.offRouteSince = now;
      return { reroute: false, thresholdM, offRouteForMs: 0 };
    }

    const offRouteForMs = now - this.offRouteSince;
    if (offRouteForMs < this.config.debounceMs) {
      return { reroute: false, thresholdM, offRouteForMs };
    }

    if (now - this.lastRerouteAt < this.config.cooldownMs) {
      return { reroute: false, thresholdM, offRouteForMs };
    }

    this.lastRerouteAt = now;
    this.offRouteSince = now;
    return { reroute: true, thresholdM, offRouteForMs };
  }

  /** Clears pending state, e.g. when navigation starts or ends. */
  reset(): void {
    this.offRouteSince = null;
    this.lastRerouteAt = Number.NEGATIVE_INFINITY;
  }
}

/**
 * Resolves the camera bearing for the three supported rotation modes:
 * - `north`: the map never rotates;
 * - `direction`: the map follows the direction of travel;
 * - `compass`: the map follows the device compass (falls back to travel).
 */
export function resolveBearing(
  mode: 'north' | 'direction' | 'compass',
  headingDegrees: number | null | undefined,
  compassDegrees?: number | null
): number {
  if (mode === 'north') return 0;
  const source = mode === 'compass' ? compassDegrees ?? headingDegrees : headingDegrees;
  return typeof source === 'number' && Number.isFinite(source) ? source : 0;
}
