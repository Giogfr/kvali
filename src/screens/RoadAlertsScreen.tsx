import React from 'react';
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
  } = useApp();

  const { showToast } = useToast();

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

          <div className="divide-y divide-neutral-800/60 rounded-xl border border-neutral-800 bg-neutral-900/40">
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
