'use client';

/**
 * TriggerEdge Component
 * 
 * Custom React Flow edge for form-to-integration connections.
 * Shows trigger labels only on hover for cleaner visualization.
 */

import { memo, useState } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';

export interface TriggerEdgeData {
  /** Comma-separated trigger labels */
  triggerLabels: string;
  /** Source form name */
  formName?: string;
}

function TriggerEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<TriggerEdgeData>) {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  if (!data) return null;

  const { triggerLabels } = data;
  const showLabel = selected || isHovered;

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#ffffff' : '#8b5cf6',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '5,5',
        }}
        markerEnd="url(#arrow-trigger)"
      />
      
      {/* Label on hover/select */}
      <EdgeLabelRenderer>
        <div
          className={`
            absolute pointer-events-none px-2 py-1 rounded text-xs
            transition-opacity duration-200
            ${showLabel ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: '#18181b',
            border: '1px solid #8b5cf6',
            color: '#c4b5fd',
          }}
        >
          <div className="text-[10px] text-zinc-400 mb-0.5">Emits:</div>
          <div className="font-medium max-w-[200px]">
            {triggerLabels}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const TriggerEdge = memo(TriggerEdgeComponent);

/**
 * Additional marker definition for trigger edges
 */
export function TriggerEdgeMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker
          id="arrow-trigger"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
        </marker>
      </defs>
    </svg>
  );
}
