/**
 * End-to-end smoke test for the web build.
 *
 * Uses the locally installed Chrome (no browser download) and a simulated GPS
 * position in Kutaisi. Run the dev server first, then: bun run test:smoke
 */

import puppeteer from 'puppeteer-core';

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
    entry.includes('net::ERR_TIMED_OUT');
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
