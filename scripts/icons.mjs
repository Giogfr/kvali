/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Renders the Kvali app icon into every PNG size the PWA and Android need.
 *
 * Uses the locally installed Chrome (already a test dependency) instead of
 * pulling in a rasteriser. Run from the repo root: bun run icons
 */

import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ROOT = process.cwd();

const LOGO = await readFile(`${ROOT}/public/logo.svg`, 'utf8');
const LOGO_MARK = `
  <path d="M13.5 34.5C15 27 15.5 21.5 24 18.5C29.5 16.6 31.5 16.5 34 14.5"
        fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="13.5" cy="34.5" r="3.1" fill="#FFFFFF" />
  <circle cx="34.5" cy="14.5" r="6" fill="none" stroke="#FFFFFF" stroke-width="3.6" />
  <circle cx="34.5" cy="14.5" r="2.6" fill="#2563EB" />`;

function iconSvg(kind, size) {
  if (kind === 'fg') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><g transform="translate(5 5) scale(.79)">${LOGO_MARK}</g></svg>`;
  }
  return LOGO.replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">`);
}

const targets = [];
for (const [size, suffix] of [
  [48, 'mdpi'],
  [72, 'hdpi'],
  [96, 'xhdpi'],
  [144, 'xxhdpi'],
  [192, 'xxxhdpi'],
]) {
  const dir = `${ROOT}/android/app/src/main/res/mipmap-${suffix}`;
  targets.push({ kind: 'square', size, out: `${dir}/ic_launcher.png` });
  targets.push({ kind: 'round', size, out: `${dir}/ic_launcher_round.png` });
}

for (const [size, suffix] of [
  [108, 'mdpi'],
  [162, 'hdpi'],
  [216, 'xhdpi'],
  [324, 'xxhdpi'],
  [432, 'xxxhdpi'],
]) {
  targets.push({
    kind: 'fg',
    size,
    out: `${ROOT}/android/app/src/main/res/mipmap-${suffix}/ic_launcher_foreground.png`,
  });
}

targets.push({ kind: 'any', size: 192, out: `${ROOT}/public/icons/icon-192.png` });
targets.push({ kind: 'any', size: 512, out: `${ROOT}/public/icons/icon-512.png` });
targets.push({ kind: 'maskable', size: 512, out: `${ROOT}/public/icons/maskable-512.png` });
targets.push({ kind: 'square', size: 180, out: `${ROOT}/public/icons/apple-touch-icon.png` });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader'],
});

try {
  for (const target of targets) {
    await mkdir(dirname(target.out), { recursive: true });
    const page = await browser.newPage();
    await page.setViewport({ width: target.size, height: target.size, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${iconSvg(target.kind, target.size)}</body></html>`,
      { waitUntil: 'load' }
    );
    await page.screenshot({ path: target.out, omitBackground: target.kind === 'fg' });
    await page.close();
    console.log(`wrote ${target.out.replace(ROOT, '.')} (${target.size}px, ${target.kind})`);
  }
} finally {
  await browser.close();
}

console.log(`\n${targets.length} icons generated`);
