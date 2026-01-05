'use client';

import { useEffect, useState } from 'react';

interface MailerLiteGroup {
  id: string;
  name: string;
  active_count: number;
  sent_count?: number;
}

interface AutomationStep {
  id: string;
  type: string;
  description: string;
  parent_id: string | null;
  name?: string;
  subject?: string;
  unit?: string;
  value?: string;
}

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  triggers: Array<{
    type: string;
    group_ids: string[];
    groups: Array<{ id: string; name: string }>;
  }>;
  steps: AutomationStep[];
  emails_count: number;
  stats: {
    sent: number;
    open_rate: { float: number; string: string };
    click_rate: { float: number; string: string };
    completed_subscribers_count: number;
    subscribers_in_queue_count: number;
  };
}

interface ConfiguredGroup extends MailerLiteGroup {
  type: 'lead' | 'customer' | 'program';
  config_key: string;
}

interface InsightsData {
  groups: MailerLiteGroup[];
  automations: Automation[];
  configured_groups: {
    lead?: ConfiguredGroup;
    customer?: ConfiguredGroup;
    programs?: ConfiguredGroup[];
  };
  summary: {
    total_groups: number;
    total_automations: number;
    active_automations: number;
    total_subscribers: number;
  };
}

interface MailerLiteInsightsProps {
  clientId: string;
}

