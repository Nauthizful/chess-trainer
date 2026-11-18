import React, { useState } from 'react';
import { formatEvalScore } from '../../services/stockfishAnalyzer';
import type { AnalyzedMove, PositionEval } from '../../types';

interface EvalGraphProps {
  evals: PositionEval[];
  moves: AnalyzedMove[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({
  evals,
  moves,
  currentPly,
  onSelectPly,
}) => {
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  if (evals.length < 2) return null;

  const width = 400;
  const height = 112;
  const maxPly = evals.length - 1;

  const points = evals.map((ev, idx) => {
    const x = (idx / Math.max(1, maxPly)) * width;
    const y = height - (ev.whiteWinPct / 100) * height;
    return { x, y, idx, ev };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const activePoint = points[Math.min(currentPly, points.length - 1)];
  const hoveredPoint =
    hoverPly !== null ? points[Math.min(hoverPly, points.length - 1)] : null;

  const displayPoint = hoveredPoint ?? activePoint;
  const displayScore = displayPoint
    ? formatEvalScore(displayPoint.ev.cp, displayPoint.ev.mate)
    : '0.0';

  const getPlyFromPointer = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return Math.round(relX * maxPly);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider">
          Courbe d’évaluation
        </span>
        <div className="flex items-center gap-2 font-mono">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-bold">
            {displayScore}
          </span>
          <span className="text-slate-400">
            Coup {displayPoint?.idx ?? currentPly}/{maxPly}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-28 rounded-lg bg-slate-950 overflow-hidden cursor-pointer border border-slate-800"
        onMouseMove={(e) => setHoverPly(getPlyFromPointer(e))}
        onMouseLeave={() => setHoverPly(null)}
        onClick={(e) => onSelectPly(getPlyFromPointer(e))}
      >
        <defs>
          <linearGradient id="evalWhiteGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#e2e8f0" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* 50% Equal line (0.0) */}
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* White advantage gradient fill */}
        <path d={areaPath} fill="url(#evalWhiteGrad)" />

        {/* Evaluation curve */}
        <path
          d={linePath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Inaccuracy / Mistake / Blunder / Missed Win dots */}
        {moves.map((mv) => {
          const pt = points[mv.ply];
          if (!pt) return null;
          if (
            mv.classification !== 'inaccuracy' &&
            mv.classification !== 'mistake' &&
            mv.classification !== 'blunder' &&
            mv.classification !== 'missed_win'
          ) {
            return null;
          }
          const color =
            mv.classification === 'blunder'
              ? '#ef4444'
              : mv.classification === 'mistake'
              ? '#fb923c'
              : mv.classification === 'missed_win'
              ? '#eab308'
              : '#facc15';
          return (
            <circle
              key={mv.ply}
              cx={pt.x}
              cy={pt.y}
              r={mv.classification === 'inaccuracy' ? 2.5 : 3.75}
              fill={color}
              stroke="#0f172a"
              strokeWidth={1}
            />
          );
        })}

        {/* Hover cursor */}
        {hoveredPoint && hoveredPoint.idx !== activePoint?.idx && (
          <g>
            <line
              x1={hoveredPoint.x}
              y1={0}
              x2={hoveredPoint.x}
              y2={height}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={3.5}
              fill="#cbd5e1"
              stroke="#0f172a"
              strokeWidth={1}
            />
          </g>
        )}

        {/* Active ply vertical cursor */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={0}
              x2={activePoint.x}
              y2={height}
              stroke="#10b981"
              strokeWidth={1.75}
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={4.5}
              fill="#10b981"
              stroke="#0f172a"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
    </div>
  );
};
