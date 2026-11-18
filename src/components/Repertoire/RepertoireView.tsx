import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type NodeTypes } from '@xyflow/react';
import { Chess } from 'chess.js';
import {
  BookMarked,
  Brain,
  Check,
  ChevronLeft,
  ClipboardPaste,
  Compass,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  StickyNote,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useChessStore } from '../../store/useChessStore';
import {
  RepertoireMoveNode,
  type RepertoireFlowNode,
} from './RepertoireMoveNode';
import {
  buildRepertoireFlowGraph,
  findRepertoireNodeById,
  parsePgnOrMovesLine,
  REP_NODE_HEIGHT,
  REP_NODE_WIDTH,
} from './repertoireUtils';
import { ChessBoard } from '../ChessBoard';
import { MoveTreeCanvas } from '../Tree/MoveTreeCanvas';
import { SideSwitcher } from '../common/SideSwitcher';
import { formatMovesSequence } from '../../utils/chessFormatting';
import { fetchPublicLichessCandidates } from '../../services/lichessExplorerApi';
import type {
  LichessExplorerResponse,
  PlayerColor,
  SquarePair,
  UserRepertoire,
} from '../../types';

const nodeTypes: NodeTypes = {
  repertoireMove: RepertoireMoveNode,
};

interface PreviewStep {
  fen: string;
  san: string;
  lastMove: SquarePair;
}

