import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Pause,
  Play,
  Trash2,
  HardDrive,
  WifiOff,
  RefreshCw,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { ToggleSwitch } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';
import { OfflineRegion } from '../types';
import {
  MAP_STYLES,
  clearTileCache,
  formatBytes,
  getStorageEstimate,
  prefetchRegion,
} from '../lib/offline';

export const OfflineMapsScreen: React.FC = () => {
  const {
    t,
    language,
    theme,
    navigateTo,
    offlineRegions,
    patchRegion,
    airplaneOfflineMode,
    setAirplaneOfflineMode,
  } = useApp();

  const { showToast } = useToast();

  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [storageSupported, setStorageSupported] = useState(true);
  const controllersRef = useRef<Record<string, AbortController>>({});

  const refreshStorage = useCallback(async () => {
    const est = await getStorageEstimate();
    if (est) {
      setStorage(est);
      setStorageSupported(true);
    } else {
      setStorageSupported(false);
    }
  }, []);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  const startDownload = useCallback(
    async (region: OfflineRegion) => {
      const controller = new AbortController();
      controllersRef.current = { ...controllersRef.current, [region.id]: controller };
      patchRegion(region.id, { status: 'downloading' });

      let lastPct = -1;
      try {
        const result = await prefetchRegion({
          bbox: region.bbox,
          styleUrl: theme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light,
          onProgress: ({ done, total, bytes }) => {
            const pct = total ? Math.round((done / total) * 100) : 0;
            if (pct !== lastPct) {
              lastPct = pct;
              patchRegion(region.id, { downloadProgress: pct, bytes });
            }
          },
          signal: controller.signal,
        });

        patchRegion(region.id, {
          status: 'downloaded',
          downloadProgress: 100,
          bytes: result.bytes,
          lastUpdated: new Date().toISOString().slice(0, 10),
        });
        showToast(t('downloadComplete'), 'success');
        refreshStorage();
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        patchRegion(region.id, { status: 'not_downloaded', downloadProgress: 0 });
        showToast(t('downloadFailed'), 'warn');
      } finally {
        const next = { ...controllersRef.current };
        delete next[region.id];
        controllersRef.current = next;
      }
    },
    [patchRegion, refreshStorage, showToast, t, theme]
  );

  const stopController = (id: string) => {
    controllersRef.current[id]?.abort();
    const next = { ...controllersRef.current };
    delete next[id];
    controllersRef.current = next;
  };

  const handlePause = (id: string) => {
    stopController(id);
    patchRegion(id, { status: 'paused' });
  };

  const handleCancel = (id: string) => {
    stopController(id);
    patchRegion(id, { status: 'not_downloaded', downloadProgress: 0 });
    showToast(t('downloadCancelled'), 'info');
  };

  const handleRemove = (region: OfflineRegion) => {
    stopController(region.id);
    patchRegion(region.id, {
      status: 'not_downloaded',
      downloadProgress: 0,
      bytes: undefined,
      lastUpdated: '',
    });
    showToast(t('downloadCancelled'), 'info');
  };

  const handleClearCache = async () => {
    controllerEntries().forEach(([, controller]) => controller.abort());
    controllersRef.current = {};
    await clearTileCache();
    offlineRegions.forEach((region) =>
      patchRegion(region.id, {
        status: 'not_downloaded',
        downloadProgress: 0,
        bytes: undefined,
        lastUpdated: '',
      })
    );
    showToast(t('cacheCleared'), 'info');
    refreshStorage();
  };

  const controllerEntries = () => Object.entries(controllersRef.current);

  const usageBytes = storage?.usage ?? 0;
  const quotaBytes = storage?.quota ?? 0;
  const usedPercent = quotaBytes ? Math.min(100, (usageBytes / quotaBytes) * 100) : 0;

  const downloadedBytes = offlineRegions.reduce((sum, r) => sum + (r.bytes ?? 0), 0);

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('offlineMapsTitle')} onBack={() => navigateTo('map')} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Storage usage */}
        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center justify-between text-[12px] mb-2">
            <div className="flex items-center gap-2">
              <HardDrive size={15} className="text-[#2F6FEB]" />
              <span className="font-semibold text-neutral-200">{t('storageUsage')}</span>
            </div>
            <span className="font-mono text-neutral-400">
              {storageSupported
                ? `${formatBytes(usageBytes)} / ${formatBytes(quotaBytes)}`
                : '—'}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#2F6FEB] rounded-full transition-all duration-300"
              style={{ width: `${storageSupported ? Math.max(2, usedPercent) : 0}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-neutral-500 mt-1.5 font-mono">
            <span>Kvali offline: {formatBytes(downloadedBytes)}</span>
            <button
              onClick={handleClearCache}
              className="underline hover:text-neutral-300 transition-colors"
            >
              {t('clearCache')}
            </button>
          </div>

          {!storageSupported && (
            <p className="text-[10px] text-neutral-500 mt-1.5">{t('storageUnavailable')}</p>
          )}
        </div>

        {/* Offline / fallback render toggle */}
        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3 pr-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                airplaneOfflineMode
                  ? 'bg-[#C9973F]/20 text-[#C9973F]'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              <WifiOff size={16} />
            </div>
            <div>
              <span className="text-[13px] font-semibold block text-neutral-200 leading-tight">
                {t('airplaneMode')}
              </span>
              <span className="text-[11px] text-neutral-400 leading-tight block mt-0.5">
                {t('airplaneModeDesc')}
              </span>
            </div>
          </div>

          <ToggleSwitch
            checked={airplaneOfflineMode}
            onChange={(checked) => {
              setAirplaneOfflineMode(checked);
              showToast(
                checked ? 'Offline rendering forced' : 'Online map rendering restored',
                checked ? 'warn' : 'info'
              );
            }}
            label={t('airplaneMode')}
          />
        </div>

        {/* Regions */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
              {t('regionsTitle')}
            </span>
          </div>

          <div className="space-y-2">
            {offlineRegions.map((region) => {
              const isDownloaded = region.status === 'downloaded';
              const isDownloading = region.status === 'downloading';
              const isPaused = region.status === 'paused';

              return (
                <div
                  key={region.id}
                  className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[13px] font-semibold text-neutral-100 block truncate">
                        {language === 'ka' ? region.nameKa : region.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                        <span className="tabular-nums font-mono">
                          {region.bytes
                            ? formatBytes(region.bytes)
                            : `~${region.sizeMb} MB ${t('estimate')}`}
                        </span>
                        <span>·</span>
                        <span
                          className={`capitalize font-medium ${
                            isDownloaded
                              ? 'text-emerald-400'
                              : isDownloading
                              ? 'text-[#2F6FEB]'
                              : isPaused
                              ? 'text-[#C9973F]'
                              : 'text-neutral-500'
                          }`}
                        >
                          {isDownloaded
                            ? t('downloaded')
                            : isDownloading
                            ? `${t('downloading')} ${region.downloadProgress}%`
                            : isPaused
                            ? `${t('pause')} · ${region.downloadProgress}%`
                            : t('notDownloaded')}
                        </span>
                        {isDownloaded && region.lastUpdated && (
                          <>
                            <span>·</span>
                            <span className="text-neutral-500">
                              {t('downloadedOn')} {region.lastUpdated}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDownloading ? (
                        <>
                          <button
                            onClick={() => handlePause(region.id)}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
                            title={t('pause')}
                          >
                            <Pause size={14} />
                          </button>
                          <button
                            onClick={() => handleCancel(region.id)}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400"
                            title="Cancel"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : isPaused ? (
                        <>
                          <button
                            onClick={() => startDownload(region)}
                            className="p-2 rounded-lg bg-[#2F6FEB] text-white"
                            title={t('resume')}
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleCancel(region.id)}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400"
                            title="Cancel"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : isDownloaded ? (
                        <>
                          <button
                            onClick={() => startDownload(region)}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                            title={t('updateAvailable')}
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => handleRemove(region)}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                            title={t('remove')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startDownload(region)}
                          disabled={airplaneOfflineMode}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2F6FEB] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium transition-colors"
                        >
                          <Download size={13} />
                          <span>{t('download')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isDownloading && (
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-2.5">
                      <div
                        className="h-full bg-[#2F6FEB] rounded-full transition-all duration-300"
                        style={{ width: `${region.downloadProgress}%` }}
                      />
                    </div>
                  )}

                  {isDownloaded && (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] mt-2">
                      <CheckCircle2 size={12} />
                      <span>{t('downloaded')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Honest notice */}
        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
          <Info size={15} className="text-neutral-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t('offlineStorageNotice')}</p>
        </div>
      </div>
    </div>
  );
};
