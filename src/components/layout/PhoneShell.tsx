import React from 'react';
import { WifiOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { airplaneOfflineMode, theme } = useApp();

  return (
    <div className="w-full h-full min-h-screen flex items-center justify-center sm:p-3 select-none bg-[#0D0D0D]">
      <div
        className={`w-full h-full sm:h-[min(844px,96vh)] sm:max-w-[400px] sm:rounded-[40px] overflow-hidden flex flex-col relative sm:shadow-[0_24px_64px_rgba(0,0,0,0.85)] sm:border-[8px] sm:border-[#222222] transition-colors ${
          theme === 'dark' ? 'bg-[#121212] text-white' : 'bg-[#F7F7F5] text-[#111111]'
        }`}
      >
        {airplaneOfflineMode && (
          <div className="bg-[#C9973F] text-black px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 z-30 shrink-0">
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
