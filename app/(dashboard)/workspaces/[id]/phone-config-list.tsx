'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, Plus, Trash2, Copy, Check, X, ChevronDown, ChevronRight } from 'lucide-react';

interface PhoneConfig {
  id: string;
  name: string;
  twilioNumberKey: string;
  forwardingNumber: string;
  mode: string;
  agentId: string | null;
  autoTextTemplate: string;
  voiceGreeting: string;
  notificationTemplate: string;
  blocklist: string[];
  enabled: boolean;
  agent: { id: string; name: string } | null;
}

interface AgentOption {
  id: string;
  name: string;
  hasSms: boolean;
}

interface TwilioPhoneEntry {
  number: string;
  label: string;
}

interface PhoneConfigListProps {
  workspaceId: string;
  workspaceSlug: string;
}

const DEFAULT_FORM = {
  name: '',
  twilioNumberKey: '',
  forwardingNumber: '',
  mode: 'NOTIFICATION' as 'NOTIFICATION' | 'AGENT',
  agentId: '',
  autoTextTemplate: 'Hey! Sorry I missed your call. How can I help?',
  voiceGreeting: 'Thanks for calling. We\'ll text you right away.',
  notificationTemplate: 'Missed call from {{callerPhone}}. Text them back!',
  blocklist: [] as string[],
  enabled: true,
};

