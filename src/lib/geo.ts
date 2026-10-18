import { RouteAlternative, RoutePreferences, TravelMode, UnitSystem } from '../types';

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

/**
 * Generates deterministic plausible route alternatives between two points.
 */
export function generateRouteAlternatives(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  mode: TravelMode,
  preferences: RoutePreferences
): RouteAlternative[] {
  const baseDistance = calculateDistanceKm(startLat, startLon, endLat, endLon);
  const directDist = Math.max(0.5, baseDistance);

  // Speed assumptions based on travel mode
  let baseSpeedKmh = 45; // car city/highway average
  if (mode === 'walking') baseSpeedKmh = 4.5;
  if (mode === 'cycling') baseSpeedKmh = 16;

  // Factor in preferences
  let highwayDistMultiplier = preferences.avoidHighways ? 1.25 : 1.15;
  let unpavedMultiplier = preferences.avoidUnpaved ? 1.05 : 1.0;

  // Route 1: Fastest
  const r1Dist = parseFloat((directDist * highwayDistMultiplier * unpavedMultiplier).toFixed(1));
  const r1Minutes = Math.max(1, Math.round((r1Dist / baseSpeedKmh) * 60));
  const r1Coords = buildInterpolatedPath(startLon, startLat, endLon, endLat, 0.003, 10);

  // Route 2: Shortest (more direct city streets, slightly slower speed)
  const r2Dist = parseFloat((directDist * 1.08 * unpavedMultiplier).toFixed(1));
  const r2Speed = baseSpeedKmh * (mode === 'car' ? 0.8 : 0.95);
  const r2Minutes = Math.max(1, Math.round((r2Dist / r2Speed) * 60));
  const r2Coords = buildInterpolatedPath(startLon, startLat, endLon, endLat, -0.003, 8);

  // Route 3: Avoid Highways / Scenic
  const r3Dist = parseFloat((directDist * 1.35 * unpavedMultiplier).toFixed(1));
  const r3Speed = baseSpeedKmh * (mode === 'car' ? 0.7 : 0.9);
  const r3Minutes = Math.max(1, Math.round((r3Dist / r3Speed) * 60));
  const r3Coords = buildInterpolatedPath(startLon, startLat, endLon, endLat, 0.006, 12);

  return [
    {
      id: 'fastest',
      name: 'Fastest Route',
      nameKa: 'უმოკლესი დროით',
      distanceKm: r1Dist,
      durationMinutes: r1Minutes,
      via: 'via Rustaveli Ave & Bypass',
      viaKa: 'რუსთაველის გამზ. და შემოვლითი გზით',
      coordinates: r1Coords,
      preferenceNote: preferences.avoidTolls ? 'Toll-free' : undefined,
      preferenceNoteKa: preferences.avoidTolls ? 'უფასო გზებით' : undefined,
    },
    {
      id: 'shortest',
      name: 'Shortest Distance',
      nameKa: 'უმოკლესი მანძილით',
      distanceKm: r2Dist,
      durationMinutes: r2Minutes,
      via: 'via Central historic streets',
      viaKa: 'ცენტრალური ისტორიული ქუჩებით',
      coordinates: r2Coords,
      preferenceNote: 'Fewer highway segments',
      preferenceNoteKa: 'ნაკლები მაგისტრალური მონაკვეთი',
    },
    {
      id: 'avoid_highways',
      name: 'Avoid Highways / Scenic',
      nameKa: 'მაგისტრალის გარეშე / ხედებით',
      distanceKm: r3Dist,
      durationMinutes: r3Minutes,
      via: 'via Riverbank & local lanes',
      viaKa: 'სანაპიროთა და ადგილობრივი გზებით',
      coordinates: r3Coords,
      preferenceNote: 'Calmer traffic',
      preferenceNoteKa: 'ნაკლებად დატვირთული მოძრაობა',
    },
  ];
}

/**
 * Creates an interpolated multi-point coordinate path with plausible road curve offsets
 */
function buildInterpolatedPath(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  offsetFactor: number,
  steps: number
): [number, number][] {
  const points: [number, number][] = [];
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const perpX = -dy;
  const perpY = dx;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // bell curve for offset
    const curve = Math.sin(t * Math.PI) * offsetFactor;
    const px = lon1 + dx * t + perpX * curve;
    const py = lat1 + dy * t + perpY * curve;
    points.push([px, py]);
  }
  return points;
}
