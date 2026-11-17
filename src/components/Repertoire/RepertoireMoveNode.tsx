import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { StickyNote } from 'lucide-react';

export interface RepertoireFlowNodeData extends Record<string, unknown> {
  label: string;
  san: string;
  color: 'w' | 'b' | null;
  fen: string;
  movesPath: string[];
  eco?: string;
  openingName?: string;
  hasNote: boolean;
  notePreview?: string;
}

export type RepertoireFlowNode = Node<RepertoireFlowNodeData, 'repertoireMove'>;

export const RepertoireMoveNode: React.FC<NodeProps<RepertoireFlowNode>> = memo(
  ({ data, selected }) => {
    const isStart = !data.san;
    const isWhite = data.color === 'w';

    return (
      <div
        className={`w-[188px] rounded-xl border px-2.5 py-2 shadow-lg transition-all duration-150 ${
          selected
            ? 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-400/40'
            : isStart
            ? 'bg-slate-900/95 border-amber-500/50 hover:border-amber-400'
            : 'bg-slate-900/90 border-slate-700 hover:border-emerald-400/60'
        }`}
      >
        <Handle
          type="target"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-slate-500 !border-slate-900"
        />

        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {!isStart && (
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 border ${
                  isWhite
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-950 border-slate-400'
                }`}
              />
            )}
            <span
              className={`font-mono text-xs font-bold truncate ${
                isStart
                  ? 'text-amber-300'
                  : isWhite
                  ? 'text-slate-100'
                  : 'text-slate-300'
              }`}
            >
              {data.label}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {data.hasNote && (
              <span
                title={data.notePreview || 'Note personnelle'}
                className="p-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35"
              >
                <StickyNote className="w-3 h-3" />
              </span>
            )}
            {data.eco && (
              <span className="px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-amber-300 border border-slate-700">
                {data.eco}
              </span>
            )}
          </div>
        </div>

        {data.openingName && (
          <p
            className="mt-1 text-[10px] text-slate-300 leading-tight line-clamp-1"
            title={data.openingName}
          >
            {data.openingName}
          </p>
        )}

        <Handle
          type="source"
          position={Position.Top}
          className="!w-2 !h-2 !bg-slate-500 !border-slate-900"
        />
      </div>
    );
  }
);

RepertoireMoveNode.displayName = 'RepertoireMoveNode';
