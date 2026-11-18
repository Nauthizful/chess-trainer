import dagre from 'dagre';
import { Position, type Edge, type Node } from '@xyflow/react';

export interface TreeLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  nodesep?: number;
  ranksep?: number;
}

export function layoutBottomToTop<T extends Node>(
  nodes: T[],
  edges: Edge[],
  { nodeWidth, nodeHeight, nodesep = 28, ranksep = 56 }: TreeLayoutOptions
): { nodes: T[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'BT', nodesep, ranksep });

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
