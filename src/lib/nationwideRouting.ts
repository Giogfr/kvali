import { parsePackedRoutingGraph, type PackedRoutingGraph } from './offlinePackedRouting';

const DATABASE_NAME = 'kvali_nationwide_routing_v2';
const STORE_NAME = 'packages';
const PACKAGE_KEY = 'georgia-car';
export const DEFAULT_NATIONWIDE_GRAPH_URL =
  'https://github.com/Giogfr/kvali/releases/latest/download/georgia-routing-graph-v2.json.gz';

interface StoredPackage {
  key: string;
  bytes: ArrayBuffer;
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

async function readPackage(): Promise<StoredPackage | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(PACKAGE_KEY);
    request.onsuccess = () => resolve((request.result as StoredPackage | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Nationwide routing package could not be read'));
  });
}

async function writePackage(value: StoredPackage): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Nationwide routing package could not be stored'));
  });
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function decodePackage(bytes: ArrayBuffer, compressed: boolean): Promise<unknown> {
  const decoded = compressed && 'DecompressionStream' in window
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(decoded);
}

function parseSha256(text: string): string | null {
  return text.trim().match(/^[a-f0-9]{64}/i)?.[0].toLowerCase() || null;
}

export async function loadInstalledNationwideGraph(): Promise<PackedRoutingGraph | null> {
  try {
    const stored = await readPackage();
    if (!stored || (await sha256(stored.bytes)) !== stored.sha256) return null;
    return parsePackedRoutingGraph(await decodePackage(stored.bytes, true));
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
