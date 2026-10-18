import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
}

/**
 * Keeps the screen awake while `active` is true so guidance and track recording
 * stay readable on a car dashboard. Falls back silently when the API is missing.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & NavigatorWithWakeLock;
    if (!nav.wakeLock?.request) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        /* the OS may refuse while the tab is hidden */
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !disposed) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      try {
        sentinel?.release();
      } catch {
        /* ignore */
      }
      sentinel = null;
    };
  }, [active]);
}
