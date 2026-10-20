/**
 * Kvali — time and ETA helpers.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

/** Returns the arrival time for a trip that still needs `remainingMinutes`. */
export function etaFromNow(remainingMinutes: number, now: Date = new Date()): Date {
  const minutes = Number.isFinite(remainingMinutes) ? Math.max(0, remainingMinutes) : 0;
  return new Date(now.getTime() + minutes * 60000);
}

/** Formats a Date as a 24-hour clock time using the device's local timezone. */
export function formatClockTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formats a duration in minutes as "45 min", "1 h" or "2 h 15 min".
 * Values are rounded to the nearest minute and never go below zero.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  const minutes = Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes)) : 0;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
