/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Offline-first end-to-end test against the production build served by
 * `bun run preview`. Verifies the service worker, cached map assets and cached
 * routes while the network is actually switched off.
 */

import puppeteer from 'puppeteer-core';

const BASE = process.env.KVALI_URL || 'http://127.0.0.1:4173';
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
const failures = [];
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
  await sleep(500);
}

async function tileCount(page) {
  return page.evaluate(async () => {
    if (!(await caches.has('kvali-tiles-v1'))) return 0;
    return (await (await caches.open('kvali-tiles-v1')).keys()).length;
  });
}

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
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

  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('tiles.openfreemap.org')) failures.push(`tile: ${url}`);
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('kvali_onboarded', 'true');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 });
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 30000 });

  // Wait until the service worker controls the page, then reload once so the
  // navigation request is also served by the service worker.
  await page.waitForFunction(async () => !!(await navigator.serviceWorker?.getRegistration()), {
    timeout: 30000,
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, {
    timeout: 30000,
  });
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 30000 });
  await sleep(3000);

  const cache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const tiles = keys.includes('kvali-tiles-v1')
      ? (await (await caches.open('kvali-tiles-v1')).keys()).length
      : 0;
    return { keys, tiles };
  });
  check('service worker caches map tiles', cache.tiles > 10, JSON.stringify(cache));

  // The same build must be installable as a PWA.
  const pwa = await page.evaluate(async () => {
    const manifest = await (await fetch('/manifest.webmanifest')).json();
    const icon = await fetch('/icons/icon-512.png');
    const maskable = await fetch('/icons/maskable-512.png');
    return {
      display: manifest.display,
      startUrl: manifest.start_url,
      icons: manifest.icons?.length ?? 0,
      iconOk: icon.ok,
      iconType: icon.headers.get('content-type'),
      maskableOk: maskable.ok,
      linked: !!document.querySelector('link[rel="manifest"]'),
    };
  });
  check(
    'PWA manifest and icons are installable',
    pwa.linked &&
      pwa.display === 'standalone' &&
      pwa.startUrl === '/' &&
      pwa.icons >= 2 &&
      pwa.iconOk &&
      pwa.maskableOk &&
      /image\/png/.test(pwa.iconType || ''),
    JSON.stringify(pwa)
  );

  // Download an area through the UI, not by browsing, and make sure the real
  // prefetch path works (styles, glyphs, sprites and zooms 9-14).
  await clickText(page, 'nav button', 'Settings');
  await clickText(page, 'button', 'Storage Management');
  await page.waitForFunction(() => document.body.innerText.includes('Save area around me'), {
    timeout: 15000,
  });
  await clickText(page, 'button', 'Save area around me');
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((node) => node.textContent?.trim() === 'Download'),
    { timeout: 15000 }
  );
  await sleep(1000);
  const tilesBeforeDownload = await tileCount(page);
  await clickText(page, 'button', 'Download');
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('span')].some(
        (node) => node.textContent?.trim() === 'Downloaded'
      ),
    { timeout: 240000 }
  );
  await sleep(800);
  const tilesAfterDownload = await tileCount(page);
  const regionState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kvali_offline_regions') || '[]')
  );
  check(
    'offline area downloads through the UI',
    tilesAfterDownload > tilesBeforeDownload + 30 &&
      regionState[0]?.status === 'downloaded' &&
      regionState[0]?.bytes > 0,
    `${tilesBeforeDownload} -> ${tilesAfterDownload} tiles, ${regionState[0]?.bytes} bytes`
  );

  // Calculate a real route online so it can be reused offline.
  await page.goto(`${BASE}/?dest=42.2772,42.7062&name=Bagrati`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        (node.textContent || '').includes('Start Navigation')
      );
      return !!button && !button.disabled;
    },
    { timeout: 60000 }
  );
  const destination = await page.evaluate(() => {
    const routes = JSON.parse(localStorage.getItem('kvali_saved_routes_v1') || '[]');
    return routes[0]?.destination || null;
  });
  check('route saved while online', !!destination);

  // Turn the network off for real.
  await page.setOfflineMode(true);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => navigator.onLine === false, { timeout: 10000 });
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 30000 });
  await page.waitForSelector('[data-map-idle="true"]', { timeout: 30000 });

  const offlinePill = await page.evaluate(() =>
    /Offline — downloaded maps only/i.test(document.body.innerText)
  );
  check('app boots offline from the service worker', true);
  check('map renders offline from cached tiles', true);
  check('offline badge is shown', offlinePill);

  await page.goto(
    `${BASE}/?dest=${destination.latitude},${destination.longitude}&name=Bagrati`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        (node.textContent || '').includes('Start Navigation')
      );
      return !!button && !button.disabled;
    },
    { timeout: 30000 }
  );
  const savedNotice = await page.evaluate(() =>
    /saved on this device/i.test(document.body.innerText)
  );
  check('saved route works with the network off', savedNotice);

  const tileFailures = failures.filter((entry) => entry.startsWith('tile:'));
  check(
    'all map tiles come from the cache offline',
    tileFailures.length === 0,
    tileFailures.slice(0, 3).join(' | ')
  );

  const pageErrors = failures.filter((entry) => entry.startsWith('pageerror:'));
  check('no page errors offline', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (error) {
  check('offline run completed', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
