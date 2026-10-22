import { PACKED_GRAPH_VERSION, parsePackedRoutingGraph, type PackedRoutingGraph } from './offlinePackedRouting';
import { gunzipSync } from 'fflate';

const DATABASE_NAME = 'kvali_nationwide_routing_v3';
const STORE_NAME = 'packages';
const PACKAGE_KEY = 'georgia-car';
const META_KEY = 'georgia-car-meta';
export const DEFAULT_NATIONWIDE_GRAPH_URL =
  'https://giogfr.github.io/kvali/georgia-routing-graph-v3.kvr.gz';

interface StoredPackage {
  key: string;
  bytes: ArrayBuffer;
  sha256: string;
  savedAt: number;
}

interface StoredMeta {
  key: string;
  version: number;
  sha256: string;
  savedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Nationwide routing storage is unavailable'));
  });
}

async function readRecord<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Nationwide routing package could not be read'));
  });
}

async function readPackage(): Promise<StoredPackage | null> {
  return readRecord<StoredPackage>(PACKAGE_KEY);
}

async function writeRecord(value: StoredPackage | StoredMeta): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Nationwide routing package could not be stored'));
  });
}

async function writePackage(value: StoredPackage): Promise<void> {
  await writeRecord(value);
  await writeRecord({
    key: META_KEY,
    version: PACKED_GRAPH_VERSION,
    sha256: value.sha256,
    savedAt: value.savedAt,
  } satisfies StoredMeta);
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function decodePackage(bytes: ArrayBuffer, compressed: boolean): Promise<ArrayBuffer> {
  if (!compressed) return bytes;
  if ('DecompressionStream' in window) {
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  const unpacked = gunzipSync(new Uint8Array(bytes));
  return unpacked.buffer.slice(unpacked.byteOffset, unpacked.byteOffset + unpacked.byteLength) as ArrayBuffer;
}

function parseSha256(text: string): string | null {
  return text.trim().match(/^[a-f0-9]{64}/i)?.[0].toLowerCase() || null;
}

/** Checks the install marker without reading or parsing the whole package. */
export async function hasInstalledNationwideGraph(): Promise<boolean> {
  try {
    const meta = await readRecord<StoredMeta>(META_KEY);
    return (
      !!meta &&
      meta.version === PACKED_GRAPH_VERSION &&
      typeof meta.sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(meta.sha256)
    );
  } catch {
    return false;
  }
}

export async function loadInstalledNationwideGraph(): Promise<PackedRoutingGraph | null> {
  try {
    const stored = await readPackage();
    if (!stored || (await sha256(stored.bytes)) !== stored.sha256) return null;
    const graph = parsePackedRoutingGraph(await decodePackage(stored.bytes, true));
    if (graph && !(await hasInstalledNationwideGraph())) {
      await writeRecord({
        key: META_KEY,
        version: PACKED_GRAPH_VERSION,
        sha256: stored.sha256,
        savedAt: stored.savedAt,
      } satisfies StoredMeta);
    }
    return graph;
  } catch {
    return null;
  }
}

export async function downloadNationwideGraph(
  url = DEFAULT_NATIONWIDE_GRAPH_URL,
  onProgress?: (received: number, total: number | null) => void,
  signal?: AbortSignal
): Promise<PackedRoutingGraph> {
  const checksumResponse = await fetch(`${url}.sha256`, { signal });
  if (!checksumResponse.ok) throw new Error('Nationwide routing checksum is not published');
  const expected = parseSha256(await checksumResponse.text());
  if (!expected) throw new Error('Nationwide routing checksum is invalid');
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error('Nationwide routing package could not be downloaded');
  const total = Number(response.headers.get('content-length')) || null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value);
    received += part.value.byteLength;
    onProgress?.(received, total);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const actual = await sha256(bytes.buffer);
  if (actual !== expected) throw new Error('Nationwide routing package checksum does not match');
  const graph = parsePackedRoutingGraph(await decodePackage(bytes.buffer, true));
  if (!graph) throw new Error('Nationwide routing package is invalid');
  await writePackage({ key: PACKAGE_KEY, bytes: bytes.buffer, sha256: actual, savedAt: Date.now() });
  return graph;
}
