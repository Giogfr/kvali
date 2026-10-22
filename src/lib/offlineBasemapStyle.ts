/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Style for the installed Georgia PMTiles basemap.
 *
 * The package uses the Protomaps basemap schema. Sprites, glyphs and the style
 * itself are generated locally, so no style server is needed when offline.
 */

import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import type { Language, ThemeMode } from '../types';

export const BASEMAP_ARCHIVE_KEY = 'kvali-georgia-basemap.pmtiles';
export const BASEMAP_MAX_ZOOM = 13;
export const BASEMAP_GLYPHS =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
export const BASEMAP_SPRITES = 'https://protomaps.github.io/basemaps-assets/sprites/v4';
export const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, Protomaps';

function useLocalNameFallback(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(useLocalNameFallback);
  if (value === 'name:en') return 'name';
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        useLocalNameFallback(item),
      ])
    );
  }
  return value;
}

export function buildBasemapStyle(theme: ThemeMode, language: Language): StyleSpecification {
  const styledLayers = layers('protomaps', namedFlavor(theme), { lang: language });
  return {
    version: 8,
    name: `Kvali Georgia ${theme}`,
    glyphs: BASEMAP_GLYPHS,
    sprite: `${BASEMAP_SPRITES}/${theme}`,
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [`pmtiles://${BASEMAP_ARCHIVE_KEY}/{z}/{x}/{y}`],
        minzoom: 0,
        maxzoom: BASEMAP_MAX_ZOOM,
        attribution: BASEMAP_ATTRIBUTION,
      },
    },
    // Protomaps has no Georgian language pair, so its `ka` fallback is English.
    // Prefer the local `name` (Georgian in Georgia) before English.
    layers:
      language === 'ka'
        ? (useLocalNameFallback(styledLayers) as StyleSpecification['layers'])
        : styledLayers,
  } as StyleSpecification;
}

/** Font stacks and sprite URLs the generated style needs for offline labels. */
export function basemapAssetUrls(_style: StyleSpecification): string[] {
  const fonts = [
    'Noto Sans Regular',
    'Noto Sans Medium',
    'Noto Sans Italic',
    'Noto Sans Devanagari Regular v1',
  ];
  const ranges = ['0-255', '256-511', '4096-4351', '4352-4607', '8192-8447'];
  const urls: string[] = [];
  for (const font of fonts) {
    for (const range of ranges) {
      urls.push(
        BASEMAP_GLYPHS.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range)
      );
    }
  }
  for (const theme of ['light', 'dark']) {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) {
      urls.push(`${BASEMAP_SPRITES}/${theme}${suffix}`);
    }
  }
  return urls;
}
