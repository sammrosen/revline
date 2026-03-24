'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface IntegrationReadiness {
  type: string;
  configured: boolean;
  healthy: boolean;
  missingSecrets: string[];
  missingMeta: string[];
  usedByWorkflows: string[];
}

interface WorkflowReadiness {
  id: string;
  name: string;
  enabled: boolean;
  canEnable: boolean;
  blockers: string[];
}

interface ReadinessData {
  ready: boolean;
  integrations: IntegrationReadiness[];
  workflows: WorkflowReadiness[];
}

export function ReadinessPanel({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchReadiness() {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/readiness`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled) {
          setData(json.data);
          // Auto-expand if there are issues
          const hasIssues = json.data && !json.data.ready;
          if (hasIssues) setExpanded(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReadiness();
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-48" />
      </div>
    );
  }

  if (error || !data) return null;

  // Don't show if there are no integrations at all
  if (data.integrations.length === 0 && data.workflows.length === 0) return null;

  const pendingIntegrations = data.integrations.filter(i => !i.configured);
  const unhealthyIntegrations = data.integrations.filter(i => i.configured && !i.healthy);
  const blockedWorkflows = data.workflows.filter(w => !w.canEnable && !w.enabled);
  const issueCount = pendingIntegrations.length + unhealthyIntegrations.length + blockedWorkflows.length;

  return (
    <div className={`mb-4 border rounded-lg overflow-hidden ${
      data.ready 
        ? 'bg-zinc-900 border-zinc-800' 
        : 'bg-zinc-900 border-amber-500/20'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {data.ready ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-sm font-medium text-zinc-200">
            {data.ready 
              ? 'Ready to Go Live' 
              : `${issueCount} item${issueCount !== 1 ? 's' : ''} need${issueCount === 1 ? 's' : ''} attention`
            }
          </span>
          {!data.ready && (
            <span className="text-xs text-zinc-500">
              {data.integrations.filter(i => i.configured).length}/{data.integrations.length} integrations configured
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-3">
          {/* Integration status */}
          {data.integrations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Integrations</p>
              <div className="space-y-1.5">
                {data.integrations.map((int) => (
                  <div key={int.type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {int.configured && int.healthy ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      ) : int.configured ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="text-zinc-300">{int.type}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {int.configured && int.healthy
                        ? 'Ready'
                        : int.configured
                          ? 'Unhealthy'
                          : int.missingSecrets.length > 0
                            ? `Missing: ${int.missingSecrets.join(', ')}`
                            : 'Pending setup'
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow status — only show workflows with blockers */}
          {blockedWorkflows.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Workflow Blockers</p>
              <div className="space-y-1.5">
                {blockedWorkflows.map((wf) => (
                  <div key={wf.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-zinc-300">{wf.name}</span>
                    </div>
                    {wf.blockers.length > 0 && (
                      <ul className="ml-5.5 mt-0.5 space-y-0.5">
                        {wf.blockers.map((blocker, i) => (
                          <li key={i} className="text-xs text-zinc-500">{blocker}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.ready && (
            <p className="text-xs text-green-400/70">
              All integrations are configured and all workflows can be enabled.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
