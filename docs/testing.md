# Testing

## Unit tests

No browser or server is needed:

```sh
bun run test:units
```

That runs the pure-module suites:

| Script | Covers |
| --- | --- |
| `test:engine` | off-route thresholds, debounce, cooldown, bearing modes |
| `test:geo` | haversine distance, metric/imperial formatting |
| `test:navigation` | projection, snapping, progress, sharp curves |
| `test:address` | Mtavruli conversion, postcodes, city bounds |
| `test:time` | ETA and duration formatting |
| `test:alerts` | school-zone time windows |
| `test:nearby-alerts` | distance ranking and limits |
| `test:route-preferences` | Avoid toggles to Valhalla costing options |
| `test:gpx` | GPX 1.1 output, escaping, bad coordinates |
| `test:i18n` | EN/KA key parity and untranslated strings |
| `test:i18n-template` | `{placeholder}` substitution in messages |
| `test:location` | GPS unit conversion, null handling, bad fixes |
| `test:track` | recording jitter filter and honest totals |
| `test:route-cache` | saved-route validation and cache keys |
| `test:offline-cache` | cached POI collections, expiry and corruption |
| `test:offline-routing` | validated local graph routes and exclusions |
| `test:offline-packed` | binary country graph reader, validation and route flags |
| `test:speech` | voice/language matching, including Georgian |
| `test:speed` | speed/limit display, tolerance and limit scope |

That is nineteen suites; the numeric suites report 127 checks, and the
packed-package suite reports pass or fail. Each suite exits non-zero on the
first failure, so `test:units` stops at the broken module.

The CI workflow runs `bun run test:units` on every push and pull request.

## Smoke test

Requires the local dev server and Chrome:

```sh
bun run dev        # terminal 1, http://127.0.0.1:3000
bun run test:smoke # terminal 2
```

The script uses `puppeteer-core` with the installed Chrome. Override the paths
with `KVALI_URL` and `CHROME_PATH` if needed. It covers onboarding, the map,
GPS, search, routing, navigation HUD, camera panning, GPX import/export and
offline route reuse.

## Offline test

Build and preview first:

```sh
bun run build
bunx vite preview --host 127.0.0.1 --port 4173   # terminal 1
bun run test:offline                             # terminal 2
```

Use `vite preview --host 127.0.0.1`. The plain `bun run preview` may bind only
`localhost`/IPv6, and the test connects to `127.0.0.1`.

## Nationwide graph test

An installed or downloaded routing package can be validated outside the app:

```sh
bun scripts/test-nationwide-graph.mjs path/to/georgia-routing-graph-v3.kvr.gz
```

The script decompresses the package, validates every offset and edge, and
calculates a Tbilisi-to-Batumi route. It needs the real published artifact, so
it is not part of `test:units`.

## What the suites do not cover

- Native Android UI, permissions and the WebView bridge.
- Background location, because it needs a physical device.
- The published Georgia routing package as loaded by the app, until it is
  tested on a device in airplane mode.
- Native MBTiles.
- Voice quality, which depends on the installed TTS engine and language pack.
- Flaky upstream services. Overpass 429/502 responses are logged as warnings,
  not failures, because the app handles them by showing cached or empty data.

A green run is evidence for the web build only. It is not a claim that the
release APK was tested on a device.
