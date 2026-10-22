/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
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
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { ToggleSwitch } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';
import { OfflineRegion } from '../types';
import { TRANSLATIONS } from '../lib/translations';
import { getCurrentLocation } from '../lib/location';
import { clearSavedRoutes, savedRouteCount } from '../lib/routeCache';
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
    addRegion,
    removeRegion,
    airplaneOfflineMode,
    setAirplaneOfflineMode,
    userLocation,
    manualLocation,
    effectiveCenter,
    geolocationStatus,
    voiceMode,
  } = useApp();

  const { showToast } = useToast();

  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [storageSupported, setStorageSupported] = useState(true);
  const [savedRoutes, setSavedRoutes] = useState(() => savedRouteCount());
  const [isAddingArea, setIsAddingArea] = useState(false);
  const controllersRef = useRef<Record<string, AbortController>>({});
  const recoveredDownloadsRef = useRef(false);

  const cardClass = 'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50';
  const rowClass = 'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50';
  const mutedText = 'text-neutral-500 dark:text-neutral-400';

  const refreshStorage = useCallback(async () => {
    setSavedRoutes(savedRouteCount());
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

  // A browser or Android process can be killed while a download is running.
  // The AbortController cannot survive that restart, so make the persisted
  // record resumable instead of leaving the area in a permanent spinner state.
  useEffect(() => {
    if (recoveredDownloadsRef.current) return;
    recoveredDownloadsRef.current = true;
    offlineRegions
      .filter((region) => region.status === 'downloading')
      .forEach((region) => patchRegion(region.id, { status: 'paused' }));
  }, [offlineRegions, patchRegion]);

  useEffect(
    () => () => {
      Object.values(controllersRef.current).forEach((controller) => controller.abort());
      controllersRef.current = {};
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem('kvali_offline_regions', JSON.stringify(offlineRegions));
    } catch {}
  }, [offlineRegions]);

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
          extraStyleUrls: [theme === 'dark' ? MAP_STYLES.light : MAP_STYLES.dark],
          onProgress: ({ done, total, bytes }) => {
            const pct = total ? Math.round((done / total) * 100) : 0;
            if (pct !== lastPct) {
              lastPct = pct;
              patchRegion(region.id, { downloadProgress: pct, bytes });
            }
          },
          signal: controller.signal,
        });

        if (result.tiles === 0) {
          throw new Error('No tiles could be cached');
        }

        const partial = result.capped || result.failed > 0;
        patchRegion(region.id, {
          status: 'downloaded',
          downloadProgress: 100,
          bytes: result.bytes,
          partial,
          lastUpdated: new Date().toISOString().slice(0, 10),
        });
        showToast(
          partial ? t('downloadPartial') : t('downloadComplete'),
          partial ? 'warn' : 'success'
        );
        refreshStorage();
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        patchRegion(region.id, { status: 'not_downloaded', downloadProgress: 0, partial: false });
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
    removeRegion(region.id);
    showToast(t('downloadCancelled'), 'info');
  };

  const handleClearCache = async () => {
    Object.values(controllersRef.current).forEach((controller) => controller.abort());
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

  const handleClearSavedRoutes = () => {
    clearSavedRoutes();
    setSavedRoutes(0);
    showToast(t('savedRoutesCleared'), 'info');
  };

  const handleAddArea = async () => {
    if (isAddingArea) return;
    setIsAddingArea(true);
    let lat = effectiveCenter.latitude;
    let lon = effectiveCenter.longitude;
    if (!userLocation && !manualLocation) {
      try {
        const loc = await getCurrentLocation();
        lat = loc.latitude;
        lon = loc.longitude;
      } catch {
        showToast(t('locationNeededForOffline'), 'warn');
        setIsAddingArea(false);
        return;
      }
    }
    const dLon = 0.12;
    const dLat = 0.09;
    addRegion({
      id: `region-${Date.now()}`,
      name: TRANSLATIONS.en.currentArea,
      nameKa: TRANSLATIONS.ka.currentArea,
      sizeMb: 0,
      bbox: [lon - dLon, lat - dLat, lon + dLon, lat + dLat],
      status: 'not_downloaded',
      downloadProgress: 0,
      lastUpdated: '',
    });
    showToast(t('offlineAreaAdded'), 'success');
    setIsAddingArea(false);
  };

  const usageBytes = storage?.usage ?? 0;
  const quotaBytes = storage?.quota ?? 0;
  const usedPercent = quotaBytes ? Math.min(100, (usageBytes / quotaBytes) * 100) : 0;
  const downloadedBytes = offlineRegions.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
  const hasOfflineMap = offlineRegions.some(
    (region) => region.status === 'downloaded' && !region.partial
  );
  const hasOfflineRoute = savedRoutes > 0;
  const hasLocation = geolocationStatus === 'granted' || !!manualLocation || !!userLocation;
  const hasGuidance = voiceMode !== 'muted';
  const tripReady = hasOfflineMap && hasOfflineRoute && hasLocation && hasGuidance;

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('offlineMapsTitle')} onBack={() => navigateTo('map')} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Storage usage */}
        <div className={`p-3.5 ${cardClass}`}>
          <div className="flex items-center justify-between text-[12px] mb-2">
            <div className="flex items-center gap-2">
              <HardDrive size={15} className="text-[#2F6FEB]" />
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {t('storageUsage')}
              </span>
            </div>
            <span className="font-mono text-neutral-500 dark:text-neutral-400">
              {storageSupported ? `${formatBytes(usageBytes)} / ${formatBytes(quotaBytes)}` : '—'}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#2F6FEB] rounded-full kvali-bar"
              style={{ width: `${storageSupported ? Math.max(2, usedPercent) : 0}%` }}
            />
          </div>

          <div className={`flex justify-between text-[10px] ${mutedText} mt-1.5 font-mono`}>
            <span>{t('offlineDownloadedSize').replace('{size}', formatBytes(downloadedBytes))}</span>
            <button onClick={handleClearCache} className="underline hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
              {t('clearCache')}
            </button>
          </div>

          {!storageSupported && (
            <p className={`text-[10px] ${mutedText} mt-1.5`}>{t('storageUnavailable')}</p>
          )}
        </div>

        {/* Routes cached for offline reuse */}
        <div className={`p-3.5 ${cardClass} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <span className="text-[13px] font-semibold block text-neutral-800 dark:text-neutral-200 leading-tight">
              {t('savedRoutesCache')}
            </span>
            <span className={`text-[11px] ${mutedText} leading-tight block mt-0.5`}>
              {t('savedRoutesCacheDesc').replace('{count}', String(savedRoutes))}
            </span>
          </div>
          {savedRoutes > 0 && (
            <button
              onClick={handleClearSavedRoutes}
              className="shrink-0 px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t('clear')}
            </button>
          )}
        </div>

        <div className={`p-3.5 ${cardClass}`}>
          <div className="flex items-start gap-2.5">
            {tripReady ? (
              <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={17} className="text-[#C9973F] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                  {t('tripReadinessTitle')}
                </span>
                <span className={`text-[10px] font-semibold ${tripReady ? 'text-emerald-500' : 'text-[#C9973F]'}`}>
                  {tripReady ? t('tripReady') : t('tripNotReady')}
                </span>
              </div>
              <div className="mt-2 space-y-1.5 text-[11px]">
                {[
                  [hasOfflineMap, hasOfflineMap ? t('tripMapReady') : t('tripMapMissing')],
                  [hasOfflineRoute, hasOfflineRoute ? t('tripRouteReady') : t('tripRouteMissing')],
                  [hasLocation, hasLocation ? t('tripLocationReady') : t('tripLocationMissing')],
                  [hasGuidance, hasGuidance ? t('tripVoiceReady') : t('tripVoiceMissing')],
                ].map(([ready, label]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <span className={ready ? 'text-emerald-500' : 'text-[#C9973F]'}>{ready ? '✓' : '!'}</span>
                    <span className={mutedText}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Offline / fallback render toggle */}
        <div className={`p-3.5 ${cardClass} flex items-center justify-between`}>
          <div className="flex items-center gap-3 pr-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                airplaneOfflineMode
                  ? 'bg-[#C9973F]/20 text-[#C9973F]'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <WifiOff size={16} />
            </div>
            <div>
              <span className="text-[13px] font-semibold block text-neutral-800 dark:text-neutral-200 leading-tight">
                {t('airplaneMode')}
              </span>
              <span className={`text-[11px] ${mutedText} leading-tight block mt-0.5`}>
                {t('airplaneModeDesc')}
              </span>
            </div>
          </div>

          <ToggleSwitch
            checked={airplaneOfflineMode}
            onChange={(checked) => {
              setAirplaneOfflineMode(checked);
              showToast(
                checked ? t('offlineRenderingOn') : t('onlineRenderingRestored'),
                checked ? 'warn' : 'info'
              );
            }}
            label={t('airplaneMode')}
          />
        </div>

        {/* Offline areas */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className={`text-[11px] uppercase tracking-wider ${mutedText} font-semibold`}>
              {t('regionsTitle')}
            </span>
            <button
              onClick={handleAddArea}
              disabled={isAddingArea}
              className="flex items-center gap-1 text-[11px] font-medium text-[#2F6FEB] hover:underline disabled:opacity-50"
            >
              <MapPin size={13} />
              <span>{t('downloadCurrentArea')}</span>
            </button>
          </div>

          {offlineRegions.length === 0 ? (
            <div className={`py-10 text-center ${mutedText}`}>
              <MapPin size={30} className="mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-medium">{t('noOfflineAreas')}</p>
            </div>
          ) : (
            <div className="space-y-2 stagger">
              {offlineRegions.map((region) => {
                const isDownloaded = region.status === 'downloaded';
                const isDownloading = region.status === 'downloading';
                const isPaused = region.status === 'paused';

                return (
                  <div key={region.id} className={`p-3 ${rowClass} hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                          {language === 'ka' ? region.nameKa : region.name}
                        </span>
                        <div className={`flex items-center gap-2 text-[11px] ${mutedText} mt-0.5`}>
                          <span className="tabular-nums font-mono">
                            {region.bytes ? formatBytes(region.bytes) : '—'}
                          </span>
                          <span>·</span>
                          <span
                            className={`capitalize font-medium ${
                              isDownloaded && !region.partial
                                ? 'text-emerald-500'
                                : isDownloaded
                                ? 'text-[#C9973F]'
                                : isDownloading
                                ? 'text-[#2F6FEB]'
                                : isPaused
                                ? 'text-[#C9973F]'
                                : mutedText
                            }`}
                          >
                            {isDownloaded
                              ? `${t('downloaded')}${
                                  region.partial ? ` · ${t('partial')}` : ''
                                }`
                              : isDownloading
                              ? `${t('downloading')} ${region.downloadProgress}%`
                              : isPaused
                              ? `${t('pause')} · ${region.downloadProgress}%`
                              : t('notDownloaded')}
                          </span>
                          {isDownloaded && region.lastUpdated && (
                            <>
                              <span>·</span>
                              <span className={mutedText}>
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
                              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                              title={t('pause')}
                            >
                              <Pause size={14} />
                            </button>
                            <button
                              onClick={() => handleCancel(region.id)}
                              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-red-500"
                              title={t('cancelDownload')}
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
                              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-red-500"
                              title={t('cancelDownload')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : isDownloaded ? (
                          <>
                            <button
                              onClick={() => startDownload(region)}
                              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                              title={t('updateAvailable')}
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              onClick={() => handleRemove(region)}
                              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-red-500 transition-colors"
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
                      <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mt-2.5">
                        <div
                          className="h-full bg-[#2F6FEB] rounded-full kvali-bar shimmer"
                          style={{ width: `${region.downloadProgress}%` }}
                        />
                      </div>
                    )}

                    {isDownloaded && (
                      <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] mt-2">
                        <CheckCircle2 size={12} />
                        <span>{t('downloaded')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Honest notice */}
        <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-start gap-2">
          <Info size={15} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t('offlineStorageNotice')}</p>
        </div>
      </div>
    </div>
  );
};
