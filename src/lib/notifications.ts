/**
 * Kvali — notification permission.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Android 13 (API 33) hides notifications, including the foreground-service
 * notice that keeps navigation alive, until POST_NOTIFICATIONS is granted.
 * Other platforms have nothing to ask for, so the answer there is `null`.
 */
export function needsNotificationPermission(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function ensureNotificationPermission(): Promise<boolean | null> {
  if (!needsNotificationPermission()) return null;

  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;

    const asked = await LocalNotifications.requestPermissions();
    return asked.display === 'granted';
  } catch {
    // A missing plugin or an OEM quirk must not break navigation.
    return null;
  }
}
