/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Location access that works both in the browser and inside the Android app.
 *
 * On Android we go through the Capacitor Geolocation plugin, which talks to the
 * platform LocationManager directly. In a normal browser we fall back to the
 * standard navigator.geolocation API so the web build keeps working.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type {
  BackgroundGeolocationPlugin,
  Location as BackgroundLocation,
} from '@capacitor-community/background-geolocation';
import { normaliseLocation, type LocationResult } from './locationMath';

export type { LocationResult } from './locationMath';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

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

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Opens the app's system settings page. Android is the only platform Kvali
 * ships for, so other platforms are a no-op.
 */
export async function openAppSettings(): Promise<void> {
  if (!isAndroid()) return;
  await BackgroundGeolocation.openSettings();
}

function fromBackgroundLocation(location: BackgroundLocation): LocationResult {
  return normaliseLocation(
    {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.bearing,
      timestamp: location.time,
    },
    Date.now()
  );
}

interface CoordsLike {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
}

/**
 * Browsers expose coordinates on the prototype of GeolocationCoordinates, so
 * spreading `pos.coords` yields an empty object. Read the fields explicitly.
 */
function fromCoords(coords: CoordsLike, timestamp: number | null): LocationResult {
  return normaliseLocation(
    {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      timestamp,
    },
    Date.now()
  );
}

export async function ensureLocationPermission(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  const status = await Geolocation.checkPermissions();
  if (status.location === 'granted') return true;
  // Ask again even after a denial: the user may have re-enabled it in settings
  // and Android will simply answer immediately when it is permanently denied.
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
      return fromCoords(pos.coords, pos.timestamp);
    } catch (err) {
      throw new LocationError('unavailable', err instanceof Error ? err.message : 'Location unavailable');
    }
  }

  if (!navigator.geolocation) {
    throw new LocationError('unavailable', 'Geolocation is not supported by this browser');
  }

  return new Promise<LocationResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromCoords(pos.coords, pos.timestamp)),
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

    // Chrome pauses WebView geolocation when the app is backgrounded. The
    // Android foreground service below keeps delivering fixes with the screen
    // off or another app in front, which turn-by-turn navigation needs.
    if (isAndroid()) {
      try {
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundTitle: 'Kvali navigation',
            backgroundMessage: 'Kvali is using your location for navigation.',
            requestPermissions: true,
            stale: false,
            distanceFilter: 5,
          },
          (position, error) => {
            if (error) {
              onError(
                new LocationError(
                  error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable',
                  error.message
                )
              );
              return;
            }
            if (position) onUpdate(fromBackgroundLocation(position));
          }
        );

        return () => {
          void BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
        };
      } catch {
        // Plugin unavailable: keep the foreground watcher below so the app
        // still has a position while it is open.
      }
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
          if (pos) onUpdate(fromCoords(pos.coords, pos.timestamp));
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
    (pos) => onUpdate(fromCoords(pos.coords, pos.timestamp)),
    (err) =>
      onError(new LocationError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', err.message)),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );

  return () => navigator.geolocation.clearWatch(id);
}
