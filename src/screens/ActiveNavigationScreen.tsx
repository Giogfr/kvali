import React, { useMemo } from 'react';
import {
  CornerUpRight,
  X,
  Compass,
  Navigation,
  LocateFixed,
  Move3d,
  Move,
  Camera,
  AlertTriangle,
  Construction,
  Octagon,
  School,
  TrafficCone,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MapView } from '../components/map/MapView';
import { calculateDistanceKm, formatDistance } from '../lib/geo';
import { isSchoolZoneActive } from '../lib/alertSchedule';
import { findSharpCurveAhead } from '../lib/navigation';
import { etaFromNow, formatClockTime, formatDurationMinutes } from '../lib/time';
import type { RoadAlert } from '../types';

function alertIcon(category: RoadAlert['category']) {
  if (category === 'school_zone') return School;
  if (category.includes('camera') || category.includes('speed_zone')) return Camera;
  if (category === 'stop_sign') return Octagon;
  if (category === 'traffic_light') return TrafficCone;
  if (category === 'sharp_curve') return TrendingUp;
  if (category === 'roadworks' || category === 'road_closures' || category === 'lane_restrictions')
    return Construction;
  return AlertTriangle;
}

export const ActiveNavigationScreen: React.FC = () => {
  const {
    t,
    language,
    units,
    activeNav,
    endNavigation,
    triggerRecenter,
    roadAlerts,
    enabledAlertCategories,
    userLocation,
    navView,
    setNavView,
    northUpLock,
    setNorthUpLock,
    isFollowing,
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

  const etaString = formatClockTime(etaFromNow(activeNav.remainingDurationMinutes));

  // Nearest mapped alerts ahead of the driver, with live distance in metres.
  const aheadAlerts = useMemo(() => {
    if (!userLocation) return [] as (RoadAlert & { distanceM: number })[];
    const schoolTime = isSchoolZoneActive(new Date());
    return roadAlerts
      .filter((alert) => enabledAlertCategories[alert.category])
      .filter((alert) => alert.category !== 'school_zone' || schoolTime)
      .map((alert) => ({
        ...alert,
        distanceM:
          calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            alert.latitude,
            alert.longitude
          ) * 1000,
      }))
      .filter((alert) => alert.distanceM <= 5000)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 3);
  }, [roadAlerts, enabledAlertCategories, userLocation]);

  // Sharp bends are derived from the route geometry, so they work offline.
  const sharpCurve = useMemo(() => {
    if (!userLocation || !activeNav.route) return null;
    return findSharpCurveAhead(activeNav.route.coordinates, userLocation);
  }, [userLocation, activeNav.route]);

  const controlBase =
    'w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg pointer-events-auto press transition-colors';
  const controlIdle = 'bg-[#1E1E1E]/92 border-neutral-700 text-white';
  const controlActive = 'bg-[#2F6FEB] border-[#2F6FEB] text-white';

  return (
    <div className="relative w-full h-full bg-[#111111] text-white overflow-hidden select-none">
      {/* Background interactive map — the overlay below is click-through so the
          driver can pan, pinch, rotate and zoom at any time. */}
      <div className="absolute inset-0">
        <MapView activeRouteCoordinates={activeNav.route?.coordinates} />
      </div>

      <div className="relative z-30 w-full h-full flex flex-col safe-top pointer-events-none">
        {/* Top driving maneuver banner */}
        <div className="p-2 sm:p-3">
          <div className="px-3 py-2.5 sm:p-3.5 rounded-2xl bg-[#1B1B1B]/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
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

        {/* Camera rail: follow, tilt, north-up. Panning the map pauses follow;
            tapping follow re-engages it. */}
        <div className="flex-1 flex flex-col items-end justify-start gap-2 pr-3">
          <button
            onClick={triggerRecenter}
            className={`${controlBase} ${isFollowing ? controlActive : controlIdle}`}
            aria-label={t('followMe')}
            title={t('followMe')}
          >
            <LocateFixed size={20} />
          </button>
          <button
            onClick={() => setNavView(navView === '3d' ? '2d' : '3d')}
            className={`${controlBase} ${controlIdle}`}
            aria-label={navView === '3d' ? t('view2d') : t('view3d')}
            title={navView === '3d' ? t('view2d') : t('view3d')}
          >
            {navView === '3d' ? <Move size={20} /> : <Move3d size={20} />}
            <span className="sr-only">{navView === '3d' ? '2D' : '3D'}</span>
          </button>
          <button
            onClick={() => setNorthUpLock(!northUpLock)}
            className={`${controlBase} ${northUpLock ? controlActive : controlIdle}`}
            aria-label={t('northUp')}
            title={t('northUp')}
          >
            <Compass size={20} />
          </button>
        </div>

        {/* Alerts ahead — camera, hazard and curve warnings with live distance. */}
        {(aheadAlerts.length > 0 || sharpCurve) && (
          <div className="px-3 pb-2 flex gap-2 overflow-x-auto pointer-events-auto">
            {sharpCurve && (
              <div className="shrink-0 px-2.5 py-1.5 rounded-xl border shadow-lg backdrop-blur-md flex items-center gap-2 bg-[#242424]/95 border-[#C9973F]/70 text-white">
                <TrendingUp size={15} className="shrink-0 text-[#C9973F]" />
                <span className="text-[12px] font-semibold tabular-nums">
                  {formatDistance(sharpCurve.distanceM / 1000, units)}
                </span>
                <span className="text-[11px] opacity-80 truncate max-w-[120px]">
                  {language === 'ka' ? 'მკვეთრი მოხვევა' : 'Sharp curve'}
                </span>
              </div>
            )}
            {aheadAlerts.map((alert) => {
              const Icon = alertIcon(alert.category);
              const isCamera =
                alert.category.includes('camera') || alert.category.includes('speed_zone');
              return (
                <div
                  key={alert.id}
                  className={`shrink-0 px-2.5 py-1.5 rounded-xl border shadow-lg backdrop-blur-md flex items-center gap-2 ${
                    isCamera
                      ? 'bg-[#C9973F]/95 border-[#C9973F] text-black'
                      : 'bg-[#242424]/95 border-neutral-700 text-white'
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="text-[12px] font-semibold tabular-nums">
                    {formatDistance(alert.distanceM / 1000, units)}
                  </span>
                  <span className="text-[11px] opacity-80 truncate max-w-[120px]">
                    {language === 'ka' ? alert.descriptionKa : alert.description}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom driving dashboard */}
        <div className="px-3.5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] landscape:py-2.5 bg-[#181818]/98 border-t border-neutral-800 shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-end justify-between">
            {/* Speed & speed limit */}
            <div className="flex items-baseline gap-3">
              <div>
                <div className="text-[44px] landscape:text-[34px] font-extrabold tracking-tighter tabular-nums leading-none text-white">
                  {speedValue}
                </div>
                <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                  {speedUnit}
                </div>
              </div>

              {/* Speed limit sign — always visible. Shows a muted dash when the
                  limit is not mapped in OpenStreetMap here, never a guess. */}
              <div
                className={`w-11 h-11 rounded-full border-[3px] flex flex-col items-center justify-center shadow font-bold text-[13px] tabular-nums shrink-0 ${
                  speedLimit !== null
                    ? 'border-red-500 bg-white text-black'
                    : 'border-neutral-500 bg-neutral-200/90 text-neutral-600 border-dashed'
                }`}
                title={speedLimit !== null ? t('speedLimit') : t('speedLimitUnmapped')}
              >
                <span>{speedLimit !== null ? speedLimit : '–'}</span>
              </div>
            </div>

            {/* Remaining distance & duration */}
            <div className="text-right">
              <div className="text-[20px] font-bold text-[#2F6FEB] tabular-nums leading-tight">
                {formatDurationMinutes(activeNav.remainingDurationMinutes)}
              </div>
              <div className="text-[12px] text-neutral-300 tabular-nums">
                {distStr} · ETA {etaString}
              </div>
            </div>
          </div>

          {/* End navigation */}
          <div className="mt-3 pt-2.5 landscape:mt-2 landscape:pt-2 border-t border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <Navigation size={13} className="text-[#2F6FEB]" />
              <span className="truncate max-w-[200px]">
                {activeNav.route?.via || t('droppedPin')}
              </span>
            </div>

            <button
              onClick={endNavigation}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-[13px] font-semibold flex items-center gap-1.5 press shadow pointer-events-auto"
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
