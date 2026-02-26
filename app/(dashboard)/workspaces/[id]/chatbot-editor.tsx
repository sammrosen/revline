'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  ArrowLeft,
  Save,
  MessageCircle,
  Sparkles,
  Shield,
  FileText,
  Settings,
  Loader2,
} from 'lucide-react';

interface ChatbotData {
  id?: string;
  name: string;
  description: string;
  channelType: string;
  channelIntegration: string;
  aiIntegration: string;
  systemPrompt: string;
  modelOverride: string;
  temperatureOverride: number | null;
  maxTokensOverride: number | null;
  maxMessagesPerConversation: number;
  maxTokensPerConversation: number;
  conversationTimeoutMinutes: number;
  fallbackMessage: string;
  allowedEvents: string[];
  active: boolean;
}

interface Integration {
  id: string;
  integration: string;
}

interface ChatbotEditorProps {
  workspaceId: string;
  chatbotId?: string;
  onClose: () => void;
  onSave: () => void;
}

const CHANNEL_TYPES = [
  { value: 'SMS', label: 'SMS' },
];

const CHANNEL_INTEGRATIONS: Record<string, string[]> = {
  SMS: ['TWILIO'],
};

const AI_INTEGRATIONS = ['OPENAI', 'ANTHROPIC'];

const AVAILABLE_EVENTS = [
  { value: 'conversation_started', label: 'Conversation Started' },
  { value: 'escalation_requested', label: 'Escalation Requested' },
  { value: 'conversation_completed', label: 'Conversation Completed' },
  { value: 'bot_event', label: 'Custom Bot Event' },
];

const DEFAULT_DATA: ChatbotData = {
  name: '',
  description: '',
  channelType: 'SMS',
  channelIntegration: 'TWILIO',
  aiIntegration: 'OPENAI',
  systemPrompt: '',
  modelOverride: '',
  temperatureOverride: null,
  maxTokensOverride: null,
  maxMessagesPerConversation: 50,
  maxTokensPerConversation: 100000,
  conversationTimeoutMinutes: 1440,
  fallbackMessage: '',
  allowedEvents: ['conversation_started', 'escalation_requested', 'conversation_completed'],
  active: true,
};

