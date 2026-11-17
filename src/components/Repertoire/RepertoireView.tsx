import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  BookMarked,
  Brain,
  Download,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react';
import { useChessStore } from '../../store/useChessStore';
import {
  RepertoireMoveNode,
  type RepertoireFlowNode,
} from './RepertoireMoveNode';
import {
  buildRepertoireFlowGraph,
  findRepertoireNodeById,
  REP_NODE_HEIGHT,
  REP_NODE_WIDTH,
} from './repertoireUtils';
import { RepertoireBoard } from './RepertoireBoard';
import { formatMovesSequence } from '../Explorer/ecoTreeBuilder';
import type { UserRepertoire } from '../../types';

const DEFAULT_ZOOM = 1.15;

const nodeTypes: NodeTypes = {
  repertoireMove: RepertoireMoveNode,
};

export const RepertoireView: React.FC = () => {
  const {
    userRepertoire,
    repertoireColor,
    repertoireSelectedNodeId,
    setRepertoireColor,
    selectRepertoireNode,
    addManualMoveToRepertoire,
    updateRepertoireNodeNote,
    deleteRepertoireBranch,
    importRepertoireJson,
    startQuizSession,
  } = useChessStore();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<RepertoireFlowNode, Edge> | null>(
    null
  );

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
  }, [repertoireSelectedNodeId, repertoireColor]);

  const focusNode = useCallback(
    (node: RepertoireFlowNode, zoomOverride?: number) => {
      const instance = rfInstanceRef.current;
      if (!instance) return;
      const targetZoom = zoomOverride ?? Math.max(instance.getZoom(), 1.05);
      instance.setCenter(
        node.position.x + REP_NODE_WIDTH / 2,
        node.position.y + REP_NODE_HEIGHT / 2,
        { zoom: targetZoom, duration: 320 }
      );
    },
    []
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance<RepertoireFlowNode, Edge>) => {
      rfInstanceRef.current = instance;
      const target =
        renderedNodes.find((n) => n.id === repertoireSelectedNodeId) ??
        renderedNodes[0];
      if (target) {
        setTimeout(() => focusNode(target, DEFAULT_ZOOM), 40);
      }
    },
    [renderedNodes, repertoireSelectedNodeId, focusNode]
  );

  useEffect(() => {
    const target =
      renderedNodes.find((n) => n.id === repertoireSelectedNodeId) ??
      renderedNodes[0];
    if (target) {
      setTimeout(() => focusNode(target), 40);
    }
  }, [repertoireColor, renderedNodes, repertoireSelectedNodeId, focusNode]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, clickedNode: RepertoireFlowNode) => {
      selectRepertoireNode(clickedNode.id);
      focusNode(clickedNode);
    },
    [selectRepertoireNode, focusNode]
  );

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

  const currentNode = selectedDetails?.node ?? activeTree;
  const movesLabel = formatMovesSequence(selectedDetails?.movesPath ?? []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Side Editing Panel */}
      <section className="lg:col-span-5 xl:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
        {/* White / Black Repertoire Switcher */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRepertoireColor('w')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
              repertoireColor === 'w'
                ? 'bg-slate-100 text-slate-950 border-white shadow-md'
                : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-white border border-slate-400" />
            Répertoire Blancs
          </button>
          <button
            type="button"
            onClick={() => setRepertoireColor('b')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
              repertoireColor === 'b'
                ? 'bg-slate-800 text-white border-emerald-400 ring-1 ring-emerald-400/40'
                : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-slate-950 border border-slate-400" />
            Répertoire Noirs
          </button>
        </div>

        {/* Interactive Board to add manual moves */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Échiquier d’édition
            </span>
            <span className="text-[11px] text-emerald-300">
              Jouez un coup pour l’ajouter
            </span>
          </div>

          <RepertoireBoard
            fen={currentNode.fen}
            orientation={repertoireColor}
            lastMove={selectedDetails?.lastMove ?? null}
            onAddMove={addManualMoveToRepertoire}
          />

          <p className="text-[11px] font-mono text-emerald-300/90 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 truncate">
            {movesLabel}
          </p>
        </div>

        {/* Personal Note Editor */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
            Note mémo sur ce coup
          </label>
          <textarea
            rows={3}
            value={currentNode.note ?? ''}
            onChange={(e) =>
              updateRepertoireNodeNote(currentNode.id, e.target.value)
            }
            placeholder="Ex: Attention au sacrifice Fxf7+, ou plan typique avec d4-d5..."
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
            Sauvegarde & Restauration
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
      <section className="lg:col-span-7 xl:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[700px]">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookMarked className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-100">
                Mon Répertoire — {repertoireColor === 'w' ? 'Blancs' : 'Noirs'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {renderedNodes.length - 1} coup{renderedNodes.length - 1 > 1 ? 's' : ''} enregistré{renderedNodes.length - 1 > 1 ? 's' : ''} • Importez depuis l’Explorateur ou jouez sur l’échiquier à gauche.
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

        <div className="flex-1 min-h-0 bg-slate-950">
          <ReactFlow
            nodes={renderedNodes}
            edges={edges}
            onInit={handleInit}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
            minZoom={0.35}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="!bg-slate-900 !border-slate-700 !text-slate-200 [&>button]:!bg-slate-900 [&>button]:!border-slate-700 [&>button]:!fill-slate-200 hover:[&>button]:!bg-slate-800" />
            <MiniMap
              nodeColor={(n) =>
                n.id === 'root' ? '#f59e0b' : '#10b981'
              }
              maskColor="rgba(2, 6, 23, 0.75)"
              className="!bg-slate-900 !border-slate-800"
            />
          </ReactFlow>
        </div>
      </section>
    </div>
  );
};
