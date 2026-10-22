/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import React from 'react';
import { version as appVersion } from '../../package.json';
import { Github, MapPin, ShieldCheck, Compass, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';

export const AboutScreen: React.FC = () => {
  const { t, theme, navigateTo } = useApp();

  const sectionLabel =
    'text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold block mb-2 px-1';
  const panel = 'p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40';

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('aboutTitle')} onBack={() => navigateTo('settings')} />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Brand Hero Card */}
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#2F6FEB] text-white flex items-center justify-center mx-auto shadow-lg">
            <Compass size={28} />
          </div>
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">
              {t('appName')} <span className="text-[14px] text-neutral-500 dark:text-neutral-400 font-normal">კვალი</span>
            </h2>
            <p className="text-[13px] text-[#2F6FEB] font-medium mt-0.5">
              "{t('appTagline')}"
            </p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700">
              {t('aboutVersion')} {appVersion}
            </span>
          </div>

          <p className="text-[12px] text-neutral-600 dark:text-neutral-300 leading-relaxed pt-2 border-t border-neutral-200 dark:border-neutral-800/80 text-left">
            {t('aboutDesc')}
          </p>
        </div>

        {/* Project Link */}
        <div className={`${panel} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Github size={18} className="text-neutral-900 dark:text-white" />
            <div>
              <span className="text-[13px] font-semibold block text-neutral-800 dark:text-neutral-200">
                {t('openSourceRepo')}
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                github.com/Giogfr/kvali
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700">
            GPL-3.0
          </span>
        </div>

        {/* Map Data & Attributions */}
        <div>
          <span className={sectionLabel}>{t('dataAttribution')}</span>

          <div className={`${panel} text-[11px] space-y-2 text-neutral-600 dark:text-neutral-300 leading-relaxed`}>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-[#2F6FEB] shrink-0 mt-0.5" />
              <p>{t('mapDataAttribution')}</p>
            </div>
          </div>
        </div>

        {/* Privacy Summary */}
        <div>
          <span className={sectionLabel}>{t('privacyPhilosophy')}</span>

          <div className={`${panel} text-[11px] space-y-1.5 text-neutral-600 dark:text-neutral-300 leading-relaxed`}>
            <div className="flex items-center gap-2 font-medium text-emerald-500 dark:text-emerald-400">
              <ShieldCheck size={15} />
              <span>{t('clientSideStorage')}</span>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">
              {t('privacyStorageNote')}
            </p>
          </div>
        </div>

        {/* Known Limitations */}
        <div>
          <span className={sectionLabel}>{t('goodToKnow')}</span>

          <div className={`${panel} text-[11px] space-y-1 text-neutral-500 dark:text-neutral-400 leading-relaxed`}>
            <div className="flex items-center gap-1.5 text-[#C9973F] font-medium">
              <AlertTriangle size={14} />
              <span>{t('dataCoverage')}</span>
            </div>
            <p>{t('knownLimitations')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
