# Kvali documentation

These notes describe how the app is put together and, just as importantly,
which parts are **not** finished yet. Nothing here claims on-device
verification that has not happened.

- [Navigation engine](navigation-engine.md) — route progress, snapping,
  off-route detection, rerouting.
- [Georgian addresses](georgian-addresses.md) — Mtavruli/Mkhedruli
  normalization, postcodes, city bounds.
- [Background location](background-location.md) — plugin survey, licenses and
  the Android integration plan.
- [Offline routing](routing-graph.md) — generating a Georgia routing graph for
  on-device Valhalla.
- [Offline tiles](offline-tiles.md) — MBTiles plan and the Yermo plugin license
  review.
- [Data sources](data-sources.md) — live services, endpoints and failure
  behaviour.
- [Testing](testing.md) — unit, smoke and offline suites.
- [Privacy](privacy.md) — what stays on the device and what leaves it.

Project-wide licensing information is in the repository root: [`LICENSE`](../LICENSE),
[`NOTICE`](../NOTICE) and [`licenses/`](../licenses/).
