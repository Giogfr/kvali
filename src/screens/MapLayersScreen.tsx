import React from 'react';
import {
  Sun,
  Moon,
  Mountain,
  MapPin,
  Camera,
  Users,
  Bookmark,
  Footprints,
  Box,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { ToggleSwitch } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';

export const MapLayersScreen: React.FC = () => {
  const {
    t,
    theme,
    setTheme,
    navigateTo,
    layers,
    toggleLayer,
  } = useApp();

  const { showToast } = useToast();

  const sectionLabel =
    'text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold block mb-2 px-1';
  const panel =
    'divide-y divide-neutral-200 dark:divide-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50';
  const rowTitle = 'text-[13px] font-medium block text-neutral-800 dark:text-neutral-200';

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('mapLayersTitle')} onBack={() => navigateTo('map')} />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Vector Map Style Selection */}
        <div>
          <span className={sectionLabel}>Map style</span>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Standard Light */}
            <button
              onClick={() => {
                setTheme('light');
                showToast('Switched to Positron Light map style', 'info');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                theme === 'light'
                  ? 'bg-white border-[#2F6FEB] text-[#111111] shadow-md ring-1 ring-[#2F6FEB]'
                  : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Sun size={17} className={theme === 'light' ? 'text-[#2F6FEB]' : 'text-neutral-400'} />
                {theme === 'light' && (
                  <span className="text-[10px] font-mono text-[#2F6FEB] font-bold">Active</span>
                )}
              </div>
              <span className="text-[13px] font-semibold block leading-tight">Positron Light</span>
            </button>

            {/* Dark Night */}
            <button
              onClick={() => {
                setTheme('dark');
                showToast('Switched to Dark map style', 'info');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                theme === 'dark'
                  ? 'bg-[#1C1C1C] border-[#2F6FEB] text-white shadow-md ring-1 ring-[#2F6FEB]'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Moon size={17} className={theme === 'dark' ? 'text-[#2F6FEB]' : 'text-neutral-400'} />
                {theme === 'dark' && (
                  <span className="text-[10px] font-mono text-[#2F6FEB] font-bold">Active</span>
                )}
              </div>
              <span className="text-[13px] font-semibold block leading-tight">Dark Night</span>
            </button>
          </div>
        </div>

        {/* 3D Terrain (unavailable) */}
        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5 pr-3">
              <Mountain size={17} className="text-neutral-500 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300">
                    {t('terrainNoticeTitle')}
                  </span>
                  <span className="text-[9px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.2 rounded border border-neutral-300 dark:border-neutral-700">
                    Unavailable
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                  {t('terrainNoticeUnavailable')}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={false}
              disabled={true}
              onChange={() => {}}
              label="Terrain layer unavailable"
            />
          </div>
        </div>

        {/* Layer Toggles */}
        <div>
          <span className={sectionLabel}>Overlays</span>

          <div className={panel}>
            {/* 3D buildings */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Box size={16} className="text-[#2F6FEB]" />
                <div>
                  <span className={rowTitle}>3D buildings</span>
                  <span className="text-[11px] text-neutral-500">
                    Extruded buildings at street level
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={layers.buildings3d}
                onChange={() => toggleLayer('buildings3d')}
                label="3D buildings"
              />
            </div>

            {/* POIs */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-[#2F6FEB]" />
                <div>
                  <span className={rowTitle}>{t('layerPoi')}</span>
                  <span className="text-[11px] text-neutral-500">
                    Cathedrals, markets, gas stations, ATMs
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={layers.pointsOfInterest}
                onChange={() => toggleLayer('pointsOfInterest')}
                label={t('layerPoi')}
              />
            </div>

            {/* Speed & Enforcement Cameras */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera size={16} className="text-[#C9973F]" />
                <div>
                  <span className={rowTitle}>{t('layerCameras')}</span>
                  <span className="text-[11px] text-neutral-500">
                    Fixed radar, red-light, average speed zones
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={layers.speedCameras}
                onChange={() => toggleLayer('speedCameras')}
                label={t('layerCameras')}
              />
            </div>

            {/* Community Reports */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-amber-500" />
                <div>
                  <span className={rowTitle}>{t('layerCommunity')}</span>
                </div>
              </div>
              <ToggleSwitch
                checked={layers.communityReports}
                onChange={() => toggleLayer('communityReports')}
                label={t('layerCommunity')}
              />
            </div>

            {/* Saved Places */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bookmark size={16} className="text-emerald-400" />
                <div>
                  <span className={rowTitle}>{t('layerSaved')}</span>
                </div>
              </div>
              <ToggleSwitch
                checked={layers.savedPlaces}
                onChange={() => toggleLayer('savedPlaces')}
                label={t('layerSaved')}
              />
            </div>

            {/* Recorded Tracks */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Footprints size={16} className="text-purple-400" />
                <div>
                  <span className={rowTitle}>{t('layerTracks')}</span>
                </div>
              </div>
              <ToggleSwitch
                checked={layers.recordedTracks}
                onChange={() => toggleLayer('recordedTracks')}
                label={t('layerTracks')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
