'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';

// =============================================================================
// TYPES
// =============================================================================

interface IntegrationNode {
  type: string;
  configured: boolean;
  healthy: boolean;
  healthStatus: string | null;
  secretNames: string[];
  metaKeys: string[];
  usedBy: Array<{
    workflowId: string;
    workflowName: string;
    asTrigger: boolean;
    asAction: boolean;
    operations: string[];
  }>;
}

interface WorkflowNode {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  canEnable: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  trigger: {
    adapter: string;
    adapterName: string;
    operation: string;
  };
  actions: Array<{
    adapter: string;
    adapterName: string;
    operation: string;
    params: Record<string, unknown>;
  }>;
  dependencies: {
    integrations: string[];
    metaReferences: Array<{
      adapter: string;
      path: string;
      param: string;
      value: string;
    }>;
  };
}

interface DependencyGraph {
  integrations: Record<string, IntegrationNode>;
  workflows: WorkflowNode[];
  warnings: string[];
  stats: {
    totalWorkflows: number;
    enabledWorkflows: number;
    validWorkflows: number;
    configuredIntegrations: number;
    healthyIntegrations: number;
  };
}

interface DependencyTreeProps {
  clientId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DependencyTree({ clientId }: DependencyTreeProps) {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/dependency-graph`);
      if (response.ok) {
        const data = await response.json();
        setGraph(data.data?.graph || null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load dependency graph');
      }
    } catch (err) {
      console.error('Failed to fetch dependency graph:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="text-center py-12 text-zinc-500">No data available</div>
    );
  }

  // Group workflows by trigger adapter
  const workflowsByTrigger: Record<string, WorkflowNode[]> = {};
  for (const workflow of graph.workflows) {
    const key = workflow.trigger.adapter;
    if (!workflowsByTrigger[key]) {
      workflowsByTrigger[key] = [];
    }
    workflowsByTrigger[key].push(workflow);
  }

  // Get unique action adapters
  const actionAdapters = new Set<string>();
  for (const workflow of graph.workflows) {
    for (const action of workflow.actions) {
      actionAdapters.add(action.adapter);
    }
  }

  // Find trigger adapters (integrations that have triggers being used)
  const triggerAdapters = Object.keys(workflowsByTrigger);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            {graph.stats.enabledWorkflows} of {graph.stats.totalWorkflows} workflows active
          </span>
          {graph.stats.validWorkflows < graph.stats.totalWorkflows && (
            <span className="flex items-center gap-1 text-sm text-yellow-500">
              <AlertTriangle className="w-4 h-4" />
              {graph.stats.totalWorkflows - graph.stats.validWorkflows} need attention
            </span>
          )}
        </div>
        <button
          onClick={fetchGraph}
          className="flex items-center gap-2 px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Warnings */}
      {graph.warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-500 text-sm font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            {graph.warnings.length} Warning{graph.warnings.length !== 1 ? 's' : ''}
          </div>
          <ul className="text-xs text-yellow-400/80 space-y-0.5 ml-6">
            {graph.warnings.slice(0, 3).map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
            {graph.warnings.length > 3 && (
              <li className="text-yellow-500/60">+ {graph.warnings.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Flow Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 overflow-x-auto">
        {graph.workflows.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No workflows configured. Create a workflow to see the automation flow.
          </div>
        ) : (
          <div className="min-w-[600px]">
            {/* Column Headers */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 mb-6 text-xs text-zinc-500 uppercase tracking-wider">
              <div className="text-center">Triggers</div>
              <div></div>
              <div className="text-center">Workflows</div>
              <div></div>
              <div className="text-center">Actions</div>
            </div>

            {/* Flow Rows - One per workflow */}
            <div className="space-y-4">
              {graph.workflows.map((workflow) => (
                <FlowRow
                  key={workflow.id}
                  workflow={workflow}
                  integrations={graph.integrations}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Integration Status Legend */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Integration Status</div>
        <div className="flex flex-wrap gap-3">
          {/* Built-in badge for RevLine */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-300">RevLine</span>
            <span className="text-xs text-zinc-500">built-in</span>
          </div>
          
          {/* External integrations */}
          {Object.entries(graph.integrations)
            .filter(([key, node]) => node.configured && !BUILTIN_ADAPTERS.includes(key))
            .map(([key, node]) => (
              <IntegrationBadge key={key} integrationKey={key} node={node} />
            ))}
          {Object.values(graph.integrations).filter(n => n.configured).length === 0 && (
            <span className="text-sm text-zinc-500">No external integrations configured</span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FLOW ROW - Single workflow visualization
// =============================================================================

// Adapters that don't require external integration (built-in)
const BUILTIN_ADAPTERS = ['revline'];

function FlowRow({
  workflow,
  integrations,
}: {
  workflow: WorkflowNode;
  integrations: Record<string, IntegrationNode>;
}) {
  const triggerStyle = getIntegrationStyle(workflow.trigger.adapter);
  const triggerIntegration = integrations[workflow.trigger.adapter.toLowerCase()];
  const isTriggerBuiltin = BUILTIN_ADAPTERS.includes(workflow.trigger.adapter.toLowerCase());
  // Built-in adapters are always healthy, external ones need to be configured
  const triggerHealthy = isTriggerBuiltin || (triggerIntegration?.configured && triggerIntegration?.healthy);

  // Group actions by adapter for cleaner display
  const actionsByAdapter: Record<string, { operations: string[]; params: Record<string, unknown>[] }> = {};
  for (const action of workflow.actions) {
    if (!actionsByAdapter[action.adapter]) {
      actionsByAdapter[action.adapter] = { operations: [], params: [] };
    }
    actionsByAdapter[action.adapter].operations.push(action.operation);
    actionsByAdapter[action.adapter].params.push(action.params);
  }

  return (
    <div className={`grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-center py-3 px-2 rounded-lg transition-colors ${
      !workflow.canEnable ? 'bg-yellow-500/5' : workflow.enabled ? 'bg-green-500/5' : 'bg-zinc-800/30'
    }`}>
      {/* Trigger */}
      <div className="flex justify-end">
        <div className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border ${
          triggerHealthy ? 'border-zinc-700 bg-zinc-800/50' : 'border-yellow-500/30 bg-yellow-500/5'
        }`}>
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: triggerStyle.color }}
          />
          <div className="text-right">
            <div className="text-sm font-medium text-white">{workflow.trigger.adapterName}</div>
            <div className="text-xs text-zinc-400">{formatOperation(workflow.trigger.operation)}</div>
          </div>
          {!triggerHealthy && (
            <AlertTriangle className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
          )}
        </div>
      </div>

      {/* Arrow → */}
      <div className="flex items-center justify-center">
        <svg className="w-8 h-4 text-zinc-600" viewBox="0 0 32 16">
          <path
            d="M0 8 H24 M20 4 L26 8 L20 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Workflow */}
      <div className="flex justify-center">
        <div className={`relative px-4 py-2 rounded-lg border-2 ${
          workflow.enabled
            ? 'border-green-500/50 bg-green-500/10'
            : workflow.canEnable
              ? 'border-zinc-600 bg-zinc-800/50'
              : 'border-yellow-500/50 bg-yellow-500/10'
        }`}>
          <div className="flex items-center gap-2">
            {workflow.enabled ? (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            ) : workflow.canEnable ? (
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-sm font-semibold text-white">{workflow.name}</span>
          </div>
          {workflow.validationErrors.length > 0 && (
            <div className="text-[10px] text-yellow-400 mt-1 max-w-[180px] truncate" title={workflow.validationErrors[0]}>
              {workflow.validationErrors[0]}
            </div>
          )}
        </div>
      </div>

      {/* Arrow → */}
      <div className="flex items-center justify-center">
        <svg className="w-8 h-4 text-zinc-600" viewBox="0 0 32 16">
          <path
            d="M0 8 H24 M20 4 L26 8 L20 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Actions */}
      <div className="flex justify-start">
        <div className="flex flex-col gap-1">
          {Object.entries(actionsByAdapter).map(([adapter, data]) => {
            const actionStyle = getIntegrationStyle(adapter);
            const actionIntegration = integrations[adapter.toLowerCase()];
            const isActionBuiltin = BUILTIN_ADAPTERS.includes(adapter.toLowerCase());
            // Built-in adapters are always healthy
            const actionHealthy = isActionBuiltin || (actionIntegration?.configured && actionIntegration?.healthy);
            
            return (
              <div
                key={adapter}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  actionHealthy ? 'border-zinc-700 bg-zinc-800/50' : 'border-yellow-500/30 bg-yellow-500/5'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: actionStyle.color }}
                />
                <div>
                  <div className="text-sm font-medium text-white">{actionStyle.name || adapter}</div>
                  <div className="text-xs text-zinc-400">
                    {data.operations.map(formatOperation).join(', ')}
                  </div>
                </div>
                {!actionHealthy && (
                  <AlertTriangle className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// INTEGRATION BADGE
// =============================================================================

function IntegrationBadge({
  integrationKey,
  node,
}: {
  integrationKey: string;
  node: IntegrationNode;
}) {
  const style = getIntegrationStyle(integrationKey);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
      node.healthy ? 'border-zinc-700 bg-zinc-800/50' : 'border-yellow-500/30 bg-yellow-500/10'
    }`}>
      {node.healthy ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-yellow-500" />
      )}
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 ${style.bgClass} ${style.textClass} text-xs rounded`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: style.color }}
        />
        {node.type}
      </span>
      <span className="text-xs text-zinc-500">
        {node.usedBy.length > 0 ? `${node.usedBy.length} workflow${node.usedBy.length !== 1 ? 's' : ''}` : 'unused'}
      </span>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatOperation(operation: string): string {
  return operation
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
