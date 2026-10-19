import { OfflineRegion } from '../types';

export type BBox = [number, number, number, number]; // minLon, minLat, maxLon, maxLat

export interface PrefetchProgress {
  done: number;
  total: number;
  bytes: number;
}

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
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

interface StyleAssets {
  tiles: string[];
  assets: string[];
}

async function resolveStyleAssets(
  styleUrl: string,
  signal: AbortSignal | undefined,
  cache: Cache | null
): Promise<StyleAssets> {
  const res = await fetch(styleUrl, { signal });
  const style = await res.json();
  await cacheResponse(cache, styleUrl, res);

  const tiles: string[] = [];
  const assets: string[] = [];
  const sources = (style && style.sources) || {};

  for (const key of Object.keys(sources)) {
    const src = sources[key];
    if (Array.isArray(src?.tiles)) {
      tiles.push(...src.tiles);
    } else if (typeof src?.url === 'string') {
      assets.push(src.url);
      try {
        const tjRes = await fetch(src.url, { signal });
        const tj = await tjRes.json();
        await cacheResponse(cache, src.url, tjRes);
        if (Array.isArray(tj?.tiles)) tiles.push(...tj.tiles);
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
  templates: string[],
  bbox: BBox,
  minZoom: number,
  maxZoom: number
): string[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const template of templates) {
    for (let z = minZoom; z <= maxZoom; z++) {
      const x0 = lon2tileX(minLon, z);
      const x1 = lon2tileX(maxLon, z);
      const y0 = lat2tileY(maxLat, z);
      const y1 = lat2tileY(minLat, z);

      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
          const url = template
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
  minZoom?: number;
  maxZoom?: number;
  onProgress?: (p: PrefetchProgress) => void;
  signal?: AbortSignal;
}): Promise<{ tiles: number; bytes: number; total: number; capped: boolean }> {
  const { bbox, styleUrl, minZoom = 9, maxZoom = 14, onProgress, signal } = opts;

  const cache = await openCache();
  const { tiles: templates, assets } = await resolveStyleAssets(styleUrl, signal, cache);

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

  let urls = buildRegionUrls(templates, bbox, minZoom, maxZoom);
  const capped = urls.length > MAX_TILES;
  if (capped) urls = urls.slice(0, MAX_TILES);

  const total = urls.length;
  let done = 0;
  let bytes = 0;
  let cursor = 0;
  onProgress?.({ done, total, bytes });

  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const index = cursor++;
      if (index >= urls.length) return;

      const url = urls[index];
      try {
        const res = await fetch(url, { signal });
        const copy = res.clone();
        const buf = await res.arrayBuffer();
        bytes += buf.byteLength;
        await cacheResponse(cache, url, copy);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
      }
      done += 1;
      onProgress?.({ done, total, bytes });
    }
  };

  const workers = Math.min(DOWNLOAD_CONCURRENCY, Math.max(1, total));
  await Promise.all(Array.from({ length: workers }, worker));

  return { tiles: done, bytes, total, capped };
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
