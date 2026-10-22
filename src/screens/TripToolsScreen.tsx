/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import React, { useRef } from 'react';
import { Footprints, Plus, Square, Download, Trash2, Gauge, Clock, Compass, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { useToast } from '../context/ToastContext';
import { formatDistance, formatSpeed } from '../lib/geo';
import { formatDurationMinutes } from '../lib/time';
import { parseGpx, trackToGpx } from '../lib/gpx';
import { fillTemplate } from '../lib/i18n';
import { RecordedTrack } from '../types';

export const TripToolsScreen: React.FC = () => {
  const {
    t,
    theme,
    units,
    recordedTracks,
    addRecordedTrack,
    deleteTrack,
    isRecordingLiveTrack,
    startLiveTrackRecording,
    stopAndSaveLiveTrack,
    navigateTo,
    setSelectedRouteAlternative,
  } = useApp();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleRecording = () => {
    if (isRecordingLiveTrack) {
      const saved = stopAndSaveLiveTrack();
      showToast(saved ? t('trackSaved') : t('trackTooShort'), saved ? 'success' : 'info');
    } else {
      startLiveTrackRecording();
      showToast(t('trackStarted'), 'info');
    }
  };

  const handleExportTrack = (track: RecordedTrack) => {
    try {
      const blob = new Blob([trackToGpx(track)], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      const safeName = track.title.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || track.id;
      downloadAnchor.href = url;
      downloadAnchor.download = `${safeName}.gpx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      showToast(fillTemplate(t('exportedGpx'), { name: track.title }), 'success');
    } catch {
      showToast(t('exportFailed'), 'warn');
    }
  };

  const handleImportGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        showToast(t('gpxTooLarge'), 'warn');
        return;
      }
      const result = parseGpx(await file.text(), file.name);
      if (result.tracks.length === 0) {
        showToast(t('gpxNoTracks'), 'warn');
        return;
      }
      result.tracks.forEach(addRecordedTrack);
      showToast(
        result.skipped > 0
          ? fillTemplate(t('gpxImportedSkipped'), {
              count: result.tracks.length,
              skipped: result.skipped,
            })
          : fillTemplate(t('gpxImported'), { count: result.tracks.length }),
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? fillTemplate(t('gpxImportFailed'), { reason: error.message })
          : t('gpxImportFailedPlain'),
        'warn'
      );
    } finally {
      event.target.value = '';
    }
  };

  const handleViewOnMap = (track: RecordedTrack) => {
    setSelectedRouteAlternative({
      id: 'fastest',
      name: track.title,
      nameKa: track.title,
      distanceKm: track.distanceKm,
      durationMinutes: track.durationMinutes,
      via: 'Recorded track trajectory',
      viaKa: 'ჩაწერილი ტრეკის ტრაექტორია',
      coordinates: track.coordinates,
    });
    navigateTo('map');
  };

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar
        title={t('tripToolsTitle')}
        onBack={() => navigateTo('map')}
        rightAction={
          <button
            onClick={handleToggleRecording}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-medium shadow transition-colors ${
              isRecordingLiveTrack
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-[#2F6FEB] hover:bg-[#2563EB]'
            }`}
          >
            {isRecordingLiveTrack ? <Square size={12} /> : <Plus size={13} />}
            <span>{isRecordingLiveTrack ? 'Stop' : 'Record'}</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Track Records List */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
              {t('recordedTracks')} ({recordedTracks.length})
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-[11px] font-medium transition-colors"
            >
              <Upload size={12} />
              <span>{t('importGpx')}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              className="hidden"
              onChange={handleImportGpx}
            />
          </div>

          {recordedTracks.length > 0 ? (
            <div className="space-y-2.5 stagger">
              {recordedTracks.map((track) => {
                const distStr = formatDistance(track.distanceKm, units);
                const speedStr = formatSpeed(track.avgSpeedKmh, units);

                return (
                  <div
                    key={track.id}
                    className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Footprints size={15} className="text-purple-400 shrink-0" />
                          <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {track.title}
                          </span>
                        </div>

                        {/* Metadata stats */}
                        <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-neutral-500" />
                            <span className="tabular-nums font-mono">{formatDurationMinutes(track.durationMinutes)}</span>
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Compass size={12} className="text-neutral-500" />
                            <span className="tabular-nums font-mono text-[#2F6FEB] font-medium">{distStr}</span>
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Gauge size={12} className="text-neutral-500" />
                            <span className="tabular-nums font-mono">{speedStr}</span>
                          </span>
                        </div>

                        <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                          Date: {track.date} · {track.coordinates.length} GPS trace points
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleViewOnMap(track)}
                          className="p-2 rounded-lg bg-[#2F6FEB]/15 hover:bg-[#2F6FEB]/25 text-[#2F6FEB] transition-colors"
                          title={t('viewOnMap')}
                        >
                          <Compass size={14} />
                        </button>
                        <button
                          onClick={() => handleExportTrack(track)}
                          className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                          title={t('exportGpx')}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => {
                            deleteTrack(track.id);
                            showToast(t('trackDeleted'), 'info');
                          }}
                          className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-red-500 transition-colors"
                          title={t('deleteTrack')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-neutral-500">
              <Footprints size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-medium">{t('noTracksYet')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
