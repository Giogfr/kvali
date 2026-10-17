# Kvali — Navigation for Georgia

Kvali (კვალი, "track/trace") is an open-source navigation prototype focused on Georgia. It renders OpenStreetMap vector tiles with MapLibre GL, supports bilingual (English/Georgian) UI, saved places and collections, simulated route planning, road-alert preferences, recorded tracks, and an offline-map demo.

Route calculation, GPS movement, cameras and downloadable map regions are deterministic simulations for prototype demonstration — not suitable for real driving.

## Stack

React 19, TypeScript, Vite, MapLibre GL JS, Tailwind CSS v4, Lucide icons.

## Getting started

Requires [Bun](https://bun.sh) (or npm).

```sh
bun install
bun run dev        # dev server on http://localhost:3000
```

Other scripts:

```sh
bun run build      # production build to dist/
bun run preview    # preview the production build
bun run lint       # type-check with tsc --noEmit
```

The app needs no API keys or environment variables. Saved places and preferences are stored in the browser's localStorage.

## Data attribution

Map data © OpenStreetMap contributors (ODbL). Vector tiles served by OpenFreeMap.

## License

MIT — see [LICENSE](LICENSE).
