import React from 'react';
import type { PieceSymbol } from 'chess.js';
import { Bot, User } from 'lucide-react';
import { ChessPieceSvg } from '../ChessPieceSvg';
import type { PlayerColor } from '../../types';

interface PlayerBannerProps {
  name: string;
  color: PlayerColor;
  rating?: string | number;
  isUser?: boolean;
  isBot?: boolean;
  capturedPieces?: Array<Exclude<PieceSymbol, 'k'>>;
  materialAdvantage?: number;
  statusText?: string;
  statusVariant?: 'active' | 'thinking' | 'muted' | 'gameover';
}

export const PlayerBanner: React.FC<PlayerBannerProps> = ({
  name,
  color,
  rating,
  isUser = false,
  isBot = false,
  capturedPieces = [],
  materialAdvantage = 0,
  statusText,
  statusVariant = 'muted',
}) => {
  const capturedColor: PlayerColor = color === 'w' ? 'b' : 'w';

  return (
    <div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
            isUser
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : isBot
              ? 'bg-slate-800 border-slate-700 text-amber-400'
              : color === 'w'
              ? 'bg-slate-100 border-slate-300 text-slate-950'
              : 'bg-slate-950 border-slate-700 text-slate-200'
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4" />
          ) : isBot ? (
            <Bot className="w-4 h-4" />
          ) : (
            <span
              className={`w-3 h-3 rounded-full border ${
                color === 'w'
                  ? 'bg-white border-slate-400'
                  : 'bg-slate-900 border-slate-500'
              }`}
            />
          )}
        </div>

        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
            {name}
          </span>
          {rating && rating !== '?' && (
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              ({rating})
            </span>
          )}
          {isUser && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
              Vous
            </span>
          )}

          {(capturedPieces.length > 0 || materialAdvantage > 0) && (
            <div className="flex items-center gap-0.5 pl-1">
              {capturedPieces.map((piece, idx) => (
                <div key={`${piece}-${idx}`} className="w-3.5 h-3.5 -ml-0.5 first:ml-0 opacity-90">
                  <ChessPieceSvg type={piece} color={capturedColor} />
                </div>
              ))}
              {materialAdvantage > 0 && (
                <span className="ml-1 text-[11px] font-mono font-bold text-emerald-300">
                  +{materialAdvantage}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {statusText && (
        <span
          className={`shrink-0 text-[11px] font-semibold ${
            statusVariant === 'active'
              ? 'px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : statusVariant === 'thinking'
              ? 'text-amber-300 animate-pulse'
              : statusVariant === 'gameover'
              ? 'text-rose-300 font-bold'
              : 'text-slate-400'
          }`}
        >
          {statusText}
        </span>
      )}
    </div>
  );
};