function formatCompactGames(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export const RepertoireView: React.FC = () => {
  const {
    userRepertoire,
    repertoireColor,
    repertoireSelectedNodeId,
    setRepertoireColor,
    selectRepertoireNode,
    addManualMoveToRepertoire,
    addVariationAtNode,
    stepBackRepertoireNode,
    addExplorerLineToRepertoire,
    updateRepertoireNodeNote,
    deleteRepertoireBranch,
    importRepertoireJson,
    startQuizSession,
  } = useChessStore();

  const [autoRecord, setAutoRecord] = useState(true);
  const [previewSteps, setPreviewSteps] = useState<PreviewStep[]>([]);

  const [candidates, setCandidates] = useState<LichessExplorerResponse | null>(
    null
  );
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const [isPgnModalOpen, setIsPgnModalOpen] = useState(false);
  const [pgnInput, setPgnInput] = useState('');
  const [pgnTargetColor, setPgnTargetColor] =
    useState<PlayerColor>(repertoireColor);
  const [pgnError, setPgnError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeTree =
    repertoireColor === 'w' ? userRepertoire.white : userRepertoire.black;

  const { nodes: rawNodes, edges } = useMemo(
    () =>
      buildRepertoireFlowGraph(
        activeTree,
        repertoireColor === 'w' ? 'Blancs' : 'Noirs'
      ),
    [activeTree, repertoireColor]
  );

  const renderedNodes: RepertoireFlowNode[] = useMemo(
    () =>
      rawNodes.map((n) => ({
        ...n,
        selected: n.id === repertoireSelectedNodeId,
      })),
    [rawNodes, repertoireSelectedNodeId]
  );

  const selectedDetails = useMemo(
    () => findRepertoireNodeById(activeTree, repertoireSelectedNodeId),
    [activeTree, repertoireSelectedNodeId]
  );

  useEffect(() => {
    setConfirmDelete(false);
    setPreviewSteps([]);
  }, [repertoireSelectedNodeId, repertoireColor]);

  const currentNode = selectedDetails?.node ?? activeTree;
  const activeFen =
    previewSteps.length > 0
      ? previewSteps[previewSteps.length - 1].fen
      : currentNode.fen;
  const activeLastMove =
    previewSteps.length > 0
      ? previewSteps[previewSteps.length - 1].lastMove
      : selectedDetails?.lastMove ?? null;
  const activeMovesPath = useMemo(
    () => [
      ...(selectedDetails?.movesPath ?? []),
      ...previewSteps.map((s) => s.san),
    ],
    [selectedDetails?.movesPath, previewSteps]
  );
  const movesLabel = formatMovesSequence(activeMovesPath);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingCandidates(true);
    setCandidatesError(null);

    fetchPublicLichessCandidates(activeFen, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setCandidates(res);
          setIsLoadingCandidates(false);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCandidatesError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger la base Lichess.'
        );
        setIsLoadingCandidates(false);
      });

    return () => controller.abort();
  }, [activeFen]);

  const playMoveOnStudio = (sanOrInput: string | { from: string; to: string; promotion?: string }): boolean => {
    try {
      const board = new Chess(activeFen);
      const moveRes = board.move(sanOrInput);
      if (!moveRes) return false;

      if (autoRecord) {
        if (previewSteps.length > 0) {
          addExplorerLineToRepertoire(repertoireColor, [
            ...activeMovesPath,
            moveRes.san,
          ]);
          setPreviewSteps([]);
        } else {
          addManualMoveToRepertoire(moveRes.san);
        }
      } else {
        setPreviewSteps((prev) => [
          ...prev,
          {
            fen: board.fen(),
            san: moveRes.san,
            lastMove: { from: moveRes.from, to: moveRes.to },
          },
        ]);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleStepBack = () => {
    if (previewSteps.length > 0) {
      setPreviewSteps((prev) => prev.slice(0, -1));
      return;
    }
    stepBackRepertoireNode();
  };

  const handleSavePreviewLine = () => {
    if (previewSteps.length === 0) return;
    addExplorerLineToRepertoire(repertoireColor, activeMovesPath);
    setPreviewSteps([]);
    setImportFeedback('Ligne ajoutée au répertoire !');
    setTimeout(() => setImportFeedback(null), 2200);
  };

  const handleAddCandidateAsVariation = (san: string) => {
    if (previewSteps.length === 0) {
      addVariationAtNode(currentNode.id, san);
    } else {
      addExplorerLineToRepertoire(repertoireColor, [...activeMovesPath, san]);
    }
  };

  const handleOpenPgnModal = () => {
    setPgnTargetColor(repertoireColor);
    setPgnInput('');
    setPgnError(null);
    setIsPgnModalOpen(true);
  };

  const handleConfirmPgnImport = () => {
    const { moves, error } = parsePgnOrMovesLine(pgnInput);
    if (error || moves.length === 0) {
      setPgnError(error ?? 'Ligne invalide.');
      return;
    }
    addExplorerLineToRepertoire(pgnTargetColor, moves);
    if (pgnTargetColor !== repertoireColor) {
      setRepertoireColor(pgnTargetColor);
    }
    setIsPgnModalOpen(false);
    setImportFeedback(`${moves.length} demi-coups fusionnés dans le répertoire !`);
    setTimeout(() => setImportFeedback(null), 2600);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(userRepertoire, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mon-repertoire-echecs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<UserRepertoire>;
      if (!parsed.white || !parsed.black || !parsed.white.id || !parsed.black.id) {
        setImportFeedback('Fichier JSON invalide : structure white/black manquante.');
        return;
      }
      importRepertoireJson(
        { white: parsed.white, black: parsed.black },
        importMode
      );
      setImportFeedback(
        importMode === 'merge'
          ? 'Répertoire fusionné avec succès !'
          : 'Répertoire remplacé avec succès !'
      );
      setTimeout(() => setImportFeedback(null), 2500);
    } catch {
      setImportFeedback('Impossible de lire le fichier JSON.');
    }
  };

  const existingChildrenSans = useMemo(
    () => new Set(currentNode.children.map((c) => c.san)),
    [currentNode.children]
  );

  const canStepBack =
    previewSteps.length > 0 || repertoireSelectedNodeId !== 'root';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Side: Quick Edit Studio */}
      <section className="lg:col-span-5 xl:col-span-5 bg-slate-900 border border-slate-700/60 rounded-2xl p-4 shadow-xl space-y-4">
        {/* White / Black Repertoire Switcher */}
        <SideSwitcher
          value={repertoireColor}
          onChange={setRepertoireColor}
          whiteLabel="Répertoire Blancs"
          blackLabel="Répertoire Noirs"
          size="sm"
        />

        {/* Studio Toolbar: Auto-Record Toggle + Step Back + Paste PGN */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRecord}
              onChange={(e) => setAutoRecord(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-3.5" />
            <span className="text-[11px] font-semibold text-slate-200">
              Enregistrement auto
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleStepBack}
              disabled={!canStepBack}
              title="Revenir au coup précédent pour embrancher"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Coup précédent
            </button>

            <button
              type="button"
              onClick={handleOpenPgnModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Coller une ligne / PGN
            </button>
          </div>
        </div>

        {/* Preview-only Banner when Auto-Record is OFF */}
        {previewSteps.length > 0 && (
          <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/40 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-blue-200">
              Aperçu hors-répertoire ({previewSteps.map((s) => s.san).join(' ')})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSavePreviewLine}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
              >
                <Save className="w-3 h-3" />
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setPreviewSteps([])}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                <RotateCcw className="w-3 h-3" />
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Board + Candidate Moves side-by-side on xl, stacked on smaller */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
          <div className="xl:col-span-7 space-y-2">
            <ChessBoard
              fen={activeFen}
              orientation={repertoireColor}
              interactive
              allowedColor="turn"
              lastMove={activeLastMove}
              size="sm"
              onMove={(from, to, promotion) =>
                playMoveOnStudio({ from, to, promotion })
              }
            />

            <p className="text-[11px] font-mono text-emerald-300/90 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 truncate">
              {movesLabel}
            </p>
          </div>

          {/* Candidate Moves Panel (Public Lichess Base) */}
          <div className="xl:col-span-5 bg-slate-950/65 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                Coups candidats
              </span>
              {isLoadingCandidates && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              )}
            </div>

            {candidatesError ? (
              <p className="text-[11px] text-rose-300">{candidatesError}</p>
            ) : !candidates || candidates.moves.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {isLoadingCandidates
                  ? 'Chargement Lichess...'
                  : 'Aucun coup recensé dans cette position.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {candidates.moves.slice(0, 5).map((mv) => {
                  const total = mv.white + mv.draws + mv.black;
                  const wPct = total > 0 ? (mv.white / total) * 100 : 33;
                  const dPct = total > 0 ? (mv.draws / total) * 100 : 34;
                  const bPct = total > 0 ? (mv.black / total) * 100 : 33;
                  const alreadyAdded =
                    previewSteps.length === 0 &&
                    existingChildrenSans.has(mv.san);

                  return (
                    <div
                      key={mv.uci}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 border border-slate-800 p-1.5 hover:border-slate-700 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => playMoveOnStudio(mv.san)}
                        className="flex-1 min-w-0 text-left space-y-1"
                        title={`Jouer ${mv.san}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-slate-100">
                            {mv.san}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatCompactGames(total)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-800">
                          <div
                            style={{ width: `${wPct}%` }}
                            className="bg-slate-100 h-full"
                          />
                          <div
                            style={{ width: `${dPct}%` }}
                            className="bg-slate-500 h-full"
                          />
                          <div
                            style={{ width: `${bPct}%` }}
                            className="bg-slate-950 h-full"
                          />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCandidateAsVariation(mv.san)}
                        title={
                          alreadyAdded
                            ? 'Déjà dans le répertoire'
                            : `Ajouter ${mv.san} comme variante sans quitter la position`
                        }
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                          alreadyAdded
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-200 border-slate-700 hover:border-emerald-500/40'
                        }`}
                      >
                        {alreadyAdded ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Personal Note / Move Idea Editor */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
            Note / Idée du coup
          </label>
          <textarea
            rows={2}
            value={currentNode.note ?? ''}
            onChange={(e) =>
              updateRepertoireNodeNote(currentNode.id, e.target.value)
            }
            placeholder="Ex: Piège de Blitzstream : si ...Nxe4, on joue Qe2"
            className="w-full px-3 py-2 text-xs bg-slate-950/70 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Delete Branch */}
        {currentNode.id !== 'root' && (
          <div className="pt-1">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/35 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer cette branche ({currentNode.san})
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    deleteRepertoireBranch(currentNode.id);
                    setConfirmDelete(false);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                >
                  Confirmer la suppression
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        )}

        {/* Portability: Export / Import JSON */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Sauvegarde & Restauration JSON
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Exporter JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              Importer JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Mode d’import :</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`px-2 py-0.5 rounded border ${
                  importMode === 'merge'
                    ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                Fusionner
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-2 py-0.5 rounded border ${
                  importMode === 'replace'
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                Remplacer
              </button>
            </div>
          </div>

          {importFeedback && (
            <p className="text-[11px] text-emerald-300 font-medium">
              {importFeedback}
            </p>
          )}
        </div>
      </section>

      {/* Right Interactive Repertoire Tree */}
      <section className="lg:col-span-7 xl:col-span-7">
        <MoveTreeCanvas<RepertoireFlowNode>
          nodes={renderedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodeWidth={REP_NODE_WIDTH}
          nodeHeight={REP_NODE_HEIGHT}
          selectedNodeId={repertoireSelectedNodeId}
          autoFocusKey={repertoireColor}
          focusOnSelectionChange
          onNodeClick={(node) => selectRepertoireNode(node.id)}
          miniMapNodeColor={(n) => (n.id === 'root' ? '#f59e0b' : '#10b981')}
          header={
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BookMarked className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-100">
                    Mon Répertoire — {repertoireColor === 'w' ? 'Blancs' : 'Noirs'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {renderedNodes.length - 1} coup
                    {renderedNodes.length - 1 > 1 ? 's' : ''} enregistré
                    {renderedNodes.length - 1 > 1 ? 's' : ''} • Cliquez sur un nœud ou jouez sur l’échiquier à gauche.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => startQuizSession(repertoireColor)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                S’entraîner sur mon répertoire
              </button>
            </div>
          }
        />
      </section>

      {/* Quick Line / PGN Import Modal */}
      {isPgnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-amber-400" />
                Importer une ligne ou un PGN
              </h3>
              <button
                type="button"
                onClick={() => setIsPgnModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Camp cible
              </span>
              <SideSwitcher
                value={pgnTargetColor}
                onChange={setPgnTargetColor}
                whiteLabel="Répertoire Blancs"
                blackLabel="Répertoire Noirs"
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Coups SAN ou PGN complet
              </label>
              <textarea
                rows={5}
                value={pgnInput}
                onChange={(e) => {
                  setPgnInput(e.target.value);
                  setPgnError(null);
                }}
                placeholder="Ex: 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
              {pgnError && (
                <p className="text-xs text-rose-400 font-medium">{pgnError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsPgnModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmPgnImport}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
              >
                Fusionner dans le répertoire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
