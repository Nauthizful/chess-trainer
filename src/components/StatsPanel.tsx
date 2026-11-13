import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Compass,
  EyeOff,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useChessStore } from '../store/useChessStore';
import { getTotalGames } from '../services/lichessApi';

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

export const StatsPanel: React.FC = () => {
  const {
    selectedOpening,
    currentPly,
    turn,
    playerColor,
    databaseSource,
    isBlindMode,
    isOutOfBook,
    isBookCompleted,
    expectedBookMoveSan,
    lastMoveDeviation,
    explorerStats,
    isLoadingStats,
    statsError,
    isComputerThinking,
    makeSanMove,
  } = useChessStore();

  const totalBookMoves = selectedOpening.moves.length;
  const completedBookPlies = isOutOfBook
    ? Math.max(0, (lastMoveDeviation?.ply ?? 1) - 1)
    : Math.min(currentPly, totalBookMoves);
  const progressPct =
    totalBookMoves > 0
      ? Math.round((completedBookPlies / totalBookMoves) * 100)
      : 0;

  const totalPositionGames = explorerStats ? getTotalGames(explorerStats) : 0;
  const canPlayFromStats =
    !isBlindMode && turn === playerColor && !isComputerThinking;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Status Banner */}
      {isOutOfBook ? (
        <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/40 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <AlertTriangle className="w-3.5 h-3.5" />
              Hors ligne cible
            </span>
            <span className="text-[11px] text-amber-200/80 font-medium">
              Relais Lichess actif
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {lastMoveDeviation && !isBlindMode ? (
              <>
                Coup joué :{' '}
                <span className="font-mono font-bold text-amber-300">
                  {lastMoveDeviation.playedSan}
                </span>{' '}
                (théorie :{' '}
                <span className="font-mono font-bold text-emerald-300">
                  {lastMoveDeviation.expectedSan}
                </span>
                ). L’adversaire répond maintenant avec les coups réels les plus populaires sur Lichess.
              </>
            ) : (
              'Vous avez dévié de la ligne cible. L’adversaire continue de façon réaliste via l’API Lichess.'
            )}
          </p>
        </div>
      ) : isBookCompleted ? (
        <div className="rounded-xl p-3 bg-indigo-500/10 border border-indigo-500/40 space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <Sparkles className="w-3.5 h-3.5" />
              Ligne cible complétée !
            </span>
            <span className="text-[11px] font-mono text-indigo-200">
              {totalBookMoves}/{totalBookMoves}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Toute la séquence de l’ouverture a été jouée. La suite de la partie s’appuie sur Lichess Explorer.
          </p>
        </div>
      ) : (
        <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/35 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              En ligne cible
            </span>
            <span className="text-[11px] font-mono text-emerald-200">
              {completedBookPlies}/{totalBookMoves} demi-coups
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {!isBlindMode && expectedBookMoveSan ? (
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-300">
                {turn === playerColor
                  ? 'Coup théorique attendu :'
                  : 'Réponse cible de l’adversaire :'}
              </span>
              <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {expectedBookMoveSan}
              </span>
            </div>
          ) : isBlindMode ? (
            <p className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              Mode Aveugle actif : aides théoriques masquées.
            </p>
          ) : null}
        </div>
      )}

      {/* Lichess Explorer Stats */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            Explorateur Lichess (
            {databaseSource === 'masters' ? 'Maîtres' : '1000–1400 Elo'})
          </h3>
          {isLoadingStats && (
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          )}
        </div>

        {explorerStats?.opening && (
          <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs">
            <Compass className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-mono font-bold text-blue-300">
              {explorerStats.opening.eco}
            </span>
            <span className="text-slate-300 truncate">
              {explorerStats.opening.name}
            </span>
          </div>
        )}

        {isBlindMode ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center space-y-1.5">
            <EyeOff className="w-5 h-5 text-amber-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-300">
              Statistiques masquées en Mode Aveugle
            </p>
            <p className="text-[11px] text-slate-500">
              Désactivez le Mode Aveugle / Test pour consulter les pourcentages Lichess et les flèches bleues.
            </p>
          </div>
        ) : statsError ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            {statsError}
          </div>
        ) : !explorerStats || explorerStats.moves.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 text-center">
            {isLoadingStats
              ? 'Chargement des parties Lichess...'
              : 'Aucune partie répertoriée dans cette base pour cette position.'}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Coup</span>
              <span>{formatCompactNumber(totalPositionGames)} parties</span>
            </div>

            <div className="divide-y divide-slate-800/70 max-h-64 overflow-y-auto">
              {explorerStats.moves.slice(0, 8).map((move) => {
                const moveTotal = getTotalGames(move);
                if (moveTotal === 0) return null;

                const freqPct = Math.round(
                  (moveTotal / Math.max(1, totalPositionGames)) * 100
                );
                const whitePct = (move.white / moveTotal) * 100;
                const drawPct = (move.draws / moveTotal) * 100;
                const blackPct = (move.black / moveTotal) * 100;
                const isExpected =
                  !isOutOfBook && expectedBookMoveSan === move.san;

                return (
                  <button
                    key={move.uci}
                    type="button"
                    disabled={!canPlayFromStats}
                    onClick={() => {
                      if (canPlayFromStats) {
                        makeSanMove(move.san);
                      }
                    }}
                    className={`w-full px-3 py-2 text-left transition-colors ${
                      canPlayFromStats
                        ? 'hover:bg-slate-800/80 cursor-pointer'
                        : 'cursor-default'
                    } ${isExpected ? 'bg-emerald-500/10' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold ${
                            isExpected ? 'text-emerald-300' : 'text-slate-100'
                          }`}
                        >
                          {move.san}
                        </span>
                        {isExpected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                            Cible
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{freqPct}%</span>
                        <span className="text-slate-500">
                          ({formatCompactNumber(moveTotal)})
                        </span>
                      </div>
                    </div>

                    {/* Win / Draw / Loss stacked bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-800 ring-1 ring-slate-700/60">
                      <div
                        style={{ width: `${whitePct}%` }}
                        className="bg-slate-100 h-full"
                        title={`Blancs: ${Math.round(whitePct)}%`}
                      />
                      <div
                        style={{ width: `${drawPct}%` }}
                        className="bg-slate-500 h-full"
                        title={`Nulles: ${Math.round(drawPct)}%`}
                      />
                      <div
                        style={{ width: `${blackPct}%` }}
                        className="bg-slate-900 h-full"
                        title={`Noirs: ${Math.round(blackPct)}%`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
