'use client';

import { useState, useEffect, useCallback } from 'react';
import { HealthStatus, LeadStage } from '@prisma/client';
import { IntegrationActions } from './integration-actions';
import { AddIntegrationForm } from './add-integration-form';
import { LeadsView } from './leads-view';
import MailerLiteInsights from './mailerlite-insights';
import { WorkflowList } from './workflows/workflow-list';
import { Workflow as WorkflowIcon } from 'lucide-react';

type TabType = 'workflows' | 'integrations' | 'leads' | 'events' | 'insights';

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
  stage: LeadStage;
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

interface ClientTabsProps {
  clientId: string;
  integrations: Integration[];
  events: Event[];
  leads: Lead[];
  workflows: Workflow[];
  configuredIntegrations: string[];
  mailerliteGroups?: Record<string, { id: string; name: string }>;
  stripeProducts?: Record<string, string>;
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

export function ClientTabs({ clientId, integrations, events, leads, workflows, configuredIntegrations, mailerliteGroups = {}, stripeProducts = {} }: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('workflows');
  const [integrationDeps, setIntegrationDeps] = useState<Record<string, IntegrationDependency>>({});

  // Fetch integration dependencies when integrations tab is active
  const fetchDependencies = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/dependency-graph`);
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
  }, [clientId]);

  useEffect(() => {
    if (activeTab === 'integrations') {
      fetchDependencies();
    }
  }, [activeTab, fetchDependencies]);

  // Helper to get dependent workflows for an integration
  const getDependentWorkflows = (integrationType: string) => {
    const key = integrationType.toLowerCase();
    const deps = integrationDeps[key];
    if (!deps?.usedBy?.length) return [];
    return deps.usedBy.map(u => ({ id: u.workflowId, name: u.workflowName }));
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'workflows', label: 'Workflows', count: workflows.length },
    { id: 'integrations', label: 'Integrations', count: integrations.length },
    { id: 'leads', label: 'Leads', count: leads.length },
    { id: 'insights', label: 'Insights' },
    { id: 'events', label: 'Events', count: events.length },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-zinc-800 mb-4">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {tab.id === 'workflows' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              )}
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 text-xs text-zinc-500">({tab.count})</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'workflows' && (
          <div>
            <WorkflowList
              clientId={clientId}
              workflows={workflows}
              configuredIntegrations={configuredIntegrations}
              mailerliteGroups={mailerliteGroups}
              stripeProducts={stripeProducts}
            />
          </div>
        )}

        {activeTab === 'integrations' && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {integrations.map((integration) => {
                const dependentWorkflows = getDependentWorkflows(integration.integration);
                const usedByCount = dependentWorkflows.length;
                
                return (
                  <div
                    key={integration.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4 relative"
                  >
                    {/* Header: Title and Actions */}
                    <div className="flex flex-row justify-between items-center gap-4 relative">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold tracking-tight text-white">{integration.integration}</span>
                        <HealthBadge status={integration.healthStatus} />
                        {usedByCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded" title={dependentWorkflows.map(w => w.name).join(', ')}>
                            <WorkflowIcon className="w-3 h-3" />
                            {usedByCount}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <IntegrationActions
                          integration={{
                            id: integration.id,
                            integration: integration.integration,
                            meta: integration.meta,
                            secrets: parseSecrets(integration.secrets),
                          }}
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
              <AddIntegrationForm clientId={clientId} />
            </div>
          </div>
        )}

        {activeTab === 'leads' && <LeadsView leads={leads} />}

        {activeTab === 'insights' && <MailerLiteInsights clientId={clientId} />}

        {activeTab === 'events' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Events (Last 50)</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
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
                        <td className="px-4 py-2 font-mono text-xs">{event.system}</td>
                        <td className="px-4 py-2">{event.eventType}</td>
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
        )}
      </div>
    </div>
  );
}

