'use client';

/**
 * GraphSelectionPanel Component
 * 
 * Slide-out panel showing details for selected node, edge, or form.
 * - Node: Shows all workflows/forms using that integration
 * - Edge: Shows workflow details with edit link and delete option
 * - Form: Shows baked-in operations, triggers, and listening workflows
 */

import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, ExternalLink, ArrowRight, Trash2, FileText, Zap } from 'lucide-react';
import { Selection, WorkflowNode, OperationSelection } from './types';
import { getIntegrationStyle, getOperationLabel } from '@/app/_lib/workflow/integration-config';

interface GraphSelectionPanelProps {
  selection: Selection;
  onClose: () => void;
  workspaceId: string;
  onWorkflowDeleted?: () => void;
}

export function GraphSelectionPanel({
  selection,
  onClose,
  workspaceId,
  onWorkflowDeleted,
}: GraphSelectionPanelProps) {
  if (!selection) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 overflow-y-auto z-10">
      {/* Header */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">
          {selection.type === 'node' ? 'Integration' : selection.type === 'form' ? 'Form' : selection.type === 'operation' ? 'Operation' : 'Workflow'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {selection.type === 'node' ? (
          <NodeDetails selection={selection} workspaceId={workspaceId} />
        ) : selection.type === 'form' ? (
          <FormDetails selection={selection} workspaceId={workspaceId} />
        ) : selection.type === 'edge' ? (
          <EdgeDetails 
            selection={selection} 
            workspaceId={workspaceId} 
            onDeleted={() => {
              onClose();
              onWorkflowDeleted?.();
            }}
          />
        ) : (
          <OperationDetails selection={selection} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// NODE DETAILS (Integration)
// =============================================================================

function NodeDetails({
  selection,
  workspaceId,
}: {
  selection: Extract<Selection, { type: 'node' }>;
  workspaceId: string;
}) {
  const { data, workflows, forms, integration } = selection;
  const style = getIntegrationStyle(data.integrationKey);

  return (
    <div className="space-y-4">
      {/* Integration info */}
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: data.color }}
        />
        <div>
          <div className="font-semibold text-white">{data.name}</div>
          <div className="text-xs text-zinc-500">{data.integrationKey}</div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {data.healthy ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-emerald-400">Healthy</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-400">
              {!data.configured ? 'Not configured' : 'Unhealthy'}
            </span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-white">{data.triggerCount}</div>
          <div className="text-xs text-zinc-500">As Trigger</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-white">{data.actionCount}</div>
          <div className="text-xs text-zinc-500">As Action</div>
        </div>
      </div>

      {/* Forms using this integration */}
      {forms.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Forms ({forms.length})
          </h4>
          <div className="space-y-2">
            {forms.map((form) => (
              <div
                key={form.id}
                className="bg-violet-950/30 border border-violet-600/30 rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-white font-medium">{form.name}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {form.operations.filter(op => op.adapter === data.integrationKey).length} operations
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflows */}
      <div>
        <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
          Workflows ({workflows.length})
        </h4>
        <div className="space-y-2">
          {workflows.length === 0 ? (
            <div className="text-sm text-zinc-500">No workflows use this integration</div>
          ) : (
            workflows.map((workflow) => (
              <WorkflowListItem
                key={workflow.id}
                workflow={workflow}
                workspaceId={workspaceId}
                highlightAdapter={data.integrationKey}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FORM DETAILS
// =============================================================================

function FormDetails({
  selection,
  workspaceId,
}: {
  selection: Extract<Selection, { type: 'form' }>;
  workspaceId: string;
}) {
  const { data, form, listeningWorkflows } = selection;

  return (
    <div className="space-y-4">
      {/* Form info */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded bg-violet-600/20">
          <FileText className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <div className="font-semibold text-white">{form.name}</div>
          <div className="text-xs text-zinc-500">{form.type}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-400">{form.description}</p>

      {/* Status */}
      <div className="flex items-center gap-2">
        {form.enabled ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-emerald-400">Enabled</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-sm text-zinc-400">Disabled</span>
          </>
        )}
      </div>

      {/* Baked-in Operations */}
      {data.operations.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Baked-in Operations ({data.operations.length})
          </h4>
          <div className="space-y-2">
            {data.operations.map((op, idx) => {
              const style = getIntegrationStyle(op.adapter);
              return (
                <div
                  key={`${op.adapter}-${op.operation}-${idx}`}
                  className="bg-zinc-800/50 rounded-lg p-3 flex items-center gap-3"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: style.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{style.name}</div>
                    <div className="text-xs text-zinc-500">
                      {op.label || op.operation}
                      {op.conditional && <span className="text-amber-500 ml-2">(conditional)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Emits Triggers */}
      {data.triggers.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Emits Triggers ({data.triggers.length})
          </h4>
          <div className="space-y-2">
            {data.triggers.map((trigger) => (
              <div
                key={trigger.id}
                className="bg-amber-950/30 border border-amber-600/30 rounded-lg p-3"
              >
                <div className="text-sm text-amber-400 font-medium">{trigger.label}</div>
                {trigger.description && (
                  <div className="text-xs text-zinc-500 mt-1">{trigger.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listening Workflows */}
      <div>
        <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
          Listening Workflows ({listeningWorkflows.length})
        </h4>
        <div className="space-y-2">
          {listeningWorkflows.length === 0 ? (
            <div className="text-sm text-zinc-500">No workflows listening to these triggers</div>
          ) : (
            listeningWorkflows.map((workflow) => (
              <WorkflowListItem
                key={workflow.id}
                workflow={workflow}
                workspaceId={workspaceId}
              />
            ))
          )}
        </div>
      </div>

      {/* Integration Dependencies */}
      {data.dependencies.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Required Integrations ({data.dependencies.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.dependencies.map((dep) => {
              const style = getIntegrationStyle(dep);
              return (
                <div
                  key={dep}
                  className="flex items-center gap-1.5 bg-zinc-800/50 rounded px-2 py-1"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: style.color }}
                  />
                  <span className="text-xs text-zinc-400">{style.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EDGE DETAILS (Workflow)
// =============================================================================

function EdgeDetails({
  selection,
  workspaceId,
  onDeleted,
}: {
  selection: Extract<Selection, { type: 'edge' }>;
  workspaceId: string;
  onDeleted: () => void;
}) {
  const { data, workflow } = selection;
  const triggerStyle = getIntegrationStyle(workflow.trigger.adapter);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/workflows/${workflow.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onDeleted();
      } else {
        const data = await response.json();
        setDeleteError(data.error || 'Failed to delete workflow');
      }
    } catch (err) {
      setDeleteError('Network error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Workflow name */}
      <div>
        <div className="font-semibold text-white text-lg">{workflow.name}</div>
        {workflow.description && (
          <div className="text-sm text-zinc-400 mt-1">{workflow.description}</div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {data.enabled ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-400">Active</span>
          </>
        ) : data.canEnable ? (
          <>
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-sm text-zinc-400">Inactive</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-400">Cannot enable</span>
          </>
        )}
      </div>

      {/* Errors */}
      {data.errors.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="text-xs text-yellow-500 font-medium mb-1">Validation Errors</div>
          <ul className="text-xs text-yellow-400/80 space-y-1">
            {data.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="text-xs text-amber-500 font-medium mb-1">Warnings</div>
          <ul className="text-xs text-amber-400/80 space-y-1">
            {data.warnings.map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Trigger */}
      <div>
        <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Trigger</h4>
        <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: triggerStyle.color }}
          />
          <div>
            <div className="text-sm text-white">{workflow.trigger.adapterName}</div>
            <div className="text-xs text-zinc-500">
              {getOperationLabel(workflow.trigger.operation)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div>
        <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
          Actions ({workflow.actions.length})
        </h4>
        <div className="space-y-2">
          {workflow.actions.map((action, i) => {
            const actionStyle = getIntegrationStyle(action.adapter);
            return (
              <div
                key={i}
                className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-3"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: actionStyle.color }}
                />
                <div>
                  <div className="text-sm text-white">{action.adapterName}</div>
                  <div className="text-xs text-zinc-500">
                    {getOperationLabel(action.operation)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit button */}
      <a
        href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
        className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
      >
        <span>Edit Workflow</span>
        <ExternalLink className="w-4 h-4" />
      </a>

      {/* Danger Zone */}
      <div className="pt-4 border-t border-zinc-800">
        {!showDangerZone ? (
          <button
            onClick={() => setShowDangerZone(true)}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
          >
            Show danger zone
          </button>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-3">
            <div className="text-xs text-red-400 font-medium">Danger Zone</div>
            <p className="text-xs text-zinc-400">
              Permanently delete this workflow. This action cannot be undone.
            </p>
            {deleteError && (
              <div className="text-xs text-red-400">{deleteError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDangerZone(false)}
                className="flex-1 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-white bg-red-600 hover:bg-red-500 rounded transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// WORKFLOW LIST ITEM
// =============================================================================

function WorkflowListItem({
  workflow,
  workspaceId,
  highlightAdapter,
}: {
  workflow: WorkflowNode;
  workspaceId: string;
  highlightAdapter?: string;
}) {
  const isTrigger = highlightAdapter ? workflow.trigger.adapter === highlightAdapter : false;
  const isAction = highlightAdapter ? workflow.actions.some(a => a.adapter === highlightAdapter) : false;

  return (
    <a
      href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
      className="block bg-zinc-800/50 hover:bg-zinc-800 rounded-lg p-3 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              workflow.enabled ? 'bg-emerald-500' : 'bg-zinc-500'
            }`}
          />
          <span className="text-sm text-white font-medium">{workflow.name}</span>
        </div>
        <ExternalLink className="w-3 h-3 text-zinc-500" />
      </div>
      
      <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
        <span className={isTrigger ? 'text-amber-400' : ''}>
          {workflow.trigger.adapterName}
        </span>
        <ArrowRight className="w-3 h-3" />
        <span className={isAction ? 'text-amber-400' : ''}>
          {workflow.actions.map(a => a.adapterName).join(', ')}
        </span>
      </div>

      {workflow.validationErrors.length > 0 && (
        <div className="flex items-center gap-1 mt-1 text-xs text-yellow-500">
          <AlertTriangle className="w-3 h-3" />
          <span>{workflow.validationErrors[0]}</span>
        </div>
      )}
    </a>
  );
}

// =============================================================================
// OPERATION DETAILS
// =============================================================================

function OperationDetails({
  selection,
}: {
  selection: OperationSelection;
}) {
  const { data, form } = selection;
  const style = getIntegrationStyle(data.adapter);
  const label = data.label || getOperationLabel(data.operation) || data.operation;

  return (
    <div className="space-y-4">
      {/* Operation header */}
      <div 
        className="rounded-lg p-4"
        style={{ backgroundColor: `${style.color}20` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4" style={{ color: style.color }} />
          <span className="text-sm text-white font-medium">{label}</span>
        </div>
        <div className="text-xs text-zinc-400">
          {style.name} • {data.operation}
        </div>
        {data.conditional && (
          <div className="mt-2 text-xs text-amber-400">
            Conditional operation
          </div>
        )}
      </div>

      {/* Parent form */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
          Part of Form
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-white">{form.name}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {form.type} form • {form.operations.length} operations
          </div>
        </div>
      </div>

      {/* Sequence position */}
      <div className="text-xs text-zinc-500">
        Step {data.sequenceIndex + 1} of {form.operations.length} in this form
      </div>
    </div>
  );
}
