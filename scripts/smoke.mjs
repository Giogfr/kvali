/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * End-to-end smoke test for the web build.
 *
 * Uses the locally installed Chrome (no browser download) and a simulated GPS
 * position in Kutaisi. Run the dev server first, then: bun run test:smoke
 */

import puppeteer from 'puppeteer-core';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.KVALI_URL || 'http://127.0.0.1:3000';
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
const browserErrors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickText(page, selector, text) {
  const clicked = await page.evaluate(
    (sel, needle) => {
      const element = [...document.querySelectorAll(sel)].find((node) =>
        (node.textContent || '').includes(needle)
      );
      if (!element) return false;
      element.click();
      return true;
    },
    selector,
    text
  );
  if (!clicked) throw new Error(`Could not find "${text}" in ${selector}`);
  await sleep(400);
}

async function mapState(page) {
  return page.evaluate(() => {
    const map = window.__kvaliMap;
    if (!map) return null;
    const center = map.getCenter();
    return {
      loaded: map.loaded(),
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      center: [center.lng, center.lat],
      layers: map.getStyle()?.layers?.length ?? 0,
      has3d: !!map.getStyle()?.layers?.some((layer) => layer.id === 'kvali-3d-buildings'),
    };
  });
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

try {
  const origin = new URL(BASE).origin;
  await browser.defaultBrowserContext().overridePermissions(origin, ['geolocation']);

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 900, isMobile: true, hasTouch: true });
  await page.setGeolocation({ latitude: 42.2679, longitude: 42.6946, accuracy: 8 });

  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });

  // Start from a clean state so previous routes and settings cannot mask bugs.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  // A brand-new install gets the download/location/voice walkthrough.
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Keep the map offline') ||
      document.body.innerText.includes('Download maps'),
    { timeout: 15000 }
  );
  check('first-run onboarding appears', true);

  await page.evaluate(() => localStorage.setItem('kvali_onboarded', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__kvaliMap, { timeout: 30000 });
  await page.waitForFunction(() => window.__kvaliMap?.loaded() === true, { timeout: 30000 });
  await sleep(1500);

  const initial = await mapState(page);
  check('map initialises', !!initial && initial.loaded && initial.layers > 10, JSON.stringify(initial));

  // A real GPS fix should arrive in Chrome's emulated position.
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return !text.includes('Location is off') && !text.includes('Waiting for GPS');
    },
    { timeout: 20000 }
  );
  check('GPS fix arrives and banner clears', true);

  // Mouse panning must move the map.
  const canvas = await page.$('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  const beforePan = await mapState(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, {
    steps: 10,
  });
  await page.mouse.up();
  await sleep(700);
  const afterPan = await mapState(page);
  check(
    'mouse drag pans the map',
    distanceKm(beforePan.center, afterPan.center) > 0.02,
    `${distanceKm(beforePan.center, afterPan.center).toFixed(3)} km`
  );

  const beforeZoom = (await mapState(page)).zoom;
  await page.click('[aria-label="Zoom in"]');
  await sleep(600);
  const afterZoom = (await mapState(page)).zoom;
  check('zoom button changes zoom', afterZoom > beforeZoom, `${beforeZoom} -> ${afterZoom}`);

  await page.click('[aria-label="Tilt / 3D view"]');
  await sleep(900);
  const tilted = await mapState(page);
  check('3D button tilts the camera', tilted.pitch > 10, `pitch ${tilted.pitch.toFixed(1)}`);
  check('3D buildings layer is registered', tilted.has3d);

  // Every main tab should open without an unhandled error.
  const tabs = [
    ['Search', 'Search'],
    ['Saved', 'Saved Places'],
    ['Alerts', 'Road Alerts'],
    ['Settings', 'Settings'],
    ['Map', null],
  ];
  for (const [tab, heading] of tabs) {
    await clickText(page, 'nav button', tab);
    if (heading) {
      await page.waitForFunction(
        (text) => document.body.innerText.includes(text),
        { timeout: 10000 },
        heading
      );
    }
    check(`${tab} tab opens`, true);
  }

  // Preferences: theme, language and units should apply immediately and persist.
  await clickText(page, 'nav button', 'Settings');
  await clickText(page, 'button', 'Dark');
  const darkTheme = await page.evaluate(() =>
    document.documentElement.classList.contains('dark')
  );
  check('dark theme applies', darkTheme);

  await clickText(page, 'button', 'ქართული');
  const georgianUi = await page.evaluate(
    () =>
      document.body.innerText.includes('პარამეტრები') &&
      localStorage.getItem('kvali_lang') === 'ka'
  );
  check('Georgian language switches the UI and is stored', georgianUi);
  await clickText(page, 'button', 'English');
  await page.waitForFunction(() => document.body.innerText.includes('Settings'), {
    timeout: 10000,
  });
  const englishStored = await page.evaluate(() => localStorage.getItem('kvali_lang') === 'en');
  check('English language can be restored', englishStored);

  await clickText(page, 'button', 'Imperial (mi, ft)');
  const imperial = await page.evaluate(() => localStorage.getItem('kvali_units'));
  check('imperial units are stored', imperial === 'imperial', String(imperial));
  await clickText(page, 'button', 'Metric (km, m)');

  await clickText(page, 'button', 'Light');
  const lightTheme = await page.evaluate(
    () =>
      !document.documentElement.classList.contains('dark') &&
      localStorage.getItem('kvali_theme') === 'light'
  );
  check('light theme restores and is stored', lightTheme);

  // Map layer screen and layer toggles.
  await clickText(page, 'nav button', 'Map');
  await page.click('[aria-label="Map layers"]');
  await page.waitForFunction(() => document.body.innerText.includes('Positron Light'), {
    timeout: 10000,
  });
  await clickText(page, 'button', 'Dark Night');
  const darkMap = await page.evaluate(() =>
    document.documentElement.classList.contains('dark')
  );
  check('map style switches to dark', darkMap);
  await clickText(page, 'button', 'Positron Light');
  check(
    'map style switches back to light',
    await page.evaluate(() => !document.documentElement.classList.contains('dark'))
  );

  const switch3d = '[role="switch"][aria-label="3D buildings"]';
  const before3d = await page.$eval(switch3d, (node) => node.getAttribute('aria-checked'));
  await page.click(switch3d);
  const without3d = await page.$eval(switch3d, (node) => node.getAttribute('aria-checked'));
  await page.click(switch3d);
  const with3d = await page.$eval(switch3d, (node) => node.getAttribute('aria-checked'));
  check('3D buildings toggle updates', before3d !== without3d && with3d === before3d);

  await page.click('[aria-label="Back"]');
  await page.waitForFunction(
    () => !!window.__kvaliMap && window.__kvaliMap.loaded() === true,
    { timeout: 30000 }
  );
  check('map reloads after changing layers', true);

  // Long-press a spot, save it, and confirm it reaches the saved list.
  const mapCanvas = await page.$('.maplibregl-canvas');
  const mapBox = await mapCanvas.boundingBox();
  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
  await page.mouse.down();
  await sleep(700);
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some((node) =>
        (node.textContent || '').includes('Save place')
      ),
    { timeout: 10000 }
  );
  await clickText(page, 'button', 'Save place');
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await page.focus('input[type="text"]');
  await page.$eval('input[type="text"]', (input) => input.select());
  await page.type('input[type="text"]', 'My Test Spot');
  await clickText(page, 'button', 'Save changes');
  const storedPlaces = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kvali_saved_places') || '[]')
  );
  check(
    'a dropped pin is saved to the device',
    storedPlaces.some((place) => place.name === 'My Test Spot'),
    storedPlaces.map((place) => place.name).join(', ')
  );
  await clickText(page, 'nav button', 'Saved');
  await page.waitForFunction(() => document.body.innerText.includes('My Test Spot'), {
    timeout: 10000,
  });
  check('the saved place appears in the list', true);
  await page.click('[aria-label="Back"]');

  // Road alert filters and About.
  await clickText(page, 'nav button', 'Alerts');
  const alertSwitch = '[role="switch"][aria-label="Fixed speed cameras"]';
  await page.waitForSelector(alertSwitch, { timeout: 10000 });
  const beforeAlert = await page.$eval(alertSwitch, (node) => node.getAttribute('aria-checked'));
  await page.click(alertSwitch);
  const afterAlert = await page.$eval(alertSwitch, (node) => node.getAttribute('aria-checked'));
  await page.click(alertSwitch);
  check('alert category toggle updates', beforeAlert !== afterAlert);

  await clickText(page, 'nav button', 'Settings');
  await page.click('[aria-label="About Kvali"]');
  await page.waitForFunction(() => document.body.innerText.includes('About Kvali'), {
    timeout: 10000,
  });
  check('About screen opens', true);
  await page.click('[aria-label="Back"]');
  await page.waitForFunction(() => document.body.innerText.includes('Settings'), {
    timeout: 10000,
  });

  // GPX round-trip through the Trip Tools screen.
  const gpxDir = await mkdtemp(join(tmpdir(), 'kvali-gpx-'));
  const gpxPath = join(gpxDir, 'smoke-track.gpx');
  await writeFile(
    gpxPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="smoke" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Smoke test track</name><trkseg>
    <trkpt lat="42.2679" lon="42.6946"><time>2026-01-01T10:00:00Z</time></trkpt>
    <trkpt lat="42.2720" lon="42.7000"><time>2026-01-01T10:10:00Z</time></trkpt>
    <trkpt lat="42.2780" lon="42.7060"><time>2026-01-01T10:20:00Z</time></trkpt>
  </trkseg></trk>
</gpx>
`,
    'utf8'
  );

  await clickText(page, 'button', 'Trip Tools');
  await page.waitForFunction(() => document.body.innerText.includes('Import GPX'), {
    timeout: 10000,
  });
  const gpxInput = await page.$('input[type="file"]');
  await gpxInput.uploadFile(gpxPath);
  await page.waitForFunction(() => document.body.innerText.includes('Smoke test track'), {
    timeout: 10000,
  });
  const importedTrack = await page.evaluate(() => {
    const tracks = JSON.parse(localStorage.getItem('kvali_tracks') || '[]');
    return tracks.find((track) => track.title === 'Smoke test track') || null;
  });
  check(
    'GPX import adds a track with its real points and distance',
    importedTrack?.coordinates?.length === 3 && importedTrack?.distanceKm > 0.5,
    importedTrack
      ? `${importedTrack.coordinates.length} points, ${importedTrack.distanceKm} km, ${importedTrack.durationMinutes} min`
      : 'no track stored'
  );

  // Serialise through the same module the UI uses, and intercept the anchor
  // click so the check does not depend on the browser's download plumbing.
  const exported = await page.evaluate(async () => {
    const { trackToGpx } = await import('/src/lib/gpx.ts');
    const track = JSON.parse(localStorage.getItem('kvali_tracks') || '[]')[0];
    const xml = trackToGpx(track);
    window.__kvaliDownloads = [];
    window.__kvaliOriginalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        window.__kvaliDownloads.push(this.download);
        return;
      }
      return window.__kvaliOriginalAnchorClick.call(this);
    };
    return xml;
  });
  await page.evaluate(() => document.querySelector('button[title="Export GPX"]')?.click());
  const downloadState = await page.evaluate(() => {
    const state = {
      names: window.__kvaliDownloads,
      buttons: document.querySelectorAll('button[title="Export GPX"]').length,
      toast: document.body.innerText
        .split('\n')
        .filter((line) => /Export|GPX/i.test(line))
        .slice(0, 5)
        .join(' | '),
    };
    HTMLAnchorElement.prototype.click = window.__kvaliOriginalAnchorClick;
    return state;
  });
  const downloadNames = downloadState.names;
  check(
    'GPX export serialises a valid track and downloads it',
    exported.includes('<gpx') &&
      exported.includes('<trkpt') &&
      exported.includes('Smoke test track') &&
      downloadNames.length === 1 &&
      downloadNames[0] === 'Smoke-test-track.gpx',
    `files: ${downloadNames.join(', ') || 'none'}; buttons: ${downloadState.buttons}; ${downloadState.toast}`
  );

  await page.evaluate(() => document.querySelector('button[title="Delete track"]')?.click());
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('kvali_tracks') || '[]').length === 0,
    { timeout: 10000 }
  );
  check('imported track can be deleted', true);
  await rm(gpxDir, { recursive: true, force: true });

  await page.click('[aria-label="Back"]');
  await page.waitForFunction(() => document.body.innerText.includes('Settings'), {
    timeout: 10000,
  });

  // Search -> directions -> route calculation.
  await clickText(page, 'nav button', 'Search');
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await page.type('input[type="text"]', 'Bagrati');
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === 'Directions'
      ),
    { timeout: 30000 }
  );
  check('Nominatim search returns results', true);

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(
      (node) => node.getAttribute('aria-label') === 'Directions'
    );
    button?.click();
  });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some((button) =>
        (button.textContent || '').includes('Start Navigation')
      ),
    { timeout: 15000 }
  );
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        (node.textContent || '').includes('Start Navigation')
      );
      return !!button && !button.disabled;
    },
    { timeout: 60000 }
  );
  check('route calculates and Start Navigation is enabled', true);

  const cachedRoutes = await page.evaluate(() =>
    localStorage.getItem('kvali_saved_routes_v1')
  );
  check('route is saved for offline use', !!cachedRoutes && cachedRoutes.length > 50);

  await clickText(page, 'button', 'Start Navigation');
  await page.waitForFunction(() => document.body.innerText.includes('End Navigation'), {
    timeout: 15000,
  });
  await page.waitForSelector('.maplibregl-canvas');
  await page.waitForFunction(
    () => {
      const map = window.__kvaliMap;
      return !!map && map.getPitch() > 20 && map.getZoom() >= 15;
    },
    { timeout: 12000 }
  );
  const navigating = await mapState(page);
  check(
    'navigation follows the car with a tilted camera',
    navigating.pitch > 20 && navigating.zoom >= 15,
    `pitch ${navigating.pitch.toFixed(1)}, zoom ${navigating.zoom.toFixed(1)}`
  );

  // Let the initial easeTo finish; a drag during it would be overwritten.
  await page.waitForFunction(
    () => window.__kvaliMap && !window.__kvaliMap.isMoving(),
    { timeout: 5000 }
  );

  // Driver HUD: speed, a speed-limit sign (mapped or explicit dash) and controls.
  const hud = await page.evaluate(() => ({
    speed: document.body.innerText.includes('KM/H'),
    limitSign: !!document.querySelector(
      '[title="Speed limit"], [title="Speed limit not mapped here"]'
    ),
    controls: ['Follow', 'North up'].every((label) =>
      [...document.querySelectorAll('button')].some((b) => b.getAttribute('aria-label') === label)
    ),
  }));
  check(
    'navigation HUD shows speed, a speed-limit sign and camera controls',
    hud.speed && hud.limitSign && hud.controls,
    JSON.stringify(hud)
  );

  // The guidance overlay must be click-through so the driver can look around.
  // Find a spot where the map canvas is the hit target, so a POI marker or a
  // control cannot swallow the drag.
  const navCanvas = await page.$('.maplibregl-canvas');
  const navBox = await navCanvas.boundingBox();
  const dragStart = await page.evaluate(() => {
    const canvas = document.querySelector('.maplibregl-canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    for (let y = rect.top + rect.height * 0.15; y < rect.bottom - rect.height * 0.35; y += 24) {
      for (let x = rect.left + 16; x < rect.right - 100; x += 24) {
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
    }
    return null;
  });
  const beforeNavPan = await mapState(page);
  const startX = dragStart?.x ?? navBox.x + navBox.width * 0.3;
  const startY = dragStart?.y ?? navBox.y + navBox.height * 0.4;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 130, startY + 80, {
    steps: 12,
  });
  await page.mouse.up();
  await sleep(700);
  const afterNavPan = await mapState(page);
  check(
    'the map can be moved during navigation',
    distanceKm(beforeNavPan.center, afterNavPan.center) > 0.003,
    `${distanceKm(beforeNavPan.center, afterNavPan.center).toFixed(3)} km`
  );

  const recenterClickable = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Follow"]');
    if (!button) return false;
    button.click();
    return true;
  });
  await sleep(1400);
  const recentered = await mapState(page);
  check(
    'the follow button brings the camera back',
    recenterClickable && recentered.zoom >= 16,
    `zoom ${recentered.zoom.toFixed(1)}`
  );

  await clickText(page, 'button', 'End Navigation');
  await page.waitForFunction(() => !document.body.innerText.includes('End Navigation'), {
    timeout: 10000,
  });
  check('End Navigation returns to the map', true);

  // Offline route reuse: reload in offline mode with the same destination.
  const savedDestination = await page.evaluate(() => {
    localStorage.setItem('kvali_airplane_mode', 'true');
    const routes = JSON.parse(localStorage.getItem('kvali_saved_routes_v1') || '[]');
    if (routes.length === 0) throw new Error('no cached route to test');
    return routes[0].destination;
  });
  await page.goto(
    `${BASE}/?dest=${savedDestination.latitude},${savedDestination.longitude}&name=Saved%20destination`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }
  );
  try {
    await page.waitForFunction(() => document.body.innerText.includes('Start Navigation'), {
      timeout: 30000,
    });
    await page.waitForFunction(
      () => {
        const button = [...document.querySelectorAll('button')].find((node) =>
          (node.textContent || '').includes('Start Navigation')
        );
        return !!button && !button.disabled;
      },
      { timeout: 30000 }
    );
  } catch (error) {
    const info = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 1200),
      routes: (localStorage.getItem('kvali_saved_routes_v1') || '').slice(0, 240),
      airplane: localStorage.getItem('kvali_airplane_mode'),
      href: location.href,
    }));
    throw new Error(`offline route did not load: ${JSON.stringify(info)}`);
  }
  const offlineSaved = await page.evaluate(() =>
    /saved on this device/i.test(document.body.innerText)
  );
  check('offline mode reuses the saved route', offlineSaved);

  const benign = (entry) =>
    entry.includes('favicon') ||
    entry.includes('Download the React DevTools') ||
    entry.includes('maplibre-gl-worker');
  // Overpass is a volunteer service and is sometimes fully down. The app
  // handles that (empty/cached alerts), so treat its CORS/network noise as a
  // warning instead of an application failure.
  const externalService = (entry) =>
    entry.includes('overpass') ||
    entry.includes('blocked by CORS policy') ||
    entry.includes('net::ERR_FAILED') ||
    entry.includes('net::ERR_TIMED_OUT') ||
    entry.includes('net::ERR_CONNECTION_TIMED_OUT') ||
    // Chrome omits the URL for gateway errors; the dev server itself never
    // answers 5xx, so these come from the volunteer map services.
    entry.includes('status of 502') ||
    entry.includes('status of 503') ||
    entry.includes('status of 429');
  const fatalErrors = browserErrors.filter((entry) => !benign(entry) && !externalService(entry));
  const externalErrors = browserErrors.filter((entry) => !benign(entry) && externalService(entry));
  if (externalErrors.length > 0) {
    console.log(`WARN  ${externalErrors.length} external service error(s) while testing`);
  }
  check('no unhandled page errors', fatalErrors.length === 0, fatalErrors.slice(0, 5).join(' | '));
} catch (error) {
  check('smoke run completed', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
