'use client';

import { getIntegrationStyle, getOperationLabel } from '@/app/_lib/workflow/integration-config';

interface WorkflowNodeProps {
  /** Adapter ID (e.g., 'calendly', 'mailerlite') */
  adapter: string;
  /** Operation name (e.g., 'booking_created', 'add_to_group') */
  operation: string;
  /** Action parameters (optional, only shown in expanded view) */
  params?: Record<string, unknown>;
  /** Node type - affects subtle styling */
  variant: 'trigger' | 'action';
  /** Whether to show expanded view with all details */
  isExpanded: boolean;
}

/**
 * Format parameter value for display
 */
function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/**
 * Get key params to display based on operation
 */
function getDisplayParams(
  operation: string,
  params?: Record<string, unknown>
): Array<{ label: string; value: string }> {
  if (!params) return [];

  const displayParams: Array<{ label: string; value: string }> = [];

  if (params.group) {
    displayParams.push({ label: 'Group', value: formatParamValue(params.group) });
  }
  if (params.stage) {
    displayParams.push({ label: 'Stage', value: formatParamValue(params.stage) });
  }
  if (params.tag) {
    displayParams.push({ label: 'Tag', value: formatParamValue(params.tag) });
  }
  if (params.source) {
    displayParams.push({ label: 'Source', value: formatParamValue(params.source) });
  }
  if (params.eventType) {
    displayParams.push({ label: 'Event', value: formatParamValue(params.eventType) });
  }
  if (params.flowId) {
    displayParams.push({ label: 'Flow', value: formatParamValue(params.flowId) });
  }

  return displayParams;
}

/**
 * WorkflowNode - A card representing a trigger or action in a workflow
 *
 * Expanded view:
 * - Row 1: Icon + Integration name
 * - Row 2: Operation label
 * - Row 3: Parameters (if any)
 *
 * Collapsed view:
 * - Icon + Integration name only
 */
export function WorkflowNode({
  adapter,
  operation,
  params,
  variant,
  isExpanded,
}: WorkflowNodeProps) {
  const style = getIntegrationStyle(adapter);
  const operationLabel = getOperationLabel(operation);
  const displayParams = getDisplayParams(operation, params);
  const Icon = style.icon;

  return (
    <div
      className={`
        ${isExpanded ? 'w-32' : 'w-24'}
        ${style.bgClass}
        ${style.borderClass}
        border rounded-lg
        flex flex-col
        shrink-0
        ${variant === 'trigger' ? 'ring-1 ring-white/10' : ''}
      `}
    >
      {/* Row 1: Icon + Integration name */}
      <div className={`flex items-center gap-1.5 ${isExpanded ? 'px-2.5 py-1.5' : 'px-2 py-1.5'}`}>
        <Icon className={`${style.textClass} w-3.5 h-3.5 shrink-0`} />
        <span className={`${style.textClass} font-medium text-[11px]`}>
          {style.name}
        </span>
      </div>

      {/* Expanded: Row 2 - Operation label */}
      {isExpanded && (
        <div className="px-2.5 pb-1.5 -mt-0.5">
          <span className="text-white text-[11px] font-medium leading-tight">
            {operationLabel}
          </span>
        </div>
      )}

      {/* Expanded: Row 3 - Parameters */}
      {isExpanded && displayParams.length > 0 && (
        <div className="px-2.5 pb-2 space-y-0.5 border-t border-white/5 pt-1.5 mt-0.5">
          {displayParams.map((param, idx) => (
            <div key={idx} className="text-[10px] leading-tight">
              <span className="text-zinc-500">{param.label}:</span>{' '}
              <span className="text-zinc-300 break-words">{param.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

