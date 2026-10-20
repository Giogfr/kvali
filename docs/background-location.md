# Background location

## Current state

Kvali uses `@capacitor/geolocation` to watch the position. On the web this is
`navigator.geolocation.watchPosition`. On Android the Capacitor plugin bridges
to the system location API, but the WebView is paused when the app goes to the
background, so guidance stops receiving fixes when the screen is off or the
user switches apps.

This is a real limitation. Background guidance is **not implemented yet**, and
the app does not claim otherwise.

## Plugin options and licenses

Both plugins were checked directly with `npm view` in October 2026.

| Plugin | Version | License | Notes |
| --- | --- | --- | --- |
| `@capacitor-community/background-geolocation` | 1.2.26 | MIT | Community plugin, foreground service, Android and iOS |
| `@capgo/background-geolocation` | 8.4.14 | **MPL-2.0** | The task brief described this as MIT; that is incorrect |

MPL-2.0 is compatible with this project's GPL-3.0-or-later license, but it is
file-level copyleft: modifications to the plugin's own files must be published
under MPL-2.0. That is an extra obligation the MIT plugin does not impose. The
recommended choice is `@capacitor-community/background-geolocation`.

## Integration plan (not done)

1. Install `@capacitor-community/background-geolocation` and run
   `bunx cap sync android` from the repository root.
2. Add the Android permissions:
   - `ACCESS_COARSE_LOCATION`
   - `ACCESS_FINE_LOCATION`
   - `ACCESS_BACKGROUND_LOCATION`
   - `FOREGROUND_SERVICE`
   - `FOREGROUND_SERVICE_LOCATION`
   - `POST_NOTIFICATIONS` (Android 13 and newer)
3. Request foreground location first, then background location in a second
   step. Android requires the user to choose "Allow all the time" in system
   settings; the app must explain why and must not pretend the permission was
   granted when it was not.
4. Add `src/lib/backgroundLocation.ts` as the single wrapper. It should expose
   `startBackgroundUpdates()`, `stopBackgroundUpdates()` and an honest
   `isAvailable()` that returns false on the web.
5. Keep the foreground `@capacitor/geolocation` path as the fallback. If the
   background plugin is missing or permission is denied, navigation continues
   with foreground fixes and the UI states the limitation.
6. Show a persistent notification while tracking, as required by Android for a
   foreground service.

## Verification

This needs a physical Android device. An emulator is not enough because the
background permission dialog and battery optimizations differ by OEM. Until
that test happens, this document is a plan, not a claim.
