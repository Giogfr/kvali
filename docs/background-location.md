# Background location

## Current state

Kvali uses `@capacitor/geolocation` for a single fix and `navigator.geolocation`
on the web. Continuous tracking is different: a WebView stops receiving
`watchPosition` callbacks when Android backgrounds the app, so turn-by-turn
guidance used to freeze with the screen off.

The Android build now starts a foreground service through
`@capacitor-community/background-geolocation` when tracking begins. The service
keeps delivering fixes while Kvali is backgrounded and shows a persistent
notification. On the web, and on native platforms where the plugin is missing,
the app falls back to `navigator.geolocation` / `Geolocation.watchPosition`;
navigation keeps working while the app is open.

## Plugin and license

The plugin was installed with `bun add` and its `LICENSE` was read from the
published package.

| Plugin | Version | License | Notes |
| --- | --- | --- | --- |
| `@capacitor-community/background-geolocation` | 1.2.26 | MIT | Android foreground service; iOS support is not used here |
| `@capgo/background-geolocation` | 8.4.14 | **MPL-2.0** | The task brief described this as MIT; that is incorrect |

MPL-2.0 is compatible with this project's GPL-3.0-or-later license, but it is
file-level copyleft: modifications to the plugin's own files must be published
under MPL-2.0. The MIT plugin avoids that extra obligation, so it is the one
installed.

## Implementation

- `src/lib/location.ts` registers the plugin lazily and only calls it on
  Android. `addWatcher` is configured with `stale: false` and a 5 m distance
  filter, which keeps city driving responsive without waking for every jitter.
- `src/lib/locationMath.ts` converts metres per second to km/h, rounds
  accuracy, clamps non-finite values to `null` and keeps six decimal places.
  All three sources (browser, Capacitor, background service) share it.
- `android/app/src/main/AndroidManifest.xml` declares
  `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION` and `POST_NOTIFICATIONS`. The plugin manifest
  merges the foreground service itself.
- Stopping a watcher calls `removeWatcher`, which also stops the service and
  its notification.

## What the user still has to do

Android 11 and newer do not allow an app to request background location in the
same dialog as foreground location. After granting location access, the user
must open system settings and choose **Allow all the time**; Kvali cannot grant
this for them and does not pretend otherwise.

On Android 13 and newer the ongoing notification also needs the notification
permission. The plugin requests location permission itself, but not
notification permission; until the user enables notifications, the service can
run while its notification stays hidden. A settings shortcut is provided from
the app so this is discoverable.

## Verification

`bunx cap sync android` finds the plugin, and `assembleDebug` completes with
Capacitor 8.5.3 and compileSdk 36. That proves the bridge compiles, not that
the service survives a real OEM battery manager.

Still required before claiming background navigation works:

1. Install the debug APK on a physical phone.
2. Grant location, then "Allow all the time", then notifications.
3. Start guidance, lock the screen, drive or simulate a route, and confirm the
   notification stays and the position keeps updating.
4. Repeat after a reboot and with battery saver on.

Until those steps are recorded, this is an implemented integration that has not
been verified on a device.
