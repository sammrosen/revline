'use client';

import { useState } from 'react';
import { HealthStatus } from '@prisma/client';
import { IntegrationActions } from './integration-actions';
import { AddIntegrationForm } from './add-integration-form';
import { LeadsView } from './leads-view';
import MailerLiteInsights from './mailerlite-insights';

type TabType = 'integrations' | 'leads' | 'events' | 'insights';

interface Integration {
  id: string;
  integration: string;
  healthStatus: HealthStatus;
  lastSeenAt: Date | null;
  meta: any;
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
  source: string;
  lastEventAt: Date | null;
  createdAt: Date;
}

interface ClientTabsProps {
  clientId: string;
  integrations: Integration[];
  events: Event[];
  leads: Lead[];
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

export function ClientTabs({ clientId, integrations, events, leads }: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('integrations');

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'integrations', label: 'Integrations', count: integrations.length },
    { id: 'leads', label: 'Leads', count: leads.length },
    { id: 'insights', label: 'Insights' },
    { id: 'events', label: 'Events', count: events.length },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-zinc-800 mb-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
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
        {activeTab === 'integrations' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{integration.integration}</span>
                      <HealthBadge status={integration.healthStatus} />
                    </div>
                    <IntegrationActions
                      clientId={clientId}
                      integration={{
                        id: integration.id,
                        integration: integration.integration,
                        meta: integration.meta,
                      }}
                    />
                  </div>
                  <div className="text-sm text-zinc-400">
                    Last seen: {formatDate(integration.lastSeenAt)}
                  </div>
                  {integration.meta && (
                    <pre className="mt-2 text-xs bg-zinc-950 p-2 rounded overflow-x-auto">
                      {JSON.stringify(integration.meta, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
            <AddIntegrationForm clientId={clientId} />
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

