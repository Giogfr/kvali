/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeaderBarProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  onBack,
  rightAction,
  subtitle,
}) => {
  const { goBack, theme } = useApp();

  const handleBack = onBack || goBack;

  return (
    <div
      className={`px-4 py-3 border-b flex items-center justify-between shrink-0 transition-colors ${
        theme === 'dark' ? 'bg-[#181818] border-neutral-800' : 'bg-white border-neutral-200'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={handleBack}
          className={`p-1.5 -ml-1 rounded-lg transition-colors ${
            theme === 'dark'
              ? 'hover:bg-neutral-800 text-neutral-300'
              : 'hover:bg-neutral-100 text-neutral-700'
          }`}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold tracking-tight truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
};
