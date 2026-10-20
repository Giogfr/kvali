/**
 * Kvali — Georgian address normalization.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 *
 * OpenStreetMap address data in Georgia is structurally noisy: Mtavruli and
 * Mkhedruli scripts are mixed inside single words, city fields are often empty,
 * postcodes are rare, and some records carry a city name that disagrees with
 * the coordinates. This module cleans and cross-checks that data before it is
 * used for search or geocoding. It does not invent missing fields.
 */

export interface AddressRecord {
  text: string;
  latitude?: number;
  longitude?: number;
}

export interface NormalizedAddress {
  /** Mkhedruli-only, whitespace-collapsed, punctuation-normalized text. */
  text: string;
  /** Every 4-digit Georgian postcode found in the text. */
  postcodes: string[];
  /** Known city mentioned in the text, if any. */
  city: string | null;
  /** True when the text names a city but the coordinates are outside it. */
  coordinateMismatch: boolean;
}

interface CityBounds {
  en: string;
  ka: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Generous bounding boxes around Georgia's larger towns. They are deliberately
 * wider than the municipal boundary so a suburb is never flagged as a mismatch.
 */
const CITY_BOUNDS: CityBounds[] = [
  { en: 'Tbilisi', ka: 'თბილისი', minLat: 41.58, maxLat: 41.88, minLon: 44.62, maxLon: 45.08 },
  { en: 'Batumi', ka: 'ბათუმი', minLat: 41.52, maxLat: 41.72, minLon: 41.52, maxLon: 41.78 },
  { en: 'Kutaisi', ka: 'ქუთაისი', minLat: 42.18, maxLat: 42.34, minLon: 42.58, maxLon: 42.82 },
  { en: 'Zugdidi', ka: 'ზუგდიდი', minLat: 42.42, maxLat: 42.58, minLon: 41.76, maxLon: 41.98 },
  { en: 'Rustavi', ka: 'რუსთავი', minLat: 41.44, maxLat: 41.62, minLon: 44.92, maxLon: 45.18 },
  { en: 'Gori', ka: 'გორი', minLat: 41.90, maxLat: 42.08, minLon: 44.02, maxLon: 44.22 },
  { en: 'Poti', ka: 'ფოთი', minLat: 42.08, maxLat: 42.22, minLon: 41.58, maxLon: 41.76 },
  { en: 'Telavi', ka: 'თელავი', minLat: 41.92, maxLat: 42.08, minLon: 45.38, maxLon: 45.58 },
  { en: 'Mtskheta', ka: 'მცხეთა', minLat: 41.78, maxLat: 41.92, minLon: 44.62, maxLon: 44.78 },
  { en: 'Samtredia', ka: 'სამტრედია', minLat: 42.08, maxLat: 42.22, minLon: 42.28, maxLon: 42.48 },
  { en: 'Kobuleti', ka: 'ქობულეთი', minLat: 41.72, maxLat: 41.88, minLon: 41.72, maxLon: 41.88 },
  { en: 'Zestafoni', ka: 'ზესტაფონი', minLat: 42.06, maxLat: 42.20, minLon: 42.96, maxLon: 43.14 },
  { en: 'Marneuli', ka: 'მარნეული', minLat: 41.42, maxLat: 41.56, minLon: 44.74, maxLon: 44.90 },
  { en: 'Akhaltsikhe', ka: 'ახალციხე', minLat: 41.58, maxLat: 41.70, minLon: 42.92, maxLon: 43.06 },
  { en: 'Sighnaghi', ka: 'სიღნაღი', minLat: 41.58, maxLat: 41.68, minLon: 45.88, maxLon: 46.02 },
];

const MTAVRULI_START = 0x1c90;
const MTAVRULI_END = 0x1cbf;
const MTAVRULI_OFFSET = 0xbc0;

/**
 * Converts Mtavruli (uppercase Georgian) to Mkhedruli (regular Georgian) and
 * normalizes whitespace and punctuation. Latin text is kept as-is.
 */
export function normalizeGeorgianText(input: string): string {
  if (!input) return '';

  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= MTAVRULI_START && code <= MTAVRULI_END) {
      out += String.fromCodePoint(code - MTAVRULI_OFFSET);
    } else {
      out += char;
    }
  }

  return out
    .replace(/\u00a0/g, ' ')
    .replace(/[„“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extracts plausible Georgian 4-digit postcodes (0100–9999). */
export function extractPostcodes(text: string): string[] {
  const matches = text.match(/(?:^|\D)(\d{4})(?=\D|$)/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    if (digits.length === 4 && digits >= '0100' && digits <= '9999' && !seen.has(digits)) {
      seen.add(digits);
      out.push(digits);
    }
  }
  return out;
}

/** Finds the first known Georgian city named in the text. */
export function findCity(text: string): CityBounds | null {
  const normalized = normalizeGeorgianText(text).toLocaleLowerCase('ka');
  for (const city of CITY_BOUNDS) {
    if (
      normalized.includes(city.en.toLocaleLowerCase('en')) ||
      normalized.includes(city.ka)
    ) {
      return city;
    }
  }
  return null;
}

function inside(bounds: CityBounds, lat: number, lon: number): boolean {
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon
  );
}

/**
 * Normalizes an address and, when coordinates are supplied, checks whether the
 * named city actually matches them. Returns `coordinateMismatch` instead of
 * silently rewriting a wrong city.
 */
export function normalizeAddress(record: AddressRecord): NormalizedAddress {
  const text = normalizeGeorgianText(record.text);
  const city = findCity(text);
  const postcodes = extractPostcodes(text);

  let coordinateMismatch = false;
  if (
    city &&
    typeof record.latitude === 'number' &&
    typeof record.longitude === 'number' &&
    Number.isFinite(record.latitude) &&
    Number.isFinite(record.longitude)
  ) {
    coordinateMismatch = !inside(city, record.latitude, record.longitude);
  }

  return {
    text,
    postcodes,
    city: city ? city.en : null,
    coordinateMismatch,
  };
}
