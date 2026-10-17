# Kvali — Navigation for Georgia

Kvali (კვალი, "trace") is an open-source navigation app for Georgia. It's a React app that runs in the browser and on Android through Capacitor.

Maps come from OpenStreetMap vector tiles rendered with MapLibre GL, search and reverse geocoding from Nominatim, and car / walking / cycling routes from OSRM. The interface is bilingual (English and Georgian).

## Features

- Live GPS positioning — native location on Android, browser geolocation on the web
- Map view with layer toggles and speed-limit / point-of-interest overlays
- Place search with reverse geocoding, saved places and collections
- Route planning for car, walking and cycling, with alternatives and waypoints
- Recorded tracks, plus units, theme and language settings

## Project status

Kvali is a work in progress and not ready for real driving yet. The following parts are still simulated or missing:

- Active navigation shows a maneuver banner and a countdown, but it advances on a fixed timer instead of tracking your position along the route.
- Offline map downloads aren't implemented — the Offline Maps screen is interface only.
- Road alerts and speed cameras use placeholder data.
- When OSRM can't be reached (for example with no network), routing falls back to a straight-line estimate.

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
