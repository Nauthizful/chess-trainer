import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { GitFork, Swords } from 'lucide-react';
import { useChessStore } from '../../store/useChessStore';
import {
  OpeningMoveNode,
  type OpeningFlowNode,
  type OpeningMoveNodeData,
} from './OpeningMoveNode';
import { ECO_NODE_HEIGHT, ECO_NODE_WIDTH } from './ecoTreeBuilder';
import { collectRepertoirePathKeys } from '../Repertoire/repertoireUtils';

const DEFAULT_ZOOM = 1.15;

const nodeTypes: NodeTypes = {
  openingMove: OpeningMoveNode,
};

export const OpeningTreeCanvas: React.FC = () => {
  const {
    explorerFamily,
    explorerNodes,
    explorerEdges,
    explorerSelectedNodeId,
    userRepertoire,
    selectExplorerNode,
    onExplorerNodesChange,
    onExplorerEdgesChange,
    trainVariantFromTree,
  } = useChessStore();

  const repertoireKeys = useMemo(
    () => collectRepertoirePathKeys(userRepertoire),
    [userRepertoire]
  );

  const rfInstanceRef = useRef<ReactFlowInstance<OpeningFlowNode, Edge> | null>(
    null
  );
  const lastFocusedFamilyIdRef = useRef<string | null>(null);

  const focusNode = useCallback(
    (node: OpeningFlowNode, zoomOverride?: number) => {
      const instance = rfInstanceRef.current;
      if (!instance) return;
      const targetZoom = zoomOverride ?? Math.max(instance.getZoom(), 1.05);
      instance.setCenter(
        node.position.x + ECO_NODE_WIDTH / 2,
        node.position.y + ECO_NODE_HEIGHT / 2,
        { zoom: targetZoom, duration: 350 }
      );
    },
    []
  );

  const renderedNodes: OpeningFlowNode[] = useMemo(
    () =>
      explorerNodes.map((n) => ({
        ...n,
        selected: n.id === explorerSelectedNodeId,
        data: {
          ...n.data,
          inRepertoire:
            n.data.movesPath.length > 0 &&
            repertoireKeys.has(n.data.movesPath.join(' ')),
        },
      })),
    [explorerNodes, explorerSelectedNodeId, repertoireKeys]
  );

  const selectedNodeData: OpeningMoveNodeData | null = useMemo(() => {
    if (!explorerSelectedNodeId) return null;
    const found = explorerNodes.find((n) => n.id === explorerSelectedNodeId);
    return found?.data ?? null;
  }, [explorerNodes, explorerSelectedNodeId]);

  useEffect(() => {
    if (explorerNodes.length === 0) return;

    if (lastFocusedFamilyIdRef.current !== explorerFamily.id) {
      lastFocusedFamilyIdRef.current = explorerFamily.id;
      const rootNode =
        explorerNodes.find((n) => n.id === 'root') ?? explorerNodes[0];
      if (rootNode) {
        setTimeout(() => focusNode(rootNode, DEFAULT_ZOOM), 40);
      }
    }
  }, [explorerFamily.id, explorerNodes, focusNode]);

  const handleInit = useCallback(
    (instance: ReactFlowInstance<OpeningFlowNode, Edge>) => {
      rfInstanceRef.current = instance;
      lastFocusedFamilyIdRef.current = explorerFamily.id;
      const target =
        explorerNodes.find((n) => n.id === explorerSelectedNodeId) ??
        explorerNodes.find((n) => n.id === 'root') ??
        explorerNodes[0];
      if (target) {
        setTimeout(() => focusNode(target, DEFAULT_ZOOM), 40);
      }
    },
    [explorerFamily.id, explorerNodes, explorerSelectedNodeId, focusNode]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, clickedNode: OpeningFlowNode) => {
      selectExplorerNode(clickedNode.id);
      setTimeout(() => {
        const latest =
          useChessStore
            .getState()
            .explorerNodes.find((n) => n.id === clickedNode.id) ?? clickedNode;
        focusNode(latest);
      }, 30);
    },
    [selectExplorerNode, focusNode]
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[700px]">
      {/* Tree Header / Action Bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <GitFork className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {explorerFamily.ecoRange}
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {explorerFamily.familyName}
              </h2>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                {explorerFamily.variantCount} variante{explorerFamily.variantCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Arbre théorique unifié ({explorerNodes.length} nœuds affichés) — cliquez sur un nœud pour prévisualiser ou déplier.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedNodeData && selectedNodeData.movesPath.length > 0 && (
            <button
              type="button"
              onClick={() =>
                trainVariantFromTree(
                  explorerFamily.representativeOpening,
                  selectedNodeData.movesPath
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-colors"
            >
              <Swords className="w-3.5 h-3.5" />
              Entraîner cette variante ({selectedNodeData.label})
            </button>
          )}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 min-h-0 bg-slate-950">
        <ReactFlow
          nodes={renderedNodes}
          edges={explorerEdges}
          onInit={handleInit}
          onNodesChange={onExplorerNodesChange}
          onEdgesChange={onExplorerEdgesChange}
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
              (n.data as OpeningMoveNodeData)?.isRootLine ? '#f59e0b' : '#10b981'
            }
            maskColor="rgba(2, 6, 23, 0.75)"
            className="!bg-slate-900 !border-slate-800"
          />
        </ReactFlow>
      </div>
    </div>
  );
};
