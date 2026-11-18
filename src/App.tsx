import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { BookMarked, Brain, Cpu, Crown, EyeOff, GitFork, GraduationCap, ShieldAlert, Swords } from 'lucide-react';
import { Board } from './components/Board';
import { OpeningSelector } from './components/OpeningSelector';
import { QuizPanel } from './components/QuizPanel';
import { MoveHistory } from './components/MoveHistory';
import { StatsPanel } from './components/StatsPanel';
import { HardwarePanel } from './components/HardwarePanel';
import { ExplorerView } from './components/Explorer/ExplorerView';
import { RepertoireView } from './components/Repertoire/RepertoireView';
import { AnalysisView } from './components/Analysis/AnalysisView';
import { PlayerBanner } from './components/common/PlayerBanner';
import { computeMaterialAndCaptures } from './utils/chessHelpers';
import { useChessStore } from './store/useChessStore';

export function App() {
  const {
    init,
    activeTab,
    setActiveTab,
    trainingMode,
    setTrainingMode,
    fen,
    turn,
    playerColor,
    selectedOpening,
    isBlindMode,
    isOutOfTargetLine,
    isComputerThinking,
    cacheCount,
    driverStatus,
    driverKind,
  } = useChessStore();

  const [isHardwareOpen, setIsHardwareOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const chess = new Chess(fen);
  const isCheckmate = chess.isCheckmate();
  const isDraw = chess.isDraw();
  const isGameOver = chess.isGameOver();
  const material = useMemo(() => computeMaterialAndCaptures(fen), [fen]);

  const opponentColor = playerColor === 'w' ? 'b' : 'w';
  const opponentCaptured =
    opponentColor === 'w' ? material.capturedByWhite : material.capturedByBlack;
  const opponentAdv =
    opponentColor === 'w'
      ? Math.max(0, material.whiteAdvantage)
      : Math.max(0, -material.whiteAdvantage);
  const playerCaptured =
    playerColor === 'w' ? material.capturedByWhite : material.capturedByBlack;
  const playerAdv =
    playerColor === 'w'
      ? Math.max(0, material.whiteAdvantage)
      : Math.max(0, -material.whiteAdvantage);

  const opponentLabel =
    trainingMode === 'quiz'
      ? `Quiz Répertoire (${playerColor === 'w' ? 'Noirs' : 'Blancs'})`
      : playerColor === 'w'
      ? `Ordinateur (Noirs • ${selectedOpening.eco})`
      : `Ordinateur (Blancs • ${selectedOpening.eco})`;

  const playerLabel =
    playerColor === 'w' ? 'Vous (Blancs)' : 'Vous (Noirs)';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-700/60 bg-slate-900/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Crown className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                Chess Opening Trainer
              </h1>
              <p className="text-[11px] text-slate-400 hidden lg:block truncate">
                Entraînement inversé • Lichess Explorer & Stockfish
              </p>
            </div>
          </div>

          {/* Primary Tab Navigation */}
          <nav
            aria-label="Navigation principale"
            className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-700/60 shrink-0"
          >
            <button
              type="button"
              onClick={() => setActiveTab('training')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'training'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Entraînement</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('explorer')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'explorer'
                  ? 'bg-blue-500/20 text-blue-200 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Explorateur & Arbre</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('repertoire')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'repertoire'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Mon Répertoire</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'analysis'
                  ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Analyse de Partie</span>
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isOutOfTargetLine && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                <ShieldAlert className="w-3.5 h-3.5" />
                Hors ligne cible
              </span>
            )}
            {isBlindMode && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/40">
                <EyeOff className="w-3.5 h-3.5" />
                Mode Aveugle
              </span>
            )}
            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Cache FEN : {cacheCount}
            </span>
            <button
              type="button"
              onClick={() => setIsHardwareOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                driverStatus === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Échiquier Connecté</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  driverStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : driverKind !== 'none' && driverStatus === 'error'
                    ? 'bg-rose-400'
                    : 'bg-slate-500'
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'explorer' ? (
          <ExplorerView />
        ) : activeTab === 'repertoire' ? (
          <RepertoireView />
        ) : activeTab === 'analysis' ? (
          <AnalysisView />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Opening Configuration or Quiz Panel */}
          <section className="lg:col-span-4 xl:col-span-3 order-2 lg:order-1 space-y-3">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
              <button
                type="button"
                onClick={() => setTrainingMode('opening')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  trainingMode === 'opening'
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                Ouverture cible
              </button>
              <button
                type="button"
                onClick={() => setTrainingMode('quiz')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  trainingMode === 'quiz'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                Quiz Répertoire
              </button>
            </div>
            {trainingMode === 'quiz' ? <QuizPanel /> : <OpeningSelector />}
          </section>

          {/* Center Column: Interactive Chessboard + SVG Overlay */}
          <section className="lg:col-span-8 xl:col-span-5 order-1 lg:order-2 flex flex-col items-center">
            <div className="w-full max-w-[min(72vh,600px)] space-y-2.5">
              {/* Top Bar: Opponent (Target Opening) */}
              <PlayerBanner
                name={opponentLabel}
                color={opponentColor}
                isBot
                capturedPieces={opponentCaptured}
                materialAdvantage={opponentAdv}
                statusText={
                  isComputerThinking
                    ? 'Réflexion...'
                    : turn !== playerColor && !isGameOver
                    ? 'Trait à l’adversaire'
                    : undefined
                }
                statusVariant={isComputerThinking ? 'thinking' : 'muted'}
              />

              {/* Board */}
              <Board />

              {/* Bottom Bar: User */}
              <PlayerBanner
                name={playerLabel}
                color={playerColor}
                isUser
                capturedPieces={playerCaptured}
                materialAdvantage={playerAdv}
                statusText={
                  isGameOver
                    ? isCheckmate
                      ? `Échec et mat ! (${turn === 'w' ? 'Noirs' : 'Blancs'} gagnent)`
                      : isDraw
                      ? 'Partie nulle'
                      : 'Partie terminée'
                    : turn === playerColor
                    ? 'À vous de jouer'
                    : 'En attente'
                }
                statusVariant={
                  isGameOver
                    ? 'gameover'
                    : turn === playerColor
                    ? 'active'
                    : 'muted'
                }
              />

              {/* SVG Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Coup théorique attendu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-amber-500 inline-block" />
                  Suite théorique cible
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-blue-500 inline-block" />
                  Réponses populaires Lichess
                </span>
              </div>
            </div>
          </section>

          {/* Right Column: Time-Travel Move History & Stats Panel */}
          <section className="lg:col-span-12 xl:col-span-4 order-3 space-y-5">
            <MoveHistory />
            {trainingMode === 'opening' && <StatsPanel />}
          </section>
          </div>
        )}
      </main>

      <HardwarePanel
        isOpen={isHardwareOpen}
        onClose={() => setIsHardwareOpen(false)}
      />
    </div>
  );
}

export default App;
