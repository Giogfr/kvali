/**
 * Kvali — location value normalisation.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedKmh: number | null;
  headingDegrees: number | null;
  timestamp: number;
}

export interface RawLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number | null;
}

function finiteOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : value;
}

/**
 * Converts the platform payload (degrees, metres, metres per second) into the
 * app's units. Coordinates are kept at six decimals, about 0.1 m, which is
 * finer than any consumer-grade GPS fix.
 */
export function normaliseLocation(raw: RawLocation, fallbackTime: number): LocationResult {
  const accuracy = finiteOrNull(raw.accuracy);
  const speed = finiteOrNull(raw.speed);
  const heading = finiteOrNull(raw.heading);

  return {
    latitude: parseFloat(raw.latitude.toFixed(6)),
    longitude: parseFloat(raw.longitude.toFixed(6)),
    accuracyMeters: accuracy === null ? null : Math.round(accuracy),
    speedKmh: speed === null ? null : Math.round(speed * 3.6),
    headingDegrees: heading,
    timestamp: raw.timestamp ?? fallbackTime,
  };
}
