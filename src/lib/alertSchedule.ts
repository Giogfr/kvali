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

export function isSchoolZoneActive(now: Date): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hour = now.getHours();
  return hour >= SCHOOL_ZONE_START_HOUR && hour < SCHOOL_ZONE_END_HOUR;
}
