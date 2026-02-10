'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, Filter } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface EventItem {
  id: string;
  system: string;
  eventType: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  leadId?: string | null;
}

const EVENT_SYSTEMS = [
  'BACKEND',
  'MAILERLITE',
  'STRIPE',
  'CALENDLY',
  'MANYCHAT',
  'ABC_IGNITE',
  'RESEND',
  'CRON',
  'WORKFLOW',
] as const;

function formatSystemLabel(system: string): string {
  return system
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(date: string | Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

// =============================================================================
// COMPONENT
// =============================================================================

interface EventsLogProps {
  workspaceId: string;
}

export function EventsLog({ workspaceId }: EventsLogProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState<string>('');

  const fetchEvents = useCallback(async (cursor?: string, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (systemFilter) params.set('system', systemFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '50');

      const res = await fetch(`/api/v1/workspaces/${workspaceId}/events?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load events');
      }

      const data = await res.json();

      if (append) {
        setEvents(prev => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
      }
      setTotal(data.total);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceId, systemFilter]);

  // Fetch on mount and when filter changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchEvents(nextCursor, true);
    }
  };

  return (
    <div>
      {/* Header + Filter */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">
          Events
          {!loading && (
            <span className="text-zinc-500 font-normal text-sm ml-2">
              {events.length} of {total.toLocaleString()}
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <div className="relative">
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-7 py-1.5 text-xs text-white appearance-none focus:outline-none focus:border-zinc-600"
            >
              <option value="">All Systems</option>
              {EVENT_SYSTEMS.map(s => (
                <option key={s} value={s}>{formatSystemLabel(s)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
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
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Loader2 className="w-5 h-5 text-zinc-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    {systemFilter ? `No events for ${formatSystemLabel(systemFilter)}` : 'No events yet'}
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
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        getSystemColor(event.system)
                      }`}>
                        {event.system}
                      </span>
                    </td>
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

        {/* Load More */}
        {nextCursor && !loading && (
          <div className="border-t border-zinc-800 p-3 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </>
              ) : (
                `Load More (${events.length} of ${total.toLocaleString()})`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getSystemColor(system: string): string {
  switch (system) {
    case 'MAILERLITE': return 'bg-green-500/10 text-green-400';
    case 'STRIPE': return 'bg-purple-500/10 text-purple-400';
    case 'CALENDLY': return 'bg-blue-500/10 text-blue-400';
    case 'ABC_IGNITE': return 'bg-orange-500/10 text-orange-400';
    case 'RESEND': return 'bg-cyan-500/10 text-cyan-400';
    case 'MANYCHAT': return 'bg-pink-500/10 text-pink-400';
    case 'WORKFLOW': return 'bg-amber-500/10 text-amber-400';
    case 'CRON': return 'bg-zinc-500/10 text-zinc-400';
    case 'BACKEND': return 'bg-zinc-500/10 text-zinc-400';
    default: return 'bg-zinc-500/10 text-zinc-400';
  }
}
