import { useEffect } from 'react';
import { Chess } from 'chess.js';
import { Bot, Crown, EyeOff, ShieldAlert, User } from 'lucide-react';
import { Board } from './components/Board';
import { OpeningSelector } from './components/OpeningSelector';
import { MoveHistory } from './components/MoveHistory';
import { StatsPanel } from './components/StatsPanel';
import { useChessStore } from './store/useChessStore';

export function App() {
  const {
    init,
    fen,
    turn,
    playerColor,
    selectedOpening,
    isBlindMode,
    isOutOfBook,
    isComputerThinking,
    cacheCount,
  } = useChessStore();

  useEffect(() => {
    init();
  }, [init]);

  const chess = new Chess(fen);
  const isCheckmate = chess.isCheckmate();
  const isDraw = chess.isDraw();
  const isGameOver = chess.isGameOver();

  const opponentLabel =
    playerColor === 'w'
      ? `Ordinateur (Noirs • ${selectedOpening.eco})`
      : `Ordinateur (Blancs • ${selectedOpening.eco})`;

  const playerLabel =
    playerColor === 'w' ? 'Vous (Blancs)' : 'Vous (Noirs)';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/90 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Crown className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                Chess Opening Trainer
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Entraînement inversé aux ouvertures • Lichess Explorer & Docker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOutOfBook && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                <ShieldAlert className="w-3.5 h-3.5" />
                Hors ligne cible
              </span>
            )}
            {isBlindMode && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/40">
                <EyeOff className="w-3.5 h-3.5" />
                Mode Aveugle
              </span>
            )}
            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Cache FEN : {cacheCount}
            </span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Training Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Opening Configuration */}
          <section className="lg:col-span-4 xl:col-span-3 order-2 lg:order-1">
            <OpeningSelector />
          </section>

          {/* Center Column: Interactive Chessboard + SVG Overlay */}
          <section className="lg:col-span-8 xl:col-span-5 order-1 lg:order-2 flex flex-col items-center">
            <div className="w-full max-w-[560px] space-y-2.5">
              {/* Top Bar: Opponent (Target Opening) */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {opponentLabel}
                  </span>
                </div>
                {isComputerThinking ? (
                  <span className="text-[11px] font-medium text-amber-300 animate-pulse">
                    Réflexion...
                  </span>
                ) : turn !== playerColor && !isGameOver ? (
                  <span className="text-[11px] font-medium text-slate-400">
                    Trait à l’adversaire
                  </span>
                ) : null}
              </div>

              {/* Board */}
              <Board />

              {/* Bottom Bar: User */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-100">
                    {playerLabel}
                  </span>
                </div>
                {isGameOver ? (
                  <span className="text-xs font-bold text-rose-300">
                    {isCheckmate
                      ? `Échec et mat ! (${turn === 'w' ? 'Noirs' : 'Blancs'} gagnent)`
                      : isDraw
                      ? 'Partie nulle'
                      : 'Partie terminée'}
                  </span>
                ) : turn === playerColor ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    À vous de jouer
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">En attente</span>
                )}
              </div>

              {/* SVG Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800/70 text-[11px] text-slate-400">
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
            <StatsPanel />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
