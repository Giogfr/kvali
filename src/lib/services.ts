/**
 * Online services used by Kvali:
 * - OpenStreetMap Nominatim reverse geocoding
 * - OSRM (Open Source Routing Machine) routing
 * - OpenStreetMap Overpass (POIs and mapped road alerts)
 */

import type { AlertCategory } from '../types';
import { normalizeAddress, normalizeGeorgianText } from './georgianAddress';

export interface RouteStep {
  instruction: string;
  instructionKa?: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  location: [number, number]; // [lng, lat]
}

export interface RealRouteResult {
  id: string;
  name: string;
  nameKa?: string;
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][]; // [lng, lat]
  steps: RouteStep[];
  via: string;
  viaKa?: string;
  isRealService: boolean;
}

export interface GeocodeResult {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category?: string;
  type?: string;
}

/**
 * Searches places by name using Nominatim. When a reference point is given the
 * results are biased towards that area, which keeps the Georgian places on top.
 */
export async function searchNominatim(
  query: string,
  near?: { latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: trimmed,
    limit: '8',
    addressdetails: '0',
    'accept-language': 'ka,en',
  });

  if (near) {
    const d = 0.6;
    params.set(
      'viewbox',
      `${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`
    );
    params.set('bounded', '0');
  }

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'KvaliNavigationApp/1.0' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const results = data
      .map((item: any): GeocodeResult | null => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (isNaN(lat) || isNaN(lon)) return null;
        const displayName: string = item.display_name || '';
        const normalized = normalizeAddress({ text: displayName, latitude: lat, longitude: lon });
        return {
          id: `nominatim-${item.osm_type || 'place'}-${item.osm_id ?? item.place_id}`,
          name: normalizeGeorgianText(item.name || displayName.split(',')[0] || trimmed),
          displayName: normalized.text,
          latitude: lat,
          longitude: lon,
          category: item.category,
          type: item.type,
        };
      })
      .filter((r: GeocodeResult | null): r is GeocodeResult => r !== null);

    // Nominatim sometimes returns records whose textual city disagrees with the
    // point (a known Georgian OSM data issue). Keep them, but rank the records
    // that pass the coordinate check first instead of hiding results.
    return results.sort((a, b) => {
      const aMismatch = normalizeAddress({
        text: a.displayName,
        latitude: a.latitude,
        longitude: a.longitude,
      }).coordinateMismatch
        ? 1
        : 0;
      const bMismatch = normalizeAddress({
        text: b.displayName,
        latitude: b.latitude,
        longitude: b.longitude,
      }).coordinateMismatch
        ? 1
        : 0;
      return aMismatch - bMismatch;
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return [];
  }
}

/**
 * Reverse geocodes coordinates to street address using Nominatim
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'ka,en;q=0.8',
        'User-Agent': 'KvaliNavigationApp/1.0',
      },
    });

    if (!response.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const data = await response.json();
    if (data.display_name) {
      const parts = data.display_name.split(',');
      return parts.slice(0, 3).join(',').trim();
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

/**
 * Calculates a real route.
 *
 * Car and bicycle routes use the FOSSGIS OSRM servers. The public OSRM demo
 * silently answers every profile with a car route, so it must not be used for
 * walking. Walking therefore goes through the public Valhalla instance, which
 * has a real pedestrian costing profile.
 */
