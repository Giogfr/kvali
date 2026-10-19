/**
 * Renders the Kvali app icon into every PNG size the PWA and Android need.
 *
 * Uses the locally installed Chrome (already a test dependency) instead of
 * pulling in a rasteriser. Run from the repo root: bun run icons
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ROOT = process.cwd();

// The mark: a route that curves from a start dot to a destination ring.
const GRADIENT = `
  <defs>
    <linearGradient id="bg" x1="40" y1="24" x2="472" y2="488" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4C8DFF" />
      <stop offset="1" stop-color="#2563EB" />
    </linearGradient>
  </defs>`;

const MARK = `
  <path d="M170 356 C170 286 226 282 258 248 C290 214 346 210 346 156"
        fill="none" stroke="#FFFFFF" stroke-width="30"
        stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="170" cy="356" r="32" fill="#FFFFFF" />
  <circle cx="346" cy="156" r="44" fill="none" stroke="#FFFFFF" stroke-width="28" />`;

function graphic(scale, dx = 0, dy = 0) {
  return `<g transform="translate(256 256) scale(${scale}) translate(${-256 + dx} ${-256 + dy})">${MARK}</g>`;
}

function iconSvg(kind, size) {
  const shape =
    kind === 'round'
      ? '<rect width="512" height="512" fill="url(#bg)"/><circle cx="256" cy="256" r="256" fill="url(#bg)"/>'
      : '<rect width="512" height="512" rx="116" fill="url(#bg)"/>';

  let body;
  if (kind === 'fg') {
    body = graphic(0.82);
  } else if (kind === 'maskable' || kind === 'square' || kind === 'round') {
    body = graphic(kind === 'maskable' ? 0.66 : 0.8);
  } else {
    body = graphic(0.86);
  }

  const background = kind === 'fg' ? '' : shape;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${GRADIENT}${background}${body}</svg>`;
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
