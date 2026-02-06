'use client';

/**
 * WorkflowEdge Component
 * 
 * Custom React Flow edge representing a workflow connection.
 * Shows workflow status through color and animation.
 */

import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import { NetworkEdgeData } from './types';

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<NetworkEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  if (!data) return null;

  const { workflowName, enabled, canEnable, errors } = data;
  const hasErrors = errors.length > 0;

  // Determine edge color based on status
  let strokeColor = '#52525b'; // zinc-600 - disabled
  let strokeWidth = 2;
  
  if (hasErrors) {
    strokeColor = '#eab308'; // yellow-500 - errors
    strokeWidth = 2;
  } else if (enabled) {
    strokeColor = '#22c55e'; // green-500 - enabled
    strokeWidth = 2;
  } else if (canEnable) {
    strokeColor = '#71717a'; // zinc-500 - can enable but disabled
  }

  if (selected) {
    strokeWidth = 3;
    strokeColor = '#ffffff';
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: enabled ? undefined : '5,5',
        }}
        markerEnd={`url(#arrow-${enabled ? 'enabled' : hasErrors ? 'warning' : 'disabled'})`}
      />
      
      {/* Label on hover/select */}
      <EdgeLabelRenderer>
        <div
          className={`
            absolute pointer-events-auto px-2 py-1 rounded text-xs
            transition-opacity duration-200
            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: hasErrors ? '#422006' : enabled ? '#14532d' : '#27272a',
            border: `1px solid ${hasErrors ? '#ca8a04' : enabled ? '#22c55e' : '#52525b'}`,
            color: hasErrors ? '#fef08a' : enabled ? '#86efac' : '#a1a1aa',
          }}
        >
          <div className="flex items-center gap-1.5">
            {/* Status indicator */}
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasErrors ? 'bg-yellow-500' : enabled ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'
              }`}
            />
            <span className="font-medium truncate max-w-[150px]">
              {workflowName}
            </span>
          </div>
          {hasErrors && (
            <div className="text-[10px] text-yellow-400/80 mt-0.5 truncate max-w-[150px]">
              {errors[0]}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const WorkflowEdge = memo(WorkflowEdgeComponent);

/**
 * SVG marker definitions for edge arrows
 */
export function EdgeMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {/* Enabled arrow (green) */}
        <marker
          id="arrow-enabled"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
        </marker>
        
        {/* Warning arrow (yellow) */}
        <marker
          id="arrow-warning"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#eab308" />
        </marker>
        
        {/* Disabled arrow (gray) */}
        <marker
          id="arrow-disabled"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>
    </svg>
  );
}