export async function fetchOsrmRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  waypoints: { latitude: number; longitude: number }[] = [],
  mode: 'car' | 'walking' | 'cycling' = 'car',
  signal?: AbortSignal
): Promise<RealRouteResult[]> {
  if (mode === 'walking') {
    return fetchValhallaWalkingRoute(origin, destination, waypoints, signal);
  }

  // Construct coordinates list: origin; intermediate...; destination
  const allPoints = [origin, ...waypoints, destination];
  const coordString = allPoints.map((p) => `${p.longitude},${p.latitude}`).join(';');

  const endpoint =
    mode === 'cycling'
      ? 'https://routing.openstreetmap.de/routed-bike/route/v1/bike'
      : 'https://routing.openstreetmap.de/routed-car/route/v1/driving';

  const url = `${endpoint}/${coordString}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`OSRM routing failed: status ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'No route found');
    }

    return data.routes.map((route: any, index: number) => {
      const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
      const durationMinutes = Math.max(1, Math.round(route.duration / 60));
      const coordinates: [number, number][] = route.geometry.coordinates;

      // Extract steps
      const steps: RouteStep[] = [];
      if (route.legs && route.legs.length > 0) {
        route.legs.forEach((leg: any) => {
          if (leg.steps) {
            leg.steps.forEach((step: any) => {
              const name = step.name || 'Road';
              const type = step.maneuver?.type || 'turn';
              const modifier = step.maneuver?.modifier || '';

              // Human readable instruction
              let instruction = formatManeuverText(type, modifier, name);
              let instructionKa = formatManeuverTextKa(type, modifier, name);

              steps.push({
                instruction,
                instructionKa,
                name,
                distanceMeters: Math.round(step.distance),
                durationSeconds: Math.round(step.duration),
                maneuverType: type,
                maneuverModifier: modifier,
                location: step.maneuver?.location || [0, 0],
              });
            });
          }
        });
      }

      // Determine main road name for "via"
      const mainRoad = steps.find((s) => s.name && s.name !== 'Road' && s.distanceMeters > 300)?.name;
      const viaText = mainRoad ? `via ${mainRoad}` : index === 0 ? 'via Main Corridor' : 'via Alternate Route';
      const viaTextKa = mainRoad ? `${mainRoad}-ით` : index === 0 ? 'მთავარი მარშრუტით' : 'ალტერნატიული გზით';

      const routeName = index === 0 ? 'Fastest Route (OSRM)' : index === 1 ? 'Alternative 1' : 'Alternative 2';
      const routeNameKa = index === 0 ? 'სწრაფი მარშრუტი (OSRM)' : index === 1 ? 'ალტერნატივა 1' : 'ალტერნატივა 2';

      return {
        id: `osrm-route-${index}`,
        name: routeName,
        nameKa: routeNameKa,
        distanceKm,
        durationMinutes,
        coordinates,
        steps,
        via: viaText,
        viaKa: viaTextKa,
        isRealService: true,
      };
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    console.warn('OSRM routing request failed, trying Valhalla fallback:', err);
    return fetchValhallaRoute(
      origin,
      destination,
      waypoints,
      mode === 'cycling' ? 'bicycle' : 'auto',
      mode,
      signal
    );
  }
}

const VALHALLA_ENDPOINT = 'https://valhalla1.openstreetmap.de/route';

/** Decodes a Valhalla polyline with 1e6 precision into [lng, lat] pairs. */
export function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lng / 1e6, lat / 1e6]);
  }

  return coordinates;
}

function valhallaManeuver(type: number): { type: string; modifier: string } {
  switch (type) {
    case 1:
    case 2:
    case 3:
      return { type: 'depart', modifier: '' };
    case 4:
    case 5:
    case 6:
      return { type: 'arrive', modifier: '' };
    case 9:
      return { type: 'turn', modifier: 'slight right' };
    case 10:
      return { type: 'turn', modifier: 'right' };
    case 11:
      return { type: 'turn', modifier: 'sharp right' };
    case 12:
    case 13:
      return { type: 'uturn', modifier: '' };
    case 14:
      return { type: 'turn', modifier: 'sharp left' };
    case 15:
      return { type: 'turn', modifier: 'left' };
    case 16:
      return { type: 'turn', modifier: 'slight left' };
    case 17:
      return { type: 'fork', modifier: 'straight' };
    case 18:
    case 20:
    case 23:
      return { type: 'fork', modifier: 'right' };
    case 19:
    case 21:
    case 24:
      return { type: 'fork', modifier: 'left' };
    case 22:
      return { type: 'turn', modifier: 'straight' };
    case 25:
    case 37:
    case 38:
      return { type: 'merge', modifier: '' };
    case 26:
    case 27:
      return { type: 'roundabout', modifier: '' };
    default:
      return { type: 'turn', modifier: '' };
  }
}

