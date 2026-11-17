import type { RepertoireNode } from '../types';

export interface QuizLine {
  id: string;
  nodes: RepertoireNode[];
  priorityScore: number;
}

export interface RepertoireGlobalStats {
  totalNodes: number;
  reviewedNodes: number;
  totalAttempts: number;
  totalSuccesses: number;
  successRate: number;
}

function scoreNodeUrgency(node: RepertoireNode, now: number): number {
  const attempts = node.stats?.attempts ?? 0;
  const successes = node.stats?.successes ?? 0;
  const lastReviewed = node.stats?.lastReviewed ?? 0;

  if (attempts === 0) {
    return 1000;
  }

  const failureRate = 1 - successes / attempts;
  const hoursSinceReview = lastReviewed
    ? Math.min(240, (now - lastReviewed) / (1000 * 60 * 60))
    : 240;

  return failureRate * 500 + hoursSinceReview * 2;
}

/**
 * Extracts all root-to-leaf lines from a UserRepertoire tree and sorts them
 * by spaced-repetition priority (unreviewed -> lowest success rate -> oldest review).
 */
export function extractRepertoireLines(root: RepertoireNode): QuizLine[] {
  const lines: QuizLine[] = [];
  const now = Date.now();

  const dfs = (node: RepertoireNode, pathNodes: RepertoireNode[]) => {
    if (node.children.length === 0) {
      if (pathNodes.length > 0) {
        const totalUrgency = pathNodes.reduce(
          (sum, n) => sum + scoreNodeUrgency(n, now),
          0
        );
        lines.push({
          id: node.id,
          nodes: pathNodes,
          priorityScore: totalUrgency / pathNodes.length,
        });
      }
      return;
    }

    for (const child of node.children) {
      dfs(child, [...pathNodes, child]);
    }
  };

  dfs(root, []);

  return lines.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Picks an opponent reply from children weighted by least-reviewed / lowest-success subtrees.
 */
export function pickWeightedOpponentChild(
  children: RepertoireNode[]
): RepertoireNode | null {
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];

  const now = Date.now();
  const weights = children.map((child) => {
    const base = scoreNodeUrgency(child, now);
    return Math.max(10, base);
  });

  const total = weights.reduce((acc, w) => acc + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < children.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return children[i];
  }
  return children[0];
}

export function computeRepertoireGlobalStats(
  root: RepertoireNode
): RepertoireGlobalStats {
  let totalNodes = 0;
  let reviewedNodes = 0;
  let totalAttempts = 0;
  let totalSuccesses = 0;

  const walk = (node: RepertoireNode, isRoot: boolean) => {
    if (!isRoot) {
      totalNodes += 1;
      const attempts = node.stats?.attempts ?? 0;
      const successes = node.stats?.successes ?? 0;
      if (attempts > 0) {
        reviewedNodes += 1;
        totalAttempts += attempts;
        totalSuccesses += successes;
      }
    }
    for (const child of node.children) {
      walk(child, false);
    }
  };

  walk(root, true);

  const successRate =
    totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : 0;

  return {
    totalNodes,
    reviewedNodes,
    totalAttempts,
    totalSuccesses,
    successRate,
  };
}

export function recordRepertoireNodeStat(
  root: RepertoireNode,
  nodeId: string,
  success: boolean
): RepertoireNode {
  const cloned: RepertoireNode = structuredClone(root);

  const visit = (node: RepertoireNode): boolean => {
    if (node.id === nodeId) {
      const prev = node.stats ?? { attempts: 0, successes: 0 };
      node.stats = {
        attempts: prev.attempts + 1,
        successes: prev.successes + (success ? 1 : 0),
        lastReviewed: Date.now(),
      };
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
