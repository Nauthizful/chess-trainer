import React, { useCallback, useEffect, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const DEFAULT_ZOOM = 1.15;

export interface MoveTreeCanvasProps<TNode extends Node> {
  nodes: TNode[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  nodeWidth: number;
  nodeHeight: number;
  selectedNodeId: string | null;
  autoFocusKey: string;
  focusOnSelectionChange?: boolean;
  onNodeClick?: (node: TNode) => void;
  onNodesChange?: (changes: NodeChange<TNode>[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  miniMapNodeColor?: (node: TNode) => string;
  header?: React.ReactNode;
}

export function MoveTreeCanvas<TNode extends Node>({
  nodes,
  edges,
  nodeTypes,
  nodeWidth,
  nodeHeight,
  selectedNodeId,
  autoFocusKey,
  focusOnSelectionChange = false,
  onNodeClick,
  onNodesChange,
  onEdgesChange,
  miniMapNodeColor,
  header,
}: MoveTreeCanvasProps<TNode>) {
  const rfInstanceRef = useRef<ReactFlowInstance<TNode, Edge> | null>(null);
  const lastFocusedKeyRef = useRef<string | null>(null);
  const nodesRef = useRef<TNode[]>(nodes);
  nodesRef.current = nodes;

  const focusNode = useCallback(
    (node: TNode, zoomOverride?: number) => {
      const instance = rfInstanceRef.current;
      if (!instance) return;
      const targetZoom = zoomOverride ?? Math.max(instance.getZoom(), 1.05);
      instance.setCenter(
        node.position.x + nodeWidth / 2,
        node.position.y + nodeHeight / 2,
        { zoom: targetZoom, duration: 340 }
      );
    },
    [nodeWidth, nodeHeight]
  );

  useEffect(() => {
    if (nodes.length === 0) return;

    if (lastFocusedKeyRef.current !== autoFocusKey) {
      lastFocusedKeyRef.current = autoFocusKey;
      const target =
        (focusOnSelectionChange &&
          nodes.find((n) => n.id === selectedNodeId)) ||
        nodes.find((n) => n.id === 'root') ||
        nodes[0];
      if (target) {
        setTimeout(() => focusNode(target, DEFAULT_ZOOM), 40);
      }
      return;
    }

    if (focusOnSelectionChange && selectedNodeId) {
      const target = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];
      if (target) {
        setTimeout(() => focusNode(target), 40);
      }
    }
  }, [autoFocusKey, nodes, selectedNodeId, focusOnSelectionChange, focusNode]);

  const handleInit = useCallback(
    (instance: ReactFlowInstance<TNode, Edge>) => {
      rfInstanceRef.current = instance;
      lastFocusedKeyRef.current = autoFocusKey;
      const target =
        nodes.find((n) => n.id === selectedNodeId) ??
        nodes.find((n) => n.id === 'root') ??
        nodes[0];
      if (target) {
        setTimeout(() => focusNode(target, DEFAULT_ZOOM), 40);
      }
    },
    [autoFocusKey, nodes, selectedNodeId, focusNode]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, clickedNode: TNode) => {
      onNodeClick?.(clickedNode);
      setTimeout(() => {
        const latest =
          nodesRef.current.find((n) => n.id === clickedNode.id) ?? clickedNode;
        focusNode(latest);
      }, 30);
    },
    [onNodeClick, focusNode]
  );

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[700px]">
      {header}

      <div className="flex-1 min-h-0 bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onInit={handleInit}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
            nodeColor={miniMapNodeColor}
            maskColor="rgba(2, 6, 23, 0.75)"
            className="!bg-slate-900 !border-slate-800"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
