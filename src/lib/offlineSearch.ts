/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Offline Georgia place search.
 *
 * The compact index is built from the current OpenStreetMap extract and
 * published next to the offline basemap. It stores places, POIs, streets and
 * address points so search still works in airplane mode without a geocoder.
 */

import { gunzipSync } from 'fflate';
import type { GeocodeResult } from './services';

export const DEFAULT_OFFLINE_SEARCH_URL =
  'https://giogfr.github.io/kvali/georgia-search-v1.json.gz';
export const OFFLINE_SEARCH_DATABASE = 'kvali_offline_search_v1';

const DATABASE_NAME = OFFLINE_SEARCH_DATABASE;
const STORE_NAME = 'packages';
const PACKAGE_KEY = 'georgia';
const META_KEY = 'georgia-meta';
const INDEX_MAGIC = 'KVALI-SEARCH';
const INDEX_VERSION = 1;

export type OfflineSearchRow = [
  name: string,
  nameEn: string,
  kind: string,
  latitude: number,
  longitude: number,
  importance: number,
];

export interface OfflineSearchIndex {
  entries: OfflineSearchRow[];
  prepared?: {
    names: string[];
    namesEn: string[];
  };
}

interface StoredSearchPackage {
  key: string;
  blob: Blob;
  sha256: string;
  bytes: number;
  savedAt: number;
}

interface StoredSearchMeta {
  key: string;
  version: number;
  sha256: string;
  bytes: number;
  savedAt: number;
}

interface RawSearchDocument {
  magic?: unknown;
  version?: unknown;
  entries?: unknown;
}

let cachedIndex: OfflineSearchIndex | null = null;
let pendingIndex: Promise<OfflineSearchIndex | null> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline search storage is unavailable'));
  });
}

async function readRecord<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Offline search index could not be read'));
  });
}

async function writeRecord(value: StoredSearchPackage | StoredSearchMeta): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Offline search index could not be stored'));
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

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function prepareIndex(index: OfflineSearchIndex): OfflineSearchIndex['prepared'] {
  if (index.prepared) return index.prepared;
  const names = new Array<string>(index.entries.length);
  const namesEn = new Array<string>(index.entries.length);
  for (let i = 0; i < index.entries.length; i += 1) {
    const row = index.entries[i];
    names[i] = normalizeSearchText(row[0]);
    namesEn[i] = row[1] ? normalizeSearchText(row[1]) : '';
  }
  index.prepared = { names, namesEn };
  return index.prepared;
}

export async function hasInstalledOfflineSearchIndex(): Promise<boolean> {
  try {
    const meta = await readRecord<StoredSearchMeta>(META_KEY);
    return (
      !!meta &&
      meta.version === INDEX_VERSION &&
      typeof meta.sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(meta.sha256)
    );
  } catch {
    return false;
  }
}

export async function loadInstalledOfflineSearchIndex(): Promise<OfflineSearchIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (pendingIndex) return pendingIndex;
  pendingIndex = (async () => {
    try {
      const stored = await readRecord<StoredSearchPackage>(PACKAGE_KEY);
      if (!stored?.blob) return null;
      const compressed = new Uint8Array(await stored.blob.arrayBuffer());
      const decoded = new TextDecoder().decode(gunzipSync(compressed));
      const document = JSON.parse(decoded) as RawSearchDocument;
      if (
        document.magic !== INDEX_MAGIC ||
        document.version !== INDEX_VERSION ||
        !Array.isArray(document.entries)
      ) {
        return null;
      }
      cachedIndex = { entries: document.entries as OfflineSearchRow[] };
      return cachedIndex;
    } catch {
      return null;
    } finally {
      pendingIndex = null;
    }
  })();
  return pendingIndex;
}

