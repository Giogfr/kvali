# Kvali — Navigation for Georgia

Kvali (კვალი, "trace") is an open-source navigation app for Georgia. It's a React app that runs in the browser and on Android through Capacitor.

Maps come from OpenStreetMap vector tiles rendered with MapLibre GL, search and reverse geocoding from Nominatim, and car / walking / cycling routes from OSRM. The interface is bilingual (English and Georgian).

## Features

- Live GPS positioning — native location on Android, browser geolocation on the web
- Map view rendered with MapLibre GL, with layer toggles and point-of-interest overlays
- Place search backed by OpenStreetMap Nominatim, plus a small built-in Georgian catalogue
- Route planning for car, walking and cycling, with alternatives and waypoints (OSRM)
- Turn-by-turn navigation driven by your GPS fix, with spoken or chime guidance
- Offline map areas that cache real map tiles on the device
- Nearby points of interest loaded from OpenStreetMap (Overpass)
- Road alerts screen where you can drop your own hazard reports on the map
- Recorded tracks, saved places, and units / theme / language settings

## Project status

Kvali is a work in progress and not ready for real driving yet. Some things to be aware of:

- Routing, search and point-of-interest lookup need a network connection. Offline areas keep the map itself rendering, not the routing.
- The camera and hazard markers that ship with the app are demonstration data, not verified enforcement locations. Reports you add are stored only on your device.
- Map detail and coverage for Georgia come from OpenStreetMap and are only as good as the underlying community data.
- Voice guidance uses the platform speech synthesiser, so the available voices depend on the device.

The app has only been built, not field-tested — treat it as a development preview.

## How to test

The quickest loop is the web build, but a few things (native location, screen wake lock, offline tile caching) only behave properly on a real Android device.

### In the browser

1. `bun install` then `bun run dev` and open http://localhost:3000.
2. Allow the location prompt on the map screen. Without it the app falls back to a Kutaisi city centre and shows a "waiting for GPS" badge.
3. Tap the search bar and type a town (for example `Batumi` or `Gori`). Results come from Nominatim; the small built-in catalogue also matches locally.
4. Open a result's directions button, pick a route alternative, then **Start navigation**. If there is no GPS fix the manoeuvre banner stays on the first instruction; with a fix the banner, remaining distance and ETA update as you move.
5. Change the units to imperial in **Settings → Distance units** and confirm speed, distance and speed-limit values switch to mph/mi.
6. In **Settings → Voice guidance**, pick *Spoken*, *Chime* or *Muted*. A manoeuvre change should speak, chime, or stay silent accordingly.
7. **Offline Maps**: download an area and watch the progress bar fill. Turn on the connection (DevTools → Network → Offline) and confirm the map still renders from the cache. Search, routing and POIs will stop working offline, as noted above.
8. **Road alerts**: add a report at your location and confirm a marker appears on the map.

To exercise location-dependent screens without real movement, use your browser's sensor override (Chrome DevTools → Sensors → Location) and set a custom position, or take the APK out with you.

### On Android

1. Build and install the APK (see below), then open Kvali.
2. Grant location permission — select "While using the app" and, if asked, allow precise location.
3. Walk or drive a short distance and confirm the blue location dot follows you and the navigation banner advances.
4. Start navigation and leave the screen on: the display should stay awake while guidance is active.
5. Airplane mode test: download an offline area first, then switch the phone to airplane mode and confirm the map still draws the downloaded tiles.

### Checking a build

- `bun run lint` type-checks the source.
- `bun run build` produces `dist/`; the service worker is only registered on a production build, not during `bun run dev`.

## Stack

React 19, TypeScript, Vite, MapLibre GL JS, Tailwind CSS v4, Lucide, Capacitor.

## Web

Requires [Bun](https://bun.sh) (or npm).

```sh
bun install
bun run dev        # http://localhost:3000
```

Other scripts:

```sh
bun run build      # production build to dist/
bun run preview    # preview the production build
bun run lint       # type-check with tsc --noEmit
```

## Android

Requires JDK 21 and the Android SDK (platform 36 and build-tools 36).

```sh
bun run build
bunx cap sync android
cd android
./gradlew assembleDebug      # gradlew.bat on Windows
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Point the build at your SDK location in `android/local.properties` (`sdk.dir=...`); that file is not committed.

## Data and attribution

- Map data © OpenStreetMap contributors, available under the ODbL.
- Vector tiles served by OpenFreeMap.
- Geocoding by Nominatim.
- Routing by OSRM.

These are shared community services — please keep to reasonable request rates if you run your own copy.

## License

MIT — see [LICENSE](LICENSE).
