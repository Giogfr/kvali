import React, { useEffect, useState } from 'react';
import {
  Moon,
  Sun,
  Globe,
  Gauge,
  Navigation,
  ShieldAlert,
  HardDrive,
  Lock,
  RotateCcw,
  ChevronRight,
  Check,
  AlertCircle,
  HelpCircle,
  Volume2,
  Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { NativeBadge } from '../components/common/Controls';
import { useToast } from '../context/ToastContext';
import {
  getPreferredVoice,
  isLanguageSupported,
  listVoices,
  openVoiceInstall,
  setPreferredVoice,
  speakText,
  speechLang,
  type SpeechVoice,
} from '../lib/speech';
import { TravelMode, VoiceMode } from '../types';

export const SettingsScreen: React.FC = () => {
  const {
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    units,
    setUnits,
    voiceMode,
    setVoiceMode,
    travelMode,
    setTravelMode,
    navView,
    setNavView,
    northUpLock,
    setNorthUpLock,
    navigateTo,
    resetPrototypeData,
  } = useApp();

  const { showToast } = useToast();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechVoice[]>([]);
  const [preferredVoice, setPreferredVoiceState] = useState<string>(() => getPreferredVoice() || '');

  useEffect(() => {
    let cancelled = false;
    const lang = speechLang(language);
    isLanguageSupported(lang).then((supported) => {
      if (!cancelled) setVoiceSupported(supported);
    });
    listVoices(lang).then((voices) => {
      if (cancelled) return;
      setAvailableVoices(voices);
      const selected = getPreferredVoice();
      if (selected && !voices.some((voice) => voice.voiceURI === selected)) {
        setPreferredVoiceState('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    const spoken = await speakText(
      language === 'ka' ? 'ორას მეტრში შეუხვიეთ მარცხნივ' : 'In two hundred metres, turn left',
      language
    );
    setIsTestingVoice(false);
    showToast(spoken ? t('voiceTestStarted') : t('voiceTestFailed'), spoken ? 'info' : 'warn');
  };

  const handleVoiceChange = (voiceURI: string) => {
    setPreferredVoiceState(voiceURI);
    setPreferredVoice(voiceURI || null);
  };

  const handleResetConfirm = () => {
    resetPrototypeData();
    showToast(t('resetConfirmed'), 'success');
    setShowResetDialog(false);
  };

  const sectionLabel =
    'text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold block mb-2 px-1';
  const panel =
    'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50';
  const rowTitle = 'text-[12px] font-medium block text-neutral-800 dark:text-neutral-200';
  const rowHint = 'text-[10px] text-neutral-500';
  const optionActive = 'bg-[#2F6FEB]/10 dark:bg-neutral-800 border-[#2F6FEB] text-neutral-900 dark:text-white';
  const optionInactive =
    'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400';
  const quickLink =
    'w-full p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 flex items-center justify-between text-left press';
  const libraryRow =
    'p-3 flex items-start justify-between gap-2';

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar
        title={t('settingsTitle')}
        onBack={() => navigateTo('map')}
        rightAction={
          <button
            onClick={() => navigateTo('about')}
            className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
            title={t('aboutTitle')}
            aria-label={t('aboutTitle')}
          >
            <HelpCircle size={18} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Appearance (Theme) */}
        <div>
          <span className={sectionLabel}>{t('appearance')}</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`py-2.5 px-3 rounded-xl border flex items-center justify-between text-[12px] font-medium transition-all ${
                theme === 'light'
                  ? 'bg-white border-[#2F6FEB] text-black shadow'
                  : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun size={15} />
                <span>{t('themeLight')}</span>
              </div>
              {theme === 'light' && <Check size={14} className="text-[#2F6FEB]" />}
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`py-2.5 px-3 rounded-xl border flex items-center justify-between text-[12px] font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-[#1F1F1F] border-[#2F6FEB] text-white shadow'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon size={15} />
                <span>{t('themeDark')}</span>
              </div>
              {theme === 'dark' && <Check size={14} className="text-[#2F6FEB]" />}
            </button>
          </div>
        </div>

        {/* Language (English vs Georgian) */}
        <div>
          <span className={sectionLabel}>{t('language')}</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setLanguage('en');
                showToast('Language: English', 'info');
              }}
              className={`py-2.5 px-3 rounded-xl border flex items-center justify-between text-[12px] font-medium transition-all ${
                language === 'en' ? optionActive : optionInactive
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe size={14} />
                <span>{t('english')}</span>
              </div>
              {language === 'en' && <Check size={14} className="text-[#2F6FEB]" />}
            </button>

            <button
              onClick={() => {
                setLanguage('ka');
                showToast('ენა: ქართული', 'info');
              }}
              className={`py-2.5 px-3 rounded-xl border flex items-center justify-between text-[12px] font-medium transition-all ${
                language === 'ka' ? optionActive : optionInactive
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe size={14} />
                <span>{t('georgian')}</span>
              </div>
              {language === 'ka' && <Check size={14} className="text-[#2F6FEB]" />}
            </button>
          </div>
        </div>

        {/* Distance Units (Metric vs Imperial) */}
        <div>
          <span className={sectionLabel}>{t('distanceUnits')}</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setUnits('metric');
                showToast('Units: Metric (km, m, km/h)', 'info');
              }}
              className={`py-2.5 px-3 rounded-xl border flex items-center justify-between text-[12px] font-medium transition-all ${
                units === 'metric' ? optionActive : optionInactive
              }`}
            >
              <div className="flex items-center gap-2">
                <Gauge size={14} />
                <span>Metric (km, m)</span>
              </div>
              {units === 'metric' && <Check size={14} className="text-[#2F6FEB]" />}
            </button>

            <button
              onClick={() => {
                setUnits('imperial');
                showToast('Units: Imperial (mi, ft, mph)', 'info');
              }}
              className={`py-2.5 px-3 rounded-xl border flex items-center justify-between text-[12px] font-medium transition-all ${
                units === 'imperial' ? optionActive : optionInactive
              }`}
            >
              <div className="flex items-center gap-2">
                <Gauge size={14} />
                <span>Imperial (mi, ft)</span>
              </div>
              {units === 'imperial' && <Check size={14} className="text-[#2F6FEB]" />}
            </button>
          </div>
        </div>

        {/* Navigation Defaults & Guidance */}
        <div>
          <span className={sectionLabel}>{t('navigationSettings')}</span>
          <div className={`divide-y divide-neutral-200 dark:divide-neutral-800/60 ${panel}`}>
            {/* Travel Mode */}
            <div className="p-3.5 flex items-center justify-between">
              <div>
                <span className={rowTitle}>{t('defaultTravelMode')}</span>
                <span className={`${rowHint} capitalize`}>{travelMode}</span>
              </div>
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                {(['car', 'walking', 'cycling'] as TravelMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTravelMode(m)}
                    className={`px-2 py-1 text-[11px] font-medium rounded capitalize transition-colors ${
                      travelMode === m
                        ? 'bg-[#2F6FEB] text-white'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Map guidance while navigating */}
            <div className="p-3.5 space-y-2.5">
              <div>
                <span className={rowTitle}>{t('mapGuidance')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNavView('3d')}
                  className={`py-2 px-3 rounded-lg border text-[12px] font-medium flex items-center justify-between transition-colors ${
                    navView === '3d' ? optionActive : optionInactive
                  }`}
                >
                  <span>{t('tiltedView')}</span>
                  {navView === '3d' && <Check size={13} className="text-[#2F6FEB]" />}
                </button>
                <button
                  onClick={() => setNavView('2d')}
                  className={`py-2 px-3 rounded-lg border text-[12px] font-medium flex items-center justify-between transition-colors ${
                    navView === '2d' ? optionActive : optionInactive
                  }`}
                >
                  <span>{t('flatView')}</span>
                  {navView === '2d' && <Check size={13} className="text-[#2F6FEB]" />}
                </button>
              </div>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span>
                  <span className={rowTitle}>{t('northUpLock')}</span>
                  <span className={`${rowHint} block`}>{t('northUpLockHint')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={northUpLock}
                  onChange={(e) => setNorthUpLock(e.target.checked)}
                  className="w-5 h-5 accent-[#2F6FEB]"
                />
              </label>
            </div>

            {/* Voice Guidance */}
            <div className="p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className={rowTitle}>{t('voiceGuidance')}</span>
                  <span className={`${rowHint} capitalize`}>{voiceMode}</span>
                </div>
                <select
                  value={voiceMode}
                  onChange={(e) => setVoiceMode(e.target.value as VoiceMode)}
                  className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="chime">{t('voiceChime')}</option>
                  <option value="spoken">{t('voiceFull')}</option>
                  <option value="muted">{t('voiceMuted')}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleTestVoice}
                  disabled={isTestingVoice}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2F6FEB]/15 hover:bg-[#2F6FEB]/25 disabled:opacity-60 text-[#2F6FEB] text-[11px] font-medium transition-colors"
                >
                  <Volume2 size={12} />
                  <span>{t('testVoice')}</span>
                </button>

                {language === 'ka' && voiceSupported === false && (
                  <button
                    onClick={() => openVoiceInstall()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#C9973F]/15 hover:bg-[#C9973F]/25 text-[#C9973F] text-[11px] font-medium transition-colors"
                  >
                    <Download size={12} />
                    <span>{t('installVoice')}</span>
                  </button>
                )}
              </div>

              {availableVoices.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className={rowHint}>{t('voiceSound')}</span>
                  <select
                    value={preferredVoice}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="max-w-[62%] bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="">{t('voiceSystemDefault')}</option>
                    {availableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                        {voice.localService ? '' : ` (${t('voiceOnline')})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {language === 'ka' && voiceSupported === false && (
                <p className="text-[10px] text-[#C9973F] leading-snug">{t('georgianVoiceMissing')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links: Alerts & Offline Maps & Trip Tools */}
        <div className="space-y-2">
          <button onClick={() => navigateTo('road-alerts')} className={quickLink}>
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} className="text-[#C9973F]" />
              <div>
                <span className="text-[13px] font-medium block text-neutral-800 dark:text-neutral-200">
                  {t('safetyAndAlerts')}
                </span>
                <span className="text-[11px] text-neutral-500">{t('manageAlerts')}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-neutral-500" />
          </button>

          <button onClick={() => navigateTo('offline-maps')} className={quickLink}>
            <div className="flex items-center gap-3">
              <HardDrive size={18} className="text-[#2F6FEB]" />
              <div>
                <span className="text-[13px] font-medium block text-neutral-800 dark:text-neutral-200">
                  {t('storageManagement')}
                </span>
                <span className="text-[11px] text-neutral-500">{t('manageOfflineMaps')}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-neutral-500" />
          </button>

          <button onClick={() => navigateTo('trip-tools')} className={quickLink}>
            <div className="flex items-center gap-3">
              <Navigation size={18} className="text-purple-400" />
              <div>
                <span className="text-[13px] font-medium block text-neutral-800 dark:text-neutral-200">
                  {t('tripToolsTitle')}
                </span>
                <span className="text-[11px] text-neutral-500">
                  Track recording, GPX import & export
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-neutral-500" />
          </button>
        </div>

        {/* Native Feature Limitations Notice */}
        <div>
          <span className={sectionLabel}>{t('nativeLimitationsTitle')}</span>

          <div className={`divide-y divide-neutral-200 dark:divide-neutral-800/60 bg-white dark:bg-neutral-900/40 text-[11px] border border-neutral-200 dark:border-neutral-800 rounded-xl`}>
            <div className={libraryRow}>
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300 block">Background GPS Service</span>
                <span className="text-neutral-500">{t('bgGpsDesc')}</span>
              </div>
              <NativeBadge label={t('nativeBadge')} />
            </div>

            <div className={libraryRow}>
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300 block">Screen-off Navigation</span>
                <span className="text-neutral-500">{t('screenOffDesc')}</span>
              </div>
              <NativeBadge label={t('nativeBadge')} />
            </div>

            <div className={libraryRow}>
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300 block">Offline Neural Speech</span>
                <span className="text-neutral-500">{t('ttsDesc')}</span>
              </div>
              <NativeBadge label={t('nativeBadge')} />
            </div>

            <div className={libraryRow}>
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300 block">Android Auto & CarPlay</span>
                <span className="text-neutral-500">{t('androidAutoDesc')}</span>
              </div>
              <NativeBadge label={t('nativeBadge')} />
            </div>

            <div className={libraryRow}>
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300 block">System Foreground Banner</span>
                <span className="text-neutral-500">{t('systemNotifsDesc')}</span>
              </div>
              <NativeBadge label={t('nativeBadge')} />
            </div>
          </div>
        </div>

        {/* Privacy Philosophy */}
        <div className={`p-3.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 rounded-xl space-y-1.5`}>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">
            <Lock size={14} className="text-emerald-400" />
            <span>{t('privacyTitle')}</span>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('privacyNote')}
          </p>
        </div>

        {/* Reset Data Button */}
        <div className="pt-2 pb-4">
          <button
            onClick={() => setShowResetDialog(true)}
            className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-500/10 text-[12px] font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw size={14} />
            <span>{t('resetData')}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Reset */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1E1E1E] p-4 shadow-2xl text-[#111111] dark:text-white animate-pop-in">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 font-semibold text-[15px] mb-2">
              <AlertCircle size={18} />
              <span>{t('confirmReset')}</span>
            </div>
            <p className="text-[12px] text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
              {t('resetWarning')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetDialog(false)}
                className="px-3 py-1.5 text-[12px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleResetConfirm}
                className="px-4 py-1.5 text-[12px] font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg shadow"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
