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

async function resolveTileTemplates(styleUrl: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(styleUrl, { signal });
  const style = await res.json();
  const templates: string[] = [];
  const sources = (style && style.sources) || {};

  for (const key of Object.keys(sources)) {
    const src = sources[key];
    if (Array.isArray(src?.tiles)) {
      templates.push(...src.tiles);
    } else if (typeof src?.url === 'string') {
      try {
        const tj = await (await fetch(src.url, { signal })).json();
        if (Array.isArray(tj?.tiles)) templates.push(...tj.tiles);
      } catch {
        /* ignore unusable source */
      }
    }
  }
  return templates;
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

  const templates = await resolveTileTemplates(styleUrl, signal);
  let urls = buildRegionUrls(templates, bbox, minZoom, maxZoom);
  const capped = urls.length > MAX_TILES;
  if (capped) urls = urls.slice(0, MAX_TILES);

  const total = urls.length;
  let done = 0;
  let bytes = 0;
  onProgress?.({ done, total, bytes });

  for (const url of urls) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, { signal });
      const buf = await res.arrayBuffer();
      bytes += buf.byteLength;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
    }
    done += 1;
    onProgress?.({ done, total, bytes });
  }

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
