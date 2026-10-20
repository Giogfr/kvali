# Offline routing graph

## Goal

Routing and turn-by-turn guidance should keep working without a network
connection. Today every route comes from OSRM or Valhalla over HTTPS. The app
caches recent routes, but it cannot calculate a new route offline.

## Data source

Georgia is a small extract, so a country-sized graph is practical:

- Source: Geofabrik, `https://download.geofabrik.de/asia/georgia-latest.osm.pbf`
- License: ODbL, attribution to OpenStreetMap contributors.
- Approximate download: 45 MB at the time of writing. Check the server's
  `.md5` file before building.

The PBF is build input only. It is not committed to this repository.

## Engine

Valhalla is the best fit because one graph serves car, bicycle and pedestrian
costing, and its guidance output already matches what the app consumes.

- Valhalla: MIT license.
- `valhalla-mobile`: MIT wrapper used by several mobile apps. It still needs an
  Android native module, packaged as a Capacitor plugin, and ABI-specific
  binaries. That work is not done.

## Build outline

The official Docker image keeps the toolchain reproducible:

```sh
# 1. Download and verify the extract
curl -O https://download.geofabrik.de/asia/georgia-latest.osm.pbf
curl -O https://download.geofabrik.de/asia/georgia-latest.osm.pbf.md5
md5sum -c georgia-latest.osm.pbf.md5

# 2. Build a config and the tiles (inside the Valhalla image)
valhalla_build_config \
  --mjolnir-tile-dir /data/valhalla \
  --mjolnir-timezone /data/timezones \
  --mjolnir-admin /data/admin \
  > /data/valhalla.json

valhalla_build_tiles -c /data/valhalla.json /data/georgia-latest.osm.pbf

# 3. Package the tile directory for the device
tar -czf georgia-valhalla.tar.gz -C /data valhalla
```

The timezone and admin databases are separate downloads. Without them,
Valhalla still routes, but time-dependent and border features are unavailable.

## Size and storage

The tile size depends on the Valhalla version and the tile hierarchy. Measure
the result before publishing a release; do not promise a number that has not
been measured. A country-sized graph is normally hundreds of megabytes.

Two delivery options:

1. Bundle the graph in the APK. Simple, but increases the download for every
   user, including people who never leave Tbilisi.
2. Download on first use into the app's private files directory, verify a
   SHA-256 checksum, and show real progress. Kvali already has an offline
   manager screen, so this fits the existing UI.

Option 2 is preferred. The app must show an honest error if the download is
interrupted, and must not mark the graph as installed until the checksum
matches.

## Integration steps

1. Build and publish the graph artifact with a checksum.
2. Add a Capacitor plugin that starts Valhalla with the tile path and exposes
   `route(request)` over the existing route model.
3. Route through the local engine first when the graph is installed, and fall
   back to the online services only when it is missing or fails.
4. Keep the existing online routing code; offline routing is an addition, not a
   replacement.
5. Test on a physical device in airplane mode, including a cold start with no
   network.

None of these steps are complete yet. The app continues to label routes as
coming from the live service.
