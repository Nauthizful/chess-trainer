import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Dumbbell,
  Eye,
  GraduationCap,
  Loader2,
  RotateCcw,
  Undo2,
  XCircle,
} from 'lucide-react';
import {
  analyzePgnGame,
  evaluateSingleFen,
  formatEvalScore,
  type AnalyzedGameResult,
} from '../../services/stockfishAnalyzer';
import { toFrenchSan } from '../../utils/tacticalExplainer';
import {
  GameImporter,
  getStoredMyUsername,
  type ImportGameMetadata,
} from './GameImporter';
import { AnalysisBoard } from './AnalysisBoard';
import { EvalGraph } from './EvalGraph';
import type {
  AnalyzedMove,
  MoveClassification,
  PlayerColor,
  PositionEval,
  SquarePair,
} from '../../types';

const MY_USERNAME_STORAGE_KEY = 'chess-trainer-my-username';
const INITIAL_FEN = new Chess().fen();

interface SandboxStep {
  fen: string;
  lastMove: SquarePair;
  san: string;
  eval: PositionEval | null;
}

const CLASSIFICATION_META: Record<
  MoveClassification,
  { label: string; symbol: string; badgeClass: string }
> = {
  book: {
    label: 'Théorie',
    symbol: '📖',
    badgeClass: 'bg-amber-900/45 text-amber-200 border-amber-600/55',
  },
  best: {
    label: 'Meilleur coup',
    symbol: '★',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45',
  },
  excellent: {
    label: 'Excellent coup',
    symbol: '!!',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/45',
  },
  good: {
    label: 'Bon coup',
    symbol: '✓',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
  },
  inaccuracy: {
    label: 'Imprécision',
    symbol: '?!',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/45',
  },
  mistake: {
    label: 'Erreur',
    symbol: '?',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/45',
  },
  blunder: {
    label: 'Gaffe',
    symbol: '??',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/45',
  },
  missed_win: {
    label: 'Gain manqué',
    symbol: '⚡',
    badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/45',
  },
};

