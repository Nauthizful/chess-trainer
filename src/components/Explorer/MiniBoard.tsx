import React, { memo, useMemo } from 'react';
import { Chess } from 'chess.js';
import { ChessPieceSvg } from '../ChessPieceSvg';
import type { SquarePair } from '../../types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

interface MiniBoardProps {
  fen: string;
  lastMove?: SquarePair | null;
}

/**
 * Enlarged read-only preview chessboard for the Explorer page.
 */
export const MiniBoard: React.FC<MiniBoardProps> = memo(
  ({ fen, lastMove = null }) => {
    const chess = useMemo(() => new Chess(fen), [fen]);
    const boardMatrix = useMemo(() => chess.board(), [chess]);

    return (
      <div className="w-full max-w-[360px] mx-auto aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/90 shadow-xl select-none pointer-events-none">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {RANKS.map((rank, rIdx) =>
            FILES.map((file, fIdx) => {
              const sq = `${file}${rank}`;
              const piece = boardMatrix[rIdx][fIdx];
              const isLight = (fIdx + parseInt(rank, 10)) % 2 === 1;
              const isLastMove =
                lastMove?.from === sq || lastMove?.to === sq;

              const showRankCoord = fIdx === 0;
              const showFileCoord = rIdx === 7;

              return (
                <div
                  key={sq}
                  className={`relative flex items-center justify-center ${
                    isLight ? 'bg-[#e9dec7]' : 'bg-[#7d945d]'
                  }`}
                >
                  {isLastMove && (
                    <div className="absolute inset-0 bg-amber-400/40 pointer-events-none" />
                  )}

                  {showRankCoord && (
                    <span
                      className={`absolute top-0.5 left-1 text-[9px] font-bold leading-none ${
                        isLight ? 'text-[#7d945d]' : 'text-[#e9dec7]'
                      }`}
                    >
                      {rank}
                    </span>
                  )}
                  {showFileCoord && (
                    <span
                      className={`absolute bottom-0.5 right-1 text-[9px] font-bold leading-none ${
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

MiniBoard.displayName = 'MiniBoard';
