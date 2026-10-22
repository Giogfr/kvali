/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import type { OfflineRegion } from '../types';
import type { StyleSpecification } from 'maplibre-gl';

export type BBox = [number, number, number, number]; // minLon, minLat, maxLon, maxLat

export interface PrefetchProgress {
  done: number;
  total: number;
  bytes: number;
}

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
};

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  satellite: SATELLITE_STYLE,
};

const TILE_CACHE = 'kvali-tiles-v1';
const MAX_TILES = 1200;
const DOWNLOAD_CONCURRENCY = 6;

export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

const lon2tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);

const lat2tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null;
    return await caches.open(TILE_CACHE);
  } catch {
    return null;
  }
}

async function cacheResponse(cache: Cache | null, url: string, response: Response) {
  try {
    if (cache && response && (response.ok || response.type === 'opaque')) {
      await cache.put(url, response.clone());
    }
  } catch {
    /* storage quota or opaque response */
  }
}

interface TileSource {
  template: string;
  minzoom: number;
  maxzoom: number;
}

interface StyleAssets {
  tiles: TileSource[];
  assets: string[];
}

async function resolveStyleAssets(
  styleUrl: string,
  signal: AbortSignal | undefined,
  cache: Cache | null
): Promise<StyleAssets> {
  const res = await fetch(styleUrl, { signal });
  // Clone before reading: a Response body can only be consumed once.
  const copy = res.clone();
  const style = await res.json();
  await cacheResponse(cache, styleUrl, copy);

  const tiles: TileSource[] = [];
  const assets: string[] = [];
  const sources = (style && style.sources) || {};

  for (const key of Object.keys(sources)) {
    const src = sources[key];
    if (Array.isArray(src?.tiles)) {
      for (const template of src.tiles) {
        tiles.push({
          template,
          minzoom: src.minzoom ?? 0,
          maxzoom: src.maxzoom ?? 22,
        });
      }
    } else if (typeof src?.url === 'string') {
      assets.push(src.url);
      try {
        const tjRes = await fetch(src.url, { signal });
        const tjCopy = tjRes.clone();
        const tj = await tjRes.json();
        await cacheResponse(cache, src.url, tjCopy);
        const minzoom = tj?.minzoom ?? src.minzoom ?? 0;
        const maxzoom = tj?.maxzoom ?? src.maxzoom ?? 22;
        if (Array.isArray(tj?.tiles)) {
          for (const template of tj.tiles) tiles.push({ template, minzoom, maxzoom });
        }
      } catch {
        /* ignore unusable source */
      }
    }
  }

  // Icons used by the style (regular and high-DPI sprites).
  if (typeof style.sprite === 'string') {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) {
      assets.push(`${style.sprite}${suffix}`);
    }
  }

  // Glyphs for the fonts in this style: ASCII, Latin-1 and Georgian.
  // Without these, labels do not render offline.
  if (typeof style.glyphs === 'string') {
    const fontstacks = new Set<string>();
    for (const layer of style.layers || []) {
      const fonts = layer?.layout?.['text-font'];
      if (Array.isArray(fonts)) fonts.forEach((font: string) => fontstacks.add(font));
    }
    const ranges = ['0-255', '256-511', '4096-4351', '4352-4607'];
    for (const font of fontstacks) {
      for (const range of ranges) {
        assets.push(
          style.glyphs
            .replace('{fontstack}', encodeURIComponent(font))
            .replace('{range}', range)
        );
      }
    }
  }

  return { tiles, assets };
}

function buildRegionUrls(
  sources: TileSource[],
  bbox: BBox,
  minZoom: number,
  maxZoom: number
): string[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    // Do not request zooms the source does not have: the low-zoom raster
    // background only exists up to zoom 6, and asking for more returns 404s.
    const from = Math.max(minZoom, source.minzoom);
    const to = Math.min(maxZoom, source.maxzoom);
    for (let z = from; z <= to; z++) {
      const x0 = lon2tileX(minLon, z);
      const x1 = lon2tileX(maxLon, z);
      const y0 = lat2tileY(maxLat, z);
      const y1 = lat2tileY(minLat, z);

      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
          const url = source.template
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y))
            .replace('{s}', '');
          if (!seen.has(url)) {
            seen.add(url);
            urls.push(url);
          }
        }
      }
    }
  }
  return urls;
}

