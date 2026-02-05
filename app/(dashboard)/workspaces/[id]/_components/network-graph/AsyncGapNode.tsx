'use client';

/**
 * AsyncGapNode Component
 * 
 * Visual indicator representing an asynchronous gap between phases.
 * This represents user action (like clicking a magic link) that separates
 * the pre-trigger operations from the trigger-phase operations.
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { AsyncGapNodeData } from './types';

function AsyncGapNodeComponent({ data }: NodeProps<AsyncGapNodeData>) {
  const { label } = data;

  return (
    <div
      className="
        relative px-3 py-2 rounded-lg border-2 border-dashed
        border-zinc-600 bg-zinc-900/50 min-w-[100px] max-w-[120px]
        transition-all duration-200
        hover:border-zinc-500
      "
    >
      {/* Left handle (incoming from pre-phase) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
      />

      {/* Right handle (outgoing to trigger-phase) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
      />

      {/* Content - matching other node structure */}
      <div className="flex items-center gap-3 text-zinc-500">
        <Clock className="w-4 h-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-400">{label}</div>
          <div className="text-[10px] text-zinc-500">async</div>
        </div>
      </div>
    </div>
  );
}

export const AsyncGapNode = memo(AsyncGapNodeComponent);
