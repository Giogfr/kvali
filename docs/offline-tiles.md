# Offline tiles

## What ships

Kvali downloads a real **Georgia basemap**, not just an HTTP cache:

- `.github/workflows/offline-map.yml` downloads the Protomaps planet build, cuts
  Georgia (`39.9,41.0,46.8,43.6`, zoom 0-13), rewrites tile IDs, and publishes
  `georgia-basemap-z13.pmtiles` plus its `.sha256` sidecar to GitHub Pages.
- `src/lib/offlineBasemap.ts` downloads that PMTiles file into IndexedDB as a
  Blob, verifies its SHA-256, and registers a MapLibre `pmtiles://` protocol that
  reads ranges from the Blob. Nothing is served over the network after install.
- `src/lib/offlineBasemapStyle.ts` builds the Protomaps style for light/dark and
  EN/KA labels from `@protomaps/basemaps`. Its glyphs, sprites, and TileJSON are
  cached during install so labels work without a connection.
- `MapView` uses the installed basemap whenever it is ready, both online and
  offline. Uninstalling it switches back to the online OpenFreeMap styles.
- The service-worker request cache in `src/lib/offline.ts` remains as a fallback
  for online styles and areas that were only browsed, not installed.

The published file is about 96 MiB (100,891,800 bytes). It contains streets,
water, land use, buildings, boundaries, and labels down to zoom 13; zooms above
13 are overzoomed from the z13 tiles.

## Offline search

The basemap download also installs `georgia-search-v1.json.gz` (about 2.5 MiB)
from GitHub Pages. It is built from the current Geofabrik Georgia extract by
`scripts/build-georgia-search-index.py` and contains named places, POIs,
streets, and address points:

- `.github/workflows/search-data.yml` builds the index on demand and preserves
  the existing basemap and routing files on Pages.
- `.github/workflows/offline-map.yml` rebuilds the index whenever the whole
  offline package is rebuilt.
- `src/lib/offlineSearch.ts` verifies the SHA-256 sidecar, stores the compressed
  index in `kvali_offline_search_v1`, decompresses it on first use, and ranks
  results by exact/prefix/token match, feature importance, and distance from
  the current map centre.
- `SearchScreen` loads the index with the screen and shows an **Offline map**
  result group when the device is offline, while Nominatim is loading, or when
  Nominatim returns nothing. The downloaded index results are real map points
  and can be opened or used as a route destination.

The index includes only features that are mapped in OpenStreetMap. It does not
contain every possible address, does not transliterate every name, and does not
provide offline reverse geocoding.

## Install and storage

The Offline Maps screen shows the download size, real progress, and a Remove
action. Removal is blocked while offline-only mode is active so the user cannot
delete the only working basemap without a connection. Nationwide routing has the
same install/remove flow.

The basemap is stored in `kvali_offline_basemap_v1`; the search index uses
`kvali_offline_search_v1`; the routing package uses
`kvali_nationwide_routing_v3`. All are separate from route and tile caches.
Removing the Georgia offline map also removes its search index.

## Licensing

The basemap is derived from OpenStreetMap data via Protomaps. The map keeps
OpenStreetMap and Protomaps attribution visible. The PMTiles client
(`pmtiles`, BSD-3-Clause) and Protomaps style package (`@protomaps/basemaps`,
BSD-3-Clause) are compatible with Kvali's GPL-3.0-or-later license.

The previously evaluated `@yermo/maplibre-gl-capacitor-offline` plugin is not
used. PMTiles plus IndexedDB avoids a native plugin and keeps the WebView as the
only map renderer.

## Remaining limits

- No z14-z16 Georgia extract is published; very close zoom levels are
  overzoomed and less detailed than maps.me.
- Android WebView storage of a 96 MiB Blob has been exercised in desktop Chrome
  but not yet on a physical device.
- GitHub Pages currently serves the 96 MiB file, but that per-file limit is not
  a documented guarantee. The workflow fails if the file reaches 100 MiB.
- Offline index matching is exact/prefix/token based rather than fuzzy; a badly
  misspelled name may still need an online search.
