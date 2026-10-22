/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import {
  BASEMAP_ARCHIVE_KEY,
  basemapAssetUrls,
  buildBasemapStyle,
} from '../src/lib/offlineBasemapStyle.ts';

const light = buildBasemapStyle('light', 'en');
assert.equal(light.version, 8);
assert.ok(light.layers.length > 20, 'basemap style should have real layers');
assert.deepEqual(light.sources.protomaps.tiles, [
  `pmtiles://${BASEMAP_ARCHIVE_KEY}/{z}/{x}/{y}`,
]);
assert.equal(light.sources.protomaps.maxzoom, 13);
assert.ok(String(light.glyphs).includes('/fonts/'));
assert.ok(String(light.sprite).endsWith('/light'));
assert.ok(String(light.sources.protomaps.attribution).startsWith('©'));

const dark = buildBasemapStyle('dark', 'ka');
assert.equal(dark.name, 'Kvali Georgia dark');
assert.ok(String(dark.sprite).endsWith('/dark'));
assert.ok(dark.layers.length > 20, 'Georgian labels should not empty the style');
assert.ok(JSON.stringify(dark.layers).includes('"name"'), 'Georgian labels should use local names');
assert.ok(!JSON.stringify(dark.layers).includes('"name:en"'), 'Georgian labels should not prefer English');

const assets = basemapAssetUrls(light);
assert.ok(assets.length > 20, 'style assets should include fonts and sprites');
assert.ok(assets.some((url) => url.includes('Noto%20Sans%20Regular') && url.endsWith('4096-4351.pbf')));
assert.ok(assets.some((url) => url.endsWith('/sprites/v4/light@2x.png')));
assert.ok(assets.some((url) => url.endsWith('/sprites/v4/dark.json')));

console.log('Offline basemap style tests passed');
