'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, MessageCircle, Sparkles, Power, PowerOff, Trash2 } from 'lucide-react';
import { AgentEditor } from './agent-editor';

interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  channelType: string | null;
  channelIntegration: string | null;
  aiIntegration: string;
  active: boolean;
  conversationCount: number;
  createdAt: string;
}

interface AgentListProps {
  workspaceId: string;
}

export function AgentList({ workspaceId }: AgentListProps) {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleToggleActive = async (agentId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        fetchAgents();
      }
    } catch (err) {
      console.error('Failed to toggle agent:', err);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (deleting) return;
    setDeleting(agentId);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents/${agentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAgents();
      }
    } catch (err) {
      console.error('Failed to delete agent:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (editingId || creating) {
    return (
      <AgentEditor
        workspaceId={workspaceId}
        agentId={editingId || undefined}
        onClose={() => {
          setEditingId(null);
          setCreating(false);
        }}
        onSave={() => {
          setEditingId(null);
          setCreating(false);
          fetchAgents();
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Agents</h2>
          <span className="text-xs text-zinc-500">({agents.length})</span>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading agents...</div>
      ) : agents.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-lg py-12 text-center">
          <Bot className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm mb-1">No agents yet</p>
          <p className="text-zinc-600 text-xs mb-4">Create an AI agent to handle conversations with your leads</p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded hover:bg-violet-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((bot) => (
            <div
              key={bot.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-400" />
                  <button
                    onClick={() => setEditingId(bot.id)}
                    className="font-semibold text-white text-sm hover:text-violet-400 transition-colors"
                  >
                    {bot.name}
                  </button>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                    bot.active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-zinc-700/50 text-zinc-500'
                  }`}>
                    {bot.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(bot.id, bot.active)}
                    className="p-1 text-zinc-500 hover:text-white transition-colors"
                    title={bot.active ? 'Deactivate' : 'Activate'}
                  >
                    {bot.active ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    disabled={deleting === bot.id}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {bot.description && (
                <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{bot.description}</p>
              )}

              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  {bot.channelType && bot.channelIntegration
                    ? `${bot.channelType} via ${bot.channelIntegration}`
                    : 'Test only'}
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {bot.aiIntegration}
                </span>
                <span className="text-zinc-600">
                  {bot.conversationCount} conversation{bot.conversationCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
