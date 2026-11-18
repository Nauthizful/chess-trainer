import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  Swords,
} from 'lucide-react';
import { OPENINGS } from '../data/openings';
import { useChessStore } from '../store/useChessStore';
import { SideSwitcher } from './common/SideSwitcher';
import type { Opening, OpeningCategory } from '../types';

const CATEGORIES: Array<'Toutes' | OpeningCategory> = [
  'Toutes',
  'Flanc (A)',
  'Semi-Ouverte (B)',
  'Ouverte (C)',
  'Fermée (D)',
  'Indienne (E)',
];

export const OpeningSelector: React.FC = () => {
  const {
    playerColor,
    selectedOpening,
    databaseSource,
    isBlindMode,
    setPlayerColor,
    setSelectedOpening,
    setDatabaseSource,
    toggleBlindMode,
    resetGame,
  } = useChessStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Toutes' | OpeningCategory>('Toutes');

  const availableOpenings = useMemo(
    () => OPENINGS.filter((opening) => opening.playedBy !== playerColor),
    [playerColor]
  );

  const filteredOpenings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableOpenings.filter((opening) => {
      if (selectedCategory !== 'Toutes' && opening.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        opening.eco.toLowerCase().includes(q) ||
        opening.name.toLowerCase().includes(q) ||
        opening.pgn.toLowerCase().includes(q) ||
        opening.moves.slice(0, 4).join(' ').toLowerCase().includes(q)
      );
    });
  }, [availableOpenings, searchQuery, selectedCategory]);

  const handleSelectOpening = (opening: Opening) => {
    setSelectedOpening(opening);
    setIsDropdownOpen(false);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-5">
      {/* Side Switcher */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5 text-emerald-400" />
            Votre camp (Rôle inversé)
          </span>
        </div>
        <SideSwitcher value={playerColor} onChange={setPlayerColor} size="md" />
        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
          L’ordinateur joue les coups{' '}
          <span className="text-slate-200 font-medium">
            {playerColor === 'w' ? 'noirs' : 'blancs'}
          </span>{' '}
          de l’ouverture choisie ci-dessous.
        </p>
      </div>

      {/* Filterable Opening Selector */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            Ouverture cible de l’adversaire
          </span>
          <span className="text-[11px] text-slate-500">
            {availableOpenings.length} lignes ({playerColor === 'w' ? 'Noirs' : 'Blancs'})
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsDropdownOpen((o) => !o)}
          className="w-full text-left bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {selectedOpening.eco}
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  {selectedOpening.category}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-100 leading-snug">
                {selectedOpening.name}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
          <p className="mt-2 text-xs font-mono text-emerald-300/90 bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-slate-800/80 truncate">
            {selectedOpening.pgn}
          </p>
        </button>

        {isDropdownOpen && (
          <div className="mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-40">
            {/* Search & Category filters */}
            <div className="p-2.5 border-b border-slate-800 space-y-2 bg-slate-950/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer par ECO (C50), nom ou coups (1. e4 c5)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700/70 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
              {filteredOpenings.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Aucune ouverture ne correspond à votre recherche.
                </div>
              ) : (
                <>
                  {filteredOpenings.slice(0, 100).map((opening) => {
                    const isActive = opening.id === selectedOpening.id;
                    return (
                      <button
                        key={opening.id}
                        type="button"
                        onClick={() => handleSelectOpening(opening)}
                        className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-slate-800/80 ${
                          isActive ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-amber-300 border border-slate-700">
                            {opening.eco}
                          </span>
                          <span
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-emerald-300' : 'text-slate-200'
                            }`}
                          >
                            {opening.name}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                          {opening.pgn}
                        </p>
                      </button>
                    );
                  })}
                  {filteredOpenings.length > 100 && (
                    <div className="px-3 py-2 text-center text-[11px] text-slate-500 bg-slate-950/60">
                      {filteredOpenings.length - 100} autres ouvertures — affinez votre recherche.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          {selectedOpening.description}
        </p>
      </div>

      {/* Lichess Explorer Database Selector */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          Base Lichess Explorer
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDatabaseSource('masters')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
              databaseSource === 'masters'
                ? 'bg-blue-500/15 text-blue-200 border-blue-500/50 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Maîtres (FIDE)
          </button>
          <button
            type="button"
            onClick={() => setDatabaseSource('lichess')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
              databaseSource === 'lichess'
                ? 'bg-blue-500/15 text-blue-200 border-blue-500/50 shadow-sm'
                : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Joueurs 1000–1400
          </button>
        </div>
      </div>

      {/* Blind / Test Mode & Reset */}
      <div className="pt-2 border-t border-slate-800 space-y-2.5">
        <button
          type="button"
          onClick={toggleBlindMode}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            isBlindMode
              ? 'bg-amber-500/15 text-amber-200 border-amber-500/50 shadow-md shadow-amber-500/10'
              : 'bg-slate-800/70 text-slate-200 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {isBlindMode ? (
              <EyeOff className="w-4 h-4 text-amber-400" />
            ) : (
              <Eye className="w-4 h-4 text-emerald-400" />
            )}
            Mode Aveugle / Test
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              isBlindMode
                ? 'bg-amber-500/25 text-amber-200'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {isBlindMode ? 'ACTIF' : 'INACTIF'}
          </span>
        </button>

        <button
          type="button"
          onClick={resetGame}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser l’entraînement
        </button>
      </div>
    </div>
  );
};
