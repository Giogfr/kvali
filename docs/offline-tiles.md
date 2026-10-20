# Offline tiles

## What works today

Kvali's offline map is a **request cache**, not a downloaded region:

- `src/lib/offline.ts` resolves the style, sprites, fonts and TileJSON for every
  configured style, then stores them in the browser Cache API.
- `public/sw.js` serves cached tile and style requests when the network is
  unavailable.
- The tile cache only contains tiles the user has actually viewed or that the
  download pass fetched. It is not a complete map of Georgia.

This is useful on a commute with a patchy signal, but it is not a maps.me-style
offline region. The UI says "saved on this device" rather than "offline map
installed".

## Native tile store

A complete region needs an MBTiles file on the device and a native way to serve
it to MapLibre inside the WebView.

### Yermo plugin license review

`@yermo/maplibre-gl-capacitor-offline` 1.15.6 was downloaded from npm and its
`LICENSE.txt` was read before any integration decision.

- The plugin itself is **BSD-3-Clause** ("Copyright (c) 2017-2018, Oscar
  Fonts").
- Bundled components: mapbox-gl.js (BSD-3), glmatrix (BSD-3), glfx (MIT),
  d3-color (BSD-3).
- BSD-3-Clause is compatible with Kvali's GPL-3.0-or-later license.
- npm reports `SEE LICENSE IN LICENSE.txt`, which is why the file was read
  directly instead of trusting the package metadata.

The plugin is acceptable from a licensing point of view. It has not been
installed, because the native build and a physical-device test are required.

### Build outline

1. Build an MBTiles file for Georgia at zoom 0 to 14 with a vector schema that
   the existing style understands (OpenMapTiles-compatible).
2. Keep the output out of git. Publish it as a release artifact with a SHA-256
   checksum.
3. Add the Yermo plugin, point it at the downloaded `.mbtiles` file, and switch
   MapLibre to the local tile URL when a region is installed.
4. Keep the current Cache API path as the fallback for people who have not
   downloaded a region. Do not delete it.
5. Show real file sizes and free-space checks before downloading.

### Open questions

- Tile size and build time for a Georgia z0–14 extract have not been measured.
  Do not publish a size until they are.
- The style's glyphs and sprites must ship with the region, otherwise labels
  disappear offline.
- Attribution for OpenStreetMap and the style must remain visible in the
  offline view.

None of the native tile work is complete. The app does not claim a downloaded
region when only the HTTP cache is populated.
