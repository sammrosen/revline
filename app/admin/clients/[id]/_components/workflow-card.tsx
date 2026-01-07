'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Pencil } from 'lucide-react';
import { WorkflowFlow } from './workflow-flow';
import { ExecutionsModal } from './executions-modal';

interface WorkflowAction {
  adapter: string;
  operation: string;
  params: Record<string, unknown>;
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
}

/**
 * WorkflowCard - Container for a workflow in the list
 *
 * Features:
 * - Collapsible expanded/collapsed views
 * - Toggle switch for enabling/disabling
 * - Edit and execution log modals
 * - Stats display
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
}: WorkflowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExecutions, setShowExecutions] = useState(false);

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

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-3 min-w-0">
            {/* Toggle Switch */}
            <button
              onClick={onToggle}
              disabled={isToggling}
              className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                enabled ? 'bg-green-500' : 'bg-zinc-700'
              } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title={enabled ? 'Disable workflow' : 'Enable workflow'}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  enabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>

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
