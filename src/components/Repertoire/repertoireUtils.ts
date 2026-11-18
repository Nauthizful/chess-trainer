import { Chess } from 'chess.js';
import { Position, type Edge } from '@xyflow/react';
import type { RepertoireFlowNode } from './RepertoireMoveNode';
import type { RepertoireNode, SquarePair, UserRepertoire } from '../../types';
import { INITIAL_FEN, parseUci } from '../../utils/chessHelpers';
import { formatMoveLabel } from '../../utils/chessFormatting';
import { layoutBottomToTop } from '../../utils/treeLayout';

const REPERTOIRE_STORAGE_KEY = 'chess-trainer-user-repertoire-v1';

export const REP_NODE_WIDTH = 188;
export const REP_NODE_HEIGHT = 60;

export function createRootRepertoireNode(): RepertoireNode {
  return {
    id: 'root',
    fen: INITIAL_FEN,
    san: '',
    uci: '',
    children: [],
  };
}

export function createEmptyRepertoire(): UserRepertoire {
  return {
    white: createRootRepertoireNode(),
    black: createRootRepertoireNode(),
  };
}

export function loadRepertoireFromStorage(): UserRepertoire {
  try {
    const raw = localStorage.getItem(REPERTOIRE_STORAGE_KEY);
    if (!raw) return createEmptyRepertoire();
    const parsed = JSON.parse(raw) as Partial<UserRepertoire>;
    if (!parsed.white || !parsed.black) return createEmptyRepertoire();
    return {
      white: parsed.white,
      black: parsed.black,
    };
  } catch {
    return createEmptyRepertoire();
  }
}

export function saveRepertoireToStorage(repertoire: UserRepertoire): void {
  try {
    localStorage.setItem(REPERTOIRE_STORAGE_KEY, JSON.stringify(repertoire));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Merges a sequence of SAN moves into a RepertoireNode tree without overwriting
 * existing variations or user notes. Returns the updated tree and the final node ID.
 */
export function mergeMovesIntoRepertoire(
  root: RepertoireNode,
  movesSan: string[],
  meta?: { eco?: string; openingName?: string }
): { updatedRoot: RepertoireNode; targetNodeId: string } {
  const clonedRoot: RepertoireNode = structuredClone(root);
  const board = new Chess();
  let current = clonedRoot;
  const pathSoFar: string[] = [];

  for (let i = 0; i < movesSan.length; i++) {
    const san = movesSan[i];
    let moveRes;
    try {
      moveRes = board.move(san);
    } catch {
      break;
    }
    if (!moveRes) break;

    pathSoFar.push(moveRes.san);
    const uci = `${moveRes.from}${moveRes.to}${moveRes.promotion ?? ''}`;
    const nodeId = `node-${pathSoFar.join('_')}`;
    const isLast = i === movesSan.length - 1;

    let child = current.children.find((c) => c.san === moveRes.san);
    if (!child) {
      child = {
        id: nodeId,
        fen: board.fen(),
        san: moveRes.san,
        uci,
        eco: isLast ? meta?.eco : undefined,
        openingName: isLast ? meta?.openingName : undefined,
        stats: { attempts: 0, successes: 0 },
        children: [],
      };
      current.children.push(child);
    } else if (isLast) {
      if (!child.eco && meta?.eco) child.eco = meta.eco;
      if (!child.openingName && meta?.openingName) {
        child.openingName = meta.openingName;
      }
    }

    current = child;
  }

  return { updatedRoot: clonedRoot, targetNodeId: current.id };
}

export function updateNodeNoteInTree(
  root: RepertoireNode,
  nodeId: string,
  note: string
): RepertoireNode {
  const cloned: RepertoireNode = structuredClone(root);
  const visit = (node: RepertoireNode): boolean => {
    if (node.id === nodeId) {
      node.note = note;
      return true;
    }
    for (const child of node.children) {
      if (visit(child)) return true;
    }
    return false;
  };
  visit(cloned);
  return cloned;
}

export function deleteBranchFromTree(
  root: RepertoireNode,
  nodeId: string
): RepertoireNode {
  if (nodeId === 'root') return root;
  const cloned: RepertoireNode = structuredClone(root);
  const visit = (node: RepertoireNode): boolean => {
    const idx = node.children.findIndex((c) => c.id === nodeId);
    if (idx !== -1) {
      node.children.splice(idx, 1);
      return true;
    }
    for (const child of node.children) {
      if (visit(child)) return true;
    }
    return false;
  };
  visit(cloned);
  return cloned;
}

export function mergeRepertoireTrees(
  base: RepertoireNode,
  incoming: RepertoireNode
): RepertoireNode {
  const cloned: RepertoireNode = structuredClone(base);

  const mergeNode = (target: RepertoireNode, source: RepertoireNode) => {
    if (!target.note && source.note) target.note = source.note;
    if (!target.eco && source.eco) target.eco = source.eco;
    if (!target.openingName && source.openingName) {
      target.openingName = source.openingName;
    }

    for (const srcChild of source.children) {
      const existing = target.children.find((c) => c.san === srcChild.san);
      if (existing) {
        mergeNode(existing, srcChild);
      } else {
        target.children.push(structuredClone(srcChild));
      }
    }
  };

  mergeNode(cloned, incoming);
  return cloned;
}

export function findRepertoireNodeById(
  root: RepertoireNode,
  nodeId: string
): { node: RepertoireNode; movesPath: string[]; lastMove: SquarePair | null } | null {
  const dfs = (
    node: RepertoireNode,
    path: string[]
  ): { node: RepertoireNode; movesPath: string[]; lastMove: SquarePair | null } | null => {
    if (node.id === nodeId) {
      const parsed = parseUci(node.uci);
      const lastMove = parsed ? { from: parsed.from, to: parsed.to } : null;
      return { node, movesPath: path, lastMove };
    }
    for (const child of node.children) {
      const found = dfs(child, [...path, child.san]);
      if (found) return found;
    }
    return null;
  };
  return dfs(root, []);
}

export function findParentRepertoireNodeId(
  root: RepertoireNode,
  targetId: string
): string | null {
  if (targetId === 'root') return null;
  const dfs = (node: RepertoireNode): string | null => {
    for (const child of node.children) {
      if (child.id === targetId) return node.id;
      const found = dfs(child);
      if (found) return found;
    }
    return null;
  };
  return dfs(root);
}

export function parsePgnOrMovesLine(rawInput: string): {
  moves: string[];
  error?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { moves: [], error: 'Veuillez coller une suite de coups ou un PGN.' };
  }

  try {
    const chess = new Chess();
    chess.loadPgn(trimmed);
    const history = chess.history();
    if (history.length > 0) {
      return { moves: history };
    }
  } catch {
    // Fallback to token-by-token SAN parsing below
  }

  const cleaned = trimmed
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\b\d+\.+/g, ' ')
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, ' ');

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const board = new Chess();
  const moves: string[] = [];

  for (const token of tokens) {
    try {
      const res = board.move(token);
      if (res) {
        moves.push(res.san);
      } else {
        return {
          moves: [],
          error: `Coup invalide ou illégal détecté : "${token}"`,
        };
      }
    } catch {
      return {
        moves: [],
        error: `Coup invalide ou illégal détecté : "${token}"`,
      };
    }
  }

  if (moves.length === 0) {
    return { moves: [], error: 'Aucun coup valide trouvé dans le texte.' };
  }

  return { moves };
}

