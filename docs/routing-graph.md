# Offline routing graph

## Goal

Routing should keep working without a network connection. Kvali ships two
offline paths now:

- saved routes from previous online calculations, and
- a nationwide Georgia car graph the user installs once from Offline Maps.

The installed graph can calculate new car routes anywhere in Georgia while
offline. Walking and cycling still require a connection or a cached route.

## Data source

Georgia is a small extract, so a country-sized graph is practical:

- Source: Geofabrik, `https://download.geofabrik.de/europe/georgia-latest.osm.pbf`
- License: ODbL, attribution to OpenStreetMap contributors.
- Approximate download: 100 MB at the time of writing. Check the server's
  `.md5` file before building.

The PBF is build input only. It is not committed to this repository.

## Engine

`src/lib/offlineRouting.ts` contains the small browser graph used for nearby
development data and tests. It is not the nationwide format.

`src/lib/offlinePackedRouting.ts` reads the nationwide package and routes over
it. The reader validates the header, array lengths, offset tables, edge targets,
and name indexes before exposing the graph. Snapping is limited to 5 km, so a
point in the sea or another country does not silently attach to a Georgian road.

The package is a binary KVRG v3 document:

- integer microdegree coordinates and typed numeric arrays, so a phone does not
  allocate millions of JavaScript objects;
- degree-two road nodes are contracted into chains, and each chain keeps its
  polyline so the route follows the real road shape;
- per-edge travel time, toll/highway/unpaved flags, and road-name indexes;
- a SHA-256 sidecar that the app must verify before installing.

`scripts/build-georgia-routing-graph.py` builds it. The builder reads every
drivable road from the PBF, preserves one-way restrictions, speed limits,
tolls, unpaved-road flags, road names, and coordinates, contracts the chains,
and writes `georgia-routing-graph-v3.kvr.gz` plus the checksum sidecar.

Install the parser once with `python -m pip install osmium`, download the
current Geofabrik extract, and run:

```sh
python scripts/build-georgia-routing-graph.py \
  --pbf georgia-latest.osm.pbf \
  --output artifacts/georgia-routing-graph-v3.kvr.gz
```

A successful build prints the node, edge, way, and geometry point counts. Do not
publish a package whose counts are zero or implausibly small.

`.github/workflows/routing-data.yml` performs the same build on GitHub-hosted
Linux and publishes the two files to a `routing-data-*` release. The default tag
is `routing-data-latest`. The app's installer reads:

```
https://github.com/Giogfr/kvali/releases/download/routing-data-latest/georgia-routing-graph-v3.kvr.gz
```

and verifies the `.sha256` sidecar before storing the package in IndexedDB.
The compressed bytes are stored, so a later app start decompresses and parses
the graph again instead of downloading it a second time.

## Verification

`bun run test:offline-packed` checks the binary reader, validation, routing,
and avoid flags with a synthetic package. A real package must also pass:

```sh
bun scripts/test-nationwide-graph.mjs path/to/georgia-routing-graph-v3.kvr.gz
```

That test decompresses the artifact, validates it, and calculates a
Tbilisi-to-Batumi route. A release is not nationwide-complete until this passes
on the published asset and the same flow is exercised on an Android device in
airplane mode.

## Remaining work

- The graph covers car routing only.
- Instructions are still per road-chain ("Continue on …"), not full turn
  guidance with junction maneuvers, lane data, or exit numbers.
- The nationwide visual map package is separate from the routing package; users
  still need downloaded tile areas for the map itself while offline.
- A native Valhalla or OSRM build could replace the in-app Dijkstra graph later.
  Valhalla is MIT licensed and one graph serves car, bicycle and pedestrian
  costing, but it needs a Capacitor plugin and ABI-specific binaries. That work
  is not done.
