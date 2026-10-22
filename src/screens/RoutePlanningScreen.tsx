/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import React, { useMemo, useEffect } from 'react';
import {
  Car,
  Footprints,
  Bike,
  ArrowUpDown,
  Trash2,
  Navigation,
  Check,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { ToggleSwitch } from '../components/common/Controls';
import { formatDistance } from '../lib/geo';
import { hasActiveRoutePreferences } from '../lib/routePreferences';
import { formatDurationMinutes } from '../lib/time';
import type { TravelMode } from '../types';

export const RoutePlanningScreen: React.FC = () => {
  const {
    t,
    language,
    theme,
    units,
    travelMode,
    setTravelMode,
    routePreferences,
    setRoutePreferences,
    routeOrigin,
    setRouteOrigin,
    routeDestination,
    setRouteDestination,
    intermediateStops,
    removeIntermediateStop,
    routeAlternatives,
    selectedRouteAlternative,
    setSelectedRouteAlternative,
    isCalculatingRoute,
    routeError,
    routeSource,
    startNavigation,
    navigateTo,
    effectiveCenter,
    userLocation,
    manualLocation,
  } = useApp();

  const destCoords = useMemo(() => {
    if (routeDestination && 'latitude' in routeDestination) {
      return {
        lat: routeDestination.latitude,
        lon: routeDestination.longitude,
        name: 'name' in routeDestination ? routeDestination.name : routeDestination.title || t('droppedPin'),
      };
    }
    return { lat: effectiveCenter.latitude, lon: effectiveCenter.longitude, name: t('chooseDestination') };
  }, [routeDestination, effectiveCenter, t]);

  const originCoords = useMemo(() => {
    if (routeOrigin) return { lat: routeOrigin.latitude, lon: routeOrigin.longitude, name: routeOrigin.name };
    if (userLocation)
      return { lat: userLocation.latitude, lon: userLocation.longitude, name: t('gpsLive') };
    if (manualLocation)
      return {
        lat: manualLocation.latitude,
        lon: manualLocation.longitude,
        name: manualLocation.name || t('manualLocationLabel'),
      };
    return null;
  }, [routeOrigin, userLocation, manualLocation, t]);

  // Routes come from the shared context; they are real OSRM results only.
  const alternatives = routeAlternatives;

  // Keep the selected alternative valid whenever the route list changes.
  useEffect(() => {
    if (alternatives.length === 0) return;
    const stillValid = alternatives.some((a) => a.id === selectedRouteAlternative?.id);
    if (!stillValid) setSelectedRouteAlternative(alternatives[0]);
  }, [alternatives, selectedRouteAlternative, setSelectedRouteAlternative]);

  const handleSwap = () => {
    if (!routeDestination || !originCoords) return;
    const oldOrigin = originCoords;
    const oldDest = destCoords;

    setRouteOrigin({
      name: oldDest.name,
      latitude: oldDest.lat,
      longitude: oldDest.lon,
    });
    setRouteDestination({
      title: oldOrigin.name,
      latitude: oldOrigin.lat,
      longitude: oldOrigin.lon,
    });
  };

  const handleStart = () => {
    if (selectedRouteAlternative) {
      startNavigation(selectedRouteAlternative);
    }
  };

  const fieldClass =
    'flex items-center justify-between px-3 rounded-lg bg-white dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700/80 text-[12px]';
  const panel = 'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40';

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar
        title={t('routePlanningTitle')}
        onBack={() => navigateTo('map')}
        subtitle={userLocation ? t('gpsLive') : manualLocation ? t('manualLocationLabel') : t('gpsWaiting')}
      />

      {/* Origin, Destination & Swap Block */}
      <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800/60 bg-neutral-50 dark:bg-neutral-900/30">
        <div className="flex items-center gap-2">
          {/* Timeline dots line */}
          <div className="flex flex-col items-center justify-between py-2 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2F6FEB] border-2 border-white" />
            <div className="w-0.5 h-7 bg-neutral-400 dark:bg-neutral-600 my-1 border-dashed" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-2">
            {/* Origin */}
            <div className={`${fieldClass} py-2`}>
              <span className="truncate text-neutral-700 dark:text-neutral-300 font-medium">
                {originCoords ? originCoords.name : t('locationOffTitle')}
              </span>
              <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                {originCoords
                  ? `${originCoords.lat.toFixed(3)}, ${originCoords.lon.toFixed(3)}`
                  : t('setLocationManually')}
              </span>
            </div>

            {/* Intermediate Stops */}
            {intermediateStops.map((stop, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700/50 text-[11px]"
              >
                <span className="truncate text-neutral-500 dark:text-neutral-400">
                  Via: {'name' in stop ? stop.name : t('droppedPin')}
                </span>
                <button
                  onClick={() => removeIntermediateStop(idx)}
                  className="text-neutral-500 hover:text-red-500"
                  aria-label={t('removeStop')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {/* Destination */}
            <div className={`${fieldClass} py-2`}>
              <span className="truncate text-neutral-900 dark:text-white font-medium">
                {destCoords.name}
              </span>
              <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                {destCoords.lat.toFixed(3)}, {destCoords.lon.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            className="p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors shrink-0"
            aria-label={t('swapPoints')}
            title={t('swapPoints')}
          >
            <ArrowUpDown size={17} />
          </button>
        </div>

      </div>

      {/* Travel Modes (Car, Walk, Cycle) */}
      <div className="px-3.5 py-2.5 border-b border-neutral-200 dark:border-neutral-800/40 flex items-center justify-around gap-2">
        {(
          [
            { id: 'car', label: t('car'), icon: Car },
            { id: 'walking', label: t('walking'), icon: Footprints },
            { id: 'cycling', label: t('cycling'), icon: Bike },
          ] as { id: TravelMode; label: string; icon: React.FC<{ size?: number }> }[]
        ).map((mode) => {
          const Icon = mode.icon;
          const isSelected = travelMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setTravelMode(mode.id)}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-[12px] font-medium border transition-all ${
                isSelected
                  ? 'bg-[#2F6FEB] border-[#2F6FEB] text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800/60 border-neutral-300 dark:border-neutral-700/60 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Body: Route Alternatives & Preferences */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
        {/* Route Alternatives */}
        <div>
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold block mb-2">
            {t('routesTitle')}
          </span>

          {isCalculatingRoute && alternatives.length === 0 && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`p-3 ${panel}`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="skeleton h-3.5 w-28" />
                      <div className="skeleton h-2.5 w-40" />
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <div className="skeleton h-4 w-12" />
                      <div className="skeleton h-2.5 w-10" />
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-[12px] text-neutral-500 dark:text-neutral-400 py-1">{t('calculatingRoutes')}</div>
            </div>
          )}

          {routeError && alternatives.length === 0 && (
            <div className="text-[12px] text-red-500 py-2">{routeError}</div>
          )}

          {alternatives.length > 0 && routeSource && routeSource !== 'online' && (
            <div className="flex items-start gap-2 p-2 mb-2 rounded-lg bg-[#C9973F]/10 border border-[#C9973F]/40 text-[11px] text-[#C9973F]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{routeSource === 'cached' ? t('savedRouteNotice') : t('offlineGraphNotice')}</span>
            </div>
          )}

          <div className="space-y-2 stagger">
            {alternatives.map((alt) => {
              const isSelected = selectedRouteAlternative?.id === alt.id;
              const distStr = formatDistance(alt.distanceKm, units);

              return (
                <div
                  key={alt.id}
                  onClick={() => setSelectedRouteAlternative(alt)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2F6FEB]/10 border-[#2F6FEB] text-neutral-900 dark:text-white'
                      : 'bg-white dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">
                          {language === 'ka' ? alt.nameKa : alt.name}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#2F6FEB] flex items-center justify-center">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {language === 'ka' ? alt.viaKa : alt.via}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[16px] font-bold tabular-nums text-[#2F6FEB]">
                        {formatDurationMinutes(alt.durationMinutes)}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block tabular-nums">
                        {distStr}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-neutral-200 dark:border-neutral-800/60 text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>{language === 'ka' ? alt.preferenceNoteKa : alt.preferenceNote}</span>
                    <span className={`font-mono ${routeSource !== 'online' ? 'text-[#C9973F]' : 'text-emerald-500 dark:text-emerald-400'}`}>
                      {routeSource === 'cached'
                        ? t('savedRouteLabel')
                        : routeSource === 'offline-graph'
                        ? t('offlineRouteLabel')
                        : travelMode === 'walking'
                        ? 'Valhalla'
                        : 'OSRM'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Route Preferences Switches */}
        <div className={`p-3 ${panel} space-y-3`}>
          <div className="flex items-center gap-2 pb-1 border-b border-neutral-200 dark:border-neutral-800">
            <Sliders size={15} className="text-neutral-500 dark:text-neutral-400" />
            <span className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">
              {t('routePreferences')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-neutral-700 dark:text-neutral-300">{t('avoidTolls')}</span>
            <ToggleSwitch
              checked={routePreferences.avoidTolls}
              onChange={(c) => setRoutePreferences((p) => ({ ...p, avoidTolls: c }))}
              label={t('avoidTolls')}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-neutral-700 dark:text-neutral-300">{t('avoidHighways')}</span>
            <ToggleSwitch
              checked={routePreferences.avoidHighways}
              onChange={(c) => setRoutePreferences((p) => ({ ...p, avoidHighways: c }))}
              label={t('avoidHighways')}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-neutral-700 dark:text-neutral-300">{t('avoidUnpaved')}</span>
            <ToggleSwitch
              checked={routePreferences.avoidUnpaved}
              onChange={(c) => setRoutePreferences((p) => ({ ...p, avoidUnpaved: c }))}
              label={t('avoidUnpaved')}
            />
          </div>

          {hasActiveRoutePreferences(routePreferences) && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {t('preferencesViaValhalla')}
            </p>
          )}
        </div>

        {/* Disclaimer Notice */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
          <AlertTriangle size={15} className="text-[#C9973F] shrink-0 mt-0.5" />
          <span>{t('routeDisclaimer')}</span>
        </div>
      </div>

      {/* Bottom Start Navigation CTA */}
      <div className="p-3.5 border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900/60">
        <button
          onClick={handleStart}
          disabled={!selectedRouteAlternative}
          className="w-full py-3.5 px-4 rounded-xl bg-[#2F6FEB] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-lg press"
        >
          <Navigation size={18} />
          <span>{t('startNavigation')}</span>
        </button>
      </div>
    </div>
  );
};
