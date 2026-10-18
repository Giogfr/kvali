<p align="center">
  <img src="public/logo.svg" width="88" height="88" alt="Kvali logo" />
</p>

<h1 align="center">Kvali</h1>

<p align="center"><b>კვალი</b> — navigation for Georgia. Open maps, real routing, and turn-by-turn guidance in English and Georgian.</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2F6FEB"></a>
  <a href="https://github.com/Giogfr/kvali/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Giogfr/kvali/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.4-2F6FEB">
  <br />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss&logoColor=white">
  <img alt="Android" src="https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white">
</p>

---

Kvali is an open-source navigation app for Georgia. It is a React + TypeScript app that runs in the browser and on Android through Capacitor. Maps are OpenStreetMap vector tiles rendered with MapLibre GL; search and reverse geocoding come from Nominatim, routes from OSRM, and nearby points of interest from Overpass.

> **Status: development preview (0.9.x).** Kvali is not ready for real driving yet. It has been built and tested in the browser and on an Android device, but not field-tested on the road. Please read [Project status](#project-status), [Demo data & simulated behaviour](#demo-data--simulated-behaviour), and [How to test](#how-to-test) before relying on it.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [How navigation works](#how-navigation-works)
- [State management](#state-management)
- [Customization](#customization)
- [Accessibility](#accessibility)
- [Offline behaviour](#offline-behaviour)
- [Data & attribution](#data--attribution)
- [Demo data & simulated behaviour](#demo-data--simulated-behaviour)
- [Android build](#android-build)
- [Releases](#releases)
- [How to test](#how-to-test)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### Maps & layers

- MapLibre GL map with light (Positron) and dark styles from OpenFreeMap, plus a low-detail fallback style when tiles are unreachable.
- A schematic SVG fallback view for devices or browsers without WebGL.
- Layer toggles for points of interest, speed/enforcement cameras, saved places, and recorded tracks.
- Live location dot, recenter control, and tap-to-drop pins anywhere on the map.

### Search & discovery

- Place search over OpenStreetMap Nominatim with a 3-character debounce and cancellable requests, backed by a small bundled Georgian catalogue.
- Category shortcuts (fuel, parking, food, hotels, hospitals, ATMs, EV charging, viewpoints, pharmacies, groceries, attractions, hiking).
- Nearby points of interest loaded from OpenStreetMap (Overpass) around the current area.
- Reverse geocoding when you tap the map.

### Routing & guidance

- Car, walking, and cycling routes from OSRM with alternatives, waypoints, and route preferences (avoid tolls, highways, unpaved).
- Turn-by-turn navigation driven by real GPS fixes: manoeuvre banner, remaining distance and ETA, off-route detection with automatic rerouting.
- Voice guidance via the platform speech synthesiser, with *spoken*, *chime*, and *muted* modes.
- Shareable route links (`?dest=…&name=…&mode=…`).

### Safety

- Road alerts screen for fixed cameras, average-speed zones, roadworks, accidents, closures and more, each individually toggleable.
- Report your own hazards at your location; your reports are stored only on your device.
- Configurable warning distance and a synthesised warning chime.

### Offline & device

- Offline map areas that cache real map tiles in device storage through a service worker, so the map keeps rendering without a connection.
- Screen wake lock while guidance or track recording is active.
- Metric / imperial units, light / dark theme, English / Georgian, all persisted locally.

### Personal tools

- Saved places with collections, notes, and JSON import/export.
- Recorded GPS tracks with GeoJSON export.
- Full-screen, safe-area-aware layout that adapts to phone portrait, landscape, and car displays.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19 |
| Language | TypeScript (strict) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Map | MapLibre GL JS with OpenStreetMap vector tiles |
| Icons | lucide-react |
| State | React Context + hooks (no state library) |
| Routing | Internal screen state synced with the URL (no router dependency) |
| Native | Capacitor 8 (`@capacitor/android`, `@capacitor/geolocation`) |
| Package manager | Bun (`bun.lock` is committed) |

## Requirements

- [Bun](https://bun.sh) 1.1+ (npm/pnpm also work — adjust the commands).
- Node.js 20+ for tooling that expects a Node runtime.
- For the Android build: JDK 21 and the Android SDK (platform 36 and build-tools 36).

## Getting started

```sh
# install dependencies
bun install

# start the dev server (http://localhost:3000)
bun run dev

# type-check
bun run lint

# production build into dist/
bun run build

# preview the production build locally
bun run preview
```

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the Vite dev server with HMR on port 3000. |
| `bun run build` | Create a production build in `dist/`. |
| `bun run preview` | Serve the production build locally. |
| `bun run lint` | Type-check with `tsc --noEmit`. |
| `bun run clean` | Remove the `dist/` directory. |

CI runs `lint` and `build` on every push to `main` and on pull requests (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Project structure

```text
src/
├─ components/
│  ├─ common/    # HeaderBar, Controls (ToggleSwitch, CustomSlider, chips), ErrorBoundary
│  ├─ layout/    # PhoneShell (responsive frame), BottomNav
│  └─ map/       # MapView (MapLibre), FallbackMap (SVG), PinCallout
├─ context/      # AppContext (app state), ToastContext
├─ data/         # seedPlaces.ts, seedAlerts.ts, seedRegions.ts, seedTracks.ts
├─ lib/          # geo.ts, navigation.ts, services.ts, location.ts, offline.ts,
│                # wakeLock.ts, translations.ts
├─ screens/      # One component per screen (lazy-loaded)
├─ types/        # Shared TypeScript types
├─ index.css     # Tailwind entry + design tokens, keyframes, utilities
├─ App.tsx       # Screen router + providers, code-split screens
└─ main.tsx      # React root, service-worker registration
public/
├─ favicon.svg, logo.svg
├─ sw.js                     # Tile/asset caching service worker
└─ maplibre-gl-worker.mjs
android/                       # Capacitor Android project
.github/workflows/ci.yml
```

## How navigation works

There is no router dependency. `AppContext` holds `currentScreen`, a `navHistory` stack, and a `navigateTo(screen)` helper; `goBack()` pops the stack. The browser back/forward buttons are wired through `popstate`. Route links are additionally deep-linkable: opening the app with `?dest=lat,lng&name=…&mode=…` opens route planning with that destination pre-filled.

Screens are loaded on demand with `React.lazy` + `Suspense`, so the map engine (~1 MB) is only fetched when a map screen is shown. This keeps the first load small.

## State management

Everything cross-cutting lives in one `AppProvider` (`src/context/AppContext.tsx`):

- **Localization** — `language` and the `t()` translator (English / Georgian).
- **Preferences** — `theme`, `units`, `voiceMode`, `travelMode`, `routePreferences`.
- **Location** — `userLocation`, `geolocationStatus`, `requestUserLocation`, continuous watch.
- **Places** — the bundled catalogue plus nearby Overpass POIs; selected place and dropped pin.
- **Routing** — origin/destination/waypoints, OSRM alternatives, and active-navigation state.
- **Alerts** — categories, distance/volume, your own reports.
- **Offline** — regions and their download state.
- **Saved places & tracks** — collections and recorded GPS tracks.
- **UI** — screen routing, toasts, the recenter trigger.

Persisted to `localStorage`: theme, language, units, voice mode, travel mode, route preferences, layers, alert settings, saved places, collections, tracks, and offline region state. Reset everything from **Settings → Reset data**.

## Customization

- **Bilingual strings** — `src/lib/translations.ts` holds the `en` and `ka` dictionaries.
- **Seed data** — `src/data/seedPlaces.ts`, `seedAlerts.ts`, `seedRegions.ts`, `seedTracks.ts`.
- **Design tokens** — the CSS custom properties at the top of `src/index.css` drive colours for both themes; keyframe animations and utilities live below them.
- **Native config** — `capacitor.config.ts` (app id `com.kvali.navigation`, name `Kvali`, web dir `dist`).
- **Branding** — `public/logo.svg` and `public/favicon.svg` are the source logo; the Android launcher icon lives under `android/app/src/main/res/`.

## Accessibility

- Semantic `<button>` controls with `aria-label`s and visible focus rings.
- `role="switch"` with `aria-checked` on toggles; labelled form controls.
- Screen transitions, toasts, staggered lists, dialogs, and skeletons all respect `prefers-reduced-motion`.

## Offline behaviour

Downloaded areas store real map tiles in device storage (`public/sw.js` caches the tile hosts), so the map keeps drawing without a connection and on weak rural signal.

What still needs a connection:

- Search and reverse geocoding (Nominatim).
- Point-of-interest lookup (Overpass).
- Turn-by-turn routing (OSRM).

Voice guidance uses the device speech synthesiser, so the available voices and languages depend on the platform.

## Data & attribution

- Map data © OpenStreetMap contributors, available under the ODbL.
- Vector tiles served by OpenFreeMap.
- Geocoding and reverse geocoding by Nominatim.
- Routing by OSRM.
- Points of interest by Overpass.

These are shared community services — keep to reasonable request rates if you run your own copy, and respect each service's usage policy.

## Demo data & simulated behaviour

Kvali bundles some sample content so the screens are explorable. It is not verified data:

- The camera and hazard markers in `seedAlerts.ts` are **demonstration data**, not real enforcement locations.
- The bundled place catalogue in `seedPlaces.ts` is a small hand-written sample; live results come from OpenStreetMap.
- Offline regions in `seedRegions.ts` are start points for real tile downloads, not pre-baked tiles.
- The bundled track history in `seedTracks.ts` is sample content.
- Your own hazard reports and recorded tracks are stored **on this device only** and are never uploaded.

## Android build

Requires JDK 21 and the Android SDK (platform 36, build-tools 36).

```sh
bun run build
bunx cap sync android
cd android
./gradlew assembleDebug      # gradlew.bat on Windows
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Point the build at your SDK with `android/local.properties` (`sdk.dir=…`); that file is not committed.

## Releases

Tagged builds attach the debug APK as a release asset, so you can download and sideload it directly:

- Browse the [Releases](https://github.com/Giogfr/kvali/releases) page and download the APK from the latest release.
- On the phone, allow installs from your browser, then open the downloaded APK.
- Grant location permission on first launch and choose precise location where offered.

Release APKs are unsigned debug builds; for distribution you would need to add a signing config to `android/app/build.gradle`.

## How to test

The quickest loop is the web build, but native location, the screen wake lock, and the tile cache only behave properly on a real Android device.

### In the browser

1. `bun install`, then `bun run dev` and open http://localhost:3000.
2. Allow the location prompt on the map screen. Without it the app falls back to a Kutaisi city centre and shows a "waiting for GPS" badge.
3. Tap the search bar and type a town (for example `Batumi` or `Gori`). Results come from Nominatim; the bundled catalogue also matches locally.
4. Open a result's directions button, pick a route alternative, then **Start navigation**. Without a GPS fix the banner stays on the first instruction; with a fix the banner, remaining distance, and ETA update as you move.
5. Switch **Settings → Distance units** to imperial and confirm speed, distance, and speed-limit values change to mph/mi.
6. In **Settings → Voice guidance**, pick *Spoken*, *Chime*, or *Muted* and confirm guidance speaks, chimes, or stays silent.
7. **Offline Maps**: download an area and watch real tiles cache. Go offline (DevTools → Network → Offline) and confirm the map still renders; search and routing will stop.
8. **Road alerts**: add a report and confirm a marker appears on the map.

To exercise location screens without moving, use your browser's sensor override (Chrome DevTools → Sensors → Location) and set a custom position.

### On Android

1. Install the APK from [Releases](#releases), then open Kvali.
2. Grant location permission — choose "While using the app" and allow precise location if asked.
3. Move a short distance and confirm the blue dot follows you and the guidance banner advances.
4. Start navigation and leave the screen on: the display should stay awake while guidance is active.
5. Airplane-mode test: download an offline area first, switch to airplane mode, and confirm the downloaded tiles still draw.

### Checking a build

- `bun run lint` type-checks the source.
- `bun run build` produces `dist/`; the service worker only registers on a production build, not during `bun run dev`.

## Troubleshooting

- **Blank page / no map** — confirm the browser supports WebGL. Without it, Kvali falls back to a schematic SVG map; you can also force it from the map's "Switch to SVG Map" control.
- **"Low-detail demo style" notice** — the OpenFreeMap style could not be fetched; the app drops to a lightweight demo style.
- **Map worker error** — usually the MapLibre worker failed to load; it should fall back to the SVG map. Rebuilding (`bun run build`) normally fixes a stale worker asset.
- **Stale map tiles or saved data** — state and tiles are cached. Clear site data / storage for the origin to reset, or use **Settings → Reset data**.
- **Location never starts** — permission was denied; re-enable location for the site/app in system settings and reload.
- **On Android, the web build changed but the app did not** — run `bunx cap sync android` and rebuild the APK.

## Contributing

Contributions are welcome. Keep it framework-light, match the existing code style, and run `bun run lint` and `bun run build` before opening a pull request. There is no automated test suite yet — adding tests for the pure helpers in `src/lib/` would be a great first contribution.

## License

MIT © 2026 Giogfr — see [LICENSE](LICENSE).

Map data © OpenStreetMap contributors (ODbL). See [Data & attribution](#data--attribution) for third-party services.
