import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Star } from 'lucide-react';

export interface OpeningMoveNodeData extends Record<string, unknown> {
  label: string;
  san: string | null;
  color: 'w' | 'b' | null;
  fen: string;
  movesPath: string[];
  eco: string | null;
  variantName: string | null;
  isRootLine: boolean;
  hiddenVariantsCount: number;
  inRepertoire?: boolean;
}

export type OpeningFlowNode = Node<OpeningMoveNodeData, 'openingMove'>;

export const OpeningMoveNode: React.FC<NodeProps<OpeningFlowNode>> = memo(
  ({ data, selected }) => {
    const isWhite = data.color === 'w';
    const isStart = data.san === null;

    return (
      <div
        className={`w-[196px] rounded-xl border px-2.5 py-2 shadow-lg transition-all duration-150 ${
          selected
            ? 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-400/40'
            : data.inRepertoire
            ? 'bg-slate-900/95 border-amber-400/80 ring-1 ring-amber-400/30'
            : data.isRootLine
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
                  ? 'text-emerald-300'
                  : isWhite
                  ? 'text-slate-100'
                  : 'text-slate-300'
              }`}
            >
              {data.label}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {data.inRepertoire && (
              <span title="Présent dans Mon Répertoire">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </span>
            )}
            {data.eco && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {data.eco}
              </span>
            )}
          </div>
        </div>

        {data.variantName && (
          <p
            className="mt-1 text-[10px] text-slate-300 leading-tight line-clamp-2"
            title={data.variantName}
          >
            {data.variantName}
          </p>
        )}

        {data.hiddenVariantsCount > 0 && (
          <div className="mt-1.5 flex justify-end">
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              +{data.hiddenVariantsCount} variante{data.hiddenVariantsCount > 1 ? 's' : ''}
            </span>
          </div>
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

OpeningMoveNode.displayName = 'OpeningMoveNode';
