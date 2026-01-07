'use client';

import { ArrowRight } from 'lucide-react';
import { WorkflowNode } from './workflow-node';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';

interface WorkflowAction {
  adapter: string;
  operation: string;
  params: Record<string, unknown>;
}

interface WorkflowFlowProps {
  /** Trigger adapter ID */
  triggerAdapter: string;
  /** Trigger operation name */
  triggerOperation: string;
  /** Array of actions */
  actions: WorkflowAction[];
  /** Whether to show expanded view */
  isExpanded: boolean;
}

/**
 * Collapsed view - simple horizontal text: "Calendly → MailerLite, RevLine"
 */
function CollapsedFlow({
  triggerAdapter,
  actions,
}: {
  triggerAdapter: string;
  actions: WorkflowAction[];
}) {
  const triggerStyle = getIntegrationStyle(triggerAdapter);
  const TriggerIcon = triggerStyle.icon;

  // Get unique action adapters
  const actionAdapters = [...new Set(actions.map((a) => a.adapter))];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Trigger */}
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 ${triggerStyle.bgClass} ${triggerStyle.borderClass} border rounded`}>
        <TriggerIcon className={`w-3.5 h-3.5 ${triggerStyle.textClass}`} />
        <span className={`text-xs font-medium ${triggerStyle.textClass}`}>
          {triggerStyle.name}
        </span>
      </div>

      {/* Arrow */}
      {actionAdapters.length > 0 && (
        <ArrowRight className="w-4 h-4 text-zinc-600" />
      )}

      {/* Action integrations */}
      {actionAdapters.map((adapter) => {
        const style = getIntegrationStyle(adapter);
        const Icon = style.icon;
        return (
          <div
            key={adapter}
            className={`inline-flex items-center gap-1.5 px-2 py-1 ${style.bgClass} ${style.borderClass} border rounded`}
          >
            <Icon className={`w-3.5 h-3.5 ${style.textClass}`} />
            <span className={`text-xs font-medium ${style.textClass}`}>
              {style.name}
            </span>
          </div>
        );
      })}

      {/* Empty state */}
      {actions.length === 0 && (
        <span className="text-xs text-zinc-500 italic">No actions</span>
      )}
    </div>
  );
}

/**
 * SVG Connector for desktop view (horizontal)
 * Draws a line from trigger to vertically-stacked actions
 */
function DesktopConnector({ actionCount }: { actionCount: number }) {
  if (actionCount === 0) return null;

  const height = actionCount === 1 ? 32 : Math.max(actionCount * 52 - 16, 70);
  const midY = height / 2;

  return (
    <svg
      className="hidden sm:block shrink-0"
      width="36"
      height={height}
      viewBox={`0 0 36 ${height}`}
    >
      {actionCount === 1 ? (
        // Single action: straight horizontal line with arrow
        <>
          <line x1="0" y1={midY} x2="28" y2={midY} stroke="#3f3f46" strokeWidth="1.5" />
          <polygon points={`28,${midY - 3} 36,${midY} 28,${midY + 3}`} fill="#3f3f46" />
        </>
      ) : (
        // Multiple actions: branching lines
        <>
          {/* Main horizontal line from trigger */}
          <line x1="0" y1={midY} x2="14" y2={midY} stroke="#3f3f46" strokeWidth="1.5" />
          {/* Vertical line for branching */}
          <line x1="14" y1={16} x2="14" y2={height - 16} stroke="#3f3f46" strokeWidth="1.5" />
          {/* Horizontal branches to each action with arrows */}
          {Array.from({ length: actionCount }).map((_, i) => {
            const y = 16 + (i * (height - 32)) / Math.max(actionCount - 1, 1);
            return (
              <g key={i}>
                <line x1="14" y1={y} x2="28" y2={y} stroke="#3f3f46" strokeWidth="1.5" />
                <polygon points={`28,${y - 3} 36,${y} 28,${y + 3}`} fill="#3f3f46" />
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}

/**
 * SVG Connector for mobile view (vertical)
 * Draws a line from trigger down to horizontally-arranged actions
 */
function MobileConnector({ actionCount }: { actionCount: number }) {
  if (actionCount === 0) return null;

  const width = actionCount === 1 ? 36 : Math.max(actionCount * 70, 100);
  const midX = width / 2;

  return (
    <svg
      className="block sm:hidden shrink-0"
      width={width}
      height="32"
      viewBox={`0 0 ${width} 32`}
    >
      {actionCount === 1 ? (
        // Single action: straight vertical line with arrow
        <>
          <line x1={midX} y1="0" x2={midX} y2="24" stroke="#3f3f46" strokeWidth="1.5" />
          <polygon points={`${midX - 3},24 ${midX},32 ${midX + 3},24`} fill="#3f3f46" />
        </>
      ) : (
        // Multiple actions: branching lines
        <>
          {/* Main vertical line from trigger */}
          <line x1={midX} y1="0" x2={midX} y2="12" stroke="#3f3f46" strokeWidth="1.5" />
          {/* Horizontal line for branching */}
          <line x1={16} y1="12" x2={width - 16} y2="12" stroke="#3f3f46" strokeWidth="1.5" />
          {/* Vertical branches to each action with arrows */}
          {Array.from({ length: actionCount }).map((_, i) => {
            const x = 16 + (i * (width - 32)) / Math.max(actionCount - 1, 1);
            return (
              <g key={i}>
                <line x1={x} y1="12" x2={x} y2="24" stroke="#3f3f46" strokeWidth="1.5" />
                <polygon points={`${x - 3},24 ${x},32 ${x + 3},24`} fill="#3f3f46" />
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}

/**
 * WorkflowFlow - Visualizes a workflow as a branching flow diagram
 *
 * Expanded:
 *   Desktop: Trigger on left, actions branch right (stacked vertically)
 *   Mobile: Trigger on top, actions below (side-by-side)
 *
 * Collapsed:
 *   Simple horizontal line: "Calendly → MailerLite, RevLine"
 */
export function WorkflowFlow({
  triggerAdapter,
  triggerOperation,
  actions,
  isExpanded,
}: WorkflowFlowProps) {
  // Collapsed view - simple horizontal text
  if (!isExpanded) {
    return <CollapsedFlow triggerAdapter={triggerAdapter} actions={actions} />;
  }

  // Expanded view - full branching visualization
  const hasActions = actions.length > 0;

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-0">
      {/* Trigger Node */}
      <WorkflowNode
        adapter={triggerAdapter}
        operation={triggerOperation}
        variant="trigger"
        isExpanded={isExpanded}
      />

      {/* Connectors and Actions */}
      {hasActions && (
        <>
          {/* Desktop Connector */}
          <DesktopConnector actionCount={actions.length} />

          {/* Mobile Connector */}
          <MobileConnector actionCount={actions.length} />

          {/* Actions Container */}
          <div
            className={`
              flex
              flex-row sm:flex-col
              flex-wrap sm:flex-nowrap
              justify-center sm:justify-start
              items-center sm:items-start
              gap-2
            `}
          >
            {actions.map((action, idx) => (
              <WorkflowNode
                key={idx}
                adapter={action.adapter}
                operation={action.operation}
                params={action.params}
                variant="action"
                isExpanded={isExpanded}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasActions && (
        <span className="text-xs text-zinc-500 italic ml-4">No actions</span>
      )}
    </div>
  );
}