export function PhoneConfigList({ workspaceId, workspaceSlug }: PhoneConfigListProps) {
  const [configs, setConfigs] = useState<PhoneConfig[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, TwilioPhoneEntry>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [blocklistInput, setBlocklistInput] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/phone-configs`);
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch phone configs:', err);
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
            hasSms: channels.some((c) => c.channel === 'SMS'),
          };
        });
        setAgents(agentList);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, [workspaceId]);

  const fetchPhoneNumbers = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (res.ok) {
        const workspace = await res.json();
        const integrations = workspace.integrations || [];
        const twilio = integrations.find((i: { integration: string }) => i.integration === 'TWILIO');
        if (twilio?.meta && typeof twilio.meta === 'object' && 'phoneNumbers' in twilio.meta) {
          setPhoneNumbers(twilio.meta.phoneNumbers as Record<string, TwilioPhoneEntry>);
        }
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchConfigs();
    fetchAgents();
    fetchPhoneNumbers();
  }, [fetchConfigs, fetchAgents, fetchPhoneNumbers]);

  const handleCreate = () => {
    setForm(DEFAULT_FORM);
    setCreating(true);
    setEditing(null);
    setError(null);
    setBlocklistInput('');
  };

  const handleEdit = (config: PhoneConfig) => {
    setForm({
      name: config.name,
      twilioNumberKey: config.twilioNumberKey,
      forwardingNumber: config.forwardingNumber,
      mode: config.mode as 'NOTIFICATION' | 'AGENT',
      agentId: config.agentId || '',
      autoTextTemplate: config.autoTextTemplate,
      voiceGreeting: config.voiceGreeting,
      notificationTemplate: config.notificationTemplate,
      blocklist: Array.isArray(config.blocklist) ? config.blocklist : [],
      enabled: config.enabled,
    });
    setEditing(config.id);
    setCreating(false);
    setError(null);
    setBlocklistInput('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.twilioNumberKey) { setError('Select a Twilio number'); return; }
    if (!form.forwardingNumber.trim()) { setError('Forwarding number is required'); return; }
    if (!/^\+[1-9]\d{1,14}$/.test(form.forwardingNumber)) { setError('Forwarding number must be E.164 format (e.g. +15551234567)'); return; }
    if (form.mode === 'AGENT' && !form.agentId) { setError('Select an agent for AI Agent mode'); return; }

    setSaving(true);
    setError(null);

    try {
      const url = editing
        ? `/api/v1/workspaces/${workspaceId}/phone-configs/${editing}`
        : `/api/v1/workspaces/${workspaceId}/phone-configs`;

      const payload = {
        ...form,
        agentId: form.mode === 'AGENT' ? form.agentId : null,
      };

      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    if (!confirm('Delete this phone config? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/phone-configs/${configId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Delete failed' }));
        setError(data.error || 'Delete failed');
        return;
      }
      fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const addBlocklistEntry = () => {
    const val = blocklistInput.trim();
    if (!val) return;
    if (!/^\+[1-9]\d{1,14}$/.test(val)) {
      setError('Blocklist number must be E.164 format (e.g. +15551234567)');
      return;
    }
    if (form.blocklist.includes(val)) {
      setError('Number already in blocklist');
      return;
    }
    setForm({ ...form, blocklist: [...form.blocklist, val] });
    setBlocklistInput('');
    setError(null);
  };

  const removeBlocklistEntry = (num: string) => {
    setForm({ ...form, blocklist: form.blocklist.filter((n) => n !== num) });
  };

  const voiceWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/v1/twilio-voice?source=${workspaceSlug}`
    : `https://your-domain.com/api/v1/twilio-voice?source=${workspaceSlug}`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(voiceWebhookUrl).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  };

  const resolveNumber = (key: string): string => {
    const entry = phoneNumbers[key];
    return entry ? `${entry.label} (${entry.number})` : key;
  };

  const smsAgents = agents.filter((a) => a.hasSms);
  const hasPhoneNumbers = Object.keys(phoneNumbers).length > 0;

  // =========================================================================
  // EDITOR VIEW
  // =========================================================================
  if (editing || creating) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Phone Config' : 'New Phone Config'}</h2>
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

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Main Line Missed Calls"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Twilio Number */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Twilio Number</label>
            {hasPhoneNumbers ? (
              <select
                value={form.twilioNumberKey}
                onChange={(e) => setForm({ ...form, twilioNumberKey: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Select number...</option>
                {Object.entries(phoneNumbers).map(([key, entry]) => (
                  <option key={key} value={key}>
                    {entry.label} ({entry.number})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700 rounded p-2">
                No phone numbers available. Configure them in the Twilio integration first.
              </p>
            )}
          </div>

          {/* Forwarding Number */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Your Personal Number</label>
            <input
              type="text"
              value={form.forwardingNumber}
              onChange={(e) => setForm({ ...form, forwardingNumber: e.target.value })}
              placeholder="+15551234567"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none font-mono"
            />
            <p className="text-xs text-zinc-600 mt-1">E.164 format — where you receive notifications and escalations</p>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, mode: 'NOTIFICATION' })}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors border ${
                  form.mode === 'NOTIFICATION'
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                Notification
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, mode: 'AGENT' })}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors border ${
                  form.mode === 'AGENT'
                    ? 'bg-violet-500/10 border-violet-500/50 text-violet-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                AI Agent
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              {form.mode === 'NOTIFICATION'
                ? 'Sends you a text when someone calls. You text them back yourself.'
                : 'AI agent handles the conversation via SMS after the missed call.'}
            </p>
          </div>

          {/* Agent (AGENT mode only) */}
          {form.mode === 'AGENT' && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Agent</label>
              {smsAgents.length > 0 ? (
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Select agent...</option>
                  {smsAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700 rounded p-2">
                  No agents with SMS channel configured. Add an SMS channel to an agent first.
                </p>
              )}
            </div>
          )}

          {/* Voice Greeting */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Voice Greeting</label>
            <textarea
              value={form.voiceGreeting}
              onChange={(e) => setForm({ ...form, voiceGreeting: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-600 mt-1">Spoken to the caller when Twilio answers the forwarded call</p>
          </div>

          {/* Auto-Text Template */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Auto-Text to Caller</label>
            <textarea
              value={form.autoTextTemplate}
              onChange={(e) => setForm({ ...form, autoTextTemplate: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-600 mt-1">Sent to the caller via SMS after the missed call</p>
          </div>

          {/* Notification Template (NOTIFICATION mode only) */}
          {form.mode === 'NOTIFICATION' && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Notification to You</label>
              <textarea
                value={form.notificationTemplate}
                onChange={(e) => setForm({ ...form, notificationTemplate: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Sent to your personal number. Variables: <code className="text-zinc-400">{'{{callerPhone}}'}</code>
              </p>
            </div>
          )}

          {/* Blocklist */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Blocklist</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={blocklistInput}
                onChange={(e) => setBlocklistInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBlocklistEntry(); } }}
                placeholder="+15551234567"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={addBlocklistEntry}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Add
              </button>
            </div>
            {form.blocklist.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.blocklist.map((num) => (
                  <span key={num} className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 font-mono">
                    {num}
                    <button onClick={() => removeBlocklistEntry(num)} className="text-zinc-500 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-zinc-600 mt-1">Numbers that should never trigger automations (e.g. spouse, business partner)</p>
          </div>

          {/* Enabled */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-zinc-300">Enabled</span>
          </label>

          {/* Save */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}
            </button>
            <button
              onClick={() => { setEditing(null); setCreating(false); }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LIST VIEW
  // =========================================================================
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Phone</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Config
        </button>
      </div>

      {/* Voice Webhook URL */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-500 mb-1">Voice Webhook URL</p>
            <code className="text-xs text-emerald-400 break-all">{voiceWebhookUrl}</code>
            <p className="text-xs text-zinc-600 mt-1.5">
              Set this as the <strong className="text-zinc-400">Voice URL</strong> (HTTP POST) on your Twilio phone number.
            </p>
          </div>
          <button
            onClick={copyWebhookUrl}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            {webhookCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {webhookCopied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Carrier forwarding help */}
        <button
          onClick={() => setHelpOpen(!helpOpen)}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-3 transition-colors"
        >
          {helpOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          How to set up call forwarding on your phone
        </button>
        {helpOpen && (
          <div className="mt-2 bg-zinc-800/50 border border-zinc-700 rounded p-3 text-xs text-zinc-400 space-y-1.5">
            <p>On your personal phone, set up conditional call forwarding to your Twilio number:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong className="text-zinc-300">Most carriers:</strong> dial <code className="text-emerald-400">*61*{'{twilioNumber}'}#</code> for &quot;forward when unanswered&quot;</li>
              <li><strong className="text-zinc-300">iPhone:</strong> Settings &gt; Phone &gt; Call Forwarding (forwards all calls)</li>
              <li><strong className="text-zinc-300">Android:</strong> Phone app &gt; Settings &gt; Calls &gt; Call forwarding</li>
            </ul>
            <p>Your public number stays the same. Only unanswered calls are forwarded to Revline.</p>
          </div>
        )}
      </div>

      {/* Config List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <Phone className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 mb-1">No phone configs yet</p>
          <p className="text-xs text-zinc-600">Create one to handle missed calls via notification or AI agent.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white truncate">{config.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    config.enabled
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-zinc-700/50 text-zinc-500'
                  }`}>
                    {config.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    config.mode === 'AGENT'
                      ? 'bg-violet-500/10 text-violet-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {config.mode === 'AGENT' ? 'AI Agent' : 'Notification'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="font-mono">{resolveNumber(config.twilioNumberKey)}</span>
                  <span>&rarr;</span>
                  <span className="font-mono">{config.forwardingNumber}</span>
                  {config.agent && (
                    <>
                      <span className="text-zinc-700">|</span>
                      <span>Agent: {config.agent.name}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(config)}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors"
                >
                  Edit
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
          ))}
        </div>
      )}
    </div>
  );
}
