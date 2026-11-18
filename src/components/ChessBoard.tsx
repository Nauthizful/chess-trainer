import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { BookOpen } from 'lucide-react';
import { ChessPieceSvg } from './ChessPieceSvg';
import { FILES, RANKS, squareToCoords } from '../utils/chessHelpers';
import type {
  BoardArrow,
  BoardSquareHighlight,
  MoveClassification,
  PlayerColor,
  SquarePair,
} from '../types';

export interface ChessBoardProps {
  fen: string;
  orientation?: PlayerColor;
  interactive?: boolean;
  allowedColor?: PlayerColor | 'turn';
  lastMove?: SquarePair | null;
  arrows?: BoardArrow[];
  highlightedSquares?: BoardSquareHighlight[];
  moveBadges?: Array<{ square: string; classification: MoveClassification }>;
  size?: 'sm' | 'md' | 'lg';
  maxWidthClass?: string;
  onMove?: (from: string, to: string, promotion?: string) => boolean | void;
}

interface PendingPromotion {
  from: string;
  to: string;
  color: PlayerColor;
}

interface BoardPiece {
  square: string;
  type: PieceSymbol;
  color: PlayerColor;
}

const SIZE_MAX_WIDTH: Record<NonNullable<ChessBoardProps['size']>, string> = {
  sm: 'max-w-[340px]',
  md: 'max-w-[360px]',
  lg: 'max-w-[560px]',
};

const ARROW_STYLES: Record<
  BoardArrow['color'],
  { hex: string; markerId: string }
> = {
  green: { hex: '#10b981', markerId: 'chessboard-arrow-green' },
  amber: { hex: '#f59e0b', markerId: 'chessboard-arrow-amber' },
  blue: { hex: '#3b82f6', markerId: 'chessboard-arrow-blue' },
  red: { hex: '#ef4444', markerId: 'chessboard-arrow-red' },
};

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

function getSquareGridCoords(
  square: string,
  orientation: PlayerColor
): { col: number; row: number } {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rankNum = parseInt(square[1], 10);
  const rankIndex = 8 - rankNum;

  const col = orientation === 'w' ? fileIndex : 7 - fileIndex;
  const row = orientation === 'w' ? rankIndex : 7 - rankIndex;
  return { col, row };
}

