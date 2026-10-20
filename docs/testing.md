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

## What the suites do not cover

- Native Android UI, permissions and the WebView bridge.
- Background location, because it needs a physical device.
- Offline routing and native MBTiles, because those are not implemented yet.
- Voice quality, which depends on the installed TTS engine and language pack.
- Flaky upstream services. Overpass 429/502 responses are logged as warnings,
  not failures, because the app handles them by showing cached or empty data.

A green run is evidence for the web build only. It is not a claim that the
release APK was tested on a device.
