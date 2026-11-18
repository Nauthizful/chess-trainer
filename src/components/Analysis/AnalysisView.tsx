import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Dumbbell,
  Eye,
  FolderInput,
  GraduationCap,
  Loader2,
  RotateCcw,
  Swords,
  Undo2,
  XCircle,
} from 'lucide-react';
import {
  analyzePgnGame,
  evaluateSingleFen,
  formatEvalScore,
  type AnalyzedGameResult,
} from '../../services/stockfishAnalyzer';
import {
  GameImporter,
  getStoredMyUsername,
  type ImportGameMetadata,
} from './GameImporter';
import { ChessBoard } from '../ChessBoard';
import { EvalBar } from './EvalBar';
import { EvalGraph } from './EvalGraph';
import { PlayerBanner } from '../common/PlayerBanner';
import {
  computeMaterialAndCaptures,
  INITIAL_FEN,
  parseUci,
} from '../../utils/chessHelpers';
import type {
  AnalyzedMove,
  BoardArrow,
  MoveClassification,
  PlayerColor,
  PositionEval,
  SquarePair,
} from '../../types';

const MY_USERNAME_STORAGE_KEY = 'chess-trainer-my-username';

interface SandboxStep {
  fen: string;
  lastMove: SquarePair;
  san: string;
  eval: PositionEval | null;
}

const CLASSIFICATION_META: Record<
  MoveClassification,
  {
    label: string;
    symbol: string;
    badgeClass: string;
    cardBorderClass: string;
    dotClass: string;
  }
> = {
  book: {
    label: 'Théorie',
    symbol: '📖',
    badgeClass: 'bg-amber-900/45 text-amber-200 border-amber-600/55',
    cardBorderClass: 'border-amber-500/45',
    dotClass: 'bg-amber-400',
  },
  best: {
    label: 'Meilleur coup',
    symbol: '★',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45',
    cardBorderClass: 'border-emerald-500/50',
    dotClass: 'bg-emerald-400',
  },
  excellent: {
    label: 'Excellent coup',
    symbol: '!!',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/45',
    cardBorderClass: 'border-cyan-500/45',
    dotClass: 'bg-cyan-400',
  },
  good: {
    label: 'Bon coup',
    symbol: '✓',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
    cardBorderClass: 'border-teal-500/45',
    dotClass: 'bg-teal-400',
  },
  inaccuracy: {
    label: 'Imprécision',
    symbol: '?!',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/45',
    cardBorderClass: 'border-amber-500/50',
    dotClass: 'bg-yellow-400',
  },
  mistake: {
    label: 'Erreur',
    symbol: '?',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/45',
    cardBorderClass: 'border-orange-500/55',
    dotClass: 'bg-orange-400',
  },
  blunder: {
    label: 'Gaffe',
    symbol: '??',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/45',
    cardBorderClass: 'border-rose-500/60',
    dotClass: 'bg-rose-500',
  },
  missed_win: {
    label: 'Gain manqué',
    symbol: '⚡',
    badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/45',
    cardBorderClass: 'border-amber-500/55',
    dotClass: 'bg-amber-400',
  },
};

