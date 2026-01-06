'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkflowEditor } from './workflow-editor';

interface WorkflowAction {
  adapter: string;
  operation: string;
  params: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerAdapter: string;
  triggerOperation: string;
  actions: WorkflowAction[];
  actionsCount: number;
  totalExecutions: number;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowListProps {
  clientId: string;
  workflows: Workflow[];
  configuredIntegrations: string[];
  mailerliteGroups?: Record<string, { id: string; name: string }>;
}

export function WorkflowList({
  clientId,
  workflows,
  configuredIntegrations,
  mailerliteGroups = {},
}: WorkflowListProps) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowData, setWorkflowData] = useState<{
    name: string;
    description: string | null;
    enabled: boolean;
    triggerAdapter: string;
    triggerOperation: string;
    triggerFilter: Record<string, unknown> | null;
    actions: WorkflowAction[];
  } | null>(null);

  const handleToggle = async (workflowId: string) => {
    setTogglingId(workflowId);
    try {
      const response = await fetch(`/api/admin/workflows/${workflowId}/toggle`, {
        method: 'PATCH',
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleNewWorkflow = () => {
    setEditingWorkflowId(null);
    setWorkflowData(null);
    setShowEditor(true);
  };

  const handleEditWorkflow = async (workflowId: string) => {
    setEditingWorkflowId(workflowId);
    try {
      const response = await fetch(`/api/admin/workflows/${workflowId}`);
      if (response.ok) {
        const data = await response.json();
        const workflow = data.data.workflow;
        setWorkflowData({
          name: workflow.name,
          description: workflow.description,
          enabled: workflow.enabled,
          triggerAdapter: workflow.triggerAdapter,
          triggerOperation: workflow.triggerOperation,
          triggerFilter: workflow.triggerFilter as Record<string, unknown> | null,
          actions: workflow.actions as WorkflowAction[],
        });
        setShowEditor(true);
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingWorkflowId(null);
    setWorkflowData(null);
  };

  const handleSaveWorkflow = () => {
    router.refresh();
  };

  const formatAdapterName = (adapter: string) => {
    const adapterNames: Record<string, string> = {
      calendly: 'Calendly',
      stripe: 'Stripe',
      revline: 'RevLine',
      mailerlite: 'MailerLite',
      manychat: 'ManyChat',
    };
    return adapterNames[adapter] || adapter;
  };

  const formatOperationName = (operation: string) => {
    const operationNames: Record<string, string> = {
      booking_created: 'Booking Created',
      booking_canceled: 'Booking Canceled',
      payment_succeeded: 'Payment Succeeded',
      subscription_created: 'Subscription Created',
      email_captured: 'Email Captured',
      add_to_group: 'Add to Group',
      remove_from_group: 'Remove from Group',
      add_tag: 'Add Tag',
      create_lead: 'Create Lead',
      update_lead_stage: 'Update Lead Stage',
      emit_event: 'Emit Event',
    };
    return operationNames[operation] || operation.replace(/_/g, ' ');
  };

  const formatActionLabel = (action: WorkflowAction) => {
    const adapterName = formatAdapterName(action.adapter);
    const operationName = formatOperationName(action.operation);
    
    // Add key params for context
    const params: string[] = [];
    if (action.params.group) {
      params.push(`group: ${action.params.group}`);
    }
    if (action.params.stage) {
      params.push(`stage: ${action.params.stage}`);
    }
    if (action.params.tag) {
      params.push(`tag: ${action.params.tag}`);
    }
    
    const paramsStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    return `${adapterName} → ${operationName}${paramsStr}`;
  };

  if (workflows.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No workflows yet</h3>
        <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
          Workflows automate actions when events happen. Create your first workflow
          to get started.
        </p>
        <button
          onClick={handleNewWorkflow}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
        >
          Create Workflow
        </button>
      </div>
    );
  }

  return (
    <>
      {showEditor && (
        <WorkflowEditor
          clientId={clientId}
          workflowId={editingWorkflowId || undefined}
          initialData={workflowData || undefined}
          configuredIntegrations={configuredIntegrations}
          mailerliteGroups={mailerliteGroups}
          onClose={handleCloseEditor}
          onSave={handleSaveWorkflow}
        />
      )}

      <div className="space-y-4">
        {/* New Workflow Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleNewWorkflow}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Workflow
          </button>
        </div>
      {workflows.map((workflow) => (
        <div
          key={workflow.id}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left: Content */}
            <div className="flex-1 min-w-0">
              {/* Header: Name and Description */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => handleEditWorkflow(workflow.id)}
                className="text-lg font-semibold text-white hover:text-zinc-300 text-left"
              >
                {workflow.name}
              </button>
                </div>
                {workflow.description && (
                  <p className="text-sm text-zinc-400 mt-1">
                    {workflow.description}
                  </p>
                )}
              </div>

              {/* Flow Visualization */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Trigger Node */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-md">
                  <svg
                    className="w-4 h-4 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-xs font-medium text-blue-300">
                    {formatAdapterName(workflow.triggerAdapter)} → {formatOperationName(workflow.triggerOperation)}
                  </span>
                </div>

                {/* Arrow */}
                {workflow.actions.length > 0 && (
                  <svg
                    className="w-4 h-4 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}

                {/* Action Nodes */}
                {workflow.actions.map((action, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-md">
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-green-300">
                        {formatActionLabel(action)}
                      </span>
                    </div>
                    {idx < workflow.actions.length - 1 && (
                      <svg
                        className="w-4 h-4 text-zinc-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                ))}

                {/* Empty state if no actions */}
                {workflow.actions.length === 0 && (
                  <span className="text-xs text-zinc-500 italic">No actions configured</span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                <span>
                  {workflow.actionsCount} action{workflow.actionsCount !== 1 ? 's' : ''}
                </span>
                <span>•</span>
                <span>
                  {workflow.totalExecutions} execution
                  {workflow.totalExecutions !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Right: Toggle and Actions */}
            <div className="flex items-start gap-3">
              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle(workflow.id)}
                disabled={togglingId === workflow.id}
                className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                  workflow.enabled ? 'bg-green-500' : 'bg-zinc-700'
                } ${togglingId === workflow.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={workflow.enabled ? 'Disable workflow' : 'Enable workflow'}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    workflow.enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Link
                  href={`/admin/clients/${clientId}/workflows/${workflow.id}/executions`}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                  title="View executions"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </Link>
              <button
                onClick={() => handleEditWorkflow(workflow.id)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="Edit workflow"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Integration status hint */}
      <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-400 mb-2">
          Configured Integrations
        </h4>
        <div className="flex flex-wrap gap-2">
          {configuredIntegrations.map((integration) => (
            <span
              key={integration}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded"
            >
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              {integration}
            </span>
          ))}
          {configuredIntegrations.length === 0 && (
            <span className="text-xs text-zinc-500">
              No integrations configured yet
            </span>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
