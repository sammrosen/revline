'use client';

/**
 * FormNode Component
 * 
 * Custom React Flow node representing a form in the network graph.
 * Compact version - operations are now their own nodes.
 * Shows form name, type, and emitted triggers.
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText, AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import { FormNodeData } from './types';

function FormNodeComponent({ data, selected }: NodeProps<FormNodeData>) {
  const {
    name,
    description,
    type,
    enabled,
    operations,
    triggers,
  } = data;

  const hasOperations = operations.length > 0;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 min-w-[180px] max-w-[220px]
        transition-all duration-200
        ${selected 
          ? 'border-violet-400 shadow-lg shadow-violet-500/20' 
          : enabled
            ? 'border-violet-600/50 bg-violet-950/30'
            : 'border-zinc-700 bg-zinc-800/50'
        }
        hover:border-violet-500/70
      `}
    >
      {/* Right handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-violet-400"
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-violet-600/20">
          <FileText className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{name}</div>
          <div className="text-[10px] text-zinc-500">{type} form</div>
        </div>
        {/* Enabled indicator */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            enabled ? 'bg-emerald-500' : 'bg-zinc-600'
          }`}
        />
      </div>

      {/* Operations count - clicking form shows details */}
      {hasOperations && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center gap-1 text-[10px] text-zinc-400">
          <ArrowRight className="w-3 h-3" />
          <span>{operations.length} operations</span>
        </div>
      )}

      {/* Triggers summary */}
      {triggers.length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400/80">
          <Zap className="w-3 h-3" />
          <span>{triggers.length} trigger{triggers.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Not enabled warning */}
      {!enabled && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center gap-1 text-[10px] text-zinc-500">
          <AlertTriangle className="w-3 h-3" />
          <span>Disabled</span>
        </div>
      )}
    </div>
  );
}

export const FormNode = memo(FormNodeComponent);