function getCastlingRookPair(
  from: string,
  to: string
): { rookFrom: string; rookTo: string } | null {
  if (from === 'e1' && to === 'g1') return { rookFrom: 'h1', rookTo: 'f1' };
  if (from === 'e1' && to === 'c1') return { rookFrom: 'a1', rookTo: 'd1' };
  if (from === 'e8' && to === 'g8') return { rookFrom: 'h8', rookTo: 'f8' };
  if (from === 'e8' && to === 'c8') return { rookFrom: 'a8', rookTo: 'd8' };
  return null;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation = 'w',
  interactive = false,
  allowedColor = 'turn',
  lastMove = null,
  arrows = [],
  highlightedSquares = [],
  moveBadges = [],
  size = 'lg',
  maxWidthClass,
  onMove,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
    setDraggedFrom(null);
    setPendingPromotion(null);
  }, [fen, interactive, orientation]);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const boardMatrix = useMemo(() => chess.board(), [chess]);
  const activeTurn = chess.turn();
  const effectiveAllowedColor: PlayerColor =
    allowedColor === 'turn' ? activeTurn : allowedColor;
  const canInteract =
    interactive &&
    Boolean(onMove) &&
    !chess.isGameOver() &&
    activeTurn === effectiveAllowedColor;

  const { piecesList, piecesBySquare } = useMemo(() => {
    const list: BoardPiece[] = [];
    const map = new Map<string, { type: PieceSymbol; color: PlayerColor }>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardMatrix[r][c];
        if (piece) {
          const sq = `${FILES[c]}${8 - r}`;
          list.push({ square: sq, type: piece.type, color: piece.color });
          map.set(sq, { type: piece.type, color: piece.color });
        }
      }
    }
    return { piecesList: list, piecesBySquare: map };
  }, [boardMatrix]);

  const pieceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevBoardStateRef = useRef<{
    fen: string;
    orientation: PlayerColor;
    bySquare: Map<string, { type: PieceSymbol; color: PlayerColor }>;
  } | null>(null);

  // Explicit FLIP sliding animation on single-move transitions
  useLayoutEffect(() => {
    const prev = prevBoardStateRef.current;
    prevBoardStateRef.current = { fen, orientation, bySquare: piecesBySquare };

    if (!prev || prev.orientation !== orientation || prev.fen === fen) {
      for (const el of pieceRefs.current.values()) {
        el.style.transition = 'none';
        el.style.transform = 'translate(0, 0)';
      }
      return;
    }

    const removed: Array<{ square: string; type: PieceSymbol; color: PlayerColor }> = [];
    const added: Array<{ square: string; type: PieceSymbol; color: PlayerColor }> = [];

    for (const [sq, prevP] of prev.bySquare.entries()) {
      const nextP = piecesBySquare.get(sq);
      if (!nextP || nextP.type !== prevP.type || nextP.color !== prevP.color) {
        removed.push({ square: sq, ...prevP });
      }
    }
    for (const [sq, nextP] of piecesBySquare.entries()) {
      const prevP = prev.bySquare.get(sq);
      if (!prevP || prevP.type !== nextP.type || prevP.color !== nextP.color) {
        added.push({ square: sq, ...nextP });
      }
    }

    // Disable animation on full reset or multi-move jumps (> 4 squares changed)
    if (
      removed.length === 0 ||
      added.length === 0 ||
      removed.length > 4 ||
      added.length > 2
    ) {
      for (const el of pieceRefs.current.values()) {
        el.style.transition = 'none';
        el.style.transform = 'translate(0, 0)';
      }
      return;
    }

    const movesToAnimate: Array<{ from: string; to: string }> = [];

    // Prefer explicit lastMove if it matches a piece that actually moved from -> to
    if (
      lastMove &&
      prev.bySquare.has(lastMove.from) &&
      piecesBySquare.has(lastMove.to) &&
      added.some((a) => a.square === lastMove.to)
    ) {
      movesToAnimate.push({ from: lastMove.from, to: lastMove.to });
      const movedPrev = prev.bySquare.get(lastMove.from);
      if (movedPrev?.type === 'k') {
        const castlingRook = getCastlingRookPair(lastMove.from, lastMove.to);
        if (
          castlingRook &&
          prev.bySquare.has(castlingRook.rookFrom) &&
          piecesBySquare.has(castlingRook.rookTo)
        ) {
          movesToAnimate.push({
            from: castlingRook.rookFrom,
            to: castlingRook.rookTo,
          });
        }
      }
    } else {
      // Fallback for 1-ply backward navigation or calls without matching lastMove
      const usedRemoved = new Set<string>();
      for (const addItem of added) {
        const exactMatch = removed.find(
          (r) =>
            r.type === addItem.type &&
            r.color === addItem.color &&
            !usedRemoved.has(r.square)
        );
        const colorMatch =
          exactMatch ??
          removed.find(
            (r) => r.color === addItem.color && !usedRemoved.has(r.square)
          );
        if (colorMatch) {
          usedRemoved.add(colorMatch.square);
          movesToAnimate.push({ from: colorMatch.square, to: addItem.square });
        }
      }
    }

    if (movesToAnimate.length === 0) return;

    const animatedEls: HTMLDivElement[] = [];
    for (const { from, to } of movesToAnimate) {
      const el = pieceRefs.current.get(to);
      if (!el) continue;
      const fromCoords = getSquareGridCoords(from, orientation);
      const toCoords = getSquareGridCoords(to, orientation);
      const deltaCol = fromCoords.col - toCoords.col;
      const deltaRow = fromCoords.row - toCoords.row;

      el.style.transition = 'none';
      el.style.transform = `translate(${deltaCol * 100}%, ${deltaRow * 100}%)`;
      animatedEls.push(el);
    }

    if (animatedEls.length === 0) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        for (const el of animatedEls) {
          el.style.transition =
            'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'translate(0, 0)';
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [fen, orientation, lastMove, piecesBySquare]);

  const legalTargetsMap = useMemo(() => {
    const map = new Map<string, { isCapture: boolean; isPromotion: boolean }>();
    if (!selectedSquare || !canInteract) return map;
    const moves = chess.moves({
      square: selectedSquare as Square,
      verbose: true,
    });
    for (const m of moves) {
      map.set(m.to, {
        isCapture: Boolean(m.captured),
        isPromotion: Boolean(m.promotion),
      });
    }
    return map;
  }, [chess, selectedSquare, canInteract]);

  const highlightBySquare = useMemo(() => {
    const map = new Map<string, BoardSquareHighlight['variant']>();
    for (const h of highlightedSquares) {
      map.set(h.square, h.variant);
    }
    return map;
  }, [highlightedSquares]);

  const badgeBySquare = useMemo(() => {
    const map = new Map<string, MoveClassification>();
    for (const b of moveBadges) {
      map.set(b.square, b.classification);
    }
    return map;
  }, [moveBadges]);

  const attemptMove = (from: string, to: string): boolean => {
    if (!canInteract || !onMove) return false;
    const moves = chess.moves({ square: from as Square, verbose: true });
    const matching = moves.filter((m) => m.to === to);
    if (matching.length === 0) return false;

    const needsPromotion = matching.some((m) => Boolean(m.promotion));
    if (needsPromotion) {
      setPendingPromotion({ from, to, color: activeTurn });
      setSelectedSquare(null);
      return true;
    }

    const res = onMove(from, to);
    if (res !== false) {
      setSelectedSquare(null);
      return true;
    }
    return false;
  };

  const handleSquareClick = (square: string, pieceColor?: PlayerColor) => {
    if (!canInteract) return;

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare && legalTargetsMap.has(square)) {
      attemptMove(selectedSquare, square);
      return;
    }

    if (pieceColor === effectiveAllowedColor) {
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
    if (!canInteract || pieceColor !== effectiveAllowedColor) {
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
  const coordFontSize = size === 'lg' ? 'text-[10px]' : 'text-[9px]';
  const captureBorderWidth = size === 'sm' ? 'border-[3px]' : 'border-[5px]';

  return (
    <div
      className={`relative w-full ${maxWidthClass ?? SIZE_MAX_WIDTH[size]} mx-auto select-none ${
        interactive ? '' : 'pointer-events-none'
      }`}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-slate-700/80 bg-slate-900">
        {/* 8x8 Squares Grid (Cream & Terracotta Orange) */}
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRanks.map((rank, rowIdx) =>
            displayFiles.map((file, colIdx) => {
              const square = `${file}${rank}`;
              const fileIdx = FILES.indexOf(file);
              const isLight = (fileIdx + parseInt(rank, 10)) % 2 === 1;

              const isSelected = selectedSquare === square;
              const legalTarget = legalTargetsMap.get(square);
              const isLastMove =
                lastMove?.from === square || lastMove?.to === square;
              const highlightVariant = highlightBySquare.get(square);
              const badgeClassification = badgeBySquare.get(square);

              const showRankCoord = colIdx === 0;
              const showFileCoord = rowIdx === 7;

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  onDragOver={(e) => {
                    if (canInteract) e.preventDefault();
                  }}
                  onDrop={(e) => handleDrop(e, square)}
                  className={`relative flex items-center justify-center transition-colors duration-100 ${
                    isLight ? 'bg-[#DBBBA1]' : 'bg-[#9B5347]'
                  } ${legalTarget ? 'cursor-pointer' : ''}`}
                >
                  {isLastMove && (
                    <div className="absolute inset-0 bg-[#FACC15]/[0.42] pointer-events-none" />
                  )}

                  {isSelected && (
                    <div className="absolute inset-0 bg-emerald-400/45 pointer-events-none" />
                  )}

                  {(highlightVariant === 'book' ||
                    highlightVariant === 'solution') && (
                    <div className="absolute inset-0 pointer-events-none ring-inset ring-2 ring-emerald-500/90 bg-emerald-400/20" />
                  )}

                  {highlightVariant === 'book-opponent' && (
                    <div className="absolute inset-0 pointer-events-none ring-inset ring-2 ring-amber-400/90 bg-amber-400/20" />
                  )}

                  {highlightVariant === 'check' && (
                    <div className="absolute inset-0 bg-rose-600/65 shadow-inner pointer-events-none" />
                  )}

                  {showRankCoord && (
                    <span
                      className={`absolute top-0.5 left-1 ${coordFontSize} font-bold tracking-tight leading-none pointer-events-none ${
                        isLight ? 'text-[#B55B24]' : 'text-[#FFF7EC]'
                      }`}
                    >
                      {rank}
                    </span>
                  )}

                  {showFileCoord && (
                    <span
                      className={`absolute bottom-0.5 right-1 ${coordFontSize} font-bold tracking-tight leading-none pointer-events-none ${
                        isLight ? 'text-[#B55B24]' : 'text-[#FFF7EC]'
                      }`}
                    >
                      {file}
                    </span>
                  )}

                  {legalTarget && !legalTarget.isCapture && (
                    <div className="w-[28%] h-[28%] rounded-full bg-slate-900/30 z-20 pointer-events-none" />
                  )}

                  {legalTarget && legalTarget.isCapture && (
                    <div
                      className={`absolute inset-[6%] rounded-full ${captureBorderWidth} border-slate-900/30 z-20 pointer-events-none`}
                    />
                  )}

                  {badgeClassification &&
                    renderClassificationCornerBadge(badgeClassification)}
                </div>
              );
            })
          )}
        </div>

        {/* Absolute Pieces Layer (with explicit FLIP sliding animation) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {piecesList.map((p) => {
            const { col, row } = getSquareGridCoords(p.square, orientation);
            const isPieceDraggable =
              canInteract && p.color === effectiveAllowedColor;
            const isLegalCaptureTarget = legalTargetsMap.has(p.square);

            return (
              <div
                key={p.square}
                ref={(el) => {
                  if (el) {
                    pieceRefs.current.set(p.square, el);
                  } else {
                    pieceRefs.current.delete(p.square);
                  }
                }}
                style={{
                  left: `${col * 12.5}%`,
                  top: `${row * 12.5}%`,
                  width: '12.5%',
                  height: '12.5%',
                }}
                onClick={() => handleSquareClick(p.square, p.color)}
                onDragOver={(e) => {
                  if (canInteract) e.preventDefault();
                }}
                onDrop={(e) => handleDrop(e, p.square)}
                className={`absolute flex items-center justify-center ${
                  canInteract ? 'pointer-events-auto' : 'pointer-events-none'
                } ${
                  isPieceDraggable
                    ? 'cursor-grab active:cursor-grabbing'
                    : isLegalCaptureTarget
                    ? 'cursor-pointer'
                    : ''
                }`}
              >
                <div
                  draggable={isPieceDraggable}
                  onDragStart={(e) => handleDragStart(e, p.square, p.color)}
                  className="w-[88%] h-[88%] transition-transform duration-150 ease-out hover:scale-[1.04]"
                >
                  <ChessPieceSvg type={p.type} color={p.color} />
                </div>
              </div>
            );
          })}
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
            {(Object.keys(ARROW_STYLES) as Array<BoardArrow['color']>).map(
              (colorKey) => {
                const { hex, markerId } = ARROW_STYLES[colorKey];
                return (
                  <marker
                    key={markerId}
                    id={markerId}
                    markerWidth="4"
                    markerHeight="4"
                    refX="2.7"
                    refY="2"
                    orient="auto"
                  >
                    <path d="M0,0.4 L3.5,2 L0,3.6 Z" fill={hex} />
                  </marker>
                );
              }
            )}
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

            const startOffset = 14;
            const endOffset = 22;
            const x1 = start.x + ux * startOffset;
            const y1 = start.y + uy * startOffset;
            const x2 = end.x - ux * endOffset;
            const y2 = end.y - uy * endOffset;

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

            const { hex: strokeColor, markerId } = ARROW_STYLES[arrow.color];

            const strokeWidth =
              arrow.color === 'blue'
                ? 8 + (arrow.weight ?? 0.5) * 8
                : 15;

            const opacity =
              arrow.color === 'blue'
                ? 0.45 + (arrow.weight ?? 0.5) * 0.35
                : 0.9;

            const midX = (x1 + x2) / 2 + px;
            const midY = (y1 + y2) / 2 + py;

            const labelWidth = arrow.color === 'blue' ? 36 : 56;

            return (
              <g
                key={`${arrow.color}-${arrow.from}-${arrow.to}-${idx}`}
                opacity={opacity}
              >
                <line
                  x1={x1 + px}
                  y1={y1 + py}
                  x2={x2 + px}
                  y2={y2 + py}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                />
                {arrow.label && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-labelWidth / 2}
                      y={-11}
                      width={labelWidth}
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
                      onMove?.(
                        pendingPromotion.from,
                        pendingPromotion.to,
                        promo
                      );
                      setPendingPromotion(null);
                    }}
                    className="w-14 h-14 p-2 rounded-lg bg-slate-800 hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-400 transition-colors"
                  >
                    <ChessPieceSvg type={promo} color={pendingPromotion.color} />
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