export const AnalysisView: React.FC = () => {
  const [depth, setDepth] = useState(13);
  const [myUsername, setMyUsername] = useState<string>(() =>
    getStoredMyUsername()
  );
  const [userColor, setUserColor] = useState<PlayerColor>('w');
  const [boardOrientation, setBoardOrientation] = useState<PlayerColor>('w');
  const [showImporter, setShowImporter] = useState(true);
  const [playersMeta, setPlayersMeta] = useState<{
    whiteName: string;
    blackName: string;
    detectedSide: PlayerColor | null;
  } | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzedGameResult | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const activeMoveBtnRef = useRef<HTMLButtonElement | null>(null);

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

  // Keyboard navigation (ArrowLeft / ArrowRight / ArrowUp / ArrowDown)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!analysis || isExerciseMode) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSandboxHistory([]);
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSandboxHistory([]);
        setCurrentPly((p) => Math.min(analysis.moves.length, p + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSandboxHistory([]);
        setCurrentPly(0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSandboxHistory([]);
        setCurrentPly(analysis.moves.length);
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
    setBoardOrientation(color);
    setShowImporter(false);
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
          setBoardOrientation('w');
        } else if (hBlack && hBlack.toLowerCase() === cleanMy) {
          detected = 'b';
          setUserColor('b');
          setBoardOrientation('b');
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
      san: moveRes.san,
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

  useEffect(() => {
    if (!isInSandbox && activeMoveBtnRef.current) {
      activeMoveBtnRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [currentPly, isInSandbox]);

  const material = useMemo(
    () => computeMaterialAndCaptures(boardProps.fen),
    [boardProps.fen]
  );

  const topColor: PlayerColor = boardOrientation === 'w' ? 'b' : 'w';
  const bottomColor: PlayerColor = boardOrientation;

  const getBannerProps = (side: PlayerColor) => {
    const isWhite = side === 'w';
    const name = isWhite
      ? playersMeta?.whiteName ?? 'Blancs'
      : playersMeta?.blackName ?? 'Noirs';
    const rating = isWhite
      ? analysis?.headers.WhiteElo
      : analysis?.headers.BlackElo;
    const capturedPieces = isWhite
      ? material.capturedByWhite
      : material.capturedByBlack;
    const adv = isWhite
      ? Math.max(0, material.whiteAdvantage)
      : Math.max(0, -material.whiteAdvantage);
    return {
      name,
      color: side,
      rating,
      isUser: playersMeta?.detectedSide === side,
      capturedPieces,
      materialAdvantage: adv,
    };
  };

  const handleTestPunishment = () => {
    if (!currentAnalyzedMove?.punishmentUci) return;
    const parsed = parseUci(currentAnalyzedMove.punishmentUci);
    if (!parsed) return;
    void handleSandboxMove(parsed.from, parsed.to, parsed.promotion);
  };

  const canGoBack = Boolean(analysis && (currentPly > 0 || isInSandbox));
  const canGoForward = Boolean(
    analysis && !isInSandbox && currentPly < analysis.moves.length
  );

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-4.75rem)] lg:overflow-hidden">
      {/* Left Column (~60-65%): Player Banners + EvalBar + Large ChessBoard + Media Controls */}
      <section className="flex-1 min-w-0 flex flex-col items-center justify-center gap-2.5">
        <div className="w-full max-w-[min(74vh,660px)] flex flex-col gap-2">
          {/* Top Player Banner */}
          <PlayerBanner {...getBannerProps(topColor)} />

          {/* Sandbox Exploration Banner */}
          {isInSandbox && (
            <div className="rounded-xl p-2.5 bg-blue-500/15 border border-blue-500/45 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
                <Compass className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  Exploration ({sandboxHistory.map((s) => s.san).join(' ')})
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
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxHistory([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500 hover:bg-blue-400 text-slate-950"
                >
                  <RotateCcw className="w-3 h-3" />
                  Revenir
                </button>
              </div>
            </div>
          )}

          {/* EvalBar + Large ChessBoard */}
          <div className="flex items-stretch gap-2.5 w-full">
            <EvalBar
              whiteWinPct={boardProps.whiteWinPct}
              scoreLabel={boardProps.scoreLabel}
              orientation={boardOrientation}
            />
            <div className="flex-1 min-w-0">
              <ChessBoard
                fen={boardProps.fen}
                orientation={boardOrientation}
                interactive={boardProps.interactive}
                allowedColor="turn"
                lastMove={boardProps.lastMove}
                arrows={(() => {
                  if (boardProps.hideArrows) return [];
                  const list: BoardArrow[] = [];
                  const best = parseUci(boardProps.bestMoveUci);
                  if (best) {
                    list.push({
                      from: best.from,
                      to: best.to,
                      color: 'green',
                      label: 'Meilleur',
                    });
                  }
                  const punish = parseUci(boardProps.punishmentUci);
                  if (punish) {
                    list.push({
                      from: punish.from,
                      to: punish.to,
                      color: 'red',
                      label: 'Punition',
                    });
                  }
                  return list;
                })()}
                moveBadges={boardProps.moveBadge ? [boardProps.moveBadge] : []}
                size="lg"
                maxWidthClass="max-w-none"
                onMove={
                  isExerciseMode ? handleExerciseAttempt : handleSandboxMove
                }
              />
            </div>
          </div>

          {/* Bottom Player Banner */}
          <PlayerBanner {...getBannerProps(bottomColor)} />

          {/* Media Control Bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 shadow-sm">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => jumpToPlyClean(0)}
                disabled={!canGoBack || isExerciseMode}
                title="Début de partie (↑)"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
              >
                <ChevronFirst className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => jumpToPlyClean(Math.max(0, currentPly - 1))}
                disabled={!canGoBack || isExerciseMode}
                title="Coup précédent (←)"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  analysis &&
                  jumpToPlyClean(Math.min(analysis.moves.length, currentPly + 1))
                }
                disabled={!canGoForward || isExerciseMode}
                title="Coup suivant (→)"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  analysis && jumpToPlyClean(analysis.moves.length)
                }
                disabled={!canGoForward || isExerciseMode}
                title="Fin de partie (↓)"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
              >
                <ChevronLast className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {analysis && (
                <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
                  Coup {currentPly}/{analysis.moves.length}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setBoardOrientation((o) => (o === 'w' ? 'b' : 'w'))
                }
                title="Retourner l'échiquier"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Retourner</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Right Column (~35-40%): EvalGraph + Coach Card + Scrollable Move List / Importer */}
      <section className="w-full lg:w-[400px] xl:w-[440px] lg:min-w-[380px] lg:h-full flex flex-col gap-3 min-h-0">
        {/* Engine + Import Toggle Header */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-3 shadow-lg space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <select
                value={depth}
                disabled={isAnalyzing}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={12}>Stockfish Prof. 12</option>
                <option value={13}>Stockfish Prof. 13</option>
                <option value={14}>Stockfish Prof. 14</option>
              </select>
            </div>

            {analysis && (
              <button
                type="button"
                onClick={() => setShowImporter((s) => !s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  showImporter
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <FolderInput className="w-3.5 h-3.5" />
                {showImporter ? 'Voir l’analyse' : 'Importer une partie'}
              </button>
            )}
          </div>

          {isAnalyzing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-emerald-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyse Stockfish en cours...
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

        {/* Importer Panel (shown initially or when toggled) */}
        {(showImporter || !analysis) && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            <GameImporter
              isAnalyzing={isAnalyzing}
              myUsername={myUsername}
              onChangeMyUsername={handleChangeMyUsername}
              onImportGame={handleImportGame}
            />
          </div>
        )}

        {/* Analysis Content: EvalGraph + Coach Card + Scrollable Move List */}
        {analysis && !showImporter && (
          <>
            {isExerciseMode && activeExerciseMove ? (
              <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-4 shadow-xl space-y-3 shrink-0">
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
                        {prevOppMoveForExercise.san}
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
                      {activeExerciseMove.san}
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
                      {activeExerciseMove.evalBefore.bestMoveSan ?? ''}
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
              <>
                <div className="shrink-0">
                  <EvalGraph
                    evals={analysis.evals}
                    moves={analysis.moves}
                    currentPly={currentPly}
                    onSelectPly={jumpToPlyClean}
                  />
                </div>

                {/* Highlighted Coach Card */}
                {isInSandbox && latestSandboxStep ? (
                  <div className="rounded-2xl p-4 bg-slate-900 border border-blue-500/50 shadow-lg space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-blue-200">
                        Exploration : {latestSandboxStep.san}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700">
                        {latestSandboxStep.eval
                          ? formatEvalScore(
                              latestSandboxStep.eval.cp,
                              latestSandboxStep.eval.mate
                            )
                          : 'Calcul...'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {latestSandboxStep.eval?.bestMoveSan
                        ? `Meilleure réplique Stockfish : ${latestSandboxStep.eval.bestMoveSan}.`
                        : 'Évaluation Stockfish en cours...'}
                    </p>
                  </div>
                ) : currentAnalyzedMove ? (
                  <div
                    className={`rounded-2xl p-4 bg-slate-900 border-2 shadow-lg space-y-3 shrink-0 ${
                      CLASSIFICATION_META[currentAnalyzedMove.classification]
                        .cardBorderClass
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-base font-extrabold text-slate-100">
                          {currentAnalyzedMove.moveNumber}
                          {currentAnalyzedMove.color === 'w' ? '. ' : '... '}
                          {currentAnalyzedMove.san}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            CLASSIFICATION_META[
                              currentAnalyzedMove.classification
                            ].badgeClass
                          }`}
                        >
                          <span>
                            {
                              CLASSIFICATION_META[
                                currentAnalyzedMove.classification
                              ].symbol
                            }
                          </span>
                          <span>
                            {
                              CLASSIFICATION_META[
                                currentAnalyzedMove.classification
                              ].label
                            }
                          </span>
                        </span>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-slate-950 text-slate-100 border border-slate-700 shrink-0">
                        {currentAnalyzedMove.scoreLabel}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-sm text-slate-200 leading-relaxed">
                      <GraduationCap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <p>{currentAnalyzedMove.coachExplanation}</p>
                    </div>

                    {(currentAnalyzedMove.punishmentUci ||
                      errorMoves.length > 0) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {currentAnalyzedMove.punishmentUci && (
                          <button
                            type="button"
                            onClick={handleTestPunishment}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/40 transition-colors"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            Tester la punition
                          </button>
                        )}
                        {errorMoves.length > 0 && (
                          <button
                            type="button"
                            onClick={startExerciseMode}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors"
                          >
                            <Dumbbell className="w-3.5 h-3.5" />
                            Répéter mes erreurs ({errorMoves.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 bg-slate-900 border border-slate-700/60 text-sm text-slate-300 leading-relaxed shrink-0">
                    Position initiale — utilisez les flèches du clavier, cliquez sur un coup ou jouez une variante sur l’échiquier.
                  </div>
                )}

                {/* Scrollable 2-Column Move List */}
                <div className="flex-1 min-h-0 bg-slate-900 border border-slate-700/60 rounded-2xl p-2.5 overflow-y-auto space-y-1">
                  {movePairs.map((pair) => (
                    <div
                      key={pair.num}
                      className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 text-xs"
                    >
                      <span className="font-mono text-slate-500 text-right pr-1.5">
                        {pair.num}.
                      </span>

                      {pair.white ? (
                        <button
                          ref={
                            !isInSandbox && currentPly === pair.white.ply
                              ? activeMoveBtnRef
                              : undefined
                          }
                          type="button"
                          onClick={() => jumpToPlyClean(pair.white!.ply)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg font-mono font-semibold transition-colors ${
                            !isInSandbox && currentPly === pair.white.ply
                              ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                              : 'text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                CLASSIFICATION_META[pair.white.classification]
                                  .dotClass
                              }`}
                            />
                            {pair.white.san}
                          </span>
                          <span className="text-[10px] opacity-85 ml-1">
                            {CLASSIFICATION_META[pair.white.classification].symbol}
                          </span>
                        </button>
                      ) : (
                        <span />
                      )}

                      {pair.black ? (
                        <button
                          ref={
                            !isInSandbox && currentPly === pair.black.ply
                              ? activeMoveBtnRef
                              : undefined
                          }
                          type="button"
                          onClick={() => jumpToPlyClean(pair.black!.ply)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg font-mono font-semibold transition-colors ${
                            !isInSandbox && currentPly === pair.black.ply
                              ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                              : 'text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                CLASSIFICATION_META[pair.black.classification]
                                  .dotClass
                              }`}
                            />
                            {pair.black.san}
                          </span>
                          <span className="text-[10px] opacity-85 ml-1">
                            {CLASSIFICATION_META[pair.black.classification].symbol}
                          </span>
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
};
