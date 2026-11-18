import React from 'react';
import type { PlayerColor } from '../../types';

interface SideSwitcherProps {
  value: PlayerColor;
  onChange: (color: PlayerColor) => void;
  whiteLabel?: string;
  blackLabel?: string;
  size?: 'sm' | 'md';
}

export const SideSwitcher: React.FC<SideSwitcherProps> = ({
  value,
  onChange,
  whiteLabel = 'Blancs',
  blackLabel = 'Noirs',
  size = 'sm',
}) => {
  const paddingClass = size === 'md' ? 'py-2.5 px-3 text-sm' : 'py-2 px-3 text-xs';
  const dotClass = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange('w')}
        className={`flex items-center justify-center gap-2 ${paddingClass} rounded-xl font-semibold border transition-all ${
          value === 'w'
            ? 'bg-slate-100 text-slate-950 border-white shadow-md shadow-white/10'
            : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <span
          className={`${dotClass} rounded-full bg-white border border-slate-400 inline-block`}
        />
        {whiteLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('b')}
        className={`flex items-center justify-center gap-2 ${paddingClass} rounded-xl font-semibold border transition-all ${
          value === 'b'
            ? 'bg-slate-800 text-white border-emerald-400 shadow-md shadow-emerald-500/15 ring-1 ring-emerald-400/40'
            : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <span
          className={`${dotClass} rounded-full bg-slate-950 border border-slate-400 inline-block`}
        />
        {blackLabel}
      </button>
    </div>
  );
};
