import React, { useMemo, useState } from 'react';
import { BookmarkPlus, Check, Search } from 'lucide-react';
import { filterOpeningFamilies } from '../../data/openings';
import { useChessStore } from '../../store/useChessStore';
import { ChessBoard } from '../ChessBoard';
import type { PlayerColor } from '../../types';

export const OpeningFilterPanel: React.FC = () => {
  const {
    explorerFamily,
    explorerNodes,
    explorerSelectedNodeId,
    explorerSearchQuery,
    explorerCampFilter,
    explorerPreviewFen,
    explorerPreviewLastMove,
    explorerPreviewMovesLabel,
    setExplorerSearchQuery,
    setExplorerCampFilter,
    selectExplorerFamily,
    addExplorerLineToRepertoire,
  } = useChessStore();

  const [targetRepColor, setTargetRepColor] = useState<PlayerColor>('w');
  const [justAdded, setJustAdded] = useState(false);

  const selectedNode = useMemo(
    () => explorerNodes.find((n) => n.id === explorerSelectedNodeId) ?? null,
    [explorerNodes, explorerSelectedNodeId]
  );

  const canAddLine =
    selectedNode !== null && selectedNode.data.movesPath.length > 0;

  const handleAddLine = () => {
    if (!selectedNode || selectedNode.data.movesPath.length === 0) return;
    addExplorerLineToRepertoire(targetRepColor, selectedNode.data.movesPath, {
      eco: selectedNode.data.eco ?? explorerFamily.representativeOpening.eco,
      openingName:
        selectedNode.data.variantName ?? explorerFamily.familyName,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  const filteredFamilies = useMemo(() => {
    return filterOpeningFamilies({
      query: explorerSearchQuery,
      playedBy: explorerCampFilter,
    });
  }, [explorerSearchQuery, explorerCampFilter]);

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 shadow-xl flex flex-col gap-4 h-full">
      {/* Read-only Enlarged Preview Chessboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Prévisualisation
          </span>
          <span className="text-[11px] font-mono text-amber-300">
            {explorerFamily.ecoRange}
          </span>
        </div>

        <ChessBoard
          fen={explorerPreviewFen}
          lastMove={explorerPreviewLastMove}
          size="md"
        />

        <p className="text-[11px] font-mono text-emerald-300/90 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 truncate">
          {explorerPreviewMovesLabel || explorerFamily.representativeOpening.pgn}
        </p>

        {/* Bridge to Personal Repertoire */}
        {canAddLine && (
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-300">
                Répertoire cible :
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTargetRepColor('w')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                    targetRepColor === 'w'
                      ? 'bg-slate-100 text-slate-950 border-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  Blancs
                </button>
                <button
                  type="button"
                  onClick={() => setTargetRepColor('b')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                    targetRepColor === 'b'
                      ? 'bg-slate-800 text-white border-emerald-400'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700'
                  }`}
                >
                  Noirs
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddLine}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                justAdded
                  ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/40'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Ligne ajoutée au Répertoire !
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Ajouter cette ligne au Répertoire ({targetRepColor === 'w' ? 'Blancs' : 'Noirs'})
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Text & Camp Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={explorerSearchQuery}
            onChange={(e) => setExplorerSearchQuery(e.target.value)}
            placeholder="Famille, sous-variante, code ECO..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950/70 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'w', label: 'Blancs' },
              { id: 'b', label: 'Noirs' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setExplorerCampFilter(item.id)}
              className={`py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                explorerCampFilter === item.id
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/45'
                  : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Family Results List */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span className="font-semibold uppercase tracking-wider">
            Familles ({filteredFamilies.length})
          </span>
        </div>

        <div className="flex-1 min-h-[180px] max-h-[280px] overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800 divide-y divide-slate-800/70">
          {filteredFamilies.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              Aucune famille d’ouvertures ne correspond à votre recherche.
            </div>
          ) : (
            <>
              {filteredFamilies.slice(0, 120).map((family) => {
                const isActive = family.id === explorerFamily.id;
                return (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => selectExplorerFamily(family)}
                    className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-slate-800/80 ${
                      isActive ? 'bg-emerald-500/15' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-amber-300 border border-slate-700 shrink-0">
                          {family.ecoRange}
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            isActive ? 'text-emerald-300' : 'text-slate-200'
                          }`}
                        >
                          {family.familyName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {family.variantCount} var.
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full border ${
                            family.playedBy === 'w'
                              ? 'bg-white border-slate-400'
                              : 'bg-slate-950 border-slate-400'
                          }`}
                          title={
                            family.playedBy === 'w'
                              ? 'Initiée par les Blancs'
                              : 'Défense des Noirs'
                          }
                        />
                      </div>
                    </div>
                    <p className="mt-0.5 text-[10px] font-mono text-slate-400 truncate">
                      {family.representativeOpening.pgn}
                    </p>
                  </button>
                );
              })}
              {filteredFamilies.length > 120 && (
                <div className="px-3 py-2 text-center text-[10px] text-slate-500">
                  {filteredFamilies.length - 120} autres familles — affinez la recherche.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
