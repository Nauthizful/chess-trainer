import React, { memo, useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { ChessPieceSvg } from '../ChessPieceSvg';
import type { PlayerColor, SquarePair } from '../../types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

interface RepertoireBoardProps {
  fen: string;
  orientation: PlayerColor;
  lastMove?: SquarePair | null;
  onAddMove: (san: string) => void;
}

export const RepertoireBoard: React.FC<RepertoireBoardProps> = memo(
  ({ fen, orientation, lastMove = null, onAddMove }) => {
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

    useEffect(() => {
      setSelectedSquare(null);
    }, [fen]);

    const chess = useMemo(() => new Chess(fen), [fen]);
    const boardMatrix = useMemo(() => chess.board(), [chess]);
    const currentTurn = chess.turn();

    const legalTargets = useMemo(() => {
      if (!selectedSquare) return new Map<string, string>();
      const moves = chess.moves({
        square: selectedSquare as Square,
        verbose: true,
      });
      const map = new Map<string, string>();
      for (const m of moves) {
        if (!map.has(m.to) || m.promotion === 'q') {
          map.set(m.to, m.san);
        }
      }
      return map;
    }, [chess, selectedSquare]);

    const handleSquareClick = (sq: string, pieceColor?: PlayerColor) => {
      if (selectedSquare === sq) {
        setSelectedSquare(null);
        return;
      }

      const targetSan = legalTargets.get(sq);
      if (selectedSquare && targetSan) {
        setSelectedSquare(null);
        onAddMove(targetSan);
        return;
      }

      if (pieceColor === currentTurn) {
        setSelectedSquare(sq);
      } else {
        setSelectedSquare(null);
      }
    };

    const displayRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
    const displayFiles = orientation === 'w' ? FILES : [...FILES].reverse();

    return (
      <div className="w-full max-w-[340px] mx-auto aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/90 shadow-xl select-none">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRanks.map((rank, rIdx) =>
            displayFiles.map((file, fIdx) => {
              const sq = `${file}${rank}`;
              const fileIdx = FILES.indexOf(file);
              const boardRow = 8 - parseInt(rank, 10);
              const piece = boardMatrix[boardRow][fileIdx];
              const isLight = (fileIdx + parseInt(rank, 10)) % 2 === 1;
              const isSelected = selectedSquare === sq;
              const isLegalTarget = legalTargets.has(sq);
              const isLastMove =
                lastMove?.from === sq || lastMove?.to === sq;

              const showRankCoord = fIdx === 0;
              const showFileCoord = rIdx === 7;

              return (
                <div
                  key={sq}
                  onClick={() => handleSquareClick(sq, piece?.color)}
                  className={`relative flex items-center justify-center ${
                    isLight ? 'bg-[#e9dec7]' : 'bg-[#7d945d]'
                  } ${
                    piece?.color === currentTurn || isLegalTarget
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
                  {isLegalTarget && !piece && (
                    <div className="w-[28%] h-[28%] rounded-full bg-slate-900/35 z-10 pointer-events-none" />
                  )}
                  {isLegalTarget && piece && (
                    <div className="absolute inset-[6%] rounded-full border-[3px] border-slate-900/35 z-10 pointer-events-none" />
                  )}

                  {showRankCoord && (
                    <span
                      className={`absolute top-0.5 left-1 text-[9px] font-bold leading-none pointer-events-none ${
                        isLight ? 'text-[#7d945d]' : 'text-[#e9dec7]'
                      }`}
                    >
                      {rank}
                    </span>
                  )}
                  {showFileCoord && (
                    <span
                      className={`absolute bottom-0.5 right-1 text-[9px] font-bold leading-none pointer-events-none ${
                        isLight ? 'text-[#7d945d]' : 'text-[#e9dec7]'
                      }`}
                    >
                      {file}
                    </span>
                  )}

                  {piece && (
                    <div className="w-[86%] h-[86%] z-10 transition-transform duration-150 ease-out">
                      <ChessPieceSvg type={piece.type} color={piece.color} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
);

RepertoireBoard.displayName = 'RepertoireBoard';
