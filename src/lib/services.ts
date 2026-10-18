/**
 * Online services used by Kvali:
 * - OpenStreetMap Nominatim reverse geocoding
 * - OSRM (Open Source Routing Machine) routing
 */

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

    return data
      .map((item: any): GeocodeResult | null => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (isNaN(lat) || isNaN(lon)) return null;
        const displayName: string = item.display_name || '';
        return {
          id: `nominatim-${item.osm_type || 'place'}-${item.osm_id ?? item.place_id}`,
          name: item.name || displayName.split(',')[0] || trimmed,
          displayName,
          latitude: lat,
          longitude: lon,
          category: item.category,
          type: item.type,
        };
      })
      .filter((r: GeocodeResult | null): r is GeocodeResult => r !== null);
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
 * Calculates real route using Open Source Routing Machine (OSRM)
 */
export async function fetchOsrmRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  waypoints: { latitude: number; longitude: number }[] = [],
  mode: 'car' | 'walking' | 'cycling' = 'car',
  signal?: AbortSignal
): Promise<RealRouteResult[]> {
  // Map travel mode to OSRM profile
  const profile = mode === 'walking' ? 'walking' : mode === 'cycling' ? 'cycling' : 'driving';

  // Construct coordinates list: origin; intermediate...; destination
  const allPoints = [origin, ...waypoints, destination];
  const coordString = allPoints.map((p) => `${p.longitude},${p.latitude}`).join(';');

  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&steps=true&alternatives=true`;

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
    console.warn('OSRM routing request failed:', err);
    throw err;
  }
}

export interface OverpassPoi {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const POI_FILTERS = [
  'amenity=fuel',
  'amenity=parking',
  'amenity=restaurant',
  'amenity=cafe',
  'amenity=fast_food',
  'amenity=pharmacy',
  'amenity=hospital',
  'amenity=clinic',
  'amenity=bank',
  'amenity=atm',
  'amenity=toilets',
  'amenity=drinking_water',
  'amenity=bus_stop',
  'shop=supermarket',
  'shop=convenience',
  'tourism=hotel',
  'tourism=guest_house',
  'tourism=attraction',
  'tourism=viewpoint',
  'tourism=museum',
];

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
  const filters = POI_FILTERS.map((f) => {
    const [key, value] = f.split('=');
    return `node["${key}"="${value}"](around:${radiusMeters},${latitude},${longitude});`;
  }).join('\n');

  const query = `[out:json][timeout:25];(\n${filters}\n);out body 80;`;
  const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return [];
    const data = await response.json();
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

function formatManeuverText(type: string, modifier: string, roadName: string): string {
  if (type === 'depart') return `Depart on ${roadName}`;
  if (type === 'arrive') return `Arrive at destination`;
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
  if (type === 'roundabout') return `წრიულ მოძრაობაზე გადადით: ${roadName}`;

  if (modifier?.includes('left')) {
    return `შეუხვიეთ მარცხნივ: ${roadName}`;
  }
  if (modifier?.includes('right')) {
    return `შეუხვიეთ მარჯვნივ: ${roadName}`;
  }
  return `განაგრძეთ პირდაპირ: ${roadName}`;
}
