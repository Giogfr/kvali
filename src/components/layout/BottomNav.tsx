import React from 'react';
import { Map, Search, Bookmark, ShieldAlert, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScreenId } from '../../types';

export const BottomNav: React.FC = () => {
  const { currentScreen, navigateTo, t, theme, activeNav } = useApp();

  // If in active navigation, hide bottom navigation so driving controls take over
  if (activeNav.isActive || currentScreen === 'active-navigation') {
    return null;
  }

  const tabs: { id: ScreenId; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'map', label: t('navMap'), icon: Map },
    { id: 'search', label: t('navSearch'), icon: Search },
    { id: 'saved-places', label: t('navSaved'), icon: Bookmark },
    { id: 'road-alerts', label: t('navAlerts'), icon: ShieldAlert },
    { id: 'settings', label: t('navSettings'), icon: Settings },
  ];

  return (
    <nav
      className={`h-[60px] px-2 flex items-center justify-around border-t shrink-0 z-30 transition-colors ${
        theme === 'dark'
          ? 'bg-[#181818]/95 border-neutral-800 text-neutral-400'
          : 'bg-white/95 border-neutral-200 text-neutral-500'
      } backdrop-blur-md`}
      aria-label="Main Navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentScreen === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => navigateTo(tab.id)}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              isActive
                ? theme === 'dark'
                  ? 'text-white font-medium'
                  : 'text-[#111111] font-medium'
                : 'hover:text-neutral-300 dark:hover:text-neutral-200'
            }`}
          >
            <Icon size={20} className={isActive ? 'stroke-[2.2px]' : 'stroke-[1.7px]'} />
            <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
