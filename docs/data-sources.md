# Data sources

Kvali does not bundle map or place data. Every result comes from a live
community service, and every failure is shown honestly.

| Purpose | Service | Endpoint |
| --- | --- | --- |
| Map tiles and styles | OpenFreeMap | `tiles.openfreemap.org` (`/styles/positron`, `/styles/dark`, `/planet`) |
| Low-zoom relief | OpenFreeMap | `ne2_shaded` raster source, max zoom 6 |
| Search and reverse geocoding | Nominatim | `nominatim.openstreetmap.org/search`, `/reverse` |
| Car and bicycle routing | FOSSGIS OSRM | `routing.openstreetmap.de/routed-car`, `/routed-bike` |
| Preference-aware routing | FOSSGIS Valhalla | `valhalla1.openstreetmap.de/route` with `costing_options` |
| Walking routing | FOSSGIS Valhalla | `valhalla1.openstreetmap.de/route` |
| Routing fallback | FOSSGIS Valhalla | same endpoint with `auto` or `bicycle` costing |
| Points of interest, cameras, alerts | Overpass | `overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee` |

## Usage rules

- OpenStreetMap data is © OpenStreetMap contributors and is available under the
  ODbL. Attribution is shown in the app and in the README.
- Nominatim has a strict usage policy. Kvali sends one search at a time and
  debounces typing; it is not a bulk geocoder.
- OSRM and Valhalla are shared FOSSGIS instances. The app must not be used to
  scrape or precompute routes in bulk.
- Overpass is a volunteer service. Short outages, 429 rate limits and 502
  gateway errors are normal. The app retries a limited number of times, then
  keeps cached results or shows nothing.

## Route preferences

The public OSRM profile rejects `exclude` flags ("Exclude flag combination is
not supported"), so a route with any Avoid toggle enabled is requested from
Valhalla instead. Valhalla receives `use_tolls`, `use_highways` and
`use_tracks` (or `use_trails` for walking) in `costing_options`. The route card
still shows which provider answered; no preference is silently ignored.

If Valhalla is unavailable, the app falls back to OSRM and the preferences are
not applied. The fallback is visible in the route label, and the app does not
claim the exclusions were honoured.



The integrity rule is simple: missing data is better than invented data.

- If a route request fails on every service, the route screen shows an error and
  no distance, ETA or polyline.
- If Overpass fails, previously cached alerts remain, or the alert list is
  empty. The app never fabricates a camera, a school zone or a traffic light.
- If tiles fail, MapLibre shows its background; the style's attribution still
  appears.
- A speed limit is shown only when OSM has `maxspeed`. The HUD shows a dash and
  "Speed limit not mapped here" otherwise.
- Search results that name a city but sit outside its bounding box are ranked
  last rather than rewritten.

## Self-hosting

If you run your own instance, update the endpoints in `src/lib/services.ts`
and `src/lib/offline.ts`. Keep the attribution and respect the upstream
service's policy. A self-hosted deployment should also cache tiles at the edge;
the volunteer services are not a CDN.
