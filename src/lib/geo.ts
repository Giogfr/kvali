import { UnitSystem } from '../types';

/**
 * Calculates distance in kilometers between two coordinates using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance with unit consideration.
 */
export function formatDistance(distanceKm: number, units: UnitSystem): string {
  if (units === 'imperial') {
    const miles = distanceKm * 0.621371;
    if (miles < 0.2) {
      const feet = Math.round(distanceKm * 3280.84);
      return `${feet} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  } else {
    if (distanceKm < 1) {
      const meters = Math.round(distanceKm * 1000);
      return `${meters} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }
}

/**
 * Formats speed with unit consideration.
 */
export function formatSpeed(speedKmh: number, units: UnitSystem): string {
  if (units === 'imperial') {
    const mph = Math.round(speedKmh * 0.621371);
    return `${mph} mph`;
  }
  return `${Math.round(speedKmh)} km/h`;
}
