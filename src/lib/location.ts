/**
 * Location access that works both in the browser and inside the Android app.
 *
 * On Android we go through the Capacitor Geolocation plugin, which talks to the
 * platform LocationManager directly. In a normal browser we fall back to the
 * standard navigator.geolocation API so the web build keeps working.
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedKmh: number | null;
  headingDegrees: number | null;
  timestamp: number;
}

export type LocationErrorKind = 'denied' | 'unavailable';

export class LocationError extends Error {
  kind: LocationErrorKind;

  constructor(kind: LocationErrorKind, message: string) {
    super(message);
    this.name = 'LocationError';
    this.kind = kind;
  }
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

function toResult(
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  },
  timestamp: number
): LocationResult {
  return {
    latitude: parseFloat(coords.latitude.toFixed(6)),
    longitude: parseFloat(coords.longitude.toFixed(6)),
    accuracyMeters: coords.accuracy === null ? null : Math.round(coords.accuracy),
    speedKmh: coords.speed === null ? null : Math.round(coords.speed * 3.6),
    headingDegrees: coords.heading,
    timestamp,
  };
}

export async function ensureLocationPermission(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  const status = await Geolocation.checkPermissions();
  if (status.location === 'granted') return true;
  if (status.location === 'denied') return false;
  const requested = await Geolocation.requestPermissions();
  return requested.location === 'granted';
}

export async function getCurrentLocation(): Promise<LocationResult> {
  if (isNativePlatform()) {
    const granted = await ensureLocationPermission();
    if (!granted) {
      throw new LocationError('denied', 'Location permission was denied');
    }
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
      return toResult(pos.coords, pos.timestamp);
    } catch (err) {
      throw new LocationError('unavailable', err instanceof Error ? err.message : 'Location unavailable');
    }
  }

  if (!navigator.geolocation) {
    throw new LocationError('unavailable', 'Geolocation is not supported by this browser');
  }

  return new Promise<LocationResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toResult(pos.coords, pos.timestamp)),
      (err) =>
        reject(
          new LocationError(
            err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
            err.message
          )
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

/**
 * Starts streaming location updates. Returns a function that stops the stream.
 */
export async function watchLocation(
  onUpdate: (location: LocationResult) => void,
  onError: (error: LocationError) => void
): Promise<() => void> {
  if (isNativePlatform()) {
    const granted = await ensureLocationPermission();
    if (!granted) {
      onError(new LocationError('denied', 'Location permission was denied'));
      return () => {};
    }

    let watchId: string | null = null;
    try {
      watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 5000 },
        (pos, err) => {
          if (err) {
            onError(new LocationError('unavailable', err.message));
            return;
          }
          if (pos) onUpdate(toResult(pos.coords, pos.timestamp));
        }
      );
    } catch (err) {
      onError(new LocationError('unavailable', err instanceof Error ? err.message : 'Location unavailable'));
      return () => {};
    }

    return () => {
      if (watchId !== null) Geolocation.clearWatch({ id: watchId });
    };
  }

  if (!navigator.geolocation) {
    onError(new LocationError('unavailable', 'Geolocation is not supported by this browser'));
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate(toResult(pos.coords, pos.timestamp)),
    (err) =>
      onError(new LocationError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', err.message)),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );

  return () => navigator.geolocation.clearWatch(id);
}
