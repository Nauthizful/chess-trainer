import React from 'react';
import type { PlayerColor } from '../../types';

interface EvalBarProps {
  whiteWinPct: number;
  scoreLabel: string;
  orientation: PlayerColor;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  whiteWinPct,
  scoreLabel,
  orientation,
}) => {
  const bottomWhitePct =
    orientation === 'w' ? whiteWinPct : 100 - whiteWinPct;

  const isBottomAdvantage =
    orientation === 'w' ? whiteWinPct >= 50 : whiteWinPct < 50;

  return (
    <div className="w-7 sm:w-8 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 flex flex-col relative shrink-0 shadow-lg select-none">
      <div
        className={`absolute inset-x-0 bottom-0 transition-all duration-300 ease-out ${
          orientation === 'w' ? 'bg-slate-100' : 'bg-slate-800'
        }`}
        style={{ height: `${Math.max(4, Math.min(96, bottomWhitePct))}%` }}
      />
      <div
        className={`absolute inset-x-0 top-0 transition-all duration-300 ease-out ${
          orientation === 'w' ? 'bg-slate-800' : 'bg-slate-100'
        }`}
        style={{
          height: `${Math.max(4, Math.min(96, 100 - bottomWhitePct))}%`,
        }}
      />
      <span
        className={`relative z-10 text-[10px] font-mono font-bold text-center py-1.5 px-0.5 leading-none ${
          whiteWinPct >= 50 ? 'text-slate-950' : 'text-slate-100'
        }`}
        style={{
          marginTop: isBottomAdvantage ? 'auto' : undefined,
        }}
      >
        {scoreLabel}
      </span>
    </div>
  );
};
