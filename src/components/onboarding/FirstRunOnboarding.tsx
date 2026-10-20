import React, { useState } from 'react';
import { ArrowRight, Check, Download, LocateFixed, Volume2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const STORAGE_KEY = 'kvali_onboarded';

export const FirstRunOnboarding: React.FC = () => {
  const {
    language,
    navigateTo,
    requestUserLocation,
    geolocationStatus,
    voiceMode,
    setVoiceMode,
    playTestBeep,
  } = useApp();

  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'true';
    } catch {
      return false;
    }
  });
  const [step, setStep] = useState(0);
  const [locating, setLocating] = useState(false);

  if (!open) return null;

  const ka = language === 'ka';
  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setOpen(false);
  };

  const enableLocation = async () => {
    setLocating(true);
    await requestUserLocation();
    setLocating(false);
  };

  const steps = [
    {
      icon: Download,
      title: ka ? 'რუკა ოფლაინ' : 'Keep the map offline',
      body: ka
        ? 'ჩამოტვირთეთ თქვენი ტერიტორია, რომ რუკა ინტერნეტის გარეშე იმუშაოს. ტერიტორია ინახება ტელეფონში.'
        : 'Download your area once so the map keeps working without a connection. Regions are stored on your device.',
      action: (
        <button
          onClick={() => {
            finish();
            navigateTo('offline-maps');
          }}
          className="w-full px-4 py-3 rounded-xl bg-[#2F6FEB] text-white font-semibold flex items-center justify-center gap-2 press"
        >
          <Download size={17} />
          {ka ? 'რუკების ჩამოტვირთვა' : 'Download maps'}
        </button>
      ),
    },
    {
      icon: LocateFixed,
      title: ka ? 'ჩართეთ მდებარეობა' : 'Turn on location',
      body: ka
        ? 'Kvali იყენებს GPS-ს მარშრუტის გასაყოლად. მდებარეობა მხოლოდ თქვენს მოწყობილობაზე მუშავდება.'
        : 'Kvali uses GPS to follow your route. Your position is processed on your device only.',
      action: (
        <button
          onClick={enableLocation}
          disabled={locating || geolocationStatus === 'granted'}
          className={`w-full px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 press ${
            geolocationStatus === 'granted'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#2F6FEB] text-white disabled:opacity-70'
          }`}
        >
          {geolocationStatus === 'granted' ? <Check size={17} /> : <LocateFixed size={17} />}
          {geolocationStatus === 'granted'
            ? ka
              ? 'მდებარეობა ჩართულია'
              : 'Location is on'
            : locating
            ? ka
              ? 'მდებარეობის ძიება…'
              : 'Locating…'
            : ka
              ? 'მდებარეობის ჩართვა'
              : 'Enable location'}
        </button>
      ),
    },
    {
      icon: Volume2,
      title: ka ? 'ხმოვანი ნავიგაცია' : 'Voice guidance',
      body: ka
        ? 'აირჩიეთ, როგორ გაფრთხილდეთ მოსახვევებზე. ქართული ხმა დამოკიდებულია ტელეფონში დაინსტალირებულ ხმებზე.'
        : 'Choose how you hear turns. Georgian speech depends on the voices installed on your phone.',
      action: (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['spoken', ka ? 'ხმა' : 'Spoken'],
                ['chime', ka ? 'ბგერა' : 'Chime'],
                ['muted', ka ? 'გამორთ.' : 'Muted'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setVoiceMode(mode)}
                className={`px-2 py-2.5 rounded-xl text-[13px] font-semibold border press ${
                  voiceMode === mode
                    ? 'bg-[#2F6FEB] border-[#2F6FEB] text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={playTestBeep}
            className="w-full px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 text-[13px] font-medium press"
          >
            {ka ? 'ბგერის ტესტი' : 'Test sound'}
          </button>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="absolute inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#161616] border border-neutral-700 shadow-2xl text-white overflow-hidden">
        <div className="flex justify-end p-3">
          <button
            onClick={finish}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:text-white press"
            aria-label={ka ? 'გამოტოვება' : 'Skip'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#2F6FEB]/15 text-[#2F6FEB] flex items-center justify-center mb-4">
            <Icon size={28} />
          </div>

          <h2 className="text-[22px] font-bold tracking-tight">{current.title}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-300">{current.body}</p>

          <div className="mt-5">{current.action}</div>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-[#2F6FEB]' : 'w-1.5 bg-neutral-600'
                  }`}
                />
              ))}
            </div>

            {!isLast ? (
              <button
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-white text-black text-[14px] font-semibold flex items-center gap-1.5 press"
              >
                {ka ? 'შემდეგი' : 'Next'}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-white text-black text-[14px] font-semibold flex items-center gap-1.5 press"
              >
                <Check size={16} />
                {ka ? 'დაწყება' : 'Get started'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
