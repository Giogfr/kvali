# Navigation engine

The live guidance engine is deliberately small and testable. It takes the
route geometry returned by OSRM or Valhalla and the latest GPS fix, and derives
everything else locally.

## Route progress

`src/lib/navigation.ts` treats a route as a list of `[longitude, latitude]`
vertices.

- `cumulativeDistances()` walks the polyline with the haversine formula and
  returns the distance from the start to every vertex.
- `projectOnRoute()` converts nearby points to local metres, projects the GPS
  fix onto each segment, and returns the distance along the route plus the
  perpendicular offset.
- `snapToRoute()` returns the closest point on the line and the bearing of that
  segment. The vehicle marker is drawn at the snapped position, so it stays on
  the road rather than floating beside it.
- `computeProgress()` combines the above with the route's steps to produce the
  remaining distance, remaining minutes, the next maneuver and the off-route
  distance.

No value is guessed: if the route has no steps, `nextStep` is `null`; if the
route is empty, the caller gets a zero-length or null result.

## Off-route detection

`src/lib/navigationEngine.ts` owns the reroute decision.

| Condition | Threshold |
| --- | --- |
| Urban deviation | 50 m |
| Highway deviation (over 80 km/h) | 150 m |
| Deviation must persist | 3 s |
| Minimum time between reroutes | 15 s |

`OffRouteDetector.update(offRouteM, speedKmh, now?)` returns
`{ reroute, thresholdM }`. The clock can be injected, so the unit tests run
without timers. The detector is reset when navigation starts, ends, or loses
GPS.

A single noisy GPS fix cannot trigger a reroute because the deviation has to
last three seconds. A reroute also cannot loop: after one request the detector
waits fifteen seconds before asking again.

## Camera bearing

`resolveBearing(mode, headingDegrees, compassDegrees)` returns:

- `north`: 0, map stays north-up.
- `direction`: the GPS travel heading, or 0 when unavailable.
- `compass`: the device compass heading, or 0 when unavailable.

The app stores the user's choice and never invents a heading.

## Sharp curves

`findSharpCurveAhead()` looks at route vertices between 10 m and 300 m ahead
(default) and compares the incoming and outgoing segment bearings. A bend of
55 degrees or more becomes a HUD chip. This is derived from the route itself,
so it works without any network request and cannot report a curve that is not
in the route geometry.

## Tests

```sh
bun run test:engine       # off-route detector and bearing modes
bun run test:navigation   # projection, snapping, progress, curves
```

The scripts import the TypeScript modules directly, so they exercise the same
code the app ships.
