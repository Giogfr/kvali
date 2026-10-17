import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Layers,
  ShieldAlert,
  WifiOff,
  Navigation,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MapView } from '../components/map/MapView';
import { PinCallout } from '../components/map/PinCallout';
import { useToast } from '../context/ToastContext';

export const MapScreen: React.FC = () => {
  const {
    t,
    theme,
    navigateTo,
    triggerRecenter,
    layers,
    toggleLayer,
    airplaneOfflineMode,
    setAirplaneOfflineMode,
    selectedPlace,
    setSelectedPlace,
    temporaryPin,
    setTemporaryPin,
    routeDestination,
    selectedRouteAlternative,
  } = useApp();

  const { showToast } = useToast();
  const [showCallout, setShowCallout] = useState(true);

  const handleToggleAlerts = () => {
    toggleLayer('speedCameras');
    showToast(
      layers.speedCameras
        ? t('alertOverlays') + ' hidden'
        : t('alertOverlays') + ' visible',
      'info'
    );
  };

  const handleToggleOffline = () => {
    const next = !airplaneOfflineMode;
    setAirplaneOfflineMode(next);
    showToast(
      next ? 'Switched to Simulated Offline Mode' : 'Connected to Online Map Tiles',
      next ? 'warn' : 'info'
    );
  };

  const handleOpenSearch = () => {
    navigateTo('search');
  };

  const handleOpenRoutePlanning = () => {
    navigateTo('route-planning');
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* Interactive Map Surface */}
      <div className="absolute inset-0">
        <MapView
          activeRouteCoordinates={selectedRouteAlternative?.coordinates}
          onTapLocation={() => setShowCallout(true)}
          onSelectPlace={() => setShowCallout(true)}
        />
      </div>

      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2">
        {/* Settings */}
        <button
          onClick={() => navigateTo('settings')}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md shrink-0 transition-colors ${
            theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-300 hover:text-white'
              : 'bg-white/95 border-neutral-200 text-neutral-700 hover:text-black'
          } backdrop-blur-md`}
          aria-label={t('preferences')}
          title={t('preferences')}
        >
          <SlidersHorizontal size={18} />
        </button>

        {/* Floating Search Bar */}
        <button
          onClick={handleOpenSearch}
          className={`flex-1 h-10 px-3.5 rounded-xl flex items-center justify-between border shadow-md text-left transition-colors ${
            theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-400 hover:border-neutral-500'
              : 'bg-white/95 border-neutral-200 text-neutral-500 hover:border-neutral-400'
          } backdrop-blur-md`}
          aria-label={t('searchPlaceholder')}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search size={17} className="text-neutral-400 shrink-0" />
            <span className="text-[13px] truncate">
              {routeDestination
                ? ('name' in routeDestination ? routeDestination.name : routeDestination.title || t('droppedPin'))
                : t('searchPlaceholder')}
            </span>
          </div>
        </button>
      </div>

      {/* Map controls */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-2">
        {/* Map layers */}
        <button
          onClick={() => navigateTo('map-layers')}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md transition-colors ${
            theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-300 hover:text-white'
              : 'bg-white/95 border-neutral-200 text-neutral-700 hover:text-black'
          } backdrop-blur-md`}
          aria-label={t('mapLayers')}
          title={t('mapLayers')}
        >
          <Layers size={18} />
        </button>

        {/* Alert overlay toggle */}
        <button
          onClick={handleToggleAlerts}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md transition-colors ${
            layers.speedCameras
              ? 'bg-[#C9973F] text-black border-amber-600'
              : theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-400'
              : 'bg-white/95 border-neutral-200 text-neutral-400'
          } backdrop-blur-md`}
          aria-label={t('alertOverlays')}
          title={t('alertOverlays')}
        >
          <ShieldAlert size={18} />
        </button>

        {/* Offline mode toggle */}
        <button
          onClick={handleToggleOffline}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md transition-colors ${
            airplaneOfflineMode
              ? 'bg-[#C9973F] text-black border-amber-600'
              : theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-300'
              : 'bg-white/95 border-neutral-200 text-neutral-700'
          } backdrop-blur-md`}
          aria-label={t('offlineStatus')}
          title={t('offlineStatus')}
        >
          <WifiOff size={18} />
        </button>

        {/* Recenter */}
        <button
          onClick={() => {
            triggerRecenter();
            showToast(t('recenter') + ': ' + t('simulatedGps'), 'info');
          }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md transition-colors ${
            theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-300 hover:text-white active:bg-neutral-800'
              : 'bg-white/95 border-neutral-200 text-neutral-700 hover:text-black active:bg-neutral-100'
          } backdrop-blur-md`}
          aria-label={t('recenter')}
          title={t('recenter')}
        >
          <Compass size={18} />
        </button>
      </div>

      {/* POI or Dropped Pin Callout */}
      {showCallout && (selectedPlace || temporaryPin) && (
        <PinCallout
          place={selectedPlace}
          temporaryPin={temporaryPin}
          onClose={() => {
            setShowCallout(false);
            setSelectedPlace(null);
            setTemporaryPin(null);
          }}
        />
      )}

      {/* Bottom Compact Route Dock (Above Nav Bar) */}
      {!selectedPlace && !temporaryPin && (
        <div className="absolute bottom-3 left-3 right-3 z-20">
          <button
            onClick={handleOpenRoutePlanning}
            className={`w-full py-3 px-4 rounded-xl border shadow-lg flex items-center justify-between transition-colors ${
              theme === 'dark'
                ? 'bg-[#181818]/95 border-neutral-700 text-white hover:bg-[#202020]'
                : 'bg-white/95 border-neutral-200 text-[#111111] hover:bg-neutral-50'
            } backdrop-blur-md`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#2F6FEB]/15 text-[#2F6FEB] flex items-center justify-center">
                <Navigation size={15} />
              </div>
              <div className="text-left">
                <span className="text-[13px] font-medium block leading-tight">
                  {routeDestination
                    ? ('name' in routeDestination ? routeDestination.name : routeDestination.title || t('droppedPin'))
                    : t('planRoute')}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {t('simulatedGps')} · Kutaisi
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#2F6FEB]">
              <span>{t('directions')}</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
