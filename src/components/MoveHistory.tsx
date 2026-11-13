import React from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
} from 'lucide-react';
import { useChessStore } from '../store/useChessStore';
import type { HistoryEntry } from '../types';

interface MovePair {
  moveNumber: number;
  white?: HistoryEntry;
  black?: HistoryEntry;
}

export const MoveHistory: React.FC = () => {
  const {
    history,
    currentPly,
    turn,
    playerColor,
    isComputerThinking,
    jumpToPly,
    triggerComputerMove,
  } = useChessStore();

  const movePairs: MovePair[] = [];
  for (let i = 1; i < history.length; i += 2) {
    movePairs.push({
      moveNumber: Math.ceil(i / 2),
      white: history[i],
      black: history[i + 1],
    });
  }

  const canGoBack = currentPly > 0;
  const canGoForward = currentPly < history.length - 1;
  const waitingForComputerResume =
    turn !== playerColor && !isComputerThinking;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          Historique & Navigation temporelle
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          Coup {currentPly}/{history.length - 1}
        </span>
      </div>

      {/* Time-travel controls */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => jumpToPly(0)}
          disabled={!canGoBack}
          title="Position initiale"
          className="flex items-center justify-center py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => jumpToPly(currentPly - 1)}
          disabled={!canGoBack}
          title="Coup précédent"
          className="flex items-center justify-center py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => jumpToPly(currentPly + 1)}
          disabled={!canGoForward}
          title="Coup suivant"
          className="flex items-center justify-center py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => jumpToPly(history.length - 1)}
          disabled={!canGoForward}
          title="Dernier coup"
          className="flex items-center justify-center py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      {/* Move list */}
      <div className="max-h-52 overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800/80 p-2 space-y-1">
        <button
          type="button"
          onClick={() => jumpToPly(0)}
          className={`w-full text-left px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            currentPly === 0
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
          }`}
        >
          Position de départ
        </button>

        {movePairs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            Jouez un coup sur l’échiquier pour démarrer la ligne.
          </p>
        ) : (
          movePairs.map((pair) => (
            <div
              key={pair.moveNumber}
              className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1 text-xs"
            >
              <span className="font-mono text-slate-500 text-right pr-1.5">
                {pair.moveNumber}.
              </span>

              {pair.white ? (
                <button
                  type="button"
                  onClick={() => jumpToPly(pair.white!.ply)}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg font-mono font-semibold transition-colors ${
                    currentPly === pair.white.ply
                      ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{pair.white.san}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pair.white.isBookMove ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    title={
                      pair.white.isBookMove
                        ? 'Coup de l’ouverture cible'
                        : 'Hors ligne cible'
                    }
                  />
                </button>
              ) : (
                <span />
              )}

              {pair.black ? (
                <button
                  type="button"
                  onClick={() => jumpToPly(pair.black!.ply)}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg font-mono font-semibold transition-colors ${
                    currentPly === pair.black.ply
                      ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{pair.black.san}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pair.black.isBookMove ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    title={
                      pair.black.isBookMove
                        ? 'Coup de l’ouverture cible'
                        : 'Hors ligne cible'
                    }
                  />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>

      {waitingForComputerResume && (
        <button
          type="button"
          onClick={triggerComputerMove}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Laisser l’adversaire jouer depuis cette position
        </button>
      )}

      <p className="mt-2.5 text-[11px] text-slate-500 leading-snug">
        Cliquez sur n’importe quel coup pour voyager dans le temps et explorer une autre variante.
      </p>
    </div>
  );
};
