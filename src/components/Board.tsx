import React, { useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { useChessStore } from '../store/useChessStore';
import { getTotalGames } from '../services/lichessApi';
import { ChessPieceSvg } from './ChessPieceSvg';
import type { BoardArrow, PlayerColor } from '../types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

function squareToCoords(
  square: string,
  orientation: PlayerColor
): { x: number; y: number } {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rankNum = parseInt(square[1], 10);
  const rankIndex = 8 - rankNum; // 0 for rank 8, 7 for rank 1

  const col = orientation === 'w' ? fileIndex : 7 - fileIndex;
  const row = orientation === 'w' ? rankIndex : 7 - rankIndex;

  return {
    x: col * 100 + 50,
    y: row * 100 + 50,
  };
}

interface PendingPromotion {
  from: string;
  to: string;
}

export const Board: React.FC = () => {
  const {
    fen,
    turn,
    playerColor,
    history,
    currentPly,
    isBlindMode,
    isOutOfTargetLine,
    expectedBookMoveUci,
    explorerStats,
    isComputerThinking,
    trainingMode,
    quizStatus,
    quizShowSolution,
    quizExpectedMove,
    makeUserMove,
  } = useChessStore();

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const boardMatrix = useMemo(() => chess.board(), [chess]);
  const isUserTurn = turn === playerColor && !isComputerThinking && !chess.isGameOver();

  const legalMovesFromSelected = useMemo(() => {
    if (!selectedSquare || !isUserTurn) return [];
    return chess.moves({ square: selectedSquare as Square, verbose: true });
  }, [chess, selectedSquare, isUserTurn]);

  const legalTargetsMap = useMemo(() => {
    const map = new Map<string, { isCapture: boolean; isPromotion: boolean }>();
    for (const m of legalMovesFromSelected) {
      map.set(m.to, {
        isCapture: Boolean(m.captured),
        isPromotion: Boolean(m.promotion),
      });
    }
    return map;
  }, [legalMovesFromSelected]);

  const lastEntry = history[currentPly];
  const lastMoveSquares = useMemo(() => {
    if (!lastEntry || !lastEntry.from || !lastEntry.to) return null;
    return { from: lastEntry.from, to: lastEntry.to };
  }, [lastEntry]);

  const kingInCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const currentTurn = chess.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardMatrix[r][c];
        if (piece && piece.type === 'k' && piece.color === currentTurn) {
          return `${FILES[c]}${8 - r}`;
        }
      }
    }
    return null;
  }, [chess, boardMatrix]);

  const isBotTurnOrThinking =
    chess.turn() !== playerColor || turn !== playerColor || isComputerThinking;

  const arrows: BoardArrow[] = useMemo(() => {
    if (trainingMode === 'quiz') {
      if (quizStatus === 'wrong' && quizShowSolution && quizExpectedMove) {
        return [
          {
            from: quizExpectedMove.from,
            to: quizExpectedMove.to,
            color: 'green',
            label: 'Solution',
            weight: 1,
          },
        ];
      }
      return [];
    }

    // Strictly force empty arrows during the bot's turn or while thinking
    if (isBlindMode || isBotTurnOrThinking) return [];
    const list: BoardArrow[] = [];

    // 1. Lichess popular moves (Blue arrows)
    if (explorerStats && explorerStats.moves.length > 0) {
      const totalPosGames = Math.max(1, getTotalGames(explorerStats));
      const topMoves = explorerStats.moves.slice(0, 3);
      for (const m of topMoves) {
        if (m.uci.length < 4) continue;
        const from = m.uci.slice(0, 2);
        const to = m.uci.slice(2, 4);
        const moveGames = getTotalGames(m);
        const pct = Math.round((moveGames / totalPosGames) * 100);
        if (pct <= 0 && moveGames === 0) continue;
        list.push({
          from,
          to,
          color: 'blue',
          label: `${pct}%`,
          weight: Math.max(0.25, Math.min(1, moveGames / totalPosGames)),
        });
      }
    }

    // 2. Theoretical expected move (Green on player's turn)
    if (!isOutOfTargetLine && expectedBookMoveUci) {
      list.push({
        from: expectedBookMoveUci.from,
        to: expectedBookMoveUci.to,
        color: 'green',
        label: 'Théorie',
        weight: 1,
      });
    }

    return list;
  }, [
    trainingMode,
    quizStatus,
    quizShowSolution,
    quizExpectedMove,
    isBlindMode,
    isBotTurnOrThinking,
    explorerStats,
    isOutOfTargetLine,
    expectedBookMoveUci,
  ]);

  const attemptMove = (from: string, to: string) => {
    if (!isUserTurn) return false;
    const moves = chess.moves({ square: from as Square, verbose: true });
    const matching = moves.filter((m) => m.to === to);
    if (matching.length === 0) return false;

    const needsPromotion = matching.some((m) => Boolean(m.promotion));
    if (needsPromotion) {
      setPendingPromotion({ from, to });
      setSelectedSquare(null);
      return true;
    }

    const ok = makeUserMove(from, to);
    if (ok) {
      setSelectedSquare(null);
    }
    return ok;
  };

  const handleSquareClick = (square: string, pieceColor?: PlayerColor) => {
    if (!isUserTurn) return;

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && legalTargetsMap.has(square)) {
      attemptMove(selectedSquare, square);
      return;
    }

    if (pieceColor === playerColor) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    square: string,
    pieceColor: PlayerColor
  ) => {
    if (!isUserTurn || pieceColor !== playerColor) {
      e.preventDefault();
      return;
    }
    setDraggedFrom(square);
    setSelectedSquare(square);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', square);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetSquare: string) => {
    e.preventDefault();
    const fromSquare = draggedFrom || e.dataTransfer.getData('text/plain');
    setDraggedFrom(null);
    if (!fromSquare || fromSquare === targetSquare) return;
    attemptMove(fromSquare, targetSquare);
  };

  const displayRanks = playerColor === 'w' ? RANKS : [...RANKS].reverse();
  const displayFiles = playerColor === 'w' ? FILES : [...FILES].reverse();

  return (
    <div className="relative w-full max-w-[560px] mx-auto select-none">
      {/* Square Aspect Ratio Board Container */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-slate-700/80 bg-slate-900">
        {/* 8x8 Grid */}
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRanks.map((rank, rowIdx) =>
            displayFiles.map((file, colIdx) => {
              const square = `${file}${rank}`;
              const fileIdx = FILES.indexOf(file);
              const boardRow = 8 - parseInt(rank, 10);
              const piece = boardMatrix[boardRow][fileIdx];
              const isLight = (fileIdx + parseInt(rank, 10)) % 2 === 1;

              const isSelected = selectedSquare === square;
              const legalTarget = legalTargetsMap.get(square);
              const isLastMove =
                lastMoveSquares?.from === square || lastMoveSquares?.to === square;
              const isQuizSolutionHighlight =
                trainingMode === 'quiz' &&
                quizStatus === 'wrong' &&
                quizShowSolution &&
                quizExpectedMove &&
                (quizExpectedMove.from === square ||
                  quizExpectedMove.to === square);

              const isBookHighlight =
                isQuizSolutionHighlight ||
                (trainingMode === 'opening' &&
                  !isBlindMode &&
                  !isBotTurnOrThinking &&
                  !isOutOfTargetLine &&
                  expectedBookMoveUci &&
                  (expectedBookMoveUci.from === square ||
                    expectedBookMoveUci.to === square));
              const isKingCheck = kingInCheckSquare === square;

              const showRankCoord = colIdx === 0;
              const showFileCoord = rowIdx === 7;

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square, piece?.color)}
                  onDragOver={(e) => {
                    if (isUserTurn) e.preventDefault();
                  }}
                  onDrop={(e) => handleDrop(e, square)}
                  className={`relative flex items-center justify-center transition-colors duration-100 ${
                    isLight ? 'bg-[#e9dec7]' : 'bg-[#7d945d]'
                  } ${isUserTurn && piece?.color === playerColor ? 'cursor-grab active:cursor-grabbing' : ''} ${
                    legalTarget ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Last move highlight */}
                  {isLastMove && (
                    <div className="absolute inset-0 bg-amber-400/35 pointer-events-none" />
                  )}

                  {/* Selected square highlight */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-emerald-400/45 pointer-events-none" />
                  )}

                  {/* Theoretical expected square illumination */}
                  {isBookHighlight && (
                    <div
                      className={`absolute inset-0 pointer-events-none ring-inset ${
                        turn === playerColor
                          ? 'ring-2 ring-emerald-400/90 bg-emerald-400/15'
                          : 'ring-2 ring-amber-400/90 bg-amber-400/15'
                      }`}
                    />
                  )}

                  {/* Check highlight */}
                  {isKingCheck && (
                    <div className="absolute inset-0 bg-rose-600/60 shadow-inner pointer-events-none" />
                  )}

                  {/* Coordinates */}
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

                  {/* Legal move indicator */}
                  {legalTarget && !legalTarget.isCapture && (
                    <div className="w-[28%] h-[28%] rounded-full bg-slate-900/30 z-10 pointer-events-none" />
                  )}
                  {legalTarget && legalTarget.isCapture && (
                    <div className="absolute inset-[6%] rounded-full border-[5px] border-slate-900/30 z-10 pointer-events-none" />
                  )}

                  {/* Chess piece */}
                  {piece && (
                    <div
                      draggable={isUserTurn && piece.color === playerColor}
                      onDragStart={(e) => handleDragStart(e, square, piece.color)}
                      className="w-[84%] h-[84%] z-10 transition-all duration-150 ease-out hover:scale-[1.04]"
                    >
                      <ChessPieceSvg type={piece.type} color={piece.color} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* SVG Overlay Layer for Arrows */}
        <svg
          viewBox="0 0 800 800"
          className={`pointer-events-none absolute inset-0 w-full h-full z-20 transition-opacity duration-200 ease-out ${
            arrows.length > 0 ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Flèches d'analyse et de théorie"
        >
            <defs>
              <marker
                id="arrow-green"
                markerWidth="4"
                markerHeight="4"
                refX="2.7"
                refY="2"
                orient="auto"
              >
                <path d="M0,0.4 L3.5,2 L0,3.6 Z" fill="#10b981" />
              </marker>
              <marker
                id="arrow-amber"
                markerWidth="4"
                markerHeight="4"
                refX="2.7"
                refY="2"
                orient="auto"
              >
                <path d="M0,0.4 L3.5,2 L0,3.6 Z" fill="#f59e0b" />
              </marker>
              <marker
                id="arrow-blue"
                markerWidth="4"
                markerHeight="4"
                refX="2.7"
                refY="2"
                orient="auto"
              >
                <path d="M0,0.4 L3.5,2 L0,3.6 Z" fill="#3b82f6" />
              </marker>
            </defs>

            {arrows.map((arrow, idx) => {
              const start = squareToCoords(arrow.from, playerColor);
              const end = squareToCoords(arrow.to, playerColor);
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const len = Math.hypot(dx, dy);
              if (len === 0) return null;

              const ux = dx / len;
              const uy = dy / len;

              // Shorten slightly at start and end so arrow doesn't cover the center completely
              const startOffset = 14;
              const endOffset = 22;
              const x1 = start.x + ux * startOffset;
              const y1 = start.y + uy * startOffset;
              const x2 = end.x - ux * endOffset;
              const y2 = end.y - uy * endOffset;

              // Slight perpendicular offset for blue arrows if overlapping green/amber book arrow
              const hasBookOverlap =
                arrow.color === 'blue' &&
                arrows.some(
                  (other) =>
                    other.color !== 'blue' &&
                    other.from === arrow.from &&
                    other.to === arrow.to
                );
              const perpOffset = hasBookOverlap ? 10 : 0;
              const px = -uy * perpOffset;
              const py = ux * perpOffset;

              const strokeColor =
                arrow.color === 'green'
                  ? '#10b981'
                  : arrow.color === 'amber'
                  ? '#f59e0b'
                  : '#3b82f6';

              const strokeWidth =
                arrow.color === 'blue'
                  ? 8 + (arrow.weight ?? 0.5) * 8
                  : 15;

              const opacity =
                arrow.color === 'blue'
                  ? 0.45 + (arrow.weight ?? 0.5) * 0.35
                  : 0.88;

              const midX = (x1 + x2) / 2 + px;
              const midY = (y1 + y2) / 2 + py;

              return (
                <g key={`${arrow.color}-${arrow.from}-${arrow.to}-${idx}`} opacity={opacity}>
                  <line
                    x1={x1 + px}
                    y1={y1 + py}
                    x2={x2 + px}
                    y2={y2 + py}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    markerEnd={`url(#arrow-${arrow.color})`}
                  />
                  {arrow.label && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={arrow.color === 'blue' ? -18 : -26}
                        y={-11}
                        width={arrow.color === 'blue' ? 36 : 52}
                        height={22}
                        rx={6}
                        fill="#0f172a"
                        fillOpacity={0.9}
                        stroke={strokeColor}
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={12}
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

        {/* Promotion Modal */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 text-center mb-3">
                Choisir la promotion
              </p>
              <div className="flex gap-2">
                {(['q', 'r', 'b', 'n'] as const).map((promo) => (
                  <button
                    key={promo}
                    type="button"
                    onClick={() => {
                      makeUserMove(pendingPromotion.from, pendingPromotion.to, promo);
                      setPendingPromotion(null);
                    }}
                    className="w-14 h-14 p-2 rounded-lg bg-slate-800 hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-400 transition-colors"
                  >
                    <ChessPieceSvg type={promo} color={playerColor} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="mt-3 w-full text-xs text-slate-400 hover:text-slate-200 py-1"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
