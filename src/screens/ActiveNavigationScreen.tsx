import React from 'react';
import { CornerUpRight, ShieldAlert, X, Compass, Navigation } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MapView } from '../components/map/MapView';
import { formatDistance } from '../lib/geo';

export const ActiveNavigationScreen: React.FC = () => {
  const {
    t,
    language,
    units,
    activeNav,
    endNavigation,
    triggerRecenter,
  } = useApp();

  const distStr = formatDistance(activeNav.remainingDistanceKm, units);

  const speedValue =
    units === 'imperial'
      ? Math.round(activeNav.currentSpeedKmh * 0.621371)
      : Math.round(activeNav.currentSpeedKmh);
  const speedUnit = units === 'imperial' ? 'MPH' : 'KM/H';
  const speedLimit =
    activeNav.speedLimitKmh === null
      ? null
      : units === 'imperial'
      ? Math.round(activeNav.speedLimitKmh * 0.621371)
      : activeNav.speedLimitKmh;

  const now = new Date();
  const etaDate = new Date(now.getTime() + activeNav.remainingDurationMinutes * 60000);
  const etaHours = etaDate.getHours().toString().padStart(2, '0');
  const etaMinutes = etaDate.getMinutes().toString().padStart(2, '0');
  const etaString = `${etaHours}:${etaMinutes}`;
  const upcomingAlert = activeNav.upcomingAlert;

  return (
    <div className="relative w-full h-full bg-[#111111] text-white overflow-hidden select-none">
      {/* Background Interactive Map */}
      <div className="absolute inset-0">
        <MapView activeRouteCoordinates={activeNav.route?.coordinates} />
      </div>

      {/* Foreground guidance column (safe-area aware on phones and car displays) */}
      <div className="relative z-30 w-full h-full flex flex-col safe-top">
        {/* Top Driving Maneuver Banner */}
        <div className="p-2 sm:p-3">
          <div className="px-3 py-2.5 sm:p-3.5 rounded-2xl bg-[#1B1B1B]/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Maneuver Icon */}
              <div className="w-11 h-11 landscape:w-12 landscape:h-12 rounded-xl bg-white text-black flex items-center justify-center shrink-0 shadow">
                <CornerUpRight size={28} className="stroke-[2.5]" />
              </div>

              <div className="min-w-0">
                <div className="text-[22px] font-bold tracking-tight leading-tight tabular-nums">
                  {formatDistance(activeNav.currentManeuver.distanceMeters / 1000, units)}
                </div>
                <div className="text-[15px] font-semibold text-neutral-100 truncate">
                  {language === 'ka'
                    ? activeNav.currentManeuver.instructionKa
                    : activeNav.currentManeuver.instruction}
                </div>
                <div className="text-[11px] text-neutral-400 font-mono truncate">
                  {activeNav.currentManeuver.roadName}
                </div>
              </div>
            </div>

            {/* GPS status */}
            <div className="flex flex-col items-end shrink-0 pl-2">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  activeNav.gpsActive
                    ? 'bg-[#2F6FEB] text-white'
                    : 'bg-neutral-600 text-neutral-200'
                }`}
              >
                {activeNav.gpsActive ? t('gpsLive') : t('gpsWaiting')}
              </span>
            </div>
          </div>

          {/* Off-route notice */}
          {activeNav.gpsActive && activeNav.offRouteM > 60 && (
            <div className="mt-2 px-3 py-1.5 rounded-xl bg-[#C9973F]/90 text-black text-[12px] font-semibold text-center shadow-lg animate-fade-in">
              {t('offRouteRerouting')}
            </div>
          )}
        </div>

        {/* Flexible middle: recenter control floats just under the banner */}
        <div className="flex-1 flex flex-col">
          <button
            onClick={triggerRecenter}
            className="self-end mr-3 w-11 h-11 rounded-xl bg-[#1E1E1E]/90 border border-neutral-700 text-white flex items-center justify-center shadow-lg press"
            aria-label={t('recenter')}
          >
            <Compass size={20} />
          </button>
        </div>

        {/* Upcoming road alert warning strip */}
        {upcomingAlert && (
          <div className="px-3 pb-2 animate-fade-in">
            <div className="px-3 py-2 rounded-xl bg-[#242424]/95 border border-[#C9973F]/70 shadow-lg backdrop-blur-md flex items-center gap-2">
              <ShieldAlert size={17} className="text-[#C9973F] shrink-0" />
              <div className="min-w-0">
                <span className="text-[12px] font-semibold text-[#C9973F] block truncate">
                  {t('cameraWarning')}:{' '}
                  {language === 'ka' ? upcomingAlert.roadNameKa : upcomingAlert.roadName}
                </span>
                <span className="text-[10px] text-neutral-300 truncate block">
                  {language === 'ka' ? upcomingAlert.descriptionKa : upcomingAlert.description} ·{' '}
                  {upcomingAlert.warningDistanceMeters} m
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Driving Dashboard Panel */}
        <div className="px-3.5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] landscape:py-2.5 bg-[#181818]/98 border-t border-neutral-800 shadow-2xl backdrop-blur-md">
          <div className="flex items-end justify-between">
            {/* Speed & Speed Limit */}
            <div className="flex items-baseline gap-3">
              <div>
                <div className="text-[44px] landscape:text-[34px] font-extrabold tracking-tighter tabular-nums leading-none text-white">
                  {speedValue}
                </div>
                <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                  {speedUnit}
                </div>
              </div>

              {/* Speed Limit Badge — only when a nearby alert reports a limit */}
              {speedLimit !== null && (
                <div
                  className="w-10 h-10 rounded-full border-[3px] border-red-500 bg-white text-black flex flex-col items-center justify-center shadow font-bold text-[13px] tabular-nums shrink-0"
                  title={t('speedLimit')}
                >
                  <span>{speedLimit}</span>
                </div>
              )}
            </div>

            {/* Remaining Distance & Duration */}
            <div className="text-right">
              <div className="text-[20px] font-bold text-[#2F6FEB] tabular-nums leading-tight">
                {activeNav.remainingDurationMinutes} min
              </div>
              <div className="text-[12px] text-neutral-300 tabular-nums">
                {distStr} · ETA {etaString}
              </div>
            </div>
          </div>

          {/* End Navigation Button */}
          <div className="mt-3 pt-2.5 landscape:mt-2 landscape:pt-2 border-t border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <Navigation size={13} className="text-[#2F6FEB]" />
              <span className="truncate max-w-[200px]">
                {activeNav.route?.via || t('droppedPin')}
              </span>
            </div>

            <button
              onClick={endNavigation}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-[13px] font-semibold flex items-center gap-1.5 press shadow"
            >
              <X size={15} />
              <span>{t('endNavigation')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