export async function downloadOfflineSearchIndex(
  signal?: AbortSignal,
  url = DEFAULT_OFFLINE_SEARCH_URL
): Promise<void> {
  if (await hasInstalledOfflineSearchIndex()) {
    cachedIndex = null;
    return;
  }
  const checksumResponse = await fetch(`${url}.sha256`, { signal });
  if (!checksumResponse.ok) throw new Error('Offline search checksum is not published');
  const expected = parseSha256(await checksumResponse.text());
  if (!expected) throw new Error('Offline search checksum is invalid');

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Offline search index could not be downloaded');
  const buffer = await response.arrayBuffer();
  const actual = await digestHex(buffer);
  if (actual !== expected) throw new Error('Offline search checksum does not match');

  const blob = new Blob([buffer], { type: 'application/gzip' });
  await writeRecord({
    key: PACKAGE_KEY,
    blob,
    sha256: actual,
    bytes: blob.size,
    savedAt: Date.now(),
  } satisfies StoredSearchPackage);
  await writeRecord({
    key: META_KEY,
    version: INDEX_VERSION,
    sha256: actual,
    bytes: blob.size,
    savedAt: Date.now(),
  } satisfies StoredSearchMeta);
  cachedIndex = null;
}

export async function removeOfflineSearchIndex(): Promise<void> {
  cachedIndex = null;
  pendingIndex = null;
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    store.delete(PACKAGE_KEY);
    const request = store.delete(META_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Offline search index could not be removed'));
  });
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, ' ');
}

function queryKindBoost(query: string, kind: string): number {
  if (query.includes('airport') && ['aerodrome', 'terminal', 'helipad'].includes(kind)) return 500;
  if (query.includes('station') && ['station', 'halt', 'bus_station', 'railway'].includes(kind)) return 250;
  return 0;
}

export function searchOfflineIndex(
  index: OfflineSearchIndex,
  query: string,
  near?: { latitude: number; longitude: number },
  language: 'en' | 'ka' = 'en',
  limit = 12
): GeocodeResult[] {
  const normalizedQuery = normalizeSearchText(query)
    .replace(/\brailway\b/g, 'station')
    .replace(/\bgas\b/g, 'fuel');
  if (normalizedQuery.length < 2) return [];
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const prepared = prepareIndex(index);
  if (!prepared) return [];

  const matches: { row: OfflineSearchRow; score: number; distance: number; id: number }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < index.entries.length; i += 1) {
    const row = index.entries[i];
    const name = prepared.names[i];
    const nameEn = prepared.namesEn[i];
    if (!name && !nameEn) continue;
    const kindText = row[2].replace(/_/g, ' ').toLowerCase();
    const haystack = `${name} ${nameEn} ${kindText}`.trim();
    let matchesAll = true;
    for (const token of tokens) {
      if (!haystack.includes(token)) {
        matchesAll = false;
        break;
      }
    }
    if (!matchesAll) continue;

    let score = 0;
    if (name === normalizedQuery) score = 1000;
    else if (nameEn === normalizedQuery) score = 960;
    else if (name.startsWith(normalizedQuery)) score = 820;
    else if (nameEn.startsWith(normalizedQuery)) score = 790;
    else if (haystack.includes(` ${normalizedQuery}`)) score = 620;
    else if (haystack.includes(normalizedQuery)) score = 520;
    else score = 300;
    score += row[5] + queryKindBoost(normalizedQuery, row[2]);

    const dist = near ? distanceKm(near.latitude, near.longitude, row[3], row[4]) : 0;
    score -= Math.min(dist, 120) * 0.15;

    const nameKa = name || row[0];
    const nameEnglish = nameEn || row[0];
    const dedupeKey = `${language === 'ka' ? nameKa : nameEnglish}|${row[3].toFixed(2)}|${row[4].toFixed(2)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    matches.push({ row, score, distance: dist, id: i });
  }

  matches.sort((a, b) => b.score - a.score || a.distance - b.distance || b.row[5] - a.row[5]);
  return matches.slice(0, limit).map(({ row, id }) => {
    const localName = row[0];
    const englishName = row[1] || row[0];
    const displayName = language === 'ka' ? englishName : localName;
    return {
      id: `offline-${id}`,
      name: language === 'ka' ? localName : englishName,
      displayName: displayName !== (language === 'ka' ? localName : englishName) ? displayName : kindLabel(row[2]),
      latitude: row[3],
      longitude: row[4],
      category: row[2],
      type: row[2],
    };
  });
}