export default function MailerLiteInsights({ clientId }: MailerLiteInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAutomation, setExpandedAutomation] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const response = await fetch(`/api/admin/clients/${clientId}/mailerlite-insights`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch insights');
        }
        const insights = await response.json();
        setData(insights);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, [clientId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <div className="animate-pulse">Loading MailerLite insights...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-lg">
        <h3 className="text-red-400 font-semibold mb-2">Error loading insights</h3>
        <p className="text-zinc-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-zinc-400">No data available</div>
    );
  }

  // Get automations for a specific group
  const getAutomationsForGroup = (groupId: string): Automation[] => {
    return data.automations.filter((automation) =>
      automation.triggers.some((trigger) => trigger.group_ids.includes(groupId))
    );
  };

  // Calculate average metrics across all automations
  const avgOpenRate =
    data.automations.length > 0
      ? (
          data.automations.reduce((sum, a) => sum + (a.stats.open_rate?.float || 0), 0) /
          data.automations.length
        ).toFixed(1)
      : '0.0';

  const avgClickRate =
    data.automations.length > 0
      ? (
          data.automations.reduce((sum, a) => sum + (a.stats.click_rate?.float || 0), 0) /
          data.automations.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400 mb-1">Total Groups</div>
          <div className="text-2xl font-bold text-white">{data.summary.total_groups}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400 mb-1">Active Automations</div>
          <div className="text-2xl font-bold text-green-400">
            {data.summary.active_automations}
          </div>
          <div className="text-xs text-zinc-500">
            of {data.summary.total_automations} total
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400 mb-1">Avg Open Rate</div>
          <div className="text-2xl font-bold text-blue-400">{avgOpenRate}%</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400 mb-1">Avg Click Rate</div>
          <div className="text-2xl font-bold text-purple-400">{avgClickRate}%</div>
        </div>
      </div>

      {/* Configured Groups Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Configured Groups & Automations</h2>

        {/* Lead Group */}
        {data.configured_groups.lead && (
          <GroupCard
            group={data.configured_groups.lead}
            automations={getAutomationsForGroup(data.configured_groups.lead.id)}
            expandedAutomation={expandedAutomation}
            onToggleAutomation={setExpandedAutomation}
          />
        )}

        {/* Customer Group */}
        {data.configured_groups.customer && (
          <GroupCard
            group={data.configured_groups.customer}
            automations={getAutomationsForGroup(data.configured_groups.customer.id)}
            expandedAutomation={expandedAutomation}
            onToggleAutomation={setExpandedAutomation}
          />
        )}

        {/* Program Groups */}
        {data.configured_groups.programs?.map((program) => (
          <GroupCard
            key={program.id}
            group={program}
            automations={getAutomationsForGroup(program.id)}
            expandedAutomation={expandedAutomation}
            onToggleAutomation={setExpandedAutomation}
          />
        ))}

        {/* No configured groups message */}
        {!data.configured_groups.lead &&
          !data.configured_groups.customer &&
          !data.configured_groups.programs?.length && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
              <p className="text-yellow-400">
                No configured groups found. Update the client&apos;s MailerLite integration
                metadata to specify group IDs.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

interface GroupCardProps {
  group: ConfiguredGroup;
  automations: Automation[];
  expandedAutomation: string | null;
  onToggleAutomation: (id: string | null) => void;
}

function GroupCard({
  group,
  automations,
  expandedAutomation,
  onToggleAutomation,
}: GroupCardProps) {
  const typeColors = {
    lead: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    customer: 'bg-green-500/10 border-green-500/20 text-green-400',
    program: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white">{group.name}</h3>
            <span
              className={`text-xs px-2 py-1 rounded border ${typeColors[group.type]}`}
            >
              {group.type}
            </span>
          </div>
          <div className="text-sm text-zinc-400">
            👥 {group.active_count} active subscribers • ID: {group.id}
          </div>
        </div>
      </div>

      {/* Automations for this group */}
      {automations.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium text-zinc-300">
            ⚡ Triggered Automations ({automations.length})
          </div>
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              isExpanded={expandedAutomation === automation.id}
              onToggle={() =>
                onToggleAutomation(
                  expandedAutomation === automation.id ? null : automation.id
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-zinc-500 bg-zinc-800/30 rounded p-3">
          No automations triggered by this group
        </div>
      )}
    </div>
  );
}

interface AutomationCardProps {
  automation: Automation;
  isExpanded: boolean;
  onToggle: () => void;
}

function AutomationCard({ automation, isExpanded, onToggle }: AutomationCardProps) {
  const statusColor = automation.enabled
    ? 'bg-green-500/10 border-green-500/20 text-green-400'
    : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400';

  // Calculate total delay in days
  const totalDelayDays = automation.steps
    .filter((step) => step.type === 'delay')
    .reduce((sum, step) => {
      const value = parseInt(step.value || '0');
      const unit = step.unit;
      if (unit === 'days') return sum + value;
      if (unit === 'hours') return sum + value / 24;
      if (unit === 'minutes') return sum + value / (24 * 60);
      return sum;
    }, 0);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-zinc-800/70 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white font-medium">{automation.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded border ${statusColor}`}>
                {automation.enabled ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
              <span>📧 {automation.emails_count} emails</span>
              {totalDelayDays > 0 && (
                <span>🕐 {Math.round(totalDelayDays)} days</span>
              )}
              <span>📊 {automation.stats.open_rate.string} open</span>
              <span>🖱️ {automation.stats.click_rate.string} click</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {automation.stats.sent} sent • {automation.stats.completed_subscribers_count}{' '}
              completed • {automation.stats.subscribers_in_queue_count} in queue
            </div>
          </div>
          <div className="text-zinc-500 ml-4">
            {isExpanded ? '▲' : '▼'}
          </div>
        </div>
      </button>

      {/* Expanded automation flow */}
      {isExpanded && (
        <div className="border-t border-zinc-700 p-4 bg-zinc-900/30">
          <div className="text-sm font-medium text-zinc-300 mb-3">Automation Flow:</div>
          <div className="space-y-2">
            {automation.steps.map((step, index) => (
              <div key={step.id} className="flex gap-3 text-sm">
                <div className="text-zinc-500 font-mono w-6">{index + 1}.</div>
                <div className="flex-1">
                  {step.type === 'email' && (
                    <div className="text-zinc-300">
                      <span className="text-blue-400">📧 Email:</span> {step.subject || step.name}
                    </div>
                  )}
                  {step.type === 'delay' && (
                    <div className="text-zinc-400">
                      <span className="text-yellow-400">⏱️ Wait:</span> {step.value} {step.unit}
                    </div>
                  )}
                  {step.type === 'condition' && (
                    <div className="text-zinc-400">
                      <span className="text-purple-400">🔀 Condition:</span> {step.description}
                    </div>
                  )}
                  {step.type !== 'email' && step.type !== 'delay' && step.type !== 'condition' && (
                    <div className="text-zinc-400">
                      <span className="text-zinc-500">• {step.type}:</span> {step.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