export function ChatbotEditor({ workspaceId, chatbotId, onClose, onSave }: ChatbotEditorProps) {
  const [data, setData] = useState<ChatbotData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(!!chatbotId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (res.ok) {
        const workspace = await res.json();
        if (workspace.integrations) {
          setIntegrations(
            workspace.integrations.map((i: { id: string; integration: string }) => ({
              id: i.id,
              integration: i.integration,
            }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  }, [workspaceId]);

  const fetchChatbot = useCallback(async () => {
    if (!chatbotId) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/chatbots/${chatbotId}`);
      if (res.ok) {
        const { data: bot } = await res.json();
        setData({
          id: bot.id,
          name: bot.name,
          description: bot.description || '',
          channelType: bot.channelType,
          channelIntegration: bot.channelIntegration,
          aiIntegration: bot.aiIntegration,
          systemPrompt: bot.systemPrompt,
          modelOverride: bot.modelOverride || '',
          temperatureOverride: bot.temperatureOverride,
          maxTokensOverride: bot.maxTokensOverride,
          maxMessagesPerConversation: bot.maxMessagesPerConversation,
          maxTokensPerConversation: bot.maxTokensPerConversation,
          conversationTimeoutMinutes: bot.conversationTimeoutMinutes,
          fallbackMessage: bot.fallbackMessage || '',
          allowedEvents: bot.allowedEvents || [],
          active: bot.active,
        });
      }
    } catch (err) {
      console.error('Failed to fetch chatbot:', err);
      setError('Failed to load chatbot');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, chatbotId]);

  useEffect(() => {
    fetchIntegrations();
    fetchChatbot();
  }, [fetchIntegrations, fetchChatbot]);

  const handleSave = async () => {
    if (!data.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!data.systemPrompt.trim()) {
      setError('System prompt is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...data,
        modelOverride: data.modelOverride || null,
        description: data.description || null,
        fallbackMessage: data.fallbackMessage || null,
      };

      const url = chatbotId
        ? `/api/v1/workspaces/${workspaceId}/chatbots/${chatbotId}`
        : `/api/v1/workspaces/${workspaceId}/chatbots`;

      const res = await fetch(url, {
        method: chatbotId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || 'Failed to save');
        return;
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChannelIntegration = integrations.some(
    (i) => i.integration === data.channelIntegration
  );
  const hasAIIntegration = integrations.some(
    (i) => i.integration === data.aiIntegration
  );

  const availableChannelIntegrations = CHANNEL_INTEGRATIONS[data.channelType] || [];
  const availableAIIntegrations = AI_INTEGRATIONS.filter((ai) =>
    integrations.some((i) => i.integration === ai)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Bot className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">
            {chatbotId ? 'Edit Chatbot' : 'New Chatbot'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.active}
              onChange={(e) => setData({ ...data, active: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
            />
            <span className={data.active ? 'text-green-400' : 'text-zinc-500'}>
              {data.active ? 'Active' : 'Inactive'}
            </span>
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded hover:bg-violet-500 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Identity */}
        <Section icon={Settings} title="Identity">
          <div className="space-y-3">
            <Field label="Name" required>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="e.g., Lead Nurture Bot"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </Field>
            <Field label="Description">
              <input
                type="text"
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="Short description of what this bot does"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </Field>
          </div>
        </Section>

        {/* Channel Configuration */}
        <Section icon={MessageCircle} title="Channel Configuration">
          <div className="space-y-3">
            <Field label="Channel Type" required>
              <select
                value={data.channelType}
                onChange={(e) => {
                  const channelType = e.target.value;
                  const available = CHANNEL_INTEGRATIONS[channelType] || [];
                  setData({
                    ...data,
                    channelType,
                    channelIntegration: available[0] || '',
                  });
                }}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {CHANNEL_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Channel Integration" required>
              <select
                value={data.channelIntegration}
                onChange={(e) => setData({ ...data, channelIntegration: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {availableChannelIntegrations.map((ci) => (
                  <option key={ci} value={ci}>
                    {ci}
                  </option>
                ))}
              </select>
              {!hasChannelIntegration && data.channelIntegration && (
                <p className="text-xs text-amber-400 mt-1">
                  {data.channelIntegration} is not configured for this workspace. Add it in Integrations first.
                </p>
              )}
            </Field>
          </div>
        </Section>

        {/* AI Configuration */}
        <Section icon={Sparkles} title="AI Configuration">
          <div className="space-y-3">
            <Field label="AI Provider" required>
              <select
                value={data.aiIntegration}
                onChange={(e) => setData({ ...data, aiIntegration: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {AI_INTEGRATIONS.map((ai) => (
                  <option key={ai} value={ai}>
                    {ai}
                  </option>
                ))}
              </select>
              {!hasAIIntegration && (
                <p className="text-xs text-amber-400 mt-1">
                  {data.aiIntegration} is not configured for this workspace. Add it in Integrations first.
                </p>
              )}
              {availableAIIntegrations.length > 0 && !availableAIIntegrations.includes(data.aiIntegration) && (
                <p className="text-xs text-zinc-500 mt-1">
                  Available: {availableAIIntegrations.join(', ')}
                </p>
              )}
            </Field>
            <Field label="Model Override" hint="Leave blank to use integration default">
              <input
                type="text"
                value={data.modelOverride}
                onChange={(e) => setData({ ...data, modelOverride: e.target.value })}
                placeholder={data.aiIntegration === 'ANTHROPIC' ? 'e.g., claude-sonnet-4-6' : 'e.g., gpt-4.1-mini'}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperature" hint="0 = deterministic, higher = creative">
                <input
                  type="number"
                  value={data.temperatureOverride ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      temperatureOverride: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="Default"
                  min={0}
                  max={data.aiIntegration === 'ANTHROPIC' ? 1 : 2}
                  step={0.1}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </Field>
              <Field label="Max Tokens" hint="Per response">
                <input
                  type="number"
                  value={data.maxTokensOverride ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      maxTokensOverride: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  placeholder="Default"
                  min={1}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* System Prompt */}
        <Section icon={FileText} title="System Prompt">
          <div className="space-y-2">
            <textarea
              value={data.systemPrompt}
              onChange={(e) => setData({ ...data, systemPrompt: e.target.value })}
              placeholder="You are a friendly sales assistant for [Business Name]. Your goal is to answer questions about our services, schedule appointments, and help leads become customers. Be concise since responses are sent via SMS."
              rows={8}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-y font-mono"
            />
            <p className="text-xs text-zinc-600">
              This is the AI&apos;s personality and instructions. It&apos;s sent as the system/developer message on every turn.
            </p>
          </div>
        </Section>

        {/* Guardrails */}
        <Section icon={Shield} title="Guardrails">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Max Messages" hint="Per conversation">
                <input
                  type="number"
                  value={data.maxMessagesPerConversation}
                  onChange={(e) =>
                    setData({
                      ...data,
                      maxMessagesPerConversation: parseInt(e.target.value, 10) || 50,
                    })
                  }
                  min={1}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </Field>
              <Field label="Max Tokens" hint="Per conversation">
                <input
                  type="number"
                  value={data.maxTokensPerConversation}
                  onChange={(e) =>
                    setData({
                      ...data,
                      maxTokensPerConversation: parseInt(e.target.value, 10) || 100000,
                    })
                  }
                  min={1000}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </Field>
              <Field label="Timeout" hint="Minutes of inactivity">
                <input
                  type="number"
                  value={data.conversationTimeoutMinutes}
                  onChange={(e) =>
                    setData({
                      ...data,
                      conversationTimeoutMinutes: parseInt(e.target.value, 10) || 1440,
                    })
                  }
                  min={5}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </Field>
            </div>
            <Field label="Fallback Message" hint="Sent when AI fails or limits are hit">
              <input
                type="text"
                value={data.fallbackMessage}
                onChange={(e) => setData({ ...data, fallbackMessage: e.target.value })}
                placeholder="Sorry, I'm unable to help right now. A team member will follow up with you shortly."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </Field>
          </div>
        </Section>

        {/* Allowed Events */}
        <Section icon={Bot} title="Workflow Events">
          <p className="text-xs text-zinc-500 mb-3">
            Select which events this bot emits into the workflow system. Other workflows can listen for these.
          </p>
          <div className="space-y-2">
            {AVAILABLE_EVENTS.map((evt) => (
              <label key={evt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={data.allowedEvents.includes(evt.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setData({ ...data, allowedEvents: [...data.allowedEvents, evt.value] });
                    } else {
                      setData({
                        ...data,
                        allowedEvents: data.allowedEvents.filter((v) => v !== evt.value),
                      });
                    }
                  }}
                  className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-zinc-300">{evt.label}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Summary */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <SummaryRow label="Channel" value={`${data.channelType} via ${data.channelIntegration}`} />
            <SummaryRow label="AI Provider" value={data.aiIntegration} />
            <SummaryRow label="Model" value={data.modelOverride || '(integration default)'} />
            <SummaryRow label="Max Messages" value={String(data.maxMessagesPerConversation)} />
            <SummaryRow label="Timeout" value={`${data.conversationTimeoutMinutes}min`} />
            <SummaryRow label="Status" value={data.active ? 'Active' : 'Inactive'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bot;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-medium text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-zinc-600 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300 font-mono">{value}</span>
    </div>
  );
}