async function fetchValhallaRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  waypoints: { latitude: number; longitude: number }[],
  costing: 'pedestrian' | 'auto' | 'bicycle',
  mode: 'car' | 'walking' | 'cycling',
  signal?: AbortSignal
): Promise<RealRouteResult[]> {
  const locations = [origin, ...waypoints, destination].map((point) => ({
    lat: point.latitude,
    lon: point.longitude,
  }));

  const response = await fetch(VALHALLA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations,
      costing,
      directions_options: { units: 'kilometers', language: 'en-US' },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Valhalla routing failed: status ${response.status}`);
  }

  const data = await response.json();
  const trip = data?.trip;
  if (!trip || !Array.isArray(trip.legs) || trip.legs.length === 0) {
    throw new Error(data?.error || `No ${mode} route found`);
  }

  const coordinates: [number, number][] = [];
  const steps: RouteStep[] = [];

  for (const leg of trip.legs) {
    const legShape = decodePolyline6(String(leg.shape || ''));
    if (legShape.length > 0) {
      const last = coordinates[coordinates.length - 1];
      const first = legShape[0];
      if (!last || last[0] !== first[0] || last[1] !== first[1]) {
        coordinates.push(...legShape);
      } else {
        coordinates.push(...legShape.slice(1));
      }
    }

    for (const maneuver of leg.maneuvers || []) {
      const mapped = valhallaManeuver(Number(maneuver.type));
      const name: string = maneuver.street_names?.[0] || 'Road';
      const shapeIndex = Math.max(
        0,
        Math.min(Number(maneuver.begin_shape_index) || 0, legShape.length - 1)
      );
      const location = legShape[shapeIndex] || [destination.longitude, destination.latitude];

      steps.push({
        instruction:
          maneuver.instruction || formatManeuverText(mapped.type, mapped.modifier, name),
        instructionKa: formatManeuverTextKa(mapped.type, mapped.modifier, name),
        name,
        distanceMeters: Math.round((Number(maneuver.length) || 0) * 1000),
        durationSeconds: Math.round(Number(maneuver.time) || 0),
        maneuverType: mapped.type,
        maneuverModifier: mapped.modifier,
        location,
      });
    }
  }

  const distanceKm = parseFloat((Number(trip.summary?.length) || 0).toFixed(1));
  const durationMinutes = Math.max(1, Math.round((Number(trip.summary?.time) || 0) / 60));
  const mainRoad = steps.find(
    (step) => step.name && step.name !== 'Road' && step.distanceMeters > 300
  )?.name;

  const labels = {
    car: { en: 'Driving Route', ka: 'საავტომობილო მარშრუტი', via: 'by road' },
    walking: { en: 'Walking Route', ka: 'საფეხმავლო მარშრუტი', via: 'on foot' },
    cycling: { en: 'Cycling Route', ka: 'ველომარშრუტი', via: 'by bike' },
  }[mode];

  return [
    {
      id: `valhalla-${mode}-0`,
      name: `${labels.en} (Valhalla)`,
      nameKa: labels.ka,
      distanceKm,
      durationMinutes,
      coordinates,
      steps,
      via: mainRoad ? `via ${mainRoad}` : labels.via,
      viaKa: mainRoad ? `${mainRoad}-ით` : labels.via,
      isRealService: true,
    },
  ];
}

function fetchValhallaWalkingRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  waypoints: { latitude: number; longitude: number }[],
  signal?: AbortSignal
): Promise<RealRouteResult[]> {
  return fetchValhallaRoute(origin, destination, waypoints, 'pedestrian', 'walking', signal);
}

export interface OverpassPoi {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  // Mirrors used when the main instance is overloaded or missing CORS headers.
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs an Overpass query against the main instance and falls back to mirrors.
 * Overpass is a volunteer service and is regularly overloaded, so each
 * endpoint is tried twice with a short backoff before giving up.
 */
async function overpassQuery(query: string, signal?: AbortSignal): Promise<any> {
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal,
        });
        if (!response.ok) {
          lastError = new Error(`Overpass ${endpoint} returned ${response.status}`);
        } else {
          return await response.json();
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastError = err;
      }
      await delay(500 * (attempt + 1));
    }
  }

  throw lastError || new Error('Overpass is unavailable');
}

const POI_QUERY = `[out:json][timeout:25];
(
  nwr["amenity"~"^(fuel|parking|restaurant|cafe|fast_food|pharmacy|hospital|clinic|bank|atm|toilets|drinking_water|bus_stop)$"](around:RADIUS,LAT,LON);
  nwr["shop"~"^(supermarket|convenience)$"](around:RADIUS,LAT,LON);
  nwr["tourism"~"^(hotel|guest_house|attraction|viewpoint|museum)$"](around:RADIUS,LAT,LON);
);
out center tags 120;`;

function poiCategory(tags: Record<string, string>): string {
  const a = tags.amenity;
  if (a === 'fuel') return 'fuel';
  if (a === 'parking') return 'parking';
  if (a === 'restaurant' || a === 'cafe' || a === 'fast_food') return 'food';
  if (a === 'pharmacy') return 'pharmacies';
  if (a === 'hospital' || a === 'clinic') return 'hospital';
  if (a === 'bank' || a === 'atm') return 'atm';
  if (tags.shop === 'supermarket' || tags.shop === 'convenience') return 'groceries';
  if (tags.tourism === 'viewpoint') return 'viewpoints';
  if (tags.tourism === 'hotel' || tags.tourism === 'guest_house') return 'hotels';
  if (tags.tourism === 'attraction' || tags.tourism === 'museum') return 'attractions';
  return 'poi';
}

function poiFallbackLabel(tags: Record<string, string>): string {
  const a = tags.amenity;
  const labels: Record<string, string> = {
    fuel: 'Fuel station',
    parking: 'Parking',
    restaurant: 'Restaurant',
    cafe: 'Café',
    fast_food: 'Fast food',
    pharmacy: 'Pharmacy',
    hospital: 'Hospital',
    clinic: 'Clinic',
    bank: 'Bank',
    atm: 'ATM',
    toilets: 'Public toilets',
    drinking_water: 'Drinking water',
    bus_stop: 'Bus stop',
  };
  if (a && labels[a]) return labels[a];
  if (tags.shop === 'supermarket') return 'Supermarket';
  if (tags.shop === 'convenience') return 'Convenience store';
  if (tags.tourism === 'hotel') return 'Hotel';
  if (tags.tourism === 'guest_house') return 'Guest house';
  if (tags.tourism === 'viewpoint') return 'Viewpoint';
  if (tags.tourism === 'museum') return 'Museum';
  if (tags.tourism === 'attraction') return 'Attraction';
  return '';
}

/**
 * Fetches nearby points of interest from the OpenStreetMap Overpass API.
 * Returns an empty list when the service is unreachable.
 */
export async function fetchOverpassPois(
  latitude: number,
  longitude: number,
  radiusMeters = 4000,
  signal?: AbortSignal
): Promise<OverpassPoi[]> {
  const query = POI_QUERY.replace('RADIUS', String(radiusMeters))
    .replace('LAT', String(latitude))
    .replace('LON', String(longitude));

  try {
    const data = await overpassQuery(query, signal);
    if (!Array.isArray(data?.elements)) return [];

    return data.elements
      .map((el: any): OverpassPoi | null => {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;
        const tags: Record<string, string> = el.tags || {};
        const name =
          tags.name || tags['name:en'] || tags.brand || poiFallbackLabel(tags) || '';
        if (!name) return null;
        const address = [tags['addr:street'], tags['addr:housenumber']]
          .filter(Boolean)
          .join(' ');
        return {
          id: `osm-${el.type}-${el.id}`,
          name,
          category: poiCategory(tags),
          latitude: lat,
          longitude: lon,
          address: address || undefined,
        };
      })
      .filter((p: OverpassPoi | null): p is OverpassPoi => p !== null);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return [];
  }
}

export interface OverpassAlert {
  id: string;
  category: AlertCategory;
  latitude: number;
  longitude: number;
  roadName: string;
  speedLimit?: number;
  description: string;
  descriptionKa: string;
  lastUpdatedText: string;
}

// Only features that really are enforcement or road hazards in OSM. Generic
// access=no segments and gates are deliberately excluded: they are mostly
// driveways and private service roads, not closures.
const ALERT_QUERY = `[out:json][timeout:25];
(
  nwr["highway"="speed_camera"](around:RADIUS,LAT,LON);
  nwr["enforcement"~"^(maxspeed|red_light|average_speed)$"](around:RADIUS,LAT,LON);
  nwr["man_made"="surveillance"]["surveillance:type"~"^(ALPR|ANPR)$"](around:RADIUS,LAT,LON);
  nwr["amenity"="police"](around:RADIUS,LAT,LON);
  nwr["highway"="construction"](around:RADIUS,LAT,LON);
  node["highway"="stop"](around:1200,LAT,LON);
  node["highway"="traffic_signals"](around:1500,LAT,LON);
  way["amenity"="school"](around:3000,LAT,LON);
);
out center tags 300;`;

function alertCategoryFromTags(tags: Record<string, string>): AlertCategory | null {
  if (tags.highway === 'speed_camera') return 'fixed_speed_camera';
  if (tags.enforcement === 'maxspeed') return 'fixed_speed_camera';
  if (tags.enforcement === 'red_light') return 'red_light_camera';
  if (tags.enforcement === 'average_speed') return 'average_speed_zone';
  if (tags['man_made'] === 'surveillance') {
    const type = tags['surveillance:type'];
    if (type === 'ALPR' || type === 'ANPR') return 'enforcement_other';
  }
  if (tags.enforcement) return 'enforcement_other';
  if (tags.amenity === 'police') return 'police_station';
  if (tags.highway === 'stop') return 'stop_sign';
  if (tags.highway === 'traffic_signals') return 'traffic_light';
  if (tags.amenity === 'school') return 'school_zone';
  if (tags.highway === 'construction' || tags.construction) return 'roadworks';
  if (tags.access === 'no' && tags.highway) return 'road_closures';
  return null;
}

function alertLabels(category: AlertCategory): { en: string; ka: string } {
  switch (category) {
    case 'fixed_speed_camera':
      return { en: 'Fixed speed camera', ka: 'ფიქსირებული რადარი' };
    case 'average_speed_zone':
      return { en: 'Average-speed camera zone', ka: 'საშუალო სიჩქარის კამერა' };
    case 'red_light_camera':
      return { en: 'Red-light camera', ka: 'შუქნიშნის კამერა' };
    case 'enforcement_other':
      return { en: 'Mapped enforcement', ka: 'საგზაო კონტროლი' };
    case 'police_station':
      return { en: 'Police station', ka: 'პოლიციის განყოფილება' };
    case 'roadworks':
      return { en: 'Roadworks / construction', ka: 'საგზაო სამუშაოები' };
    case 'road_closures':
      return { en: 'Road closure', ka: 'ჩაკეტილი გზა' };
    case 'stop_sign':
      return { en: 'Stop sign', ka: 'გაჩერების ნიშანი' };
    case 'traffic_light':
      return { en: 'Traffic light', ka: 'შუქნიშანი' };
    case 'school_zone':
      return { en: 'School zone', ka: 'სკოლის ზონა' };
    case 'sharp_curve':
      return { en: 'Sharp curve', ka: 'მკვეთრი მოხვევა' };
    default:
      return { en: 'Road alert', ka: 'საგზაო გაფრთხილება' };
  }
}

function parseSpeedLimit(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  const speed = parseInt(match[0], 10);
  return Number.isFinite(speed) && speed > 0 && speed < 200 ? speed : undefined;
}

/**
 * Fetches real mapped enforcement and hazard features from OpenStreetMap.
 * Only returns what is actually present in OSM; missing coverage stays empty.
 */
export async function fetchOverpassAlerts(
  latitude: number,
  longitude: number,
  radiusMeters = 6000,
  signal?: AbortSignal
): Promise<OverpassAlert[]> {
  const query = ALERT_QUERY.replace('RADIUS', String(radiusMeters))
    .replace('LAT', String(latitude))
    .replace('LON', String(longitude));

  try {
    const data = await overpassQuery(query, signal);
    if (!Array.isArray(data?.elements)) return [];

    return data.elements
      .map((el: any): OverpassAlert | null => {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;

        const tags: Record<string, string> = el.tags || {};
        const category = alertCategoryFromTags(tags);
        if (!category) return null;

        const labels = alertLabels(category);
        const roadName = tags.name || tags['name:en'] || tags['addr:street'] || '';
        const direction = tags.direction || tags['camera:direction'] || tags['traffic_sign'];
        const enDetail = [labels.en, direction].filter(Boolean).join(' · ');
        const kaDetail = [labels.ka, direction].filter(Boolean).join(' · ');

        return {
          id: `osm-alert-${el.type}-${el.id}`,
          category,
          latitude: lat,
          longitude: lon,
          roadName: roadName || labels.en,
          speedLimit: parseSpeedLimit(tags.maxspeed),
          description: enDetail,
          descriptionKa: kaDetail,
          lastUpdatedText: tags.check_date || tags['survey:date'] || 'OpenStreetMap',
        };
      })
      .filter((a: OverpassAlert | null): a is OverpassAlert => a !== null);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return [];
  }
}

function formatManeuverText(type: string, modifier: string, roadName: string): string {
  if (type === 'depart') return `Depart on ${roadName}`;
  if (type === 'arrive') return `Arrive at destination`;
  if (type === 'uturn') return `Make a U-turn onto ${roadName}`;
  if (type === 'roundabout') return `At roundabout, continue onto ${roadName}`;
  if (type === 'merge') return `Merge onto ${roadName}`;
  if (type === 'fork') return `Keep ${modifier || 'left'} onto ${roadName}`;

  if (modifier === 'left' || modifier === 'sharp left' || modifier === 'slight left') {
    return `Turn left onto ${roadName}`;
  }
  if (modifier === 'right' || modifier === 'sharp right' || modifier === 'slight right') {
    return `Turn right onto ${roadName}`;
  }
  if (modifier === 'straight') {
    return `Continue straight on ${roadName}`;
  }
  return `Continue onto ${roadName}`;
}

function formatManeuverTextKa(type: string, modifier: string, roadName: string): string {
  if (type === 'depart') return `გაემართეთ: ${roadName}`;
  if (type === 'arrive') return `მიხვედით დანიშნულების ადგილზე`;
  if (type === 'uturn') return `შეასრულეთ U-მობრუნება: ${roadName}`;
  if (type === 'roundabout') return `წრიულ მოძრაობაზე გადადით: ${roadName}`;

  if (modifier?.includes('left')) {
    return `შეუხვიეთ მარცხნივ: ${roadName}`;
  }
  if (modifier?.includes('right')) {
    return `შეუხვიეთ მარჯვნივ: ${roadName}`;
  }
  return `განაგრძეთ პირდაპირ: ${roadName}`;
}
