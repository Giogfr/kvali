import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${checked ? 'bg-[#2F6FEB]' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      aria-label={label}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
};

interface CustomSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  label?: string;
}

export const CustomSlider: React.FC<CustomSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  label,
}) => {
  return (
    <div className="w-full flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#2F6FEB]"
        aria-label={label}
      />
    </div>
  );
};

export const DemoChip: React.FC<{ label?: string }> = ({ label = 'Demo data' }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300/50 dark:border-neutral-700/50">
    {label}
  </span>
);

export const NativeBadge: React.FC<{ label?: string }> = ({ label = 'Native feature' }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight bg-amber-500/10 text-[#C9973F] border border-[#C9973F]/30">
    {label}
  </span>
);
