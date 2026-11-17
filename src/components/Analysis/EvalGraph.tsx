import React from 'react';
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
  if (evals.length < 2) return null;

  const width = 360;
  const height = 96;
  const maxPly = evals.length - 1;

  const points = evals.map((ev, idx) => {
    const x = (idx / Math.max(1, maxPly)) * width;
    const y = height - (ev.whiteWinPct / 100) * height;
    return { x, y, idx };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const activePoint = points[Math.min(currentPly, points.length - 1)];

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider">
          Courbe d’évaluation (% Gain)
        </span>
        <span className="font-mono text-slate-300">
          Coup {currentPly}/{maxPly}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-24 rounded-lg bg-slate-900 overflow-hidden cursor-pointer border border-slate-800"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const targetPly = Math.round(relX * maxPly);
          onSelectPly(targetPly);
        }}
      >
        {/* 50% Equal line */}
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* White advantage fill */}
        <path d={areaPath} fill="#f8fafc" fillOpacity={0.22} />

        {/* Evaluation curve */}
        <path
          d={linePath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Mistake / Blunder / Missed Win dots */}
        {moves.map((mv) => {
          const pt = points[mv.ply];
          if (!pt) return null;
          if (
            mv.classification !== 'blunder' &&
            mv.classification !== 'mistake' &&
            mv.classification !== 'missed_win'
          ) {
            return null;
          }
          const color =
            mv.classification === 'blunder'
              ? '#ef4444'
              : mv.classification === 'missed_win'
              ? '#f59e0b'
              : '#fb923c';
          return (
            <circle
              key={mv.ply}
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill={color}
              stroke="#0f172a"
              strokeWidth={1}
            />
          );
        })}

        {/* Active ply vertical cursor */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={0}
              x2={activePoint.x}
              y2={height}
              stroke="#10b981"
              strokeWidth={1.5}
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
