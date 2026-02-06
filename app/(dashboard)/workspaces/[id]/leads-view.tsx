'use client';

import { useState } from 'react';
import { DEFAULT_LEAD_STAGES, LeadStageDefinition } from '@/app/_lib/types';

interface Lead {
  id: string;
  email: string;
  stage: string;
  source: string | null;
  lastEventAt: Date | string | null;
  createdAt: Date | string;
}

interface LeadsViewProps {
  leads: Lead[];
  leadStages?: LeadStageDefinition[];
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function StageBadge({ stage, stages }: { stage: string; stages: LeadStageDefinition[] }) {
  const def = stages.find(s => s.key === stage);
  const color = def?.color ?? '#6B7280';
  const label = def?.label ?? stage;

  return (
    <span
      className="px-2 py-1 text-xs rounded font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {label}
    </span>
  );
}

export function LeadsView({ leads, leadStages }: LeadsViewProps) {
  const stages = leadStages ?? DEFAULT_LEAD_STAGES;
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  
  // Capture current time once using useState lazy initialization
  // This avoids calling Date.now() during render
  const [now] = useState(() => Date.now());

  const filteredLeads = selectedStage === 'ALL' 
    ? leads 
    : leads.filter(lead => lead.stage === selectedStage);

  // Build stage counts dynamically
  const stageCounts: Record<string, number> = { ALL: leads.length };
  for (const s of stages) {
    stageCounts[s.key] = leads.filter(l => l.stage === s.key).length;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Customer Funnel</h2>
        <div className="text-sm text-zinc-400">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedStage('ALL')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            selectedStage === 'ALL'
              ? 'bg-white text-black font-medium'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          All Leads ({stageCounts.ALL})
        </button>
        {stages.map(stage => (
          <button
            key={stage.key}
            onClick={() => setSelectedStage(stage.key)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              selectedStage === stage.key
                ? 'bg-white text-black font-medium'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: stage.color }}
            />
            {stage.label} ({stageCounts[stage.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Leads table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="px-4 py-12 text-center text-zinc-500">
            No leads in {selectedStage === 'ALL' ? 'any stage' : (stages.find(s => s.key === selectedStage)?.label ?? selectedStage).toLowerCase()} yet
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Last Activity</th>
                  <th className="px-4 py-2 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const lastEventTime = lead.lastEventAt ? new Date(lead.lastEventAt).getTime() : now;
                  const daysSinceActivity = Math.floor(
                    (now - lastEventTime) / (1000 * 60 * 60 * 24)
                  );
                  const isStale = daysSinceActivity > 1;

                  return (
                    <tr 
                      key={lead.id} 
                      className={`border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 ${
                        isStale ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{lead.email}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <StageBadge stage={lead.stage} stages={stages} />
                      </td>
                      <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">{lead.source || '—'}</td>
                      <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                        {lead.lastEventAt ? formatDate(lead.lastEventAt) : '—'}
                        {isStale && lead.lastEventAt && (
                          <span className="ml-2 text-yellow-400 text-xs">
                            ({daysSinceActivity}d ago)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
