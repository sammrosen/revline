'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Workflow } from 'lucide-react';
import { WorkflowEditor } from './workflow-editor';
import { WorkflowCard } from '../_components/workflow-card';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';

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

  // Empty state
  if (workflows.length === 0) {
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Workflow className="w-8 h-8 text-zinc-600" />
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
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      </>
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

      <div className="space-y-3">
        {/* Header: Integrations + Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {configuredIntegrations.map((integration) => {
              const style = getIntegrationStyle(integration.toLowerCase());
              return (
                <span
                  key={integration}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 ${style.bgClass} ${style.textClass} text-xs rounded`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: style.color }}
                  />
                  {integration}
                </span>
              );
            })}
            {configuredIntegrations.length === 0 && (
              <span className="text-xs text-zinc-500">No integrations</span>
            )}
          </div>
          <button
            onClick={handleNewWorkflow}
            className="p-2 bg-white text-black rounded hover:bg-zinc-200 transition-colors"
            title="New Workflow"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Workflow Cards */}
        {workflows.map((workflow) => (
          <WorkflowCard
            key={workflow.id}
            id={workflow.id}
            clientId={clientId}
            name={workflow.name}
            description={workflow.description}
            enabled={workflow.enabled}
            triggerAdapter={workflow.triggerAdapter}
            triggerOperation={workflow.triggerOperation}
            actions={workflow.actions}
            totalExecutions={workflow.totalExecutions}
            onToggle={() => handleToggle(workflow.id)}
            isToggling={togglingId === workflow.id}
            onEdit={() => handleEditWorkflow(workflow.id)}
          />
        ))}
      </div>
    </>
  );
}
