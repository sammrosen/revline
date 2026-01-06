'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerAdapter: string;
  triggerOperation: string;
  actionsCount: number;
  totalExecutions: number;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowListProps {
  clientId: string;
  workflows: Workflow[];
  configuredIntegrations: string[];
}

export function WorkflowList({
  clientId,
  workflows,
  configuredIntegrations,
}: WorkflowListProps) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const formatTrigger = (adapter: string, operation: string) => {
    const adapterNames: Record<string, string> = {
      calendly: 'Calendly',
      stripe: 'Stripe',
      revline: 'RevLine',
      mailerlite: 'MailerLite',
      manychat: 'ManyChat',
    };

    const operationNames: Record<string, string> = {
      booking_created: 'Booking Created',
      booking_canceled: 'Booking Canceled',
      payment_succeeded: 'Payment Succeeded',
      subscription_created: 'Subscription Created',
      email_captured: 'Email Captured',
    };

    return `${adapterNames[adapter] || adapter} → ${operationNames[operation] || operation}`;
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
        <Link
          href={`/admin/clients/${clientId}/workflows/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
        >
          Create Workflow
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workflows.map((workflow) => (
        <div
          key={workflow.id}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => handleToggle(workflow.id)}
                  disabled={togglingId === workflow.id}
                  className={`w-10 h-5 rounded-full relative transition-colors ${
                    workflow.enabled ? 'bg-green-500' : 'bg-zinc-700'
                  } ${togglingId === workflow.id ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      workflow.enabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
                <Link
                  href={`/admin/clients/${clientId}/workflows/${workflow.id}`}
                  className="text-lg font-semibold text-white hover:text-zinc-300 truncate"
                >
                  {workflow.name}
                </Link>
              </div>

              {workflow.description && (
                <p className="text-sm text-zinc-400 mb-3 line-clamp-2">
                  {workflow.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded text-zinc-300">
                  <svg
                    className="w-3 h-3"
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
                  {formatTrigger(workflow.triggerAdapter, workflow.triggerOperation)}
                </span>

                <span className="text-zinc-500">
                  {workflow.actionsCount} action{workflow.actionsCount !== 1 ? 's' : ''}
                </span>

                <span className="text-zinc-500">
                  {workflow.totalExecutions} execution
                  {workflow.totalExecutions !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
              <Link
                href={`/admin/clients/${clientId}/workflows/${workflow.id}`}
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
              </Link>
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
  );
}

