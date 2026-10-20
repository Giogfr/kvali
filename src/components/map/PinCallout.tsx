/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import React, { useState } from 'react';
import { Navigation, Bookmark, Trash2, X, LocateFixed, Copy } from 'lucide-react';
import { Place, TemporaryPin } from '../../types';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

interface PinCalloutProps {
  place: Place | null;
  temporaryPin: TemporaryPin | null;
  onClose: () => void;
}

export const PinCallout: React.FC<PinCalloutProps> = ({
  place,
  temporaryPin,
  onClose,
}) => {
  const {
    t,
    language,
    theme,
    navigateTo,
    setRouteDestination,
    savePlace,
    setTemporaryPin,
    setSelectedPlace,
    collections,
    setManualLocation,
  } = useApp();
  const { showToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState(
    place ? (language === 'ka' ? place.nameKa : place.name) : 'Custom Pin'
  );
  const [selectedCollection, setSelectedCollection] = useState(collections[0] || 'Favorites');

  if (!place && !temporaryPin) return null;

  const lat = place ? place.latitude : temporaryPin!.latitude;
  const lng = place ? place.longitude : temporaryPin!.longitude;
  const title = place
    ? language === 'ka'
      ? place.nameKa
      : place.name
    : temporaryPin?.title || t('droppedPin');
  const description = place
    ? language === 'ka'
      ? place.descriptionKa
      : place.description
    : null;

  const handleDirections = () => {
    const dest = place || temporaryPin;
    setRouteDestination(dest);
    navigateTo('route-planning');
  };

  const handleSaveConfirm = () => {
    if (!saveName.trim()) return;
    savePlace({
      name: saveName.trim(),
      latitude: lat,
      longitude: lng,
      collection: selectedCollection,
      category: place?.category,
    });
    showToast(t('savePlace') + ': ' + saveName.trim(), 'success');
    setIsSaving(false);
  };

  const handleRemove = () => {
    setTemporaryPin(null);
    setSelectedPlace(null);
    onClose();
  };

  const handleUseAsMyLocation = () => {
    setManualLocation({ latitude: lat, longitude: lng, name: title });
    showToast(t('useAsMyLocation'), 'success');
  };

  const coordinateText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const handleCopyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(coordinateText);
      showToast(t('coordinatesCopied'), 'success');
    } catch {
      showToast(t('copyFailed'), 'warn');
    }
  };

  return (
    <div
      className={`absolute bottom-20 left-3 right-3 rounded-xl border shadow-xl z-30 p-3.5 transition-all animate-callout-in ${
        theme === 'dark'
          ? 'bg-[#1E1E1E]/95 border-neutral-700 text-white'
          : 'bg-white/95 border-neutral-200 text-[#111111]'
      } backdrop-blur-md`}
    >
      {/* Header with Title and Close button */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[15px] font-semibold tracking-tight truncate leading-tight">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
              {coordinateText}
            </p>
            <button
              onClick={handleCopyCoordinates}
              className="p-0.5 rounded text-neutral-400 hover:text-[#2F6FEB] transition-colors"
              aria-label={t('copyCoordinates')}
              title={t('copyCoordinates')}
            >
              <Copy size={11} />
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 -mr-1 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-neutral-200 transition-colors"
          aria-label={t('close')}
        >
          <X size={16} />
        </button>
      </div>

      {description && (
        <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Save Place inline form if active */}
      {isSaving ? (
        <div className="mt-2.5 pt-2.5 border-t border-neutral-200 dark:border-neutral-700/60 flex flex-col gap-2">
          <div>
            <label className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
              {t('placeName')}
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full mt-1 px-2.5 py-1.5 text-[12px] rounded-lg border bg-white dark:bg-neutral-800/80 border-neutral-300 dark:border-neutral-700 text-[#111111] dark:text-white focus:outline-none focus:border-[#2F6FEB]"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
              {t('collections')}
            </label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full mt-1 px-2.5 py-1.5 text-[12px] rounded-lg border bg-white dark:bg-neutral-800/80 border-neutral-300 dark:border-neutral-700 text-[#111111] dark:text-white focus:outline-none focus:border-[#2F6FEB]"
            >
              {collections.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              onClick={() => setIsSaving(false)}
              className="px-2.5 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSaveConfirm}
              className="px-3 py-1 text-[11px] font-medium bg-[#2F6FEB] text-white rounded-md hover:bg-[#2563EB]"
            >
              {t('saveChanges')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={handleUseAsMyLocation}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-neutral-100 dark:bg-[#282828] hover:bg-neutral-200 dark:hover:bg-[#333333] text-[11px] font-medium text-neutral-600 dark:text-neutral-300 transition-colors"
          >
            <LocateFixed size={13} />
            <span>{t('useAsMyLocation')}</span>
          </button>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 mt-2 pt-2.5 border-t border-neutral-200 dark:border-neutral-700/40">
          <button
            onClick={handleDirections}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#2F6FEB] hover:bg-[#2563EB] text-white text-[12px] font-medium shadow-sm press"
          >
            <Navigation size={14} />
            <span>{t('directions')}</span>
          </button>

          <button
            onClick={() => setIsSaving(true)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-200 dark:bg-[#282828] hover:bg-neutral-300 dark:hover:bg-[#333333] text-[12px] font-medium text-current transition-colors"
          >
            <Bookmark size={14} />
            <span>{t('savePlace')}</span>
          </button>

          <button
            onClick={handleRemove}
            className="p-2 rounded-lg bg-neutral-200 dark:bg-[#282828] hover:bg-neutral-300 dark:hover:bg-[#333333] text-neutral-400 hover:text-red-400 transition-colors"
            title={t('removePin')}
            aria-label={t('removePin')}
          >
            <Trash2 size={15} />
          </button>
          </div>
        </>
      )}
    </div>
  );
};
