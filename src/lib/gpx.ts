/**
 * Kvali — GPX import and export.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import { calculateDistanceKm } from './geo';
import { RecordedTrack } from '../types';

export interface GpxParseResult {
  tracks: RecordedTrack[];
  skipped: number;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textOf(parent: Element, localName: string): string {
  const node = parent.getElementsByTagNameNS('*', localName)[0];
  return node?.textContent?.trim() ?? '';
}

function timestampOf(point: Element): number | null {
  const raw = textOf(point, 'time');
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function isoDate(ms: number | null): string {
  return new Date(ms ?? Date.now()).toISOString().slice(0, 10);
}

function pointOf(el: Element): { lng: number; lat: number; time: number | null } | null {
  const lat = Number.parseFloat(el.getAttribute('lat') ?? '');
  const lon = Number.parseFloat(el.getAttribute('lon') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lng: lon, lat, time: timestampOf(el) };
}

function makeTrack(
  title: string,
  points: { lng: number; lat: number; time: number | null }[],
  index: number
): RecordedTrack | null {
  if (points.length < 2) return null;

  let distanceKm = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceKm += calculateDistanceKm(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }

  const times = points.map((p) => p.time).filter((t): t is number => t !== null);
  const durationMinutes =
    times.length >= 2
      ? Math.max(0, Math.round((Math.max(...times) - Math.min(...times)) / 60000))
      : 0;
  const avgSpeedKmh =
    durationMinutes > 0 ? Number(((distanceKm / (durationMinutes / 60)) || 0).toFixed(1)) : 0;

  return {
    id: `gpx-${Date.now()}-${index}`,
    title: title.slice(0, 120),
    date: isoDate(times.length > 0 ? Math.min(...times) : null),
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMinutes,
    avgSpeedKmh,
    coordinates: points.map((p) => [p.lng, p.lat]),
  };
}

/**
 * Parse a GPX 1.0/1.1 document. Tracks and routes are supported; each `trk`
 * or `rte` becomes one RecordedTrack. Points without a valid latitude and
 * longitude are dropped, and segments shorter than two points are skipped.
 */
export function parseGpx(xml: string, fallbackTitle = 'Imported GPX'): GpxParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('The file is not valid XML.');
  }
  if (doc.getElementsByTagNameNS('*', 'gpx').length === 0) {
    throw new Error('The file is not a GPX document.');
  }

  const baseTitle = fallbackTitle.replace(/\.gpx$/i, '').trim() || 'Imported GPX';
  const tracks: RecordedTrack[] = [];
  let skipped = 0;

  const containers = [
    ...Array.from(doc.getElementsByTagNameNS('*', 'trk')),
    ...Array.from(doc.getElementsByTagNameNS('*', 'rte')),
  ];

  containers.forEach((container, index) => {
    const isRoute = container.localName === 'rte';
    const pointTag = isRoute ? 'rtept' : 'trkpt';
    const points = Array.from(container.getElementsByTagNameNS('*', pointTag))
      .map(pointOf)
      .filter((p): p is { lng: number; lat: number; time: number | null } => p !== null);

    const name = textOf(container, 'name');
    const title = name || (containers.length > 1 ? `${baseTitle} ${index + 1}` : baseTitle);
    const track = makeTrack(title, points, index);
    if (track) tracks.push(track);
    else skipped += 1;
  });

  return { tracks, skipped };
}

/**
 * Serialise a recorded track as GPX 1.1. Per-point timestamps are not stored
 * by Kvali, so the document carries only the track date — no times are
 * invented.
 */
export function trackToGpx(track: RecordedTrack): string {
  const points = track.coordinates
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
    .map(
      ([lng, lat]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`
    )
    .join('\n');

  const date = /^\d{4}-\d{2}-\d{2}$/.test(track.date)
    ? `${track.date}T00:00:00Z`
    : new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Kvali" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${xmlEscape(track.title)}</name>
    <time>${date}</time>
  </metadata>
  <trk>
    <name>${xmlEscape(track.title)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}
