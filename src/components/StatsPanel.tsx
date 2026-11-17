import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Compass,
  EyeOff,
  GitBranch,
  KeyRound,
  Loader2,
  Play,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { findRefugeOpenings, useChessStore } from '../store/useChessStore';
import { getTotalGames } from '../services/lichessApi';

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

export const StatsPanel: React.FC = () => {
  const {
    selectedOpening,
    history,
    currentPly,
    turn,
    playerColor,
    databaseSource,
    isBlindMode,
    isOutOfTargetLine,
    isFreeExploreMode,
    isBookCompleted,
    expectedBookMoveSan,
    lastMoveDeviation,
    lichessToken,
    lichessStatus,
    explorerStats,
    isLoadingStats,
    statsError,
    isComputerThinking,
    makeSanMove,
    setLichessToken,
    switchToRefugeOpening,
    continueWithPopularMoves,
  } = useChessStore();

  const [tokenDraft, setTokenDraft] = useState(lichessToken);
  const [showTokenInput, setShowTokenInput] = useState(
    lichessStatus === 'auth_error'
  );

  const refugeOpenings = useMemo(() => {
    if (!isOutOfTargetLine) return [];
    return findRefugeOpenings(
      history,
      currentPly,
      playerColor,
      selectedOpening.id
    );
  }, [isOutOfTargetLine, history, currentPly, playerColor, selectedOpening.id]);

  const totalBookMoves = selectedOpening.moves.length;
  const completedBookPlies = isOutOfTargetLine
    ? Math.max(0, (lastMoveDeviation?.ply ?? 1) - 1)
    : Math.min(currentPly, totalBookMoves);
  const progressPct =
    totalBookMoves > 0
      ? Math.round((completedBookPlies / totalBookMoves) * 100)
      : 0;

  const totalPositionGames = explorerStats ? getTotalGames(explorerStats) : 0;
  const canPlayFromStats =
    !isBlindMode && turn === playerColor && !isComputerThinking;

  const statusBadge = (() => {
    switch (lichessStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
            <Wifi className="w-3 h-3" />
            Connecté
          </span>
        );
      case 'auth_error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
            <KeyRound className="w-3 h-3" />
            Erreur 401/429 - Token requis
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/40">
            <WifiOff className="w-3 h-3" />
            Hors-ligne
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Status Banner */}
      {isOutOfTargetLine && !isFreeExploreMode ? (
        <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <AlertTriangle className="w-3.5 h-3.5" />
              Hors ligne cible
            </span>
            <span className="text-[11px] text-amber-200/80 font-medium">
              Ordinateur en pause
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
                ). Choisissez comment poursuivre :
              </>
            ) : (
              'Vous avez dévié de la ligne cible. Choisissez une ligne de refuge ou continuez en exploration libre :'
            )}
          </p>

          {/* Refuge Openings */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Changer de ligne (Refuges)
            </p>
            {refugeOpenings.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                Aucune ouverture du catalogue ne correspond à cette séquence exacte.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                {refugeOpenings.map((opening) => (
                  <button
                    key={opening.id}
                    type="button"
                    onClick={() => switchToRefugeOpening(opening)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/50 transition-colors flex items-center gap-2"
                  >
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-amber-300 border border-slate-700 shrink-0">
                      {opening.eco}
                    </span>
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {opening.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Continue with popular Lichess moves */}
          <button
            type="button"
            onClick={continueWithPopularMoves}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Continuer via coups populaires
          </button>
        </div>
      ) : isFreeExploreMode ? (
        <div className="rounded-xl p-3 bg-blue-500/10 border border-blue-500/40 space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
              <Compass className="w-3.5 h-3.5" />
              Exploration libre
            </span>
            <span className="text-[11px] text-blue-200/80">Lichess Explorer</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            L’ordinateur répond avec les coups les plus populaires sur Lichess.
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

      {/* Lichess Explorer Stats & Connection Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            Lichess ({databaseSource === 'masters' ? 'Maîtres' : '1000–1400'})
          </h3>
          <div className="flex items-center gap-1.5">
            {isLoadingStats && (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            )}
            {statusBadge}
            <button
              type="button"
              onClick={() => setShowTokenInput((v) => !v)}
              title="Configurer le Token API Lichess"
              className={`p-1 rounded-md border transition-colors ${
                lichessToken
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3 h-3" />
            </button>
          </div>
        </div>

        {(showTokenInput || lichessStatus === 'auth_error') && (
          <div className="mb-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <label className="block text-[11px] font-semibold text-slate-300">
              Token API Lichess (optionnel)
            </label>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder="lip_xxxxxxxxxxxxxxxx..."
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setLichessToken(tokenDraft)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 transition-colors shrink-0"
              >
                Enregistrer
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">
              Stocké localement (<code className="text-slate-400">localStorage</code>) et envoyé en en-tête{' '}
              <code className="text-slate-400">Authorization: Bearer</code> vers{' '}
              <code className="text-slate-400">explorer.lichess.org</code>.
            </p>
          </div>
        )}

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

            <div className="divide-y divide-slate-800/70 max-h-60 overflow-y-auto">
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
                  !isOutOfTargetLine &&
                  !isFreeExploreMode &&
                  expectedBookMoveSan === move.san;

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
