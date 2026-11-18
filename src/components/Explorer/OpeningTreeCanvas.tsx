import React, { useMemo } from 'react';
import type { NodeTypes } from '@xyflow/react';
import { GitFork, Swords } from 'lucide-react';
import { useChessStore } from '../../store/useChessStore';
import {
  OpeningMoveNode,
  type OpeningFlowNode,
  type OpeningMoveNodeData,
} from './OpeningMoveNode';
import { ECO_NODE_HEIGHT, ECO_NODE_WIDTH } from './ecoTreeBuilder';
import { collectRepertoirePathKeys } from '../Repertoire/repertoireUtils';
import { MoveTreeCanvas } from '../Tree/MoveTreeCanvas';

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

  return (
    <MoveTreeCanvas<OpeningFlowNode>
      nodes={renderedNodes}
      edges={explorerEdges}
      nodeTypes={nodeTypes}
      nodeWidth={ECO_NODE_WIDTH}
      nodeHeight={ECO_NODE_HEIGHT}
      selectedNodeId={explorerSelectedNodeId}
      autoFocusKey={explorerFamily.id}
      onNodeClick={(node) => selectExplorerNode(node.id)}
      onNodesChange={onExplorerNodesChange}
      onEdgesChange={onExplorerEdgesChange}
      miniMapNodeColor={(n) =>
        n.data?.isRootLine ? '#f59e0b' : '#10b981'
      }
      header={
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
                  {explorerFamily.variantCount} variante
                  {explorerFamily.variantCount > 1 ? 's' : ''}
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
      }
    />
  );
};
