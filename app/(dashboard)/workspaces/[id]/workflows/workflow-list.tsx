'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Workflow, AlertTriangle, RefreshCw, List, GitBranch } from 'lucide-react';
import { WorkflowEditor } from './workflow-editor';
import { WorkflowCard } from '../_components/workflow-card';
import { IntegrationNetworkGraph } from '../_components/network-graph';
import type { LeadPropertyDefinition } from '@/app/_lib/types';

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

interface ValidationStatus {
  canEnable: boolean;
  errors: string[];
  warnings: string[];
}

export interface WorkflowListProps {
  workspaceId: string;
  workflows: Workflow[];
  configuredIntegrations: string[];
  mailerliteGroups?: Record<string, { id: string; name: string }>;
  resendTemplates?: Record<string, { id: string; name: string; variables?: string[] }>;
  stripeProducts?: Record<string, string>;
  leadStages?: Array<{ key: string; label: string; color: string }>;
  leadPropertySchema?: LeadPropertyDefinition[] | null;
  /** Hide the header when embedded in another component that provides its own controls */
  hideHeader?: boolean;
}

export function WorkflowList({
  workspaceId,
  workflows,
  configuredIntegrations,
  mailerliteGroups = {},
  resendTemplates = {},
  stripeProducts = {},
  leadStages,
  leadPropertySchema,
  hideHeader = false,
}: WorkflowListProps) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
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
  
  // Validation status per workflow
  const [validationMap, setValidationMap] = useState<Record<string, ValidationStatus>>({});
  const [isLoadingValidation, setIsLoadingValidation] = useState(false);
  
  // View mode toggle
  const [viewMode, setViewMode] = useState<'list' | 'dependencies'>('list');

  // Fetch validation status for all workflows
  const fetchValidation = useCallback(async () => {
    setIsLoadingValidation(true);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/dependency-graph`);
      if (response.ok) {
        const data = await response.json();
        const graph = data.data?.graph;
        if (graph?.workflows) {
          const newValidationMap: Record<string, ValidationStatus> = {};
          for (const w of graph.workflows) {
            newValidationMap[w.id] = {
              canEnable: w.canEnable,
              errors: w.validationErrors || [],
              warnings: w.validationWarnings || [],
            };
          }
          setValidationMap(newValidationMap);
        }
      }
    } catch (error) {
      console.error('Failed to fetch validation status:', error);
    } finally {
      setIsLoadingValidation(false);
    }
  }, [workspaceId]);

  // Fetch validation on mount and when workflows change
  useEffect(() => {
    fetchValidation();
  }, [fetchValidation, workflows.length]);

  const handleToggle = async (workflowId: string) => {
    setTogglingId(workflowId);
    setToggleError(null);
    try {
      const response = await fetch(`/api/v1/workflows/${workflowId}/toggle`, {
        method: 'PATCH',
      });

      if (response.ok) {
        router.refresh();
        // Refresh validation after toggle
        fetchValidation();
      } else {
        const data = await response.json();
        // Handle new validation error format with validationErrors array
        const errorMessage = data.error || 'Failed to toggle';
        setToggleError(errorMessage);
        
        // Update validation map with errors from the new format
        if (data.validationErrors) {
          setValidationMap(prev => ({
            ...prev,
            [workflowId]: {
              canEnable: false,
              errors: data.validationErrors.map((e: { message: string }) => e.message),
              warnings: [],
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
      setToggleError('Network error');
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
      const response = await fetch(`/api/v1/workflows/${workflowId}`);
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
            workspaceId={workspaceId}
            workflowId={editingWorkflowId || undefined}
            initialData={workflowData || undefined}
            configuredIntegrations={configuredIntegrations}
            mailerliteGroups={mailerliteGroups}
            resendTemplates={resendTemplates}
            stripeProducts={stripeProducts}
            leadStages={leadStages}
            leadPropertySchema={leadPropertySchema}
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
          workspaceId={workspaceId}
          workflowId={editingWorkflowId || undefined}
          initialData={workflowData || undefined}
          configuredIntegrations={configuredIntegrations}
          mailerliteGroups={mailerliteGroups}
          resendTemplates={resendTemplates}
          stripeProducts={stripeProducts}
          leadStages={leadStages}
          leadPropertySchema={leadPropertySchema}
          onClose={handleCloseEditor}
          onSave={handleSaveWorkflow}
        />
      )}

      <div className="space-y-3">
        {/* Header: View Toggle + Add Button - only show when not embedded */}
        {!hideHeader && (
          <div className="flex items-center justify-end gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-800 rounded p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('dependencies')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'dependencies'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Dependencies view"
              >
                <GitBranch className="w-4 h-4" />
              </button>
            </div>
            {viewMode === 'list' && (
              <button
                onClick={fetchValidation}
                disabled={isLoadingValidation}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                title="Refresh validation"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingValidation ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={handleNewWorkflow}
              className="p-2 bg-white text-black rounded hover:bg-zinc-200 transition-colors"
              title="New Workflow"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Network Graph View (Business Process Visualization) - only when header shown */}
        {!hideHeader && viewMode === 'dependencies' ? (
          <IntegrationNetworkGraph workspaceId={workspaceId} />
        ) : (
          <>
            {/* Toggle Error Banner */}
            {toggleError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{toggleError}</span>
                <button 
                  onClick={() => setToggleError(null)} 
                  className="ml-auto text-red-400/60 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            )}

            {/* Workflow Cards */}
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                id={workflow.id}
                workspaceId={workspaceId}
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
                validationStatus={validationMap[workflow.id]}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
