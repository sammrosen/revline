'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, Copy, Check, Palette } from 'lucide-react';

interface WebchatConfig {
  id: string;
  name: string;
  agentId: string;
  brandColor: string;
  chatName: string;
  collectEmail: boolean;
  collectPhone: boolean;
  greeting: string | null;
  active: boolean;
  agent: { id: string; name: string };
}

interface AgentOption {
  id: string;
  name: string;
  hasWebChat: boolean;
}

interface WebchatConfigListProps {
  workspaceId: string;
}

const DEFAULT_FORM = {
  name: '',
  agentId: '',
  brandColor: '#2563eb',
  chatName: 'Chat',
  collectEmail: true,
  collectPhone: false,
  greeting: '',
  active: true,
};

export function WebchatConfigList({ workspaceId }: WebchatConfigListProps) {
  const [configs, setConfigs] = useState<WebchatConfig[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/webchat-configs`);
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch webchat configs:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents`);
      if (res.ok) {
        const data = await res.json();
        const agentList = (data.data || []).map((a: { id: string; name: string; channels: unknown }) => {
          const channels = Array.isArray(a.channels) ? (a.channels as Array<{ channel: string }>) : [];
          return {
            id: a.id,
            name: a.name,
            hasWebChat: channels.some((c) => c.channel === 'WEB_CHAT'),
          };
        });
        setAgents(agentList);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchConfigs();
    fetchAgents();
  }, [fetchConfigs, fetchAgents]);

  const handleCreate = () => {
    setForm(DEFAULT_FORM);
    setCreating(true);
    setEditing(null);
    setError(null);
  };

  const handleEdit = (config: WebchatConfig) => {
    setForm({
      name: config.name,
      agentId: config.agentId,
      brandColor: config.brandColor,
      chatName: config.chatName,
      collectEmail: config.collectEmail,
      collectPhone: config.collectPhone,
      greeting: config.greeting || '',
      active: config.active,
    });
    setEditing(config.id);
    setCreating(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.agentId) { setError('Select an agent'); return; }

    setSaving(true);
    setError(null);

    try {
      const url = editing
        ? `/api/v1/workspaces/${workspaceId}/webchat-configs/${editing}`
        : `/api/v1/workspaces/${workspaceId}/webchat-configs`;

      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          greeting: form.greeting || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error || 'Save failed');
      }

      setEditing(null);
      setCreating(false);
      fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      await fetch(`/api/v1/workspaces/${workspaceId}/webchat-configs/${configId}`, {
        method: 'DELETE',
      });
      fetchConfigs();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const getSnippet = (configId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
    return `<script\n  src="${origin}/embed/webchat-loader.js"\n  data-config="${configId}"\n  async defer\n></script>`;
  };

  const copySnippet = (configId: string) => {
    navigator.clipboard.writeText(getSnippet(configId)).then(() => {
      setSnippetCopied(configId);
      setTimeout(() => setSnippetCopied(null), 2000);
    });
  };

  const webChatAgents = agents.filter((a) => a.hasWebChat);

  if (editing || creating) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Web Chat' : 'New Web Chat'}</h2>
          <button
            onClick={() => { setEditing(null); setCreating(false); }}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4 max-w-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Landing Page Chat"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Agent</label>
            {webChatAgents.length > 0 ? (
              <select
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Select agent...</option>
                {webChatAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700 rounded p-2">
                No agents with WEB_CHAT channel configured. Add a Web Chat channel to an agent first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Brand Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  className="w-8 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white font-mono focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Chat Name</label>
              <input
                type="text"
                value={form.chatName}
                onChange={(e) => setForm({ ...form, chatName: e.target.value })}
                placeholder="Chat"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Greeting</label>
            <textarea
              value={form.greeting}
              onChange={(e) => setForm({ ...form, greeting: e.target.value })}
              placeholder="Optional greeting shown before the first message"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.collectEmail}
                onChange={(e) => setForm({ ...form, collectEmail: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-zinc-300">Collect email</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.collectPhone}
                onChange={(e) => setForm({ ...form, collectPhone: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-zinc-300">Collect phone</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-zinc-300">Active</span>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Web Chat'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Web Chats</h2>
          <span className="text-xs text-zinc-500">({configs.length})</span>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Web Chat
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-lg py-12 text-center">
          <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm mb-1">No web chats configured</p>
          <p className="text-zinc-600 text-xs mb-4">Create a webchat config to embed a chat widget on any website</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded hover:bg-violet-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Web Chat
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.brandColor }}
                    />
                    <button
                      onClick={() => handleEdit(config)}
                      className="font-semibold text-white text-sm hover:text-violet-400 transition-colors"
                    >
                      {config.name}
                    </button>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                      config.active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-zinc-700/50 text-zinc-500'
                    }`}>
                      {config.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Agent: {config.agent.name} · {config.chatName}
                    {config.collectEmail && ' · Collects email'}
                    {config.collectPhone && ' · Collects phone'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-1 text-zinc-500 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Palette className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Embed Snippet</p>
                <div className="relative">
                  <pre className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">
                    {getSnippet(config.id)}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copySnippet(config.id)}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    {snippetCopied === config.id ? (
                      <>
                        <Check className="w-3 h-3 text-green-400" />
                        <span className="text-green-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-1.5">
                  Add before the closing <code className="text-violet-400">&lt;/body&gt;</code> tag on any HTML page.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
