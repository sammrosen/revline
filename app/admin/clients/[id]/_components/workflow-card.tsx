'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Pencil, AlertTriangle } from 'lucide-react';
import { WorkflowFlow } from './workflow-flow';
import { ExecutionsModal } from './executions-modal';

interface WorkflowAction {
  adapter: string;
  operation: string;
  params: Record<string, unknown>;
}

interface ValidationStatus {
  /** Whether the workflow can be enabled */
  canEnable: boolean;
  /** Validation error messages */
  errors: string[];
  /** Validation warning messages */
  warnings: string[];
}

interface WorkflowCardProps {
  /** Workflow ID */
  id: string;
  /** Client ID (for links) */
  clientId: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description: string | null;
  /** Whether the workflow is enabled */
  enabled: boolean;
  /** Trigger adapter ID */
  triggerAdapter: string;
  /** Trigger operation name */
  triggerOperation: string;
  /** Array of actions */
  actions: WorkflowAction[];
  /** Total execution count */
  totalExecutions: number;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Whether toggle is in progress */
  isToggling: boolean;
  /** Callback when edit is clicked */
  onEdit: () => void;
  /** Validation status (optional - if not provided, no validation UI shown) */
  validationStatus?: ValidationStatus;
}

/**
 * WorkflowCard - Container for a workflow in the list
 *
 * Features:
 * - Collapsible expanded/collapsed views
 * - Toggle switch for enabling/disabling
 * - Edit and execution log modals
 * - Stats display
 * - Validation status indicators
 */
export function WorkflowCard({
  id,
  name,
  description,
  enabled,
  triggerAdapter,
  triggerOperation,
  actions,
  totalExecutions,
  onToggle,
  isToggling,
  onEdit,
  validationStatus,
}: WorkflowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExecutions, setShowExecutions] = useState(false);
  const [showValidationTooltip, setShowValidationTooltip] = useState(false);

  // Determine if toggle should be disabled
  const cannotEnable = !enabled && validationStatus && !validationStatus.canEnable;
  const toggleDisabled = isToggling || cannotEnable;
  const hasWarnings = validationStatus?.warnings && validationStatus.warnings.length > 0;

  // Build tooltip message
  const getToggleTitle = () => {
    if (isToggling) return 'Processing...';
    if (cannotEnable) {
      return validationStatus.errors[0] || 'Cannot enable workflow';
    }
    return enabled ? 'Disable workflow' : 'Enable workflow';
  };

  return (
    <>
      {/* Executions Modal */}
      {showExecutions && (
        <ExecutionsModal
          workflowId={id}
          workflowName={name}
          onClose={() => setShowExecutions(false)}
        />
      )}

      <div className={`bg-zinc-900 border rounded-lg overflow-hidden transition-colors ${
        cannotEnable ? 'border-yellow-500/30' : 'border-zinc-800 hover:border-zinc-700'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-3 min-w-0">
            {/* Toggle Switch */}
            <div className="relative">
              <button
                onClick={onToggle}
                disabled={toggleDisabled}
                className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                  enabled ? 'bg-green-500' : cannotEnable ? 'bg-yellow-500/30' : 'bg-zinc-700'
                } ${toggleDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={getToggleTitle()}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Validation Warning Icon */}
            {(cannotEnable || hasWarnings) && (
              <div 
                className="relative"
                onMouseEnter={() => setShowValidationTooltip(true)}
                onMouseLeave={() => setShowValidationTooltip(false)}
              >
                <AlertTriangle 
                  className={`w-4 h-4 flex-shrink-0 ${
                    cannotEnable ? 'text-yellow-500' : 'text-yellow-500/60'
                  }`}
                />
                {/* Tooltip */}
                {showValidationTooltip && (
                  <div className="absolute left-0 top-6 z-50 w-64 p-2 bg-zinc-800 border border-zinc-700 rounded shadow-lg text-xs">
                    {validationStatus?.errors.map((error, i) => (
                      <div key={i} className="text-yellow-400 mb-1">{error}</div>
                    ))}
                    {validationStatus?.warnings.map((warning, i) => (
                      <div key={i} className="text-zinc-400">{warning}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Name and Description */}
            <div className="min-w-0">
              <button
                onClick={onEdit}
                className="text-sm font-semibold text-white hover:text-zinc-300 text-left truncate block"
              >
                {name}
              </button>
              {description && (
                <p className="text-xs text-zinc-500 truncate">{description}</p>
              )}
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Stats */}
            <span className="text-xs text-zinc-500 hidden sm:block">
              {totalExecutions} execution{totalExecutions !== 1 ? 's' : ''}
            </span>

            {/* View Execution Logs */}
            <button
              onClick={() => setShowExecutions(true)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="View execution logs"
            >
              <ClipboardList className="w-4 h-4" />
            </button>

            {/* Edit */}
            <button
              onClick={onEdit}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="Edit workflow"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Flow Visualization Body */}
        <div className="px-4 py-4">
          <WorkflowFlow
            triggerAdapter={triggerAdapter}
            triggerOperation={triggerOperation}
            actions={actions}
            isExpanded={isExpanded}
          />
        </div>

        {/* Footer Stats (mobile only) */}
        <div className="px-4 pb-3 sm:hidden">
          <span className="text-xs text-zinc-500">
            {actions.length} action{actions.length !== 1 ? 's' : ''} · {totalExecutions} execution{totalExecutions !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  );
}
