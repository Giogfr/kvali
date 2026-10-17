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
