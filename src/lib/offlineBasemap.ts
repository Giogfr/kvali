/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Download, verify and load the whole-country PMTiles basemap.
 *
 * The archive is stored as a Blob so MapLibre can read byte ranges through a
 * FileSource without keeping the 96 MB file in JavaScript memory.
 */

import * as maplibregl from 'maplibre-gl';
import { FileSource, PMTiles, Protocol } from 'pmtiles';
import type { Language, ThemeMode } from '../types';
import {
  BASEMAP_ARCHIVE_KEY,
  basemapAssetUrls,
  buildBasemapStyle,
} from './offlineBasemapStyle';
import { downloadOfflineSearchIndex, removeOfflineSearchIndex } from './offlineSearch';

export const DEFAULT_BASEMAP_URL =
  'https://giogfr.github.io/kvali/georgia-basemap-z13.pmtiles';

const DATABASE_NAME = 'kvali_offline_basemap_v1';
const STORE_NAME = 'packages';
const PACKAGE_KEY = 'georgia';
const META_KEY = 'georgia-meta';
const TILE_CACHE = 'kvali-tiles-v1';

interface StoredBasemap {
  key: string;
  blob: Blob;
  sha256: string;
  bytes: number;
  savedAt: number;
}

interface StoredBasemapMeta {
  key: string;
  sha256: string;
  bytes: number;
  savedAt: number;
}

let protocol: Protocol | null = null;
let archiveFile: File | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline basemap storage is unavailable'));
  });
}

async function readRecord<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Offline basemap could not be read'));
  });
}

async function writeRecord(value: StoredBasemap | StoredBasemapMeta): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Offline basemap could not be stored'));
  });
}

async function digestHex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseSha256(text: string): string | null {
  return text.trim().match(/^[a-f0-9]{64}/i)?.[0].toLowerCase() || null;
}

export async function hasInstalledBasemap(): Promise<boolean> {
  try {
    const meta = await readRecord<StoredBasemapMeta>(META_KEY);
    return !!meta && typeof meta.sha256 === 'string' && /^[a-f0-9]{64}$/.test(meta.sha256);
  } catch {
    return false;
  }
}

/** Reads the stored Blob and registers its PMTiles archive with MapLibre. */
export async function loadInstalledBasemap(): Promise<Blob | null> {
  try {
    const stored = await readRecord<StoredBasemap>(PACKAGE_KEY);
    if (!stored?.blob) return null;
    registerBasemap(stored.blob);
    return stored.blob;
  } catch {
    return null;
  }
}

export function registerBasemap(blob: Blob): void {
  if (!protocol) {
    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  if (protocol.get(BASEMAP_ARCHIVE_KEY)) return;
  archiveFile = new File([blob], BASEMAP_ARCHIVE_KEY, { type: 'application/octet-stream' });
  protocol.add(new PMTiles(new FileSource(archiveFile)));
}

export function isBasemapRegistered(): boolean {
  return protocol?.get(BASEMAP_ARCHIVE_KEY) !== undefined;
}

export function getBasemapStyle(theme: ThemeMode, language: Language) {
  return buildBasemapStyle(theme, language);
}

async function cacheStyleAssets(onProgress?: (done: number, total: number) => void) {
  if (typeof caches === 'undefined') return;
  const urls = basemapAssetUrls(buildBasemapStyle('light', 'en'));
  let done = 0;
  try {
    const cache = await caches.open(TILE_CACHE);
    for (const url of urls) {
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        }
      } catch {
        /* A missing glyph range only affects that label. */
      }
      done += 1;
      onProgress?.(done, urls.length);
    }
  } catch {
    /* The map package itself is still usable without cached sprites. */
  }
}

export async function downloadBasemap(
  onProgress?: (received: number, total: number | null) => void,
  signal?: AbortSignal,
  url = DEFAULT_BASEMAP_URL
): Promise<Blob> {
  await downloadOfflineSearchIndex(signal);
  const checksumResponse = await fetch(`${url}.sha256`, { signal });
  if (!checksumResponse.ok) throw new Error('Offline basemap checksum is not published');
  const expected = parseSha256(await checksumResponse.text());
  if (!expected) throw new Error('Offline basemap checksum is invalid');

  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error('Offline basemap could not be downloaded');
  // GitHub Pages can gzip the archive; browsers do not expose
  // Content-Encoding through CORS, so Content-Length may describe fewer bytes
  // than the decoded body. Use it only for progress, never for allocation.
  const total = Number(response.headers.get('Content-Length')) || null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(received, total);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const actual = await digestHex(bytes.buffer);
  if (actual !== expected) throw new Error('Offline basemap checksum does not match');

  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  await writeRecord({
    key: PACKAGE_KEY,
    blob,
    sha256: actual,
    bytes: blob.size,
    savedAt: Date.now(),
  } satisfies StoredBasemap);
  await writeRecord({
    key: META_KEY,
    sha256: actual,
    bytes: blob.size,
    savedAt: Date.now(),
  } satisfies StoredBasemapMeta);
  await cacheStyleAssets();
  registerBasemap(blob);
  return blob;
}

export async function removeBasemap(): Promise<void> {
  await removeOfflineSearchIndex();
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    store.delete(PACKAGE_KEY);
    const request = store.delete(META_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Offline basemap could not be removed'));
  });
  if (protocol) {
    maplibregl.removeProtocol('pmtiles');
    protocol = null;
    archiveFile = null;
  }
}
