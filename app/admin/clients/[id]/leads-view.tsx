'use client';

import { useState } from 'react';
import { LeadStage } from '@prisma/client';

interface Lead {
  id: string;
  email: string;
  stage: LeadStage;
  source: string | null;
  lastEventAt: Date | string;
  createdAt: Date | string;
}

interface LeadsViewProps {
  leads: Lead[];
}

const STAGES: { value: LeadStage | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Leads' },
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DEAD', label: 'Dead' },
];

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function StageBadge({ stage }: { stage: LeadStage }) {
  const colors = {
    CAPTURED: 'bg-blue-500/20 text-blue-400',
    BOOKED: 'bg-emerald-500/20 text-emerald-400',
    PAID: 'bg-green-500/20 text-green-400',
    DEAD: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded font-medium ${colors[stage]}`}>
      {stage}
    </span>
  );
}

export function LeadsView({ leads }: LeadsViewProps) {
  const [selectedStage, setSelectedStage] = useState<LeadStage | 'ALL'>('ALL');

  const filteredLeads = selectedStage === 'ALL' 
    ? leads 
    : leads.filter(lead => lead.stage === selectedStage);

  const stageCounts = {
    ALL: leads.length,
    CAPTURED: leads.filter(l => l.stage === 'CAPTURED').length,
    BOOKED: leads.filter(l => l.stage === 'BOOKED').length,
    PAID: leads.filter(l => l.stage === 'PAID').length,
    DEAD: leads.filter(l => l.stage === 'DEAD').length,
  };

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
        {STAGES.map(stage => (
          <button
            key={stage.value}
            onClick={() => setSelectedStage(stage.value)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              selectedStage === stage.value
                ? 'bg-white text-black font-medium'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {stage.label} ({stageCounts[stage.value]})
          </button>
        ))}
      </div>

      {/* Leads table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="px-4 py-12 text-center text-zinc-500">
            No leads in {selectedStage === 'ALL' ? 'any stage' : selectedStage.toLowerCase()} yet
          </div>
        ) : (
          <table className="w-full text-sm">
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
                const daysSinceActivity = Math.floor(
                  (Date.now() - new Date(lead.lastEventAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                const isStale = daysSinceActivity > 1;

                return (
                  <tr 
                    key={lead.id} 
                    className={`border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 ${
                      isStale ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{lead.email}</td>
                    <td className="px-4 py-2">
                      <StageBadge stage={lead.stage} />
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{lead.source || '—'}</td>
                    <td className="px-4 py-2 text-zinc-400">
                      {formatDate(lead.lastEventAt)}
                      {isStale && (
                        <span className="ml-2 text-yellow-400 text-xs">
                          ({daysSinceActivity}d ago)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}



