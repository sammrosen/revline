'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HealthStatus } from '@prisma/client';
import { IntegrationActions } from './integration-actions';
import { AddIntegrationForm } from './add-integration-form';
import { LeadsView } from './leads-view';
import { WorkflowList } from './workflows/workflow-list';
import { WorkflowEditor } from './workflows/workflow-editor';
import { IntegrationNetworkGraph } from './_components/network-graph';
import { TestingTab } from './testing-tab';
import { WorkspaceSettings } from './workspace-settings';
import { Workflow as WorkflowIcon, Plus, List } from 'lucide-react';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';

type TabType = 'workflows' | 'integrations' | 'leads' | 'events' | 'testing' | 'settings';

interface SecretSummary {
  id: string;
  name: string;
}

interface Integration {
  id: string;
  integration: string;
  healthStatus: HealthStatus;
  lastSeenAt: Date | null;
  meta: unknown;
  secrets: unknown;
  createdAt: Date;
}

interface Event {
  id: string;
  system: string;
  eventType: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

interface Lead {
  id: string;
  email: string;
  stage: string;
  source: string | null;
  lastEventAt: Date | null;
  createdAt: Date;
}

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

interface WorkspaceTabsProps {
  workspaceId: string;
  workspaceSlug: string;
  integrations: Integration[];
  events: Event[];
  eventCount?: number; // Total event count for "X of Y" display
  leads: Lead[];
  workflows: Workflow[];
  configuredIntegrations: string[];
  mailerliteGroups?: Record<string, { id: string; name: string }>;
  stripeProducts?: Record<string, string>;
  timezone?: string; // Workspace timezone for settings
  domainConfig?: {
    customDomain: string | null;
    domainVerifyToken: string | null;
    domainVerified: boolean;
    domainVerifiedAt: string | null;
  };
  leadStages?: Array<{ key: string; label: string; color: string }>;
  leadPropertySchema?: Array<{ key: string; label: string; type: string; required: boolean }> | null;
}

// Parse secrets from JSON, returning only id and name (never values)
function parseSecrets(secrets: unknown): SecretSummary[] {
  if (!secrets || !Array.isArray(secrets)) return [];
  return secrets.map((s: { id?: string; name?: string }) => ({
    id: s.id || '',
    name: s.name || '',
  })).filter(s => s.id && s.name);
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const colors = {
    GREEN: 'bg-green-500/20 text-green-400',
    YELLOW: 'bg-yellow-500/20 text-yellow-400',
    RED: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded ${colors[status]}`}>
      {status}
    </span>
  );
}

function formatDate(date: Date | string | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

interface IntegrationDependency {
  type: string;
  usedBy: Array<{ workflowId: string; workflowName: string }>;
}

const VALID_TABS: TabType[] = ['workflows', 'integrations', 'leads', 'events', 'testing', 'settings'];

export function WorkspaceTabs({ workspaceId, workspaceSlug, integrations, events, eventCount, leads, workflows, configuredIntegrations, mailerliteGroups = {}, stripeProducts = {}, timezone = 'America/New_York', domainConfig, leadStages, leadPropertySchema }: WorkspaceTabsProps) {
  // Initialize with default to avoid hydration mismatch, then sync from hash in useEffect
  const [activeTab, setActiveTab] = useState<TabType>('workflows');
  const [integrationDeps, setIntegrationDeps] = useState<Record<string, IntegrationDependency>>({});

  // Sync tab from URL hash after mount and on hash changes (driven by sidebar)
  const hasAppliedHash = useRef(false);
  
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash && VALID_TABS.includes(hash as TabType)) {
        setActiveTab(hash as TabType);
      }
    };

    // Initial sync
    if (!hasAppliedHash.current) {
      hasAppliedHash.current = true;
      setTimeout(syncHash, 0);
    }

    // Listen for hash changes from sidebar navigation
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  // Fetch integration dependencies when integrations tab is active
  const fetchDependencies = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/dependency-graph`);
      if (response.ok) {
        const data = await response.json();
        const graph = data.data?.graph;
        if (graph?.integrations) {
          setIntegrationDeps(graph.integrations);
        }
      }
    } catch (error) {
      console.error('Failed to fetch dependencies:', error);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab === 'integrations') {
      // Use setTimeout to avoid synchronous setState warning
      const timer = setTimeout(() => {
        fetchDependencies();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchDependencies]);

  // Helper to get dependent workflows for an integration
  // Only returns ENABLED workflows since deletion is blocked by enabled workflows only
  const getDependentWorkflows = (integrationType: string) => {
    const key = integrationType.toLowerCase();
    const deps = integrationDeps[key];
    if (!deps?.usedBy?.length) return [];
    // Filter to only enabled workflows - disabled workflows don't block deletion
    return deps.usedBy
      .filter((u: { workflowId: string; workflowName: string; workflowEnabled?: boolean }) => u.workflowEnabled)
      .map((u: { workflowId: string; workflowName: string; workflowEnabled?: boolean }) => ({ id: u.workflowId, name: u.workflowName }));
  };

  // State for workflow view mode: 'graph' (default) or 'list'
  const [workflowViewMode, setWorkflowViewMode] = useState<'graph' | 'list'>('graph');
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-[400px]">
        {activeTab === 'workflows' && (
          <div className={`relative ${workflowViewMode === 'graph' ? '-mx-4 sm:-mx-6 -mb-4 sm:-mb-6' : 'max-w-[1600px] mx-auto'}`}>
            {/* Integration badges and controls header */}
            <div className={`flex items-center justify-between mb-3 ${workflowViewMode === 'graph' ? 'px-4 sm:px-6' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {configuredIntegrations.map((integration) => {
                  const style = getIntegrationStyle(integration.toLowerCase());
                  const Icon = style.icon;
                  return (
                    <span
                      key={integration}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 ${style.bgClass} ${style.textClass} text-xs rounded`}
                    >
                      {style.logo ? (
                        <img src={style.logo} alt={integration} className="w-3 h-3 object-contain" />
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                      {integration}
                    </span>
                  );
                })}
                {configuredIntegrations.length === 0 && (
                  <span className="text-xs text-zinc-500">No integrations</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle - graph first since it's default */}
                <div className="flex items-center bg-zinc-800 rounded p-0.5">
                  <button
                    onClick={() => setWorkflowViewMode('graph')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors ${
                      workflowViewMode === 'graph'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Graph view"
                  >
                    <WorkflowIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setWorkflowViewMode('list')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors ${
                      workflowViewMode === 'list'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowNewWorkflow(true)}
                  className="flex items-center justify-center w-8 h-8 bg-white text-black rounded hover:bg-zinc-200 transition-colors"
                  title="New Workflow"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Network Graph view */}
            {workflowViewMode === 'graph' && (
              <IntegrationNetworkGraph workspaceId={workspaceId} />
            )}

            {/* Workflow List view */}
            {workflowViewMode === 'list' && (
              <div className="max-w-[1600px] mx-auto">
                <WorkflowList
                  workspaceId={workspaceId}
                  workflows={workflows}
                  configuredIntegrations={configuredIntegrations}
                  mailerliteGroups={mailerliteGroups}
                  stripeProducts={stripeProducts}
                  leadStages={leadStages}
                  hideHeader
                />
              </div>
            )}
          </div>
        )}

        {/* New Workflow Editor — renders as overlay from any view */}
        {showNewWorkflow && (
          <WorkflowEditor
            workspaceId={workspaceId}
            configuredIntegrations={configuredIntegrations}
            mailerliteGroups={mailerliteGroups}
            stripeProducts={stripeProducts}
            leadStages={leadStages}
            onClose={() => setShowNewWorkflow(false)}
            onSave={() => {
              setShowNewWorkflow(false);
              router.refresh();
            }}
          />
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {integrations.map((integration) => {
                const dependentWorkflows = getDependentWorkflows(integration.integration);
                const usedByCount = dependentWorkflows.length;
                
                const integrationStyle = getIntegrationStyle(integration.integration.toLowerCase());
                const IntegrationIcon = integrationStyle.icon;
                
                return (
                  <div
                    key={integration.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4 relative"
                  >
                    {/* Header: Title and Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center relative">
                      <div className="flex items-center gap-2 flex-wrap">
                        {integrationStyle.logo ? (
                          <img src={integrationStyle.logo} alt={integration.integration} className="w-4 h-4 object-contain" />
                        ) : (
                          <IntegrationIcon className={`w-4 h-4 ${integrationStyle.textClass}`} />
                        )}
                        <span className={`font-bold tracking-tight ${integrationStyle.textClass}`}>{integration.integration}</span>
                        <HealthBadge status={integration.healthStatus} />
                        {usedByCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded" title={dependentWorkflows.map(w => w.name).join(', ')}>
                            <WorkflowIcon className="w-3 h-3" />
                            {usedByCount}
                          </span>
                        )}
                      </div>
                      <div className="flex">
                        <IntegrationActions
                          integration={{
                            id: integration.id,
                            integration: integration.integration,
                            meta: integration.meta,
                            secrets: parseSecrets(integration.secrets),
                          }}
                          workspaceId={workspaceId}
                          workspaceSlug={workspaceSlug}
                          dependentWorkflows={dependentWorkflows}
                        />
                      </div>
                    </div>

                    {/* Body: Last seen and JSON Toggle row */}
                    <details className="group relative">
                      <summary className="flex items-center justify-between text-zinc-400 border-t border-zinc-800/50 pt-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="text-[10px] sm:text-xs">
                          <span className="text-zinc-500 uppercase tracking-widest text-[9px] mr-1">Last seen:</span>
                          {formatDate(integration.lastSeenAt)}
                        </div>
                        
                        {integration.meta != null && (
                          <div className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5 py-1">
                            <span className="font-medium uppercase tracking-wider text-[9px]">JSON</span>
                            <svg 
                              className="w-2.5 h-2.5 transition-transform duration-200 group-open:rotate-180 text-zinc-600 group-hover:text-zinc-400" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        )}
                      </summary>

                      {integration.meta != null && (
                        <div className="mt-4 border-t border-zinc-800/50 pt-3 overflow-hidden">
                          <pre className="text-[10px] sm:text-xs bg-zinc-950 border border-zinc-800 p-3 rounded-md overflow-x-auto max-h-64 font-mono text-zinc-400 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                            {JSON.stringify(integration.meta, null, 2)}
                          </pre>
                        </div>
                      )}
                    </details>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <AddIntegrationForm workspaceId={workspaceId} />
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="max-w-[1600px] mx-auto">
            <LeadsView leads={leads} leadStages={leadStages} leadPropertySchema={leadPropertySchema} />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="max-w-[1600px] mx-auto">
            <h2 className="text-lg font-semibold mb-4">
              Recent Events ({events.length} of {eventCount?.toLocaleString() ?? '...'})
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-zinc-400">
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">System</th>
                      <th className="px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                          No events yet
                        </td>
                      </tr>
                    ) : (
                      events.map((event) => (
                        <tr
                          key={event.id}
                          className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
                        >
                          <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                            {formatDate(event.createdAt)}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{event.system}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{event.eventType}</td>
                          <td className="px-4 py-2">
                            {event.success ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-red-400">✗</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-red-400 text-xs truncate max-w-xs">
                            {event.errorMessage || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'testing' && (
          <div className="max-w-[1600px] mx-auto">
            <TestingTab workspaceId={workspaceId} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-[1600px] mx-auto">
            <WorkspaceSettings 
              workspaceId={workspaceId} 
              currentTimezone={timezone}
              domainConfig={domainConfig}
              leadStages={leadStages}
            />
          </div>
        )}
    </div>
  );
}

