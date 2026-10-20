/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import React from 'react';
import { WifiOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { airplaneOfflineMode, theme } = useApp();

  return (
    <div className="w-full h-full min-h-screen flex items-center justify-center select-none bg-[#0D0D0D] sm:portrait:p-3">
      <div
        className={`w-full h-full overflow-hidden flex flex-col relative transition-colors sm:portrait:h-[min(844px,96vh)] sm:portrait:max-w-[400px] sm:portrait:rounded-[40px] sm:portrait:shadow-[0_24px_64px_rgba(0,0,0,0.85)] sm:portrait:border-[8px] sm:portrait:border-[#222222] ${
          theme === 'dark' ? 'bg-[#121212] text-white' : 'bg-[#F7F7F5] text-[#111111]'
        }`}
      >
        {airplaneOfflineMode && (
          <div className="bg-[#C9973F] text-black px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 z-30 shrink-0 safe-top">
            <WifiOff size={12} />
            <span>Offline map rendering</span>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};
