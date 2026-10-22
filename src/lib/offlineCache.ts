/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Small localStorage cache for results that should survive a lost connection:
 * nearby POIs and mapped road alerts for a downloaded area.
 */

const PREFIX = 'kvali_offline_cache_';
const MAX_RECORDS = 24;

interface CacheRecord<T> {
  savedAt: number;
  data: T;
}

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function prune(): void {
  try {
    const records: { key: string; savedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '') as CacheRecord<unknown>;
        records.push({ key, savedAt: Number(parsed.savedAt) || 0 });
      } catch {
        records.push({ key, savedAt: 0 });
      }
    }
    if (records.length <= MAX_RECORDS) return;
    records.sort((a, b) => a.savedAt - b.savedAt);
    records.slice(0, records.length - MAX_RECORDS).forEach((record) => {
      localStorage.removeItem(record.key);
    });
  } catch {
    /* ignore */
  }
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRecord<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function readCachedValues<T>(keyPrefix: string, maxAgeMs: number): T[] {
  if (!storageAvailable()) return [];
  const values: T[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX + keyPrefix)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as CacheRecord<T>;
        if (!parsed || typeof parsed.savedAt !== 'number') continue;
        if (Date.now() - parsed.savedAt > maxAgeMs) continue;
        if (Array.isArray(parsed.data)) values.push(...parsed.data);
      } catch {
        // One damaged cache entry must not hide healthy offline data.
      }
    }
  } catch {
    return values;
  }
  return values;
}

export function writeCache<T>(key: string, data: T): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), data } satisfies CacheRecord<T>)
    );
    prune();
  } catch {
    /* storage full: the network result is still used for this session */
  }
}
