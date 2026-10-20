/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/* Kvali service worker.
 * Caches map tiles and app assets so the map still renders without a network.
 */

const VERSION = 'v1';
const TILE_CACHE = `kvali-tiles-${VERSION}`;
const ASSET_CACHE = `kvali-assets-${VERSION}`;

const MAP_HOSTS = [
  'tiles.openfreemap.org',
  'fonts.openfreemap.org',
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('kvali-') && !key.endsWith(VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isMapAsset(url) {
  return MAP_HOSTS.some((host) => url.hostname.endsWith(host));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isMapAsset(url)) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, ASSET_CACHE));
    } else {
      event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    }
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CLEAR_TILES') {
    event.waitUntil(caches.delete(TILE_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}
