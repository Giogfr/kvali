import React from 'react';
import {
  Download,
  Pause,
  Play,
  Trash2,
  HardDrive,
  WifiOff,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { ToggleSwitch, DemoChip } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';

export const OfflineMapsScreen: React.FC = () => {
  const {
    t,
    language,
    theme,
    navigateTo,
    offlineRegions,
    updateRegionStatus,
    airplaneOfflineMode,
    setAirplaneOfflineMode,
  } = useApp();

  const { showToast } = useToast();

  const totalUsedMb = offlineRegions
    .filter((r) => r.status === 'downloaded' || r.status === 'update_available')
    .reduce((sum, r) => sum + r.sizeMb, 0);

  const totalCapacityMb = 32000; // 32 GB simulated device space
  const usedPercent = Math.min(100, (totalUsedMb / totalCapacityMb) * 100);

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('offlineMapsTitle')} onBack={() => navigateTo('map')} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Simulated Storage Usage Bar */}
        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center justify-between text-[12px] mb-2">
            <div className="flex items-center gap-2">
              <HardDrive size={15} className="text-[#2F6FEB]" />
              <span className="font-semibold text-neutral-200">
                {t('storageUsage')}
              </span>
            </div>
            <span className="font-mono text-neutral-400">
              {totalUsedMb} MB / 32 GB (Simulated)
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#2F6FEB] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(2, usedPercent)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-neutral-500 mt-1.5 font-mono">
            <span>Kvali offline data: {totalUsedMb} MB</span>
            <span>Free: ~{(32 - totalUsedMb / 1024).toFixed(1)} GB</span>
          </div>
        </div>

        {/* Simulated Offline / Airplane Mode Switch */}
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
                checked ? 'Simulated Offline Mode Active' : 'Online Map Mode Restored',
                checked ? 'warn' : 'info'
              );
            }}
            label={t('airplaneMode')}
          />
        </div>

        {/* Regions List */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
              Available Regions (Georgia)
            </span>
            <DemoChip label={t('demoData')} />
          </div>

          <div className="space-y-2">
            {offlineRegions.map((region) => {
              const isDownloaded = region.status === 'downloaded';
              const isDownloading = region.status === 'downloading';
              const isPaused = region.status === 'paused';
              const hasUpdate = region.status === 'update_available';

              return (
                <div
                  key={region.id}
                  className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-semibold text-neutral-100 block">
                        {language === 'ka' ? region.nameKa : region.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                        <span className="tabular-nums font-mono">{region.sizeMb} MB</span>
                        <span>·</span>
                        <span
                          className={`capitalize font-medium ${
                            isDownloaded
                              ? 'text-emerald-400'
                              : hasUpdate
                              ? 'text-[#C9973F]'
                              : isDownloading
                              ? 'text-[#2F6FEB]'
                              : 'text-neutral-500'
                          }`}
                        >
                          {isDownloaded
                            ? t('downloaded') + ' — simulated'
                            : hasUpdate
                            ? t('updateAvailable')
                            : isDownloading
                            ? `${t('downloading')} ${region.downloadProgress}%`
                            : isPaused
                            ? 'Paused'
                            : 'Not downloaded'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDownloading ? (
                        <>
                          <button
                            onClick={() => updateRegionStatus(region.id, 'pause')}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
                            title={t('pause')}
                          >
                            <Pause size={14} />
                          </button>
                          <button
                            onClick={() => updateRegionStatus(region.id, 'cancel')}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400"
                            title="Cancel"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : isPaused ? (
                        <>
                          <button
                            onClick={() => updateRegionStatus(region.id, 'resume')}
                            className="p-2 rounded-lg bg-[#2F6FEB] text-white"
                            title={t('resume')}
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => updateRegionStatus(region.id, 'cancel')}
                            className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400"
                            title="Cancel"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : isDownloaded ? (
                        <button
                          onClick={() => {
                            updateRegionStatus(region.id, 'remove');
                            showToast('Removed simulated region package', 'info');
                          }}
                          className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                          title={t('remove')}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : hasUpdate ? (
                        <button
                          onClick={() => {
                            updateRegionStatus(region.id, 'update');
                            showToast('Starting package update…', 'info');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C9973F]/20 text-[#C9973F] text-[11px] font-medium"
                        >
                          <RefreshCw size={12} />
                          <span>Update</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            updateRegionStatus(region.id, 'download');
                            showToast(`Simulating download for ${region.name}…`, 'info');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2F6FEB] hover:bg-[#2563EB] text-white text-[11px] font-medium transition-colors"
                        >
                          <Download size={13} />
                          <span>{t('download')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar when downloading */}
                  {isDownloading && (
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-2.5">
                      <div
                        className="h-full bg-[#2F6FEB] rounded-full transition-all duration-300"
                        style={{ width: `${region.downloadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Honest Limitations Notice */}
        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
          <Info size={15} className="text-neutral-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{t('offlineStorageNotice')}</p>
        </div>
      </div>
    </div>
  );
};
