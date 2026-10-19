import React, { useRef, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Layers,
  ShieldAlert,
  WifiOff,
  Navigation,
  Compass,
  ArrowRight,
  Plus,
  Minus,
  LocateFixed,
  MapPin,
  X,
  Box,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MapView, type MapViewHandle } from '../components/map/MapView';
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
    userLocation,
    geolocationStatus,
    requestUserLocation,
    manualLocation,
    handleMapTapCoords,
  } = useApp();

  const { showToast } = useToast();
  const [showCallout, setShowCallout] = useState(true);
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  const mapRef = useRef<MapViewHandle>(null);

  const controlButtonClass = `w-11 h-11 rounded-xl flex items-center justify-center border shadow-md press transition-colors ${
    theme === 'dark'
      ? 'bg-[#1E1E1E]/95 border-neutral-700 text-neutral-300 hover:text-white'
      : 'bg-white/95 border-neutral-200 text-neutral-700 hover:text-black'
  } backdrop-blur-md`;

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
      next ? 'Offline rendering forced' : 'Back to online map tiles',
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
          ref={mapRef}
          activeRouteCoordinates={selectedRouteAlternative?.coordinates}
          onTapLocation={(coords) => {
            setShowCallout(true);
            handleMapTapCoords(coords);
          }}
          onSelectPlace={() => setShowCallout(true)}
        />
      </div>

      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2">
        {/* Settings */}
        <button
          onClick={() => navigateTo('settings')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-md press shrink-0 transition-colors ${
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
          className={`flex-1 h-11 px-3.5 rounded-xl flex items-center justify-between border shadow-md text-left press ${
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

      {/* Location setup: shown until a GPS fix or a manual position exists */}
      {!userLocation && !manualLocation && showLocationBanner && (
        <div
          className={`absolute top-16 left-3 right-16 z-10 rounded-xl border shadow-lg p-3 ${
            theme === 'dark'
              ? 'bg-[#1E1E1E]/95 border-neutral-700 text-white'
              : 'bg-white/95 border-neutral-200 text-[#111111]'
          } backdrop-blur-md`}
        >
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2F6FEB]/15 text-[#2F6FEB] flex items-center justify-center shrink-0">
              <LocateFixed size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold leading-tight">{t('locationOffTitle')}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                {t('locationOffDesc')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => requestUserLocation()}
                  disabled={geolocationStatus === 'requesting'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2F6FEB] hover:bg-[#2563EB] disabled:opacity-60 text-white text-[11px] font-medium press"
                >
                  <LocateFixed size={12} />
                  <span>
                    {geolocationStatus === 'requesting' ? t('locating') : t('enableLocation')}
                  </span>
                </button>
                <button
                  onClick={() => showToast(t('manualLocationHint'), 'info')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-200 dark:bg-[#282828] hover:bg-neutral-300 dark:hover:bg-[#333333] text-[11px] font-medium text-current transition-colors"
                >
                  <MapPin size={12} />
                  <span>{t('setLocationManually')}</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowLocationBanner(false)}
              className="p-1 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              aria-label={t('close')}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {airplaneOfflineMode && (userLocation || manualLocation || !showLocationBanner) && (
        <div className="absolute top-16 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#C9973F] text-black text-[11px] font-semibold shadow-md">
          <WifiOff size={13} />
          <span>{t('offlineStatus')}</span>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-2">
        {/* Zoom */}
        <div className={`flex flex-col rounded-xl border shadow-md overflow-hidden ${theme === 'dark' ? 'bg-[#1E1E1E]/95 border-neutral-700' : 'bg-white/95 border-neutral-200'} backdrop-blur-md`}>
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className={`w-11 h-10 flex items-center justify-center press transition-colors ${theme === 'dark' ? 'text-neutral-300 hover:text-white' : 'text-neutral-700 hover:text-black'}`}
            aria-label={t('zoomIn')}
            title={t('zoomIn')}
          >
            <Plus size={18} />
          </button>
          <div className={`h-px ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className={`w-11 h-10 flex items-center justify-center press transition-colors ${theme === 'dark' ? 'text-neutral-300 hover:text-white' : 'text-neutral-700 hover:text-black'}`}
            aria-label={t('zoomOut')}
            title={t('zoomOut')}
          >
            <Minus size={18} />
          </button>
        </div>

        {/* Tilt / 3D view */}
        <button
          onClick={() => mapRef.current?.toggle3D()}
          className={controlButtonClass}
          aria-label={t('toggle3d')}
          title={t('toggle3d')}
        >
          <Box size={18} />
        </button>

        {/* Map layers */}
        <button
          onClick={() => navigateTo('map-layers')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-md press transition-colors ${
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
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-md press transition-colors ${
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
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-md press transition-colors ${
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
          onClick={async () => {
            await triggerRecenter();
            showToast(t('recenter'), 'info');
          }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-md press transition-colors ${
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
          key={
            selectedPlace
              ? `place-${selectedPlace.id}`
              : `pin-${temporaryPin?.latitude},${temporaryPin?.longitude}`
          }
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
            className={`w-full py-3 px-4 rounded-xl border shadow-lg flex items-center justify-between press ${
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
                  {userLocation ? t('gpsLive') : t('gpsWaiting')}
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
