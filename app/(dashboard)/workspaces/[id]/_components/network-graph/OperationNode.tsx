'use client';

/**
 * OperationNode Component
 * 
 * Custom React Flow node representing a baked-in operation from a form.
 * Styled to match IntegrationNode for visual consistency.
 * 
 * Has handles on all 4 sides:
 * - Left: incoming from previous phase (form or gap)
 * - Right: outgoing to next phase (gap or revline)
 * - Top: incoming from operation above (vertical stacking)
 * - Bottom: outgoing to operation below (vertical stacking)
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';
import { OperationNodeData } from './types';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';

function OperationNodeComponent({ data, selected }: NodeProps<OperationNodeData>) {
  const {
    adapter,
    operation,
    label,
    conditional,
    hasLeftConnection,
    hasRightConnection,
    hasTopConnection,
    hasBottomConnection,
  } = data;

  const style = getIntegrationStyle(adapter);
  const Icon = style.icon;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 min-w-[140px] max-w-[180px]
        transition-all duration-200
        ${selected 
          ? 'border-white shadow-lg shadow-white/20' 
          : 'border-zinc-700 bg-zinc-800/80'
        }
        hover:border-zinc-500
      `}
      style={{
        boxShadow: selected ? `0 0 20px ${style.color}40` : undefined,
      }}
    >
      {/* Left handle (incoming from previous phase) */}
      {hasLeftConnection && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
        />
      )}

      {/* Right handle (outgoing to next phase) */}
      {hasRightConnection && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
        />
      )}

      {/* Top handle (incoming from op above) */}
      {hasTopConnection && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
        />
      )}

      {/* Bottom handle (outgoing to op below) */}
      {hasBottomConnection && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
        />
      )}

      {/* Conditional indicator */}
      {conditional && (
        <div className="absolute -top-2 -right-2" title="Conditional operation">
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
      )}

      {/* Content - matching IntegrationNode structure */}
      <div className="flex items-center gap-2.5">
        {/* Integration logo or icon fallback */}
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: `${style.color}20` }}
        >
          {style.logo ? (
            <img 
              src={style.logo} 
              alt={style.name} 
              className="w-5 h-5 object-contain"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <Icon className={`w-4 h-4 ${style.logo ? 'hidden' : ''}`} style={{ color: style.color }} />
        </div>

        {/* Name and operation */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {style.name}
          </div>
          <div className="text-[10px] text-zinc-400 truncate">
            {label || operation}
          </div>
        </div>
      </div>
    </div>
  );
}

export const OperationNode = memo(OperationNodeComponent);
