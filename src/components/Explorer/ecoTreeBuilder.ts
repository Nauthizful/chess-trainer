import dagre from 'dagre';
import { Chess } from 'chess.js';
import { Position, type Edge } from '@xyflow/react';
import type { OpeningFlowNode } from './OpeningMoveNode';
import type { Opening, OpeningFamily, SquarePair } from '../../types';

export const ECO_NODE_WIDTH = 196;
export const ECO_NODE_HEIGHT = 72;
const LARGE_FAMILY_NODE_THRESHOLD = 60;
const INITIAL_DEPTH_LIMIT = 8;
const EXPAND_DEPTH_STEP = 4;

export function formatMoveLabel(san: string, plyIndex: number): string {
  const moveNumber = Math.floor((plyIndex - 1) / 2) + 1;
  const isWhite = plyIndex % 2 === 1;
  return isWhite ? `${moveNumber}. ${san}` : `${moveNumber}... ${san}`;
}

export function formatMovesSequence(moves: string[]): string {
  if (moves.length === 0) return 'Position de départ';
  return moves
    .map((san, idx) =>
      idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${san}` : san
    )
    .join(' ');
}

export function computePositionForMoves(movesPath: string[]): {
  fen: string;
  lastMove: SquarePair | null;
  movesLabel: string;
} {
  const chess = new Chess();
  let lastMove: SquarePair | null = null;
  for (const san of movesPath) {
    try {
      const res = chess.move(san);
      lastMove = { from: res.from, to: res.to };
    } catch {
      break;
    }
  }
  return {
    fen: chess.fen(),
    lastMove,
    movesLabel: formatMovesSequence(movesPath),
  };
}

function layoutBottomToTop(
  nodes: OpeningFlowNode[],
  edges: Edge[]
): { nodes: OpeningFlowNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'BT', nodesep: 28, ranksep: 56 });

  for (const node of nodes) {
    g.setNode(node.id, { width: ECO_NODE_WIDTH, height: ECO_NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      position: {
        x: pos.x - ECO_NODE_WIDTH / 2,
        y: pos.y - ECO_NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}

interface EcoTrieNode {
  id: string;
  ply: number;
  label: string;
  san: string | null;
  color: 'w' | 'b' | null;
  fen: string;
  movesPath: string[];
  eco: string | null;
  variantName: string | null;
  isRootLine: boolean;
  children: Map<string, EcoTrieNode>;
  descendantLeafCount: number;
}

function countTrieStats(node: EcoTrieNode): {
  totalNodes: number;
  descendantOpenings: number;
} {
  let totalNodes = 1;
  let descendantOpenings = 0;

  for (const child of node.children.values()) {
    const childStats = countTrieStats(child);
    totalNodes += childStats.totalNodes;
    descendantOpenings +=
      childStats.descendantOpenings + (child.variantName ? 1 : 0);
  }

  // Fallback if a branch has moves without explicit terminal name
  if (node.children.size > 0 && descendantOpenings === 0) {
    descendantOpenings = node.children.size;
  }

  node.descendantLeafCount = descendantOpenings;
  return { totalNodes, descendantOpenings };
}

/**
 * Merges all openings of an OpeningFamily into one unified theoretical ECO tree.
 * If the merged tree exceeds 60 nodes, initially displays up to 8 plies of depth
 * and marks leaf nodes with "+X variantes" so clicking them unfolds deeper branches.
 */
export function buildFamilyEcoTree(
  family: OpeningFamily,
  expandedBranchIds: Set<string> = new Set()
): {
  nodes: OpeningFlowNode[];
  edges: Edge[];
  initialSelectedNodeId: string;
  totalTrieNodes: number;
} {
  const rootFen = new Chess().fen();
  const rootTrie: EcoTrieNode = {
    id: 'root',
    ply: 0,
    label: 'Position initiale',
    san: null,
    color: null,
    fen: rootFen,
    movesPath: [],
    eco: null,
    variantName: family.familyName,
    isRootLine: true,
    children: new Map(),
    descendantLeafCount: 0,
  };

  const sortedOpenings: Opening[] = [...family.openings].sort(
    (a, b) => a.moves.length - b.moves.length
  );
  const repId = family.representativeOpening.id;

  for (const opening of sortedOpenings) {
    const isRep = opening.id === repId;
    const board = new Chess();
    let current = rootTrie;
    const pathSoFar: string[] = [];

    for (let i = 0; i < opening.moves.length; i++) {
      const san = opening.moves[i];
      let moveRes;
      try {
        moveRes = board.move(san);
      } catch {
        break;
      }
      if (!moveRes) break;

      pathSoFar.push(moveRes.san);
      const nodeId = `node-${pathSoFar.join('_')}`;
      const isFinalPly = i === opening.moves.length - 1;

      let child = current.children.get(moveRes.san);
      if (!child) {
        child = {
          id: nodeId,
          ply: pathSoFar.length,
          label: formatMoveLabel(moveRes.san, pathSoFar.length),
          san: moveRes.san,
          color: moveRes.color,
          fen: board.fen(),
          movesPath: [...pathSoFar],
          eco: isFinalPly ? opening.eco : null,
          variantName: isFinalPly
            ? opening.variationName ?? opening.name
            : null,
          isRootLine: isRep,
          children: new Map(),
          descendantLeafCount: 0,
        };
        current.children.set(moveRes.san, child);
      } else {
        if (isRep) {
          child.isRootLine = true;
        }
        if (isFinalPly && !child.variantName) {
          child.eco = opening.eco;
          child.variantName = opening.variationName ?? opening.name;
        }
      }

      current = child;
    }
  }

  const { totalNodes: totalTrieNodes } = countTrieStats(rootTrie);
  const enforceDepthLimit = totalTrieNodes > LARGE_FAMILY_NODE_THRESHOLD;

  const flowNodes: OpeningFlowNode[] = [];
  const flowEdges: Edge[] = [];

  const traverse = (
    trieNode: EcoTrieNode,
    parentId: string | null,
    allowedMaxPly: number
  ) => {
    const effectiveMaxPly = expandedBranchIds.has(trieNode.id)
      ? Math.max(allowedMaxPly, trieNode.ply + EXPAND_DEPTH_STEP)
      : allowedMaxPly;

    const hasChildren = trieNode.children.size > 0;
    const canShowChildren = !enforceDepthLimit || trieNode.ply < effectiveMaxPly;
    const hiddenCount =
      hasChildren && !canShowChildren
        ? Math.max(1, trieNode.descendantLeafCount)
        : 0;

    flowNodes.push({
      id: trieNode.id,
      type: 'openingMove',
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      position: { x: 0, y: 0 },
      data: {
        label: trieNode.label,
        san: trieNode.san,
        color: trieNode.color,
        fen: trieNode.fen,
        movesPath: trieNode.movesPath,
        eco: trieNode.eco,
        variantName: trieNode.variantName,
        isRootLine: trieNode.isRootLine,
        hiddenVariantsCount: hiddenCount,
      },
    });

    if (parentId) {
      flowEdges.push({
        id: `edge-${parentId}->${trieNode.id}`,
        source: parentId,
        target: trieNode.id,
        style: {
          stroke: trieNode.isRootLine ? '#f59e0b' : '#10b981',
          strokeWidth: trieNode.isRootLine ? 2.5 : 1.75,
        },
      });
    }

    if (canShowChildren) {
      for (const child of trieNode.children.values()) {
        traverse(child, trieNode.id, effectiveMaxPly);
      }
    }
  };

  traverse(
    rootTrie,
    null,
    enforceDepthLimit ? INITIAL_DEPTH_LIMIT : Number.MAX_SAFE_INTEGER
  );

  const repTipId =
    family.representativeOpening.moves.length > 0
      ? `node-${family.representativeOpening.moves.join('_')}`
      : 'root';

  const visibleNodeIds = new Set(flowNodes.map((n) => n.id));
  const initialSelectedNodeId = visibleNodeIds.has(repTipId) ? repTipId : 'root';

  const laidOut = layoutBottomToTop(flowNodes, flowEdges);
  return {
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    initialSelectedNodeId,
    totalTrieNodes,
  };
}
