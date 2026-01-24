'use client';

/**
 * IntegrationNode Component
 * 
 * Custom React Flow node representing an integration in the network graph.
 * Shows integration name, health status, and connection counts.
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import { NetworkNodeData } from './types';

function IntegrationNodeComponent({ data, selected }: NodeProps<NetworkNodeData>) {
  const {
    name,
    color,
    configured,
    healthy,
    triggerCount,
    actionCount,
  } = data;

  const hasIssues = !configured || !healthy;
  const isTrigger = triggerCount > 0;
  const isAction = actionCount > 0;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 min-w-[160px]
        transition-all duration-200
        ${selected 
          ? 'border-white shadow-lg shadow-white/20' 
          : hasIssues 
            ? 'border-yellow-500/50 bg-yellow-500/5' 
            : 'border-zinc-700 bg-zinc-800/80'
        }
        hover:border-zinc-500
      `}
      style={{
        boxShadow: selected ? `0 0 20px ${color}40` : undefined,
      }}
    >
      {/* Left handle (for incoming connections - as action target) */}
      {isAction && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
        />
      )}

      {/* Right handle (for outgoing connections - as trigger source) */}
      {isTrigger && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-500"
        />
      )}

      {/* Warning indicator */}
      {hasIssues && (
        <div className="absolute -top-2 -right-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
        </div>
      )}

      {/* Content */}
      <div className="flex items-center gap-3">
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Name and stats */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {name}
          </div>
          
          {/* Connection counts */}
          <div className="flex items-center gap-2 mt-0.5">
            {isTrigger && (
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                <ArrowRight className="w-3 h-3" />
                {triggerCount}
              </span>
            )}
            {isAction && (
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                <ArrowLeft className="w-3 h-3" />
                {actionCount}
              </span>
            )}
          </div>
        </div>

        {/* Health indicator */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            hasIssues ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
        />
      </div>

      {/* Not configured warning */}
      {!configured && (
        <div className="text-[10px] text-yellow-400 mt-1">
          Not configured
        </div>
      )}
    </div>
  );
}

export const IntegrationNode = memo(IntegrationNodeComponent);
