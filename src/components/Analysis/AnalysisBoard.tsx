import React, { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { BookOpen } from 'lucide-react';
import { ChessPieceSvg } from '../ChessPieceSvg';
import type { MoveClassification, PlayerColor, SquarePair } from '../../types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

function squareToCoords(
  square: string,
  orientation: PlayerColor
): { x: number; y: number } {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rankNum = parseInt(square[1], 10);
  const rankIndex = 8 - rankNum;

  const col = orientation === 'w' ? fileIndex : 7 - fileIndex;
  const row = orientation === 'w' ? rankIndex : 7 - rankIndex;

  return {
    x: col * 100 + 50,
    y: row * 100 + 50,
  };
}

interface AnalysisArrow {
  from: string;
  to: string;
  color: 'green' | 'red';
  label?: string;
}

interface AnalysisBoardProps {
  fen: string;
  orientation: PlayerColor;
  whiteWinPct: number;
  scoreLabel: string;
  lastMove: SquarePair | null;
  bestMoveUci: string | null;
  punishmentUci: string | null;
  moveBadge?: { square: string; classification: MoveClassification } | null;
  hideArrows?: boolean;
  interactive?: boolean;
  onPlayMove?: (from: string, to: string, promotion?: string) => void;
}

function renderClassificationCornerBadge(classification: MoveClassification) {
  switch (classification) {
    case 'book':
      return (
        <div
          title="Théorie (Book)"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-amber-800 text-amber-100 border border-slate-950 shadow-md z-30 flex items-center justify-center pointer-events-none"
        >
          <BookOpen className="w-3 h-3" />
        </div>
      );
    case 'best':
      return (
        <div
          title="Meilleur coup"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 border border-slate-950 shadow-md z-30 flex items-center justify-center text-[11px] font-black pointer-events-none"
        >
          ★
        </div>
      );
    case 'excellent':
      return (
        <div
          title="Excellent coup"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-emerald-400 text-slate-950 border border-slate-950 shadow-md z-30 flex items-center justify-center text-[11px] font-black pointer-events-none"
        >
          !
        </div>
      );
    case 'good':
      return (
        <div
          title="Bon coup"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-teal-500 text-slate-950 border border-slate-950 shadow-md z-30 flex items-center justify-center text-[11px] font-black pointer-events-none"
        >
          ✓
        </div>
      );
    case 'inaccuracy':
      return (
        <div
          title="Imprécision (?!)"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-yellow-400 text-slate-950 border border-slate-950 shadow-md z-30 flex items-center justify-center text-[10px] font-black pointer-events-none"
        >
          ?!
        </div>
      );
    case 'mistake':
      return (
        <div
          title="Erreur (?)"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-orange-500 text-white border border-slate-950 shadow-md z-30 flex items-center justify-center text-[11px] font-black pointer-events-none"
        >
          ?
        </div>
      );
    case 'blunder':
      return (
        <div
          title="Gaffe (??)"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-rose-600 text-white border border-slate-950 shadow-md z-30 flex items-center justify-center text-[10px] font-black pointer-events-none"
        >
          ??
        </div>
      );
    case 'missed_win':
      return (
        <div
          title="Gain manqué (!)"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-orange-600 text-white border border-slate-950 shadow-md z-30 flex items-center justify-center text-[11px] font-black pointer-events-none"
        >
          !
        </div>
      );
  }
}

export const AnalysisBoard: React.FC<AnalysisBoardProps> = ({
  fen,
  orientation,
  whiteWinPct,
  scoreLabel,
  lastMove,
  bestMoveUci,
  punishmentUci,
  moveBadge = null,
  hideArrows = false,
  interactive = false,
  onPlayMove,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
    setDraggedFrom(null);
  }, [fen, interactive]);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const boardMatrix = useMemo(() => chess.board(), [chess]);
  const activeTurn = chess.turn();

  const legalTargets = useMemo(() => {
    if (!interactive || !selectedSquare) return new Map<string, boolean>();
    const moves = chess.moves({
      square: selectedSquare as Square,
      verbose: true,
    });
    const map = new Map<string, boolean>();
    for (const m of moves) {
      map.set(m.to, Boolean(m.captured));
    }
    return map;
  }, [chess, interactive, selectedSquare]);

  const arrows: AnalysisArrow[] = useMemo(() => {
    if (hideArrows) return [];
    const list: AnalysisArrow[] = [];
    if (bestMoveUci && bestMoveUci.length >= 4) {
      list.push({
        from: bestMoveUci.slice(0, 2),
        to: bestMoveUci.slice(2, 4),
        color: 'green',
        label: 'Meilleur',
      });
    }
    if (punishmentUci && punishmentUci.length >= 4) {
      list.push({
        from: punishmentUci.slice(0, 2),
        to: punishmentUci.slice(2, 4),
        color: 'red',
        label: 'Punition',
      });
    }
    return list;
  }, [hideArrows, bestMoveUci, punishmentUci]);

  const attemptMove = (from: string, to: string) => {
    if (!interactive || !onPlayMove) return;
    const moves = chess.moves({ square: from as Square, verbose: true });
    const match = moves.find((m) => m.to === to);
    if (!match) return;
    setSelectedSquare(null);
    onPlayMove(from, to, match.promotion ? 'q' : undefined);
  };

  const handleSquareClick = (sq: string, pieceColor?: PlayerColor) => {
    if (!interactive || !onPlayMove) return;

    if (selectedSquare === sq) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && legalTargets.has(sq)) {
      attemptMove(selectedSquare, sq);
      return;
    }

    if (pieceColor === activeTurn) {
      setSelectedSquare(sq);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    square: string,
    pieceColor: PlayerColor
  ) => {
    if (!interactive || pieceColor !== activeTurn) {
      e.preventDefault();
      return;
    }
    setDraggedFrom(square);
    setSelectedSquare(square);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', square);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetSquare: string
  ) => {
    e.preventDefault();
    const fromSquare = draggedFrom || e.dataTransfer.getData('text/plain');
    setDraggedFrom(null);
    if (!fromSquare || fromSquare === targetSquare) return;
    attemptMove(fromSquare, targetSquare);
  };

  const displayRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const displayFiles = orientation === 'w' ? FILES : [...FILES].reverse();

  const bottomWhitePct =
    orientation === 'w' ? whiteWinPct : 100 - whiteWinPct;

  return (
    <div className="flex items-stretch gap-3 w-full max-w-[590px] mx-auto select-none">
      {/* Vertical Evaluation Bar */}
      <div className="w-8 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex flex-col justify-between relative shrink-0 shadow-lg">
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
          className={`relative z-10 text-[10px] font-mono font-bold text-center py-1.5 ${
            whiteWinPct >= 50 ? 'text-slate-950' : 'text-slate-100'
          }`}
          style={{
            marginTop: whiteWinPct >= 50 ? 'auto' : undefined,
          }}
        >
          {scoreLabel}
        </span>
      </div>

      {/* 8x8 Chessboard + SVG Overlay */}
      <div className="relative aspect-square flex-1 rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-slate-700/80 bg-slate-900">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRanks.map((rank, rowIdx) =>
            displayFiles.map((file, colIdx) => {
              const sq = `${file}${rank}`;
              const fileIdx = FILES.indexOf(file);
              const boardRow = 8 - parseInt(rank, 10);
              const piece = boardMatrix[boardRow][fileIdx];
              const isLight = (fileIdx + parseInt(rank, 10)) % 2 === 1;

              const isLastMove =
                lastMove?.from === sq || lastMove?.to === sq;
              const isSelected = selectedSquare === sq;
              const isCaptureTarget = legalTargets.get(sq);
              const isLegalDot = legalTargets.has(sq);
              const showCornerBadge = moveBadge?.square === sq;

              const showRankCoord = colIdx === 0;
              const showFileCoord = rowIdx === 7;

              return (
                <div
                  key={sq}
                  onClick={() => handleSquareClick(sq, piece?.color)}
                  onDragOver={(e) => {
                    if (interactive) e.preventDefault();
                  }}
                  onDrop={(e) => handleDrop(e, sq)}
                  className={`relative flex items-center justify-center ${
                    isLight ? 'bg-[#e9dec7]' : 'bg-[#7d945d]'
                  } ${
                    interactive && piece?.color === activeTurn
                      ? 'cursor-grab active:cursor-grabbing'
                      : interactive && isLegalDot
                      ? 'cursor-pointer'
                      : ''
                  }`}
                >
                  {isLastMove && (
                    <div className="absolute inset-0 bg-amber-400/35 pointer-events-none" />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-emerald-400/45 pointer-events-none" />
                  )}
                  {isLegalDot && !isCaptureTarget && (
                    <div className="w-[28%] h-[28%] rounded-full bg-slate-900/35 z-10 pointer-events-none" />
                  )}
                  {isLegalDot && isCaptureTarget && (
                    <div className="absolute inset-[6%] rounded-full border-[5px] border-slate-900/35 z-10 pointer-events-none" />
                  )}

                  {showRankCoord && (
                    <span
                      className={`absolute top-0.5 left-1 text-[10px] font-bold leading-none pointer-events-none ${
                        isLight ? 'text-[#7d945d]' : 'text-[#e9dec7]'
                      }`}
                    >
                      {rank}
                    </span>
                  )}
                  {showFileCoord && (
                    <span
                      className={`absolute bottom-0.5 right-1 text-[10px] font-bold leading-none pointer-events-none ${
                        isLight ? 'text-[#7d945d]' : 'text-[#e9dec7]'
                      }`}
                    >
                      {file}
                    </span>
                  )}

                  {piece && (
                    <div
                      draggable={interactive && piece.color === activeTurn}
                      onDragStart={(e) => handleDragStart(e, sq, piece.color)}
                      className="w-[84%] h-[84%] z-10 transition-all duration-150 ease-out"
                    >
                      <ChessPieceSvg type={piece.type} color={piece.color} />
                    </div>
                  )}

                  {showCornerBadge &&
                    renderClassificationCornerBadge(moveBadge!.classification)}
                </div>
              );
            })
          )}
        </div>

        {/* SVG Arrows Layer */}
        <svg
          viewBox="0 0 800 800"
          className={`pointer-events-none absolute inset-0 w-full h-full z-20 transition-opacity duration-200 ease-out ${
            arrows.length > 0 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <defs>
            <marker
              id="analysis-arrow-green"
              markerWidth="4"
              markerHeight="4"
              refX="2.7"
              refY="2"
              orient="auto"
            >
              <path d="M0,0.4 L3.5,2 L0,3.6 Z" fill="#10b981" />
            </marker>
            <marker
              id="analysis-arrow-red"
              markerWidth="4"
              markerHeight="4"
              refX="2.7"
              refY="2"
              orient="auto"
            >
              <path d="M0,0.4 L3.5,2 L0,3.6 Z" fill="#ef4444" />
            </marker>
          </defs>

          {arrows.map((arrow, idx) => {
            const start = squareToCoords(arrow.from, orientation);
            const end = squareToCoords(arrow.to, orientation);
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return null;

            const ux = dx / len;
            const uy = dy / len;
            const x1 = start.x + ux * 14;
            const y1 = start.y + uy * 14;
            const x2 = end.x - ux * 22;
            const y2 = end.y - uy * 22;
            const strokeColor = arrow.color === 'green' ? '#10b981' : '#ef4444';

            return (
              <g key={`${arrow.color}-${arrow.from}-${arrow.to}-${idx}`} opacity={0.9}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={15}
                  strokeLinecap="round"
                  markerEnd={`url(#analysis-arrow-${arrow.color})`}
                />
                {arrow.label && (
                  <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                    <rect
                      x={-28}
                      y={-11}
                      width={56}
                      height={22}
                      rx={6}
                      fill="#0f172a"
                      fillOpacity={0.92}
                      stroke={strokeColor}
                      strokeWidth={1.5}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight="bold"
                      fill="#f8fafc"
                    >
                      {arrow.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
