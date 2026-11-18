import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import { OPENING_FAMILIES } from '../../data/openings';
import {
  buildFamilyEcoTree,
  computePositionForMoves,
} from '../../components/Explorer/ecoTreeBuilder';
import type { ExplorerSlice, SliceCreator } from '../storeTypes';

const defaultExplorerFamily =
  OPENING_FAMILIES.find((f) => f.representativeOpening.eco === 'C50') ??
  OPENING_FAMILIES[0];
const initialTree = buildFamilyEcoTree(defaultExplorerFamily);
const initialSelectedTreeNode =
  initialTree.nodes.find((n) => n.id === initialTree.initialSelectedNodeId) ??
  initialTree.nodes[0];
const initialPreview = computePositionForMoves(
  initialSelectedTreeNode?.data.movesPath ?? []
);

export const createExplorerSlice: SliceCreator<ExplorerSlice> = (set, get) => ({
  explorerFamily: defaultExplorerFamily,
  explorerExpandedBranchIds: [],
  explorerSearchQuery: '',
  explorerCampFilter: 'all',
  explorerNodes: initialTree.nodes,
  explorerEdges: initialTree.edges,
  explorerSelectedNodeId: initialTree.initialSelectedNodeId,
  explorerPreviewFen: initialPreview.fen,
  explorerPreviewLastMove: initialPreview.lastMove,
  explorerPreviewMovesLabel: initialPreview.movesLabel,

  setExplorerSearchQuery: (query) => {
    set({ explorerSearchQuery: query });
  },

  setExplorerCampFilter: (camp) => {
    set({ explorerCampFilter: camp });
  },

  selectExplorerFamily: (family) => {
    const built = buildFamilyEcoTree(family);
    const selectedNode =
      built.nodes.find((n) => n.id === built.initialSelectedNodeId) ??
      built.nodes[0];
    const preview = computePositionForMoves(
      selectedNode?.data.movesPath ?? []
    );
    set({
      explorerFamily: family,
      explorerExpandedBranchIds: [],
      explorerNodes: built.nodes,
      explorerEdges: built.edges,
      explorerSelectedNodeId: built.initialSelectedNodeId,
      explorerPreviewFen: preview.fen,
      explorerPreviewLastMove: preview.lastMove,
      explorerPreviewMovesLabel: preview.movesLabel,
    });
  },

  selectExplorerNode: (nodeId) => {
    const state = get();
    const node = state.explorerNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const preview = computePositionForMoves(node.data.movesPath);

    if (
      node.data.hiddenVariantsCount > 0 &&
      !state.explorerExpandedBranchIds.includes(nodeId)
    ) {
      const nextExpanded = [...state.explorerExpandedBranchIds, nodeId];
      const rebuilt = buildFamilyEcoTree(
        state.explorerFamily,
        new Set(nextExpanded)
      );
      set({
        explorerExpandedBranchIds: nextExpanded,
        explorerNodes: rebuilt.nodes,
        explorerEdges: rebuilt.edges,
        explorerSelectedNodeId: nodeId,
        explorerPreviewFen: preview.fen,
        explorerPreviewLastMove: preview.lastMove,
        explorerPreviewMovesLabel: preview.movesLabel,
      });
      return;
    }

    set({
      explorerSelectedNodeId: nodeId,
      explorerPreviewFen: preview.fen,
      explorerPreviewLastMove: preview.lastMove,
      explorerPreviewMovesLabel: preview.movesLabel,
    });
  },

  onExplorerNodesChange: (changes) => {
    set((state) => ({
      explorerNodes: applyNodeChanges(changes, state.explorerNodes),
    }));
  },

  onExplorerEdgesChange: (changes) => {
    set((state) => ({
      explorerEdges: applyEdgeChanges(changes, state.explorerEdges),
    }));
  },
});