export const AnalysisView: React.FC = () => {
  const [depth, setDepth] = useState(13);
  const [myUsername, setMyUsername] = useState<string>(() =>
    getStoredMyUsername()
  );
  const [userColor, setUserColor] = useState<PlayerColor>('w');
  const [playersMeta, setPlayersMeta] = useState<{
    whiteName: string;
    blackName: string;
    detectedSide: PlayerColor | null;
  } | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzedGameResult | null>(null);
  const [currentPly, setCurrentPly] = useState(0);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Interactive Sandbox Exploration state
  const [sandboxHistory, setSandboxHistory] = useState<SandboxStep[]>([]);
  const [isEvaluatingSandbox, setIsEvaluatingSandbox] = useState(false);
  const sandboxEvalSeqRef = useRef(0);

  // Interactive "Retry mistakes" exercise state
  const [isExerciseMode, setIsExerciseMode] = useState(false);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [exerciseReady, setExerciseReady] = useState(true);
  const [exerciseStatus, setExerciseStatus] = useState<
    'awaiting' | 'solved' | 'wrong'
  >('awaiting');
  const [exerciseRevealSolution, setExerciseRevealSolution] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const errorMoves: AnalyzedMove[] = useMemo(() => {
    if (!analysis) return [];
    return analysis.moves.filter(
      (m) =>
        m.color === userColor &&
        (m.classification === 'mistake' ||
          m.classification === 'blunder' ||
          m.classification === 'missed_win')
    );
  }, [analysis, userColor]);

  const jumpToPlyClean = (ply: number) => {
    setSandboxHistory([]);
    setCurrentPly(ply);
  };

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!analysis || isExerciseMode) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSandboxHistory([]);
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSandboxHistory([]);
        setCurrentPly((p) => Math.min(analysis.moves.length, p + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [analysis, isExerciseMode]);

  const activeExerciseMove = isExerciseMode
    ? errorMoves[exerciseIdx] ?? null
    : null;

  const prevOppMoveForExercise: AnalyzedMove | null = useMemo(() => {
    if (!analysis || !activeExerciseMove || activeExerciseMove.ply <= 1) {
      return null;
    }
    return analysis.moves[activeExerciseMove.ply - 2] ?? null;
  }, [analysis, activeExerciseMove]);

  // Play opponent's preceding move after 350ms delay to give full visual context
  useEffect(() => {
    if (!isExerciseMode || !activeExerciseMove) return;
    if (!prevOppMoveForExercise) {
      setExerciseReady(true);
      return;
    }
    setExerciseReady(false);
    const timer = setTimeout(() => {
      setExerciseReady(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [isExerciseMode, activeExerciseMove, prevOppMoveForExercise]);

  const handleChangeMyUsername = (name: string) => {
    setMyUsername(name);
    try {
      localStorage.setItem(MY_USERNAME_STORAGE_KEY, name);
    } catch {
      // Ignore storage errors
    }
  };

  const handleImportGame = async (
    pgn: string,
    color: PlayerColor,
    meta?: ImportGameMetadata
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setUserColor(color);
    setPlayersMeta({
      whiteName: meta?.whiteName ?? 'Blancs',
      blackName: meta?.blackName ?? 'Noirs',
      detectedSide: meta?.detectedUserSide ?? null,
    });
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsExerciseMode(false);
    setSandboxHistory([]);
    setProgress({ completed: 0, total: 0 });

    try {
      const result = await analyzePgnGame(pgn, {
        depth,
        signal: controller.signal,
        onProgress: (completed, total) => {
          setProgress({ completed, total });
        },
      });
      setAnalysis(result);

      const hWhite = result.headers.White?.trim();
      const hBlack = result.headers.Black?.trim();
      const cleanMy = myUsername.trim().toLowerCase();
      let detected: PlayerColor | null = meta?.detectedUserSide ?? null;
      if (cleanMy) {
        if (hWhite && hWhite.toLowerCase() === cleanMy) {
          detected = 'w';
          setUserColor('w');
        } else if (hBlack && hBlack.toLowerCase() === cleanMy) {
          detected = 'b';
          setUserColor('b');
        }
      }
      if (hWhite || hBlack) {
        setPlayersMeta({
          whiteName: hWhite || meta?.whiteName || 'Blancs',
          blackName: hBlack || meta?.blackName || 'Noirs',
          detectedSide: detected,
        });
      }
      setCurrentPly(result.moves.length > 0 ? 1 : 0);
    } catch (err) {
      if (!controller.signal.aborted) {
        setAnalysisError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de l’analyse Stockfish.'
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
      }
    }
  };

  const startExerciseMode = () => {
    if (errorMoves.length === 0) return;
    setSandboxHistory([]);
    setIsExerciseMode(true);
    setExerciseIdx(0);
    setExerciseStatus('awaiting');
    setExerciseRevealSolution(false);
  };

  const currentAnalyzedMove: AnalyzedMove | null =
    analysis && currentPly > 0 ? analysis.moves[currentPly - 1] ?? null : null;

  const isInSandbox = !isExerciseMode && sandboxHistory.length > 0;
  const latestSandboxStep = isInSandbox
    ? sandboxHistory[sandboxHistory.length - 1]
    : null;

  const handleSandboxMove = async (
    from: string,
    to: string,
    promotion?: string
  ) => {
    if (isAnalyzing) return;
    const baseFen = latestSandboxStep
      ? latestSandboxStep.fen
      : currentAnalyzedMove
      ? currentAnalyzedMove.fenAfter
      : INITIAL_FEN;

    const chess = new Chess(baseFen);
    let moveRes;
    try {
      moveRes = chess.move({ from, to, promotion });
    } catch {
      return;
    }
    if (!moveRes) return;

    const newFen = chess.fen();
    const newStep: SandboxStep = {
      fen: newFen,
      lastMove: { from: moveRes.from, to: moveRes.to },
      san: toFrenchSan(moveRes.san),
      eval: null,
    };

    const nextIdx = sandboxHistory.length;
    setSandboxHistory((prev) => [...prev, newStep]);
    setIsEvaluatingSandbox(true);

    const evalSeq = ++sandboxEvalSeqRef.current;
    try {
      const posEval = await evaluateSingleFen(newFen, Math.min(depth, 12));
      if (evalSeq !== sandboxEvalSeqRef.current) return;
      setSandboxHistory((prev) =>
        prev.map((step, i) => (i === nextIdx ? { ...step, eval: posEval } : step))
      );
    } finally {
      if (evalSeq === sandboxEvalSeqRef.current) {
        setIsEvaluatingSandbox(false);
      }
    }
  };

  const handleExerciseAttempt = (
    from: string,
    to: string,
    promotion?: string
  ) => {
    if (!activeExerciseMove || !exerciseReady || exerciseStatus === 'solved') {
      return;
    }
    const chess = new Chess(activeExerciseMove.fenBefore);
    let moveRes;
    try {
      moveRes = chess.move({ from, to, promotion });
    } catch {
      return;
    }
    if (!moveRes) return;

    const uci = `${moveRes.from}${moveRes.to}${moveRes.promotion ?? ''}`;
    if (uci === activeExerciseMove.bestMoveUci) {
      setExerciseStatus('solved');
      setExerciseRevealSolution(true);
    } else {
      setExerciseStatus('wrong');
    }
  };

  const boardProps = useMemo(() => {
    // 1. Exercise Mode ("Répéter les erreurs")
    if (activeExerciseMove) {
      if (!exerciseReady && prevOppMoveForExercise) {
        return {
          fen: prevOppMoveForExercise.fenBefore,
          whiteWinPct: prevOppMoveForExercise.evalBefore.whiteWinPct,
          scoreLabel: formatEvalScore(
            prevOppMoveForExercise.evalBefore.cp,
            prevOppMoveForExercise.evalBefore.mate
          ),
          lastMove: null,
          bestMoveUci: null,
          punishmentUci: null,
          moveBadge: null,
          hideArrows: true,
          interactive: false,
        };
      }

      return {
        fen: activeExerciseMove.fenBefore,
        whiteWinPct: activeExerciseMove.evalBefore.whiteWinPct,
        scoreLabel: formatEvalScore(
          activeExerciseMove.evalBefore.cp,
          activeExerciseMove.evalBefore.mate
        ),
        lastMove: prevOppMoveForExercise
          ? {
              from: prevOppMoveForExercise.from,
              to: prevOppMoveForExercise.to,
            }
          : null,
        bestMoveUci: exerciseRevealSolution
          ? activeExerciseMove.bestMoveUci
          : null,
        punishmentUci: null,
        moveBadge: null,
        hideArrows: !exerciseRevealSolution,
        interactive: exerciseReady && exerciseStatus !== 'solved',
      };
    }

    // 2. Interactive Sandbox Exploration Mode
    if (latestSandboxStep) {
      const ev = latestSandboxStep.eval;
      return {
        fen: latestSandboxStep.fen,
        whiteWinPct: ev?.whiteWinPct ?? 50,
        scoreLabel: ev ? formatEvalScore(ev.cp, ev.mate) : '...',
        lastMove: latestSandboxStep.lastMove,
        bestMoveUci: ev?.bestMoveUci ?? null,
        punishmentUci: null,
        moveBadge: null,
        hideArrows: false,
        interactive: !isAnalyzing,
      };
    }

    // 3. No game loaded yet (allow free sandbox from start too!)
    if (!analysis) {
      return {
        fen: INITIAL_FEN,
        whiteWinPct: 50,
        scoreLabel: '0.0',
        lastMove: null,
        bestMoveUci: null,
        punishmentUci: null,
        moveBadge: null,
        hideArrows: true,
        interactive: !isAnalyzing,
      };
    }

    // 4. Game Review at Ply 0
    if (currentPly === 0) {
      const ev0 = analysis.evals[0];
      return {
        fen: INITIAL_FEN,
        whiteWinPct: ev0?.whiteWinPct ?? 50,
        scoreLabel: ev0 ? formatEvalScore(ev0.cp, ev0.mate) : '0.0',
        lastMove: null,
        bestMoveUci: ev0?.bestMoveUci ?? null,
        punishmentUci: null,
        moveBadge: null,
        hideArrows: false,
        interactive: !isAnalyzing,
      };
    }

    // 5. Game Review at Analyzed Move
    const mv = currentAnalyzedMove!;
    return {
      fen: mv.fenAfter,
      whiteWinPct: mv.evalAfter.whiteWinPct,
      scoreLabel: mv.scoreLabel,
      lastMove: { from: mv.from, to: mv.to },
      bestMoveUci: mv.bestMoveUci,
      punishmentUci: mv.punishmentUci,
      moveBadge: { square: mv.to, classification: mv.classification },
      hideArrows: false,
      interactive: !isAnalyzing,
    };
  }, [
    analysis,
    currentPly,
    currentAnalyzedMove,
    activeExerciseMove,
    exerciseReady,
    prevOppMoveForExercise,
    exerciseRevealSolution,
    exerciseStatus,
    latestSandboxStep,
    isAnalyzing,
  ]);

  const movePairs = useMemo(() => {
    if (!analysis) return [];
    const pairs: Array<{
      num: number;
      white?: AnalyzedMove;
      black?: AnalyzedMove;
    }> = [];
    for (let i = 0; i < analysis.moves.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: analysis.moves[i],
        black: analysis.moves[i + 1],
      });
    }
    return pairs;
  }, [analysis]);

  const progressPct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Importer & Depth Settings */}
      <section className="lg:col-span-4 xl:col-span-3 space-y-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Moteur Stockfish WASM
            </span>
            <select
              value={depth}
              disabled={isAnalyzing}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={12}>Profondeur 12 (Rapide)</option>
              <option value={13}>Profondeur 13 (Équilibrée)</option>
              <option value={14}>Profondeur 14 (Précise)</option>
            </select>
          </div>

          {isAnalyzing && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-emerald-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyse en cours...
                </span>
                <span className="font-mono">
                  {progress.completed}/{progress.total} ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {analysisError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}
        </div>

        <GameImporter
          isAnalyzing={isAnalyzing}
          myUsername={myUsername}
          onChangeMyUsername={handleChangeMyUsername}
          onImportGame={handleImportGame}
        />
      </section>

      {/* Center Column: Eval Bar + Board + Sandbox Banner + Navigation */}
      <section className="lg:col-span-8 xl:col-span-5 flex flex-col items-center space-y-3">
        <div className="w-full max-w-[590px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          {playersMeta ? (
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-semibold text-slate-100 truncate">
                {playersMeta.whiteName}
              </span>
              {playersMeta.detectedSide === 'w' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                  Vous
                </span>
              )}
              <span className="text-slate-500">vs</span>
              <span className="font-semibold text-slate-200 truncate">
                {playersMeta.blackName}
              </span>
              {playersMeta.detectedSide === 'b' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                  Vous
                </span>
              )}
            </div>
          ) : (
            <span className="font-semibold text-slate-400">
              Aucune partie chargée
            </span>
          )}
          <span className="text-[11px] text-slate-400 shrink-0">
            Orientation : {userColor === 'w' ? 'Blancs' : 'Noirs'}
          </span>
        </div>

        {/* Sandbox Exploration Banner */}
        {isInSandbox && (
          <div className="w-full max-w-[590px] rounded-xl p-2.5 bg-blue-500/15 border border-blue-500/45 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
              <Compass className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Mode Exploration libre (
                {sandboxHistory.map((s) => s.san).join(' ')})
              </span>
              {isEvaluatingSandbox && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setSandboxHistory((prev) => prev.slice(0, -1))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                <Undo2 className="w-3 h-3" />
                Annuler le coup exploré
              </button>
              <button
                type="button"
                onClick={() => setSandboxHistory([])}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500 hover:bg-blue-400 text-slate-950"
              >
                <RotateCcw className="w-3 h-3" />
                Revenir à la partie
              </button>
            </div>
          </div>
        )}

        <AnalysisBoard
          fen={boardProps.fen}
          orientation={userColor}
          whiteWinPct={boardProps.whiteWinPct}
          scoreLabel={boardProps.scoreLabel}
          lastMove={boardProps.lastMove}
          bestMoveUci={boardProps.bestMoveUci}
          punishmentUci={boardProps.punishmentUci}
          moveBadge={boardProps.moveBadge}
          hideArrows={boardProps.hideArrows}
          interactive={boardProps.interactive}
          onPlayMove={
            isExerciseMode ? handleExerciseAttempt : handleSandboxMove
          }
        />

        {/* Navigation / Legend */}
        {analysis && !isExerciseMode && (
          <div className="w-full max-w-[590px] flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => jumpToPlyClean(0)}
                disabled={currentPly === 0 && !isInSandbox}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 border border-slate-700"
              >
                <ChevronFirst className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => jumpToPlyClean(Math.max(0, currentPly - 1))}
                disabled={currentPly === 0 && !isInSandbox}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 border border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  jumpToPlyClean(Math.min(analysis.moves.length, currentPly + 1))
                }
                disabled={currentPly >= analysis.moves.length && !isInSandbox}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 border border-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => jumpToPlyClean(analysis.moves.length)}
                disabled={currentPly >= analysis.moves.length && !isInSandbox}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 border border-slate-700"
              >
                <ChevronLast className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Meilleur coup
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-red-500 inline-block" />
                Punition
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Right Column: Coach Panel, Eval Curve & Moves */}
      <section className="lg:col-span-12 xl:col-span-4 space-y-4">
        {!analysis ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-2 shadow-xl">
            <GraduationCap className="w-9 h-9 text-emerald-400 mx-auto" />
            <h2 className="text-sm font-bold text-slate-100">
              Coach Tactique Stockfish
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Importez une partie via votre pseudo Lichess ou collez un PGN à gauche pour obtenir une analyse complète coup par coup, ou manipulez directement l’échiquier en bac à sable.
            </p>
          </div>
        ) : isExerciseMode && activeExerciseMove ? (
          /* Interactive Retry Mistakes Mode */
          <div className="bg-slate-900/90 border border-amber-500/45 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Dumbbell className="w-4 h-4" />
                Exercice : Corriger mes erreurs
              </span>
              <span className="text-xs font-mono text-slate-300">
                {exerciseIdx + 1} / {errorMoves.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
              {prevOppMoveForExercise ? (
                <p className="text-slate-200">
                  Les {prevOppMoveForExercise.color === 'w' ? 'Blancs' : 'Noirs'}{' '}
                  viennent de jouer{' '}
                  <strong className="font-mono text-amber-300">
                    {prevOppMoveForExercise.color === 'b' ? '...' : ''}
                    {prevOppMoveForExercise.frenchSan}
                  </strong>
                  . À vous de trouver le meilleur coup !
                </p>
              ) : (
                <p className="text-slate-200">
                  Début de partie : à vous de trouver le meilleur coup !
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                Dans la partie, vous aviez joué{' '}
                <span className="font-mono text-rose-300">
                  {activeExerciseMove.frenchSan}
                </span>{' '}
                ({CLASSIFICATION_META[activeExerciseMove.classification].label.toLowerCase()}).
              </p>
            </div>

            {exerciseStatus === 'wrong' && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                Ce n’est pas le meilleur coup, essayez encore !
              </div>
            )}

            {exerciseStatus === 'solved' && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/45 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Bravo ! Vous avez trouvé{' '}
                  {activeExerciseMove.evalBefore.bestMoveSan
                    ? toFrenchSan(activeExerciseMove.evalBefore.bestMoveSan)
                    : ''}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {activeExerciseMove.coachExplanation}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExerciseRevealSolution(true)}
                disabled={exerciseRevealSolution}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-slate-200 border border-slate-700"
              >
                <Eye className="w-3.5 h-3.5" />
                Voir la solution
              </button>

              {exerciseIdx < errorMoves.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setExerciseIdx((i) => i + 1);
                    setExerciseStatus('awaiting');
                    setExerciseRevealSolution(false);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                >
                  Erreur suivante
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsExerciseMode(false)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                >
                  Terminer
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsExerciseMode(false)}
              className="w-full py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
            >
              Revenir à la revue complète
            </button>
          </div>
        ) : (
          /* Normal Review Mode: Coach + Eval Curve + Moves */
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            <EvalGraph
              evals={analysis.evals}
              moves={analysis.moves}
              currentPly={currentPly}
              onSelectPly={jumpToPlyClean}
            />

            {/* Coach Explanation Card */}
            {isInSandbox && latestSandboxStep ? (
              <div className="rounded-xl p-3.5 bg-blue-500/10 border border-blue-500/35 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-200">
                    Exploration : {latestSandboxStep.san}
                  </span>
                  <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-900 text-slate-100 border border-slate-700">
                    {latestSandboxStep.eval
                      ? formatEvalScore(
                          latestSandboxStep.eval.cp,
                          latestSandboxStep.eval.mate
                        )
                      : 'Calcul...'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {latestSandboxStep.eval?.bestMoveSan
                    ? `Meilleure réplique Stockfish : ${toFrenchSan(
                        latestSandboxStep.eval.bestMoveSan
                      )}.`
                    : 'Évaluation Stockfish en cours...'}
                </p>
              </div>
            ) : currentAnalyzedMove ? (
              <div className="rounded-xl p-3.5 bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-100">
                      {currentAnalyzedMove.moveNumber}
                      {currentAnalyzedMove.color === 'w' ? '. ' : '... '}
                      {currentAnalyzedMove.frenchSan}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        CLASSIFICATION_META[currentAnalyzedMove.classification]
                          .badgeClass
                      }`}
                    >
                      <span>
                        {
                          CLASSIFICATION_META[currentAnalyzedMove.classification]
                            .symbol
                        }
                      </span>
                      <span>
                        {
                          CLASSIFICATION_META[currentAnalyzedMove.classification]
                            .label
                        }
                      </span>
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700">
                    {currentAnalyzedMove.scoreLabel}
                  </span>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed">
                  <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>{currentAnalyzedMove.coachExplanation}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                Position initiale — utilisez les flèches du clavier, cliquez sur un coup ou jouez une variante sur l’échiquier.
              </div>
            )}

            {/* Retry Mistakes CTA */}
            {errorMoves.length > 0 && (
              <button
                type="button"
                onClick={startExerciseMode}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-colors"
              >
                <Dumbbell className="w-4 h-4" />
                Répéter les erreurs de cette partie ({errorMoves.length})
              </button>
            )}

            {/* Analyzed Move List */}
            <div className="max-h-56 overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800 p-2 space-y-1">
              {movePairs.map((pair) => (
                <div
                  key={pair.num}
                  className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1 text-xs"
                >
                  <span className="font-mono text-slate-500 text-right pr-1.5">
                    {pair.num}.
                  </span>

                  {pair.white ? (
                    <button
                      type="button"
                      onClick={() => jumpToPlyClean(pair.white!.ply)}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg font-mono font-semibold transition-colors ${
                        !isInSandbox && currentPly === pair.white.ply
                          ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                          : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{pair.white.frenchSan}</span>
                      <span className="text-[10px]">
                        {CLASSIFICATION_META[pair.white.classification].symbol}
                      </span>
                    </button>
                  ) : (
                    <span />
                  )}

                  {pair.black ? (
                    <button
                      type="button"
                      onClick={() => jumpToPlyClean(pair.black!.ply)}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg font-mono font-semibold transition-colors ${
                        !isInSandbox && currentPly === pair.black.ply
                          ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                          : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{pair.black.frenchSan}</span>
                      <span className="text-[10px]">
                        {CLASSIFICATION_META[pair.black.classification].symbol}
                      </span>
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
