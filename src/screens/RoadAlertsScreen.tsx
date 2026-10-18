import React, { useState } from 'react';
import {
  ShieldAlert,
  Volume2,
  VolumeX,
  Sliders,
  Play,
  Info,
  Radio,
  Camera,
  AlertTriangle,
  Construction,
  Car,
  Ban,
  Activity,
  Layers,
  MapPin,
  Send,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { ToggleSwitch, CustomSlider } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';
import { AlertCategory } from '../types';

export const RoadAlertsScreen: React.FC = () => {
  const {
    t,
    theme,
    navigateTo,
    enabledAlertCategories,
    toggleAlertCategory,
    alertDistanceMeters,
    setAlertDistanceMeters,
    beepVolume,
    setBeepVolume,
    soundEnabled,
    setSoundEnabled,
    playTestBeep,
    layers,
    toggleLayer,
    roadAlerts,
    userLocation,
    requestUserLocation,
    reportAlert,
    removeAlert,
  } = useApp();

  const { showToast } = useToast();
  const [reportCategory, setReportCategory] = useState<AlertCategory>('dangerous_conditions');
  const [reportNote, setReportNote] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const myReports = roadAlerts.filter((a) => a.source === 'user');

  const handleReport = async () => {
    if (!userLocation) {
      setIsLocating(true);
      const ok = await requestUserLocation();
      setIsLocating(false);
      if (!ok) {
        showToast(t('locationRequired'), 'warn');
        return;
      }
    }
    const coords = userLocation;
    const report = reportAlert({
      category: reportCategory,
      latitude: coords?.latitude ?? 0,
      longitude: coords?.longitude ?? 0,
      description: reportNote,
    });
    if (report) {
      setReportNote('');
      showToast(t('reportSubmitted'), 'success');
    }
  };

  const alertCategoriesList: {
    id: AlertCategory;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
  }[] = [
    { id: 'fixed_speed_camera', label: t('fixedSpeedCamera'), icon: Camera },
    { id: 'average_speed_zone', label: t('averageSpeedZone'), icon: Radio },
    { id: 'red_light_camera', label: t('redLightCamera'), icon: Camera },
    { id: 'combined_camera', label: t('combinedCamera'), icon: Camera },
    { id: 'enforcement_other', label: t('enforcementOther'), icon: ShieldAlert },
    { id: 'speed_limit_change', label: t('speedLimitChange'), icon: Activity },
    { id: 'roadworks', label: t('roadworks'), icon: Construction },
    { id: 'accidents', label: t('accidents'), icon: AlertTriangle },
    { id: 'road_closures', label: t('roadClosures'), icon: Ban },
    { id: 'broken_down_vehicle', label: t('brokenDownVehicle'), icon: Car },
    { id: 'dangerous_conditions', label: t('dangerousConditions'), icon: AlertTriangle },
    { id: 'lane_restrictions', label: t('laneRestrictions'), icon: Activity },
    { id: 'community_reports', label: t('communityReports'), icon: Info },
    { id: 'mobile_police', label: t('mobilePolice'), icon: ShieldAlert },
  ];

  const handleTestAudio = () => {
    playTestBeep();
    showToast('Synthesized warning chime preview', 'info');
  };

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('alertsTitle')} onBack={() => navigateTo('map')} />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Master Map Layer Switch */}
        <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C9973F]/15 text-[#C9973F] flex items-center justify-center">
              <Layers size={17} />
            </div>
            <div>
              <span className="text-[13px] font-semibold block leading-tight">
                {t('layerCameras')}
              </span>
              <span className="text-[11px] text-neutral-400">Camera markers on map</span>
            </div>
          </div>
          <ToggleSwitch
            checked={layers.speedCameras}
            onChange={() => toggleLayer('speedCameras')}
            label={t('layerCameras')}
          />
        </div>

        {/* Audio & Threshold Controls Card */}
        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Sliders size={15} className="text-neutral-400" />
              <span className="text-[13px] font-semibold text-neutral-200">
                Notification Thresholds
              </span>
            </div>
            <button
              onClick={handleTestAudio}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2F6FEB]/15 hover:bg-[#2F6FEB]/25 text-[#2F6FEB] text-[11px] font-medium transition-colors"
            >
              <Play size={12} />
              <span>{t('testChime')}</span>
            </button>
          </div>

          {/* Warning Distance Slider */}
          <div>
            <div className="flex justify-between text-[12px] mb-1.5">
              <span className="text-neutral-300">{t('alertDistance')}</span>
              <span className="font-mono font-semibold text-[#2F6FEB]">
                {alertDistanceMeters} m
              </span>
            </div>
            <CustomSlider
              value={alertDistanceMeters}
              min={200}
              max={1200}
              step={50}
              onChange={setAlertDistanceMeters}
              label={t('alertDistance')}
            />
          </div>

          {/* Beep Volume Slider & Toggle */}
          <div>
            <div className="flex justify-between items-center text-[12px] mb-1.5">
              <div className="flex items-center gap-1.5 text-neutral-300">
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>{t('beepVolume')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-neutral-400">
                  {soundEnabled ? `${beepVolume}%` : 'Muted'}
                </span>
                <ToggleSwitch
                  checked={soundEnabled}
                  onChange={setSoundEnabled}
                  label={t('enableSound')}
                />
              </div>
            </div>
            <CustomSlider
              value={beepVolume}
              min={0}
              max={100}
              step={5}
              disabled={!soundEnabled}
              onChange={setBeepVolume}
              label={t('beepVolume')}
            />
          </div>

          <p className="text-[10px] text-neutral-500 italic">
            {t('soundDisclaimer')}
          </p>
        </div>

        {/* Categories Switches */}
        <div>
          <div className="mb-2 px-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
              {t('alertCategoriesTitle')}
            </span>
          </div>

          <div className="divide-y divide-neutral-800/60 rounded-xl border border-neutral-800 bg-neutral-900/40 stagger">
            {alertCategoriesList.map((cat) => {
              const Icon = cat.icon;
              const isEnabled = enabledAlertCategories[cat.id];

              return (
                <div
                  key={cat.id}
                  className="p-3 flex items-center justify-between hover:bg-neutral-800/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <Icon size={16} className="text-neutral-400 shrink-0" />
                    <span className="text-[12px] font-medium truncate text-neutral-200">
                      {cat.label}
                    </span>
                  </div>

                  <ToggleSwitch
                    checked={isEnabled}
                    onChange={() => toggleAlertCategory(cat.id)}
                    label={cat.label}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Report a hazard */}
        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-[#2F6FEB]" />
            <span className="text-[13px] font-semibold text-neutral-200">{t('reportTitle')}</span>
          </div>

          <select
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value as AlertCategory)}
            className="w-full bg-neutral-800 border border-neutral-700 text-white text-[12px] rounded-lg px-2.5 py-2 focus:outline-none"
          >
            {alertCategoriesList.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <input
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder={t('reportNotePlaceholder')}
            className="w-full bg-neutral-800 border border-neutral-700 text-white text-[12px] rounded-lg px-2.5 py-2 focus:outline-none"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-neutral-500 font-mono truncate">
              {userLocation
                ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
                : t('locationRequired')}
            </span>
            <button
              onClick={handleReport}
              disabled={isLocating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F6FEB] hover:bg-[#2563EB] disabled:opacity-50 text-white text-[11px] font-medium transition-colors shrink-0"
            >
              <Send size={12} />
              <span>{userLocation ? t('submitReport') : t('useMyLocation')}</span>
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 leading-relaxed">{t('reportHint')}</p>

          {myReports.length > 0 && (
            <div className="pt-2 border-t border-neutral-800 space-y-1.5 stagger">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                {t('myReports')}
              </span>
              {myReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-[11px] text-neutral-300"
                >
                  <span className="truncate pr-2">
                    {alertCategoriesList.find((c) => c.id === r.category)?.label ?? r.category}
                    {' · '}
                    {r.description}
                  </span>
                  <button
                    onClick={() => removeAlert(r.id)}
                    className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors shrink-0"
                    title={t('remove')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Source */}
        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-[#C9973F]">
            <Info size={14} />
            <span>Data source</span>
          </div>
          <p>{t('sourceLegend')}</p>
        </div>
      </div>
    </div>
  );
};