export async function prefetchRegion(opts: {
  bbox: BBox;
  styleUrl: string;
  /** Extra styles (for example the dark theme) downloaded in the same pass. */
  extraStyleUrls?: string[];
  minZoom?: number;
  maxZoom?: number;
  onProgress?: (p: PrefetchProgress) => void;
  signal?: AbortSignal;
}): Promise<{ tiles: number; failed: number; bytes: number; total: number; capped: boolean }> {
  const {
    bbox,
    styleUrl,
    extraStyleUrls = [],
    minZoom = 9,
    maxZoom = 14,
    onProgress,
    signal,
  } = opts;

  const cache = await openCache();
  if (!cache) {
    throw new Error('Offline tile storage is unavailable on this device');
  }
  const tileSources = new Map<string, TileSource>();
  const assets = new Set<string>();

  // Cache every style the app can switch to, so changing the theme offline
  // does not leave the map without a style.
  for (const url of [styleUrl, ...extraStyleUrls]) {
    const resolved = await resolveStyleAssets(url, signal, cache);
    for (const source of resolved.tiles) {
      const existing = tileSources.get(source.template);
      if (existing) {
        existing.minzoom = Math.min(existing.minzoom, source.minzoom);
        existing.maxzoom = Math.max(existing.maxzoom, source.maxzoom);
      } else {
        tileSources.set(source.template, { ...source });
      }
    }
    resolved.assets.forEach((asset) => assets.add(asset));
  }

  // Cache the style, sprites and fonts first so the map can boot offline.
  for (const url of assets) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, { signal });
      await cacheResponse(cache, url, res);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
    }
  }

  let urls = buildRegionUrls([...tileSources.values()], bbox, minZoom, maxZoom);
  const capped = urls.length > MAX_TILES;
  if (capped) urls = urls.slice(0, MAX_TILES);

  const total = urls.length;
  let done = 0;
  let cached = 0;
  let failed = 0;
  let bytes = 0;
  let cursor = 0;
  onProgress?.({ done, total, bytes });

  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const index = cursor++;
      if (index >= urls.length) return;

      const url = urls[index];

      // A paused download is resumed by starting the region again. Tiles that
      // already made it into the cache are skipped instead of fetched twice.
      try {
        const hit = cache ? await cache.match(url) : undefined;
        if (hit) {
          cached += 1;
          done += 1;
          onProgress?.({ done, total, bytes });
          continue;
        }
      } catch {
        /* treat a cache miss as a normal fetch */
      }

      try {
        const res = await fetch(url, { signal });
        if (!res.ok) {
          failed += 1;
        } else {
          const copy = res.clone();
          const buf = await res.arrayBuffer();
          bytes += buf.byteLength;
          await cacheResponse(cache, url, copy);
          cached += 1;
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        failed += 1;
      }
      done += 1;
      onProgress?.({ done, total, bytes });
    }
  };

  const workers = Math.min(DOWNLOAD_CONCURRENCY, Math.max(1, total));
  await Promise.all(Array.from({ length: workers }, worker));

  return { tiles: cached, failed, bytes, total, capped };
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    }
  } catch {
    /* not supported */
  }
  return null;
}

export async function clearTileCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(TILE_CACHE);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function isRegionDownloaded(region: OfflineRegion): boolean {
  return region.status === 'downloaded';
}

/** Turn persisted in-flight downloads into resumable work after a restart. */
export function recoverInterruptedRegions(regions: OfflineRegion[]): OfflineRegion[] {
  return regions.map((region) =>
    region.status === 'downloading' ? { ...region, status: 'paused' } : region
  );
}
