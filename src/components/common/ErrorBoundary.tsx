/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center bg-[#1A1A1A] text-white select-none">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-[#C9973F] flex items-center justify-center mb-3 border border-[#C9973F]/30 shadow-lg">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-[16px] font-semibold text-neutral-100">Display Recovery</h3>
          <p className="text-[12px] text-neutral-400 mt-1.5 max-w-[280px] leading-relaxed">
            The interface recovered gracefully from a component issue.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#2F6FEB] hover:bg-[#2563EB] text-white text-[12px] font-semibold flex items-center gap-2 shadow-md transition-colors"
          >
            <RotateCcw size={14} />
            <span>Reload Map Interface</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
