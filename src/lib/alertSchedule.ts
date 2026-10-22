/**
 * Kvali — time windows for conditional road alerts.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

/** School-zone alerts are shown on weekdays between 08:00 and 16:00 local time. */
export const SCHOOL_ZONE_START_HOUR = 8;
export const SCHOOL_ZONE_END_HOUR = 16;
const GEORGIA_TIME_ZONE = 'Asia/Tbilisi';

export function isSchoolZoneActive(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: GEORGIA_TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  if (weekday === 'Sat' || weekday === 'Sun' || !Number.isFinite(hour)) return false;
  return hour >= SCHOOL_ZONE_START_HOUR && hour < SCHOOL_ZONE_END_HOUR;
}