/**
 * Collects all move-sequence keys ("e4 e5 Nf3") present in both White & Black repertoires
 * so Explorer nodes can show a visual badge when already saved.
 */
export function collectRepertoirePathKeys(repertoire: UserRepertoire): Set<string> {
  const keys = new Set<string>();
  const walk = (node: RepertoireNode, path: string[]) => {
    if (path.length > 0) {
      keys.add(path.join(' '));
    }
    for (const child of node.children) {
      walk(child, [...path, child.san]);
    }
  };
  walk(repertoire.white, []);
  walk(repertoire.black, []);
  return keys;
}

export function buildRepertoireFlowGraph(
  root: RepertoireNode,
  sideLabel: 'Blancs' | 'Noirs'
): { nodes: RepertoireFlowNode[]; edges: Edge[] } {
  const rawNodes: RepertoireFlowNode[] = [];
  const rawEdges: Edge[] = [];

  const walk = (
    node: RepertoireNode,
    parentId: string | null,
    path: string[]
  ) => {
    const ply = path.length;
    const isStart = ply === 0;
    const isWhiteMove = ply % 2 === 1;
    const label = isStart
      ? `Départ (${sideLabel})`
      : formatMoveLabel(node.san, ply);

    rawNodes.push({
      id: node.id,
      type: 'repertoireMove',
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      position: { x: 0, y: 0 },
      data: {
        label,
        san: node.san,
        color: isStart ? null : isWhiteMove ? 'w' : 'b',
        fen: node.fen,
        movesPath: path,
        eco: node.eco,
        openingName: node.openingName,
        hasNote: Boolean(node.note && node.note.trim().length > 0),
        notePreview: node.note,
      },
    });

    if (parentId) {
      rawEdges.push({
        id: `rep-edge-${parentId}->${node.id}`,
        source: parentId,
        target: node.id,
        style: { stroke: '#10b981', strokeWidth: 2 },
      });
    }

    for (const child of node.children) {
      walk(child, node.id, [...path, child.san]);
    }
  };

  walk(root, null, []);

  return layoutBottomToTop(rawNodes, rawEdges, {
    nodeWidth: REP_NODE_WIDTH,
    nodeHeight: REP_NODE_HEIGHT,
  });
}
