# Privacy

## No accounts, no analytics

Kvali has no sign-in, no advertising SDK, no crash reporter and no analytics
service. The app does not send usage events anywhere.

## Data stored on the device

Everything you create stays in the WebView's local storage or the HTTP cache:

- settings: theme, language, units, layers, voice, alert preferences
- saved places, collections, temporary pins and recent searches
- recorded tracks and imported GPX files
- community reports you create
- saved routes and routing preferences
- downloaded tile/style responses in the Cache API
- onboarding and camera state

Use Settings to clear this data, or clear the app's storage from Android.

## Network requests

To show a map and calculate a route, the app must talk to the services listed
in [Data sources](data-sources.md). Those requests necessarily reveal your IP
address to the service, and routing, search and alert requests include
coordinates.

- Map tiles: OpenFreeMap receives the map area you are viewing.
- Search: Nominatim receives the text you type and the result location.
- Routing: OSRM or Valhalla receives the start and destination coordinates.
- Alerts and POIs: Overpass receives a bounding box around your position.

There is no Kvali server in the middle and no request log kept by the project.

## Permissions

- Location is requested only when you start navigation, record a track or tap
  the locate button.
- The app does not request background location yet. When that changes, the
  permission flow will be explained before the system dialog appears.
- Notifications are used for the Android foreground service once background
  tracking is implemented.

## Reports and removal

Community reports are stored locally and are not uploaded by this build. If a
future version adds sharing, that will be opt-in and documented here first.

To report a privacy problem, open an issue at
<https://github.com/Giogfr/kvali/issues>.
