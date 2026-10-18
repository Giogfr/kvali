import React from 'react';
import { Footprints, Plus, Square, Download, Trash2, Gauge, Clock, Compass } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { DemoChip } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';
import { formatDistance, formatSpeed } from '../lib/geo';
import { RecordedTrack } from '../types';

export const TripToolsScreen: React.FC = () => {
  const {
    t,
    theme,
    units,
    recordedTracks,
    deleteTrack,
    isRecordingLiveTrack,
    startLiveTrackRecording,
    stopAndSaveLiveTrack,
    navigateTo,
    setSelectedRouteAlternative,
  } = useApp();

  const { showToast } = useToast();

  const handleToggleRecording = () => {
    if (isRecordingLiveTrack) {
      stopAndSaveLiveTrack();
      showToast('Track saved', 'success');
    } else {
      startLiveTrackRecording();
      showToast('Recording your track', 'info');
    }
  };

  const handleExportTrack = (track: RecordedTrack) => {
    try {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              title: track.title,
              date: track.date,
              distanceKm: track.distanceKm,
              durationMinutes: track.durationMinutes,
              avgSpeedKmh: track.avgSpeedKmh,
              demo: track.demo,
            },
            geometry: {
              type: 'LineString',
              coordinates: track.coordinates,
            },
          },
        ],
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${track.id}.geojson`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast(`Exported ${track.title} as GeoJSON`, 'success');
    } catch {
      showToast('Export failed', 'warn');
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
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
              {t('recordedTracks')} ({recordedTracks.length})
            </span>
            {recordedTracks.some((track) => track.demo) && <DemoChip label={t('demoData')} />}
          </div>

          {recordedTracks.length > 0 ? (
            <div className="space-y-2.5">
              {recordedTracks.map((track) => {
                const distStr = formatDistance(track.distanceKm, units);
                const speedStr = formatSpeed(track.avgSpeedKmh, units);

                return (
                  <div
                    key={track.id}
                    className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Footprints size={15} className="text-purple-400 shrink-0" />
                          <span className="text-[13px] font-semibold text-neutral-100 truncate">
                            {track.title}
                          </span>
                          {track.demo && <DemoChip label={t('demoData')} />}
                        </div>

                        {/* Metadata stats */}
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-2">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-neutral-500" />
                            <span className="tabular-nums font-mono">{track.durationMinutes} min</span>
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
                          title="View on Map"
                        >
                          <Compass size={14} />
                        </button>
                        <button
                          onClick={() => handleExportTrack(track)}
                          className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                          title={t('exportGeoJson')}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => {
                            deleteTrack(track.id);
                            showToast('Track deleted', 'info');
                          }}
                          className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 transition-colors"
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
