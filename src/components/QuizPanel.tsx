import React, { useMemo } from 'react';
import {
  ArrowRight,
  BookMarked,
  Brain,
  CheckCircle2,
  Eye,
  RotateCcw,
  StickyNote,
  Swords,
  XCircle,
} from 'lucide-react';
import { useChessStore } from '../store/useChessStore';
import { computeRepertoireGlobalStats } from '../utils/quizEngine';

export const QuizPanel: React.FC = () => {
  const {
    playerColor,
    userRepertoire,
    quizLines,
    quizLineIndex,
    quizStatus,
    quizShowSolution,
    quizLastNote,
    quizExpectedMove,
    quizWrongMovePlayed,
    setPlayerColor,
    startQuizSession,
    nextQuizLine,
    revealQuizSolution,
    retryQuizMove,
    setActiveTab,
  } = useChessStore();

  const activeTree =
    playerColor === 'w' ? userRepertoire.white : userRepertoire.black;

  const globalStats = useMemo(
    () => computeRepertoireGlobalStats(activeTree),
    [activeTree]
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Side Switcher */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
          <Brain className="w-3.5 h-3.5 text-amber-400" />
          Quiz Répertoire (Répétition espacée)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPlayerColor('w')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
              playerColor === 'w'
                ? 'bg-slate-100 text-slate-950 border-white shadow-md'
                : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-white border border-slate-400" />
            Blancs
          </button>
          <button
            type="button"
            onClick={() => setPlayerColor('b')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
              playerColor === 'b'
                ? 'bg-slate-800 text-white border-emerald-400 ring-1 ring-emerald-400/40'
                : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-slate-950 border border-slate-400" />
            Noirs
          </button>
        </div>
      </div>

      {/* Empty Repertoire Welcome State */}
      {quizStatus === 'empty_repertoire' || quizLines.length === 0 ? (
        <div className="rounded-xl p-4 bg-slate-950/70 border border-slate-800 text-center space-y-3">
          <BookMarked className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-100">
              Votre répertoire {playerColor === 'w' ? 'Blancs' : 'Noirs'} est vide
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ajoutez vos premières lignes depuis l’Explorateur ou créez-les manuellement pour lancer une session de révision.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('repertoire')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
          >
            <BookMarked className="w-3.5 h-3.5" />
            Aller dans Mon Répertoire
          </button>
        </div>
      ) : (
        <>
          {/* Session Progress & Global Stats */}
          <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                Ligne {quizLineIndex + 1} / {quizLines.length}
              </span>
              <span className="font-mono font-bold text-emerald-300">
                Réussite : {globalStats.successRate}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{
                  width: `${Math.round(
                    ((quizLineIndex + 1) / Math.max(1, quizLines.length)) * 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {globalStats.reviewedNodes}/{globalStats.totalNodes} coups révisés ({globalStats.totalAttempts} tentatives)
            </p>
          </div>

          {/* Feedback Card */}
          {quizStatus === 'awaiting_user' && (
            <div className="rounded-xl p-3 bg-slate-800/60 border border-slate-700 text-xs text-slate-200 flex items-center gap-2">
              <Swords className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Jouez le coup de votre répertoire sur l’échiquier (mode sans aide).
              </span>
            </div>
          )}

          {quizStatus === 'correct' && (
            <div className="rounded-xl p-3 bg-emerald-500/15 border border-emerald-500/45 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">Coup validé !</span>
            </div>
          )}

          {quizStatus === 'wrong' && (
            <div className="rounded-xl p-3 bg-rose-500/15 border border-rose-500/45 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-rose-200">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Coup hors répertoire :{' '}
                  <strong className="font-mono">{quizWrongMovePlayed}</strong>
                </span>
              </div>

              {quizShowSolution && quizExpectedMove && (
                <p className="text-xs text-emerald-300 font-medium">
                  Solution attendue :{' '}
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                    {quizExpectedMove.san}
                  </span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={revealQuizSolution}
                  disabled={quizShowSolution}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-45 text-emerald-200 border border-emerald-500/40 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Voir la solution
                </button>
                <button
                  type="button"
                  onClick={retryQuizMove}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {quizStatus === 'line_completed' && (
            <div className="rounded-xl p-3.5 bg-emerald-500/15 border border-emerald-500/45 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Branche terminée avec succès !
              </div>
              <button
                type="button"
                onClick={nextQuizLine}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
              >
                Ligne suivante
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Note Mémo revealed ONLY after validation */}
          {quizLastNote && (quizStatus === 'correct' || quizStatus === 'awaiting_user' || quizStatus === 'line_completed') && (
            <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/40 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" />
                Note mémo
              </span>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {quizLastNote}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => startQuizSession(playerColor)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Relancer la session Quiz
          </button>
        </>
      )}
    </div>
  );
};
