'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Upload,
  Trash2,
  Paperclip,
  Plus,
  HelpCircle,
  Wrench,
  Clock,
} from 'lucide-react';

interface AgentData {
  id?: string;
  name: string;
  description: string;
  channelType: string;
  channelIntegration: string;
  channelAddress: string;
  channelEnabled: boolean;
  aiIntegration: string;
  systemPrompt: string;
  initialMessage: string;
  modelOverride: string;
  temperatureOverride: number | null;
  maxTokensOverride: number | null;
  maxMessagesPerConversation: number;
  maxTokensPerConversation: number;
  conversationTimeoutMinutes: number;
  responseDelaySeconds: number;
  autoResumeMinutes: number;
  rateLimitPerHour: number;
  fallbackMessage: string;
  escalationPattern: string;
  faqOverrides: Array<{ patterns: string; response: string }>;
  allowedEvents: string[];
  enabledTools: string[];
  active: boolean;
  followUpEnabled: boolean;
  followUpAiGenerated: boolean;
  followUpSequence: Array<{ delayMinutes: number; unit: 'minutes' | 'hours' | 'days'; message: string; variants: string[] }>;
}

interface Integration {
  id: string;
  integration: string;
  meta: Record<string, unknown> | null;
}

interface AgentFileData {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  charCount: number;
  createdAt: string;
}

interface AgentEditorProps {
  workspaceId: string;
  agentId?: string;
  onClose: () => void;
  onSave: () => void;
}

const CHANNEL_TYPES = [
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WEB_CHAT', label: 'Web Chat' },
];

const CHANNEL_INTEGRATIONS: Record<string, string[]> = {
  SMS: ['TWILIO'],
  EMAIL: ['RESEND'],
  WEB_CHAT: ['BUILT_IN'],
};

const AI_INTEGRATIONS = ['OPENAI', 'ANTHROPIC'];

const BASE_VARIABLES: { key: string; label: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'stage', label: 'Lead Stage' },
  { key: 'source', label: 'Lead Source' },
  { key: 'workspaceName', label: 'Workspace Name' },
];

const AVAILABLE_EVENTS = [
  { value: 'conversation_started', label: 'Conversation Started' },
  { value: 'escalation_requested', label: 'Escalation Requested' },
  { value: 'conversation_completed', label: 'Conversation Completed' },
  { value: 'contact_opted_out', label: 'Contact Opted Out' },
  { value: 'bot_event', label: 'Custom Bot Event' },
];

const DEFAULT_DATA: AgentData = {
  name: '',
  description: '',
  channelType: 'SMS',
  channelIntegration: 'TWILIO',
  channelAddress: '',
  channelEnabled: false,
  aiIntegration: 'OPENAI',
  systemPrompt: '',
  initialMessage: '',
  modelOverride: '',
  temperatureOverride: null,
  maxTokensOverride: null,
  maxMessagesPerConversation: 50,
  maxTokensPerConversation: 100000,
  conversationTimeoutMinutes: 1440,
  responseDelaySeconds: 0,
  autoResumeMinutes: 60,
  rateLimitPerHour: 10,
  fallbackMessage: '',
  escalationPattern: '[ESCALATE]',
  faqOverrides: [],
  allowedEvents: ['conversation_started', 'escalation_requested', 'conversation_completed'],
  enabledTools: [],
  active: true,
  followUpEnabled: false,
  followUpAiGenerated: true,
  followUpSequence: [],
};

export function AgentEditor({ workspaceId, agentId, onClose, onSave }: AgentEditorProps) {
  const [data, setData] = useState<AgentData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(!!agentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [leadPropertySchema, setLeadPropertySchema] = useState<{ key: string; label: string }[]>([]);
  const [files, setFiles] = useState<AgentFileData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialMessageRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageWrapperRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<{
    open: boolean;
    filter: string;
    index: number;
    triggerStart: number;
  }>({ open: false, filter: '', index: 0, triggerStart: 0 });

  const fetchWorkspaceData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (res.ok) {
        const workspace = await res.json();
        if (workspace.integrations) {
          setIntegrations(
            workspace.integrations.map((i: { id: string; integration: string; meta: Record<string, unknown> | null }) => ({
              id: i.id,
              integration: i.integration,
              meta: i.meta,
            }))
          );
        }
        if (Array.isArray(workspace.leadPropertySchema)) {
          setLeadPropertySchema(
            workspace.leadPropertySchema.map((p: { key: string; label: string }) => ({
              key: p.key,
              label: p.label,
            }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspace:', err);
    }
  }, [workspaceId]);

  const fetchModels = useCallback(async (provider: string) => {
    const integration = integrations.find((i) => i.integration === provider);
    if (!integration) {
      setAvailableModels([]);
      return;
    }
    const endpoint = provider === 'OPENAI' ? 'openai-models' : 'anthropic-models';
    setFetchingModels(true);
    try {
      const res = await fetch(`/api/v1/integrations/${integration.id}/${endpoint}`);
      if (res.ok) {
        const { data: models } = await res.json();
        setAvailableModels(models.map((m: { id: string }) => m.id));
      } else {
        setAvailableModels([]);
      }
    } catch {
      setAvailableModels([]);
    } finally {
      setFetchingModels(false);
    }
  }, [integrations]);

  const fetchAgent = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents/${agentId}`);
      if (res.ok) {
        const { data: bot } = await res.json();
        setData({
          id: bot.id,
          name: bot.name,
          description: bot.description || '',
          channelType: bot.channelType || 'SMS',
          channelIntegration: bot.channelIntegration || 'TWILIO',
          channelAddress: bot.channelAddress || '',
          channelEnabled: !!bot.channelType && !!bot.channelIntegration,
          aiIntegration: bot.aiIntegration,
          systemPrompt: bot.systemPrompt,
          initialMessage: bot.initialMessage || '',
          modelOverride: bot.modelOverride || '',
          temperatureOverride: bot.temperatureOverride,
          maxTokensOverride: bot.maxTokensOverride,
          maxMessagesPerConversation: bot.maxMessagesPerConversation,
          maxTokensPerConversation: bot.maxTokensPerConversation,
          conversationTimeoutMinutes: bot.conversationTimeoutMinutes,
          responseDelaySeconds: bot.responseDelaySeconds ?? 0,
          autoResumeMinutes: bot.autoResumeMinutes ?? 60,
          rateLimitPerHour: bot.rateLimitPerHour ?? 10,
          fallbackMessage: bot.fallbackMessage || '',
          escalationPattern: bot.escalationPattern || '[ESCALATE]',
          faqOverrides: (bot.faqOverrides || []).map((f: { patterns: string[]; response: string }) => ({
            patterns: f.patterns.join(', '),
            response: f.response,
          })),
          allowedEvents: bot.allowedEvents || [],
          enabledTools: bot.enabledTools || [],
          active: bot.active,
          followUpEnabled: bot.followUpEnabled ?? false,
          followUpAiGenerated: bot.followUpAiGenerated ?? true,
          followUpSequence: ((bot.followUpSequence || []) as Array<{ delayMinutes: number; message?: string; variants?: string[] }>).map(
            (s: { delayMinutes: number; message?: string; variants?: string[] }) => {
              let unit: 'minutes' | 'hours' | 'days' = 'minutes';
              let delay = s.delayMinutes;
              if (delay >= 1440 && delay % 1440 === 0) { unit = 'days'; delay = delay / 1440; }
              else if (delay >= 60 && delay % 60 === 0) { unit = 'hours'; delay = delay / 60; }
              return { delayMinutes: delay, unit, message: s.message || '', variants: s.variants || [] };
            }
          ),
        });
      }
    } catch (err) {
      console.error('Failed to fetch agent:', err);
      setError('Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, agentId]);

  const fetchFiles = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents/${agentId}/files`);
      if (res.ok) {
        const { data: fileList } = await res.json();
        setFiles(fileList || []);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, [workspaceId, agentId]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !agentId) return;
    setFileError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileList[0]);
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/agents/${agentId}/files`,
        { method: 'POST', body: formData }
      );
      if (!res.ok) {
        const errData = await res.json();
        setFileError(errData.error || 'Upload failed');
        return;
      }
      await fetchFiles();
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!agentId) return;
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/agents/${agentId}/files/${fileId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
    fetchAgent();
    fetchFiles();
  }, [fetchWorkspaceData, fetchAgent, fetchFiles]);

  useEffect(() => {
    if (integrations.length === 0) return;
    const configuredAI = AI_INTEGRATIONS.filter((ai) =>
      integrations.some((i) => i.integration === ai)
    );
    if (configuredAI.length > 0 && !configuredAI.includes(data.aiIntegration)) {
      setData((prev) => ({ ...prev, aiIntegration: configuredAI[0], modelOverride: '' }));
    }
    if (data.aiIntegration) {
      fetchModels(data.aiIntegration);
    }
  }, [integrations, data.aiIntegration, fetchModels]);

  const insertVariable = (variable: string) => {
    const textarea = initialMessageRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = data.initialMessage;
    const tag = `{{${variable}}}`;
    const newText = text.slice(0, start) + tag + text.slice(end);
    setData({ ...data, initialMessage: newText });
    setAutocomplete({ open: false, filter: '', index: 0, triggerStart: 0 });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const completeAutocomplete = (variableKey: string) => {
    const textarea = initialMessageRef.current;
    if (!textarea) return;
    const text = data.initialMessage;
    const before = text.slice(0, autocomplete.triggerStart);
    const after = text.slice(textarea.selectionStart);
    const tag = `{{${variableKey}}}`;
    const newText = before + tag + after;
    setData({ ...data, initialMessage: newText });
    setAutocomplete({ open: false, filter: '', index: 0, triggerStart: 0 });
    const cursorPos = before.length + tag.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const allVariables: { key: string; label: string }[] = [
    ...BASE_VARIABLES,
    ...leadPropertySchema.map((p) => ({
      key: `properties.${p.key}`,
      label: p.label,
    })),
  ];

  const filteredVars = autocomplete.open
    ? allVariables.filter((v) =>
        v.key.toLowerCase().includes(autocomplete.filter.toLowerCase()) ||
        v.label.toLowerCase().includes(autocomplete.filter.toLowerCase())
      )
    : [];

  const handleInitialMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setData({ ...data, initialMessage: value });

    const textBefore = value.slice(0, cursor);
    const triggerMatch = textBefore.match(/\{\{([^{}]*)$/);
    if (triggerMatch) {
      const filterText = triggerMatch[1];
      const triggerStart = cursor - filterText.length - 2;
      setAutocomplete({ open: true, filter: filterText, index: 0, triggerStart });
    } else {
      if (autocomplete.open) {
        setAutocomplete({ open: false, filter: '', index: 0, triggerStart: 0 });
      }
    }
  };

  const handleInitialMessageKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocomplete.open || filteredVars.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocomplete((prev) => ({
        ...prev,
        index: (prev.index + 1) % filteredVars.length,
      }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocomplete((prev) => ({
        ...prev,
        index: (prev.index - 1 + filteredVars.length) % filteredVars.length,
      }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      completeAutocomplete(filteredVars[autocomplete.index].key);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAutocomplete({ open: false, filter: '', index: 0, triggerStart: 0 });
    }
  };

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
        channelType: data.channelEnabled ? data.channelType : null,
        channelIntegration: data.channelEnabled ? data.channelIntegration : null,
        channelAddress: data.channelEnabled ? (data.channelAddress || null) : null,
        channelEnabled: undefined,
        modelOverride: data.modelOverride || null,
        initialMessage: data.initialMessage || null,
        description: data.description || null,
        fallbackMessage: data.fallbackMessage || null,
        escalationPattern: data.escalationPattern || null,
        faqOverrides: data.faqOverrides
          .filter((f) => f.patterns.trim() && f.response.trim())
          .map((f) => ({
            patterns: f.patterns.split(',').map((p) => p.trim()).filter(Boolean),
            response: f.response,
          })),
        followUpSequence: data.followUpSequence.map((s) => {
          const filtered = s.variants.map((v) => v.trim()).filter(Boolean);
          return {
            delayMinutes: s.unit === 'days' ? s.delayMinutes * 1440 : s.unit === 'hours' ? s.delayMinutes * 60 : s.delayMinutes,
            ...(s.message.trim() ? { message: s.message.trim() } : {}),
            ...(filtered.length > 0 ? { variants: filtered } : {}),
          };
        }),
      };

      const url = agentId
        ? `/api/v1/workspaces/${workspaceId}/agents/${agentId}`
        : `/api/v1/workspaces/${workspaceId}/agents`;

      const res = await fetch(url, {
        method: agentId ? 'PATCH' : 'POST',
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

  const hasChannelIntegration = data.channelType === 'WEB_CHAT' || integrations.some(
    (i) => i.integration === data.channelIntegration
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
            {agentId ? 'Edit Agent' : 'New Agent'}
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.channelEnabled}
                onChange={(e) => setData({ ...data, channelEnabled: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-zinc-300">Enable channel for production messaging</span>
            </label>
            {!data.channelEnabled && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400">
                <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                No channel configured — this bot can only be used in the test playground. Add a channel to use in workflows.
              </div>
            )}
            {data.channelEnabled && (
              <>
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
                {data.channelType !== 'WEB_CHAT' && (
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
                )}
                {hasChannelIntegration && (() => {
                  const channelInt = integrations.find((i) => i.integration === data.channelIntegration);
                  const meta = channelInt?.meta as Record<string, unknown> | null;

                  if (data.channelType === 'WEB_CHAT') {
                    return (
                      <Field label="Channel" hint="Web Chat uses the built-in /api/v1/chat endpoint">
                        <p className="text-xs text-zinc-400 bg-zinc-800/50 border border-zinc-700 rounded p-2">
                          No external integration required. Messages are handled via the embedded webchat widget on your landing page.
                        </p>
                      </Field>
                    );
                  }

                  if (data.channelType === 'EMAIL') {
                    const configuredEmail = meta && typeof meta === 'object' && 'fromEmail' in meta
                      ? (meta.fromEmail as string)
                      : '';

                    return (
                      <Field label="Send From" required hint="Email address the agent sends from (must match Resend verified domain)">
                        <input
                          type="email"
                          value={data.channelAddress || configuredEmail}
                          onChange={(e) => setData({ ...data, channelAddress: e.target.value })}
                          placeholder={configuredEmail || 'agent@yourdomain.com'}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                        />
                        {configuredEmail && !data.channelAddress && (
                          <p className="text-xs text-zinc-500 mt-1">
                            Using configured from-address: {configuredEmail}
                          </p>
                        )}
                      </Field>
                    );
                  }

                  const phoneNumbers = meta && typeof meta === 'object' && 'phoneNumbers' in meta
                    ? (meta.phoneNumbers as Record<string, { number: string; label: string }>)
                    : null;

                  if (!phoneNumbers || Object.keys(phoneNumbers).length === 0) {
                    return (
                      <Field label="Send From" hint="Agent's address on this channel">
                        <p className="text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700 rounded p-2">
                          No addresses available. Configure phone numbers in the {data.channelIntegration} integration first.
                        </p>
                      </Field>
                    );
                  }

                  return (
                    <Field label="Send From" required hint="Agent's address on this channel">
                      <select
                        value={data.channelAddress}
                        onChange={(e) => setData({ ...data, channelAddress: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                      >
                        <option value="">Select address...</option>
                        {Object.entries(phoneNumbers).map(([key, entry]) => (
                          <option key={key} value={entry.number}>
                            {entry.label} ({entry.number})
                          </option>
                        ))}
                      </select>
                    </Field>
                  );
                })()}
              </>
            )}
          </div>
        </Section>

        {/* AI Configuration */}
        <Section icon={Sparkles} title="AI Configuration">
          <div className="space-y-3">
            <Field label="AI Provider" required>
              {availableAIIntegrations.length > 0 ? (
                <select
                  value={data.aiIntegration}
                  onChange={(e) => setData({ ...data, aiIntegration: e.target.value, modelOverride: '' })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  {availableAIIntegrations.map((ai) => (
                    <option key={ai} value={ai}>
                      {ai}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <select
                    disabled
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-500 focus:outline-none cursor-not-allowed"
                  >
                    <option>No AI integrations configured</option>
                  </select>
                  <p className="text-xs text-amber-400 mt-1">
                    Add an OpenAI or Anthropic integration in the Integrations tab first.
                  </p>
                </>
              )}
            </Field>
            <Field label="Model" hint={fetchingModels ? 'Loading models...' : 'Select a model or leave as default'}>
              <select
                value={data.modelOverride}
                onChange={(e) => setData({ ...data, modelOverride: e.target.value })}
                disabled={fetchingModels}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none disabled:text-zinc-500"
              >
                <option value="">Integration default</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
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
              placeholder="You are a friendly sales assistant for [Business Name]. Your goal is to answer questions about our services, schedule appointments, and help leads become customers."
              rows={8}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-y font-mono"
            />
            <p className="text-xs text-zinc-600">
              This is the AI&apos;s personality and instructions. It&apos;s sent as the system/developer message on every turn.
            </p>
          </div>
        </Section>

        {/* Reference Files */}
        {agentId && (
          <Section icon={Paperclip} title={`Reference Files (${files.length}/5)`}>
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Upload documents for the bot to reference on every message. Supports PDF, TXT, CSV, DOCX (max 2MB each).
              </p>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{f.filename}</p>
                          <p className="text-[10px] text-zinc-500">
                            {formatFileSize(f.sizeBytes)} &middot; {f.charCount.toLocaleString()} chars extracted
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileDelete(f.id)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {fileError && (
                <p className="text-xs text-red-400">{fileError}</p>
              )}

              {files.length < 5 && (
                <label
                  className={`flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    uploading
                      ? 'border-zinc-700 bg-zinc-800/50 cursor-wait'
                      : 'border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.csv,.docx,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    disabled={uploading}
                    className="hidden"
                  />
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-zinc-500" />
                  )}
                  <span className="text-xs text-zinc-500">
                    {uploading ? 'Extracting text...' : 'Click to upload a reference file'}
                  </span>
                </label>
              )}
            </div>
          </Section>
        )}

        {/* FAQ Overrides */}
        <Section icon={HelpCircle} title={`FAQ Overrides (${data.faqOverrides.length})`}>
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Hardcoded answers that bypass AI entirely. If an inbound message contains any pattern keyword, the bot replies with the static response (no tokens used).
            </p>
            {data.faqOverrides.map((faq, idx) => (
              <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Rule {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...data.faqOverrides];
                      updated.splice(idx, 1);
                      setData({ ...data, faqOverrides: updated });
                    }}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Field label="Patterns" hint="Comma-separated keywords">
                  <input
                    type="text"
                    value={faq.patterns}
                    onChange={(e) => {
                      const updated = [...data.faqOverrides];
                      updated[idx] = { ...updated[idx], patterns: e.target.value };
                      setData({ ...data, faqOverrides: updated });
                    }}
                    placeholder="hours, what time, when are you open"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </Field>
                <Field label="Response">
                  <textarea
                    value={faq.response}
                    onChange={(e) => {
                      const updated = [...data.faqOverrides];
                      updated[idx] = { ...updated[idx], response: e.target.value };
                      setData({ ...data, faqOverrides: updated });
                    }}
                    placeholder="We're open Mon-Fri 5am-9pm, Sat-Sun 7am-5pm."
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
                  />
                </Field>
              </div>
            ))}
            {data.faqOverrides.length < 20 && (
              <button
                type="button"
                onClick={() =>
                  setData({
                    ...data,
                    faqOverrides: [...data.faqOverrides, { patterns: '', response: '' }],
                  })
                }
                className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add FAQ rule
              </button>
            )}
          </div>
        </Section>

        {/* Initial Message */}
        <Section icon={MessageCircle} title="Initial Message">
          <div className="space-y-2">
            <div ref={initialMessageWrapperRef} className="relative">
              <textarea
                ref={initialMessageRef}
                value={data.initialMessage}
                onChange={handleInitialMessageChange}
                onKeyDown={handleInitialMessageKeyDown}
                onBlur={() => setTimeout(() => setAutocomplete((prev) => ({ ...prev, open: false })), 150)}
                placeholder="Hey {{firstName}}! Thanks for your interest in {{workspaceName}}. What questions can I help with?"
                rows={3}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-y font-mono"
              />
              {autocomplete.open && filteredVars.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                  {filteredVars.map((v, i) => (
                    <button
                      key={v.key}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        completeAutocomplete(v.key);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm font-mono flex items-center justify-between transition-colors ${
                        i === autocomplete.index
                          ? 'bg-violet-600/30 text-violet-300'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{`{{${v.key}}}`}</span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        {v.label}
                      </span>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-600 flex gap-3">
                    <span><kbd className="px-1 bg-zinc-800 rounded">↑↓</kbd> navigate</span>
                    <span><kbd className="px-1 bg-zinc-800 rounded">Enter</kbd> select</span>
                    <span><kbd className="px-1 bg-zinc-800 rounded">Esc</kbd> dismiss</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-600">
              Sent automatically when a new conversation starts. Leave blank to skip. Type <code className="text-violet-400">{'{{'}</code> for variables:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allVariables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="text-[10px] px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/40 transition-colors cursor-pointer"
                  title={v.label}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Guardrails */}
        <Section icon={Shield} title="Guardrails">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
              <Field label="Reply Delay" hint="Seconds before responding">
                <input
                  type="number"
                  value={data.responseDelaySeconds}
                  onChange={(e) =>
                    setData({
                      ...data,
                      responseDelaySeconds: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  min={0}
                  max={30}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </Field>
              <Field label="Auto-Resume" hint="Minutes before bot resumes after pause (0 = manual)">
                <input
                  type="number"
                  value={data.autoResumeMinutes}
                  onChange={(e) =>
                    setData({
                      ...data,
                      autoResumeMinutes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  min={0}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </Field>
              <Field label="Rate Limit" hint="Max bot replies per lead per hour (0 = unlimited)">
                <input
                  type="number"
                  value={data.rateLimitPerHour}
                  onChange={(e) =>
                    setData({
                      ...data,
                      rateLimitPerHour: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  min={0}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </Field>
              <Field label="Escalation Keyword" hint="AI says this to trigger escalation">
                <input
                  type="text"
                  value={data.escalationPattern}
                  onChange={(e) =>
                    setData({ ...data, escalationPattern: e.target.value })
                  }
                  placeholder="[ESCALATE]"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
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

        {/* Follow-Up Sequence */}
        <Section icon={Clock} title="Follow-Up Sequence">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.followUpEnabled}
                onChange={(e) => setData({ ...data, followUpEnabled: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-zinc-300">Enable follow-ups for idle conversations</span>
            </label>
            {data.followUpEnabled && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.followUpAiGenerated}
                    onChange={(e) => setData({ ...data, followUpAiGenerated: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-zinc-300">AI-generated messages</span>
                  <span className="text-[10px] text-zinc-600">(off = use templates below)</span>
                </label>
                <p className="text-xs text-zinc-500">
                  {data.followUpAiGenerated
                    ? 'The AI will generate contextual follow-ups based on the conversation history.'
                    : 'Each step uses a fixed template message. Supports {{firstName}} variables.'}
                </p>

                {data.followUpSequence.map((step, idx) => (
                  <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Step {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...data.followUpSequence];
                          updated.splice(idx, 1);
                          setData({ ...data, followUpSequence: updated });
                        }}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <Field label="Delay" hint="After last message">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={step.delayMinutes}
                          onChange={(e) => {
                            const updated = [...data.followUpSequence];
                            updated[idx] = { ...updated[idx], delayMinutes: parseInt(e.target.value, 10) || 1 };
                            setData({ ...data, followUpSequence: updated });
                          }}
                          min={1}
                          className="w-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                        />
                        <select
                          value={step.unit}
                          onChange={(e) => {
                            const updated = [...data.followUpSequence];
                            updated[idx] = { ...updated[idx], unit: e.target.value as 'minutes' | 'hours' | 'days' };
                            setData({ ...data, followUpSequence: updated });
                          }}
                          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                          <option value="minutes">minutes</option>
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                      </div>
                    </Field>
                    {!data.followUpAiGenerated && (
                      <>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`variant-mode-${idx}`}
                              checked={step.variants.length === 0}
                              onChange={() => {
                                const updated = [...data.followUpSequence];
                                updated[idx] = { ...updated[idx], variants: [] };
                                setData({ ...data, followUpSequence: updated });
                              }}
                              className="text-violet-500 focus:ring-violet-500"
                            />
                            <span className="text-xs text-zinc-400">Single message</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`variant-mode-${idx}`}
                              checked={step.variants.length > 0}
                              onChange={() => {
                                const updated = [...data.followUpSequence];
                                updated[idx] = { ...updated[idx], variants: updated[idx].variants.length > 0 ? updated[idx].variants : [''] };
                                setData({ ...data, followUpSequence: updated });
                              }}
                              className="text-violet-500 focus:ring-violet-500"
                            />
                            <span className="text-xs text-zinc-400">Variants</span>
                            {step.variants.length > 0 && (
                              <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">{step.variants.length}</span>
                            )}
                          </label>
                        </div>

                        {step.variants.length === 0 ? (
                          <Field label="Message Template" hint="Supports {{firstName}} variables">
                            <textarea
                              value={step.message}
                              onChange={(e) => {
                                const updated = [...data.followUpSequence];
                                updated[idx] = { ...updated[idx], message: e.target.value };
                                setData({ ...data, followUpSequence: updated });
                              }}
                              placeholder="Hey {{firstName}}, just checking in! Still interested in getting started?"
                              rows={2}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none font-mono"
                            />
                          </Field>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Message Variants <span className="normal-case">(rotated per lead, no repeats)</span></p>
                            {step.variants.map((v, vIdx) => (
                              <div key={vIdx} className="flex gap-2 items-start">
                                <textarea
                                  value={v}
                                  onChange={(e) => {
                                    const updated = [...data.followUpSequence];
                                    const newVariants = [...updated[idx].variants];
                                    newVariants[vIdx] = e.target.value;
                                    updated[idx] = { ...updated[idx], variants: newVariants };
                                    setData({ ...data, followUpSequence: updated });
                                  }}
                                  placeholder={`Variant ${vIdx + 1} — e.g., "Hey {{firstName}}, wanted to follow up..."`}
                                  rows={2}
                                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-none font-mono"
                                />
                                {step.variants.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...data.followUpSequence];
                                      const newVariants = [...updated[idx].variants];
                                      newVariants.splice(vIdx, 1);
                                      updated[idx] = { ...updated[idx], variants: newVariants };
                                      setData({ ...data, followUpSequence: updated });
                                    }}
                                    className="mt-2 text-zinc-500 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {step.variants.length < 5 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...data.followUpSequence];
                                  updated[idx] = { ...updated[idx], variants: [...updated[idx].variants, ''] };
                                  setData({ ...data, followUpSequence: updated });
                                }}
                                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add variant
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {data.followUpSequence.length < 10 && (
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        followUpSequence: [
                          ...data.followUpSequence,
                          { delayMinutes: data.followUpSequence.length === 0 ? 1 : 24, unit: data.followUpSequence.length === 0 ? 'hours' : 'hours', message: '', variants: [] },
                        ],
                      })
                    }
                    className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add step
                  </button>
                )}
                {data.followUpSequence.length === 0 && (
                  <p className="text-xs text-amber-400">
                    Add at least one step for follow-ups to work.
                  </p>
                )}
              </>
            )}
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

        {/* Enabled Tools */}
        <Section icon={Wrench} title="Tools (Function Calling)">
          <p className="text-xs text-zinc-500 mb-3">
            Enable tools this agent can use during conversations. The AI will call these functions when relevant.
          </p>
          <div className="space-y-2">
            {[
              { value: 'check_availability', label: 'Check Availability', desc: 'Query open appointment slots' },
              { value: 'book_appointment', label: 'Book Appointment', desc: 'Create bookings for contacts' },
              { value: 'lookup_customer', label: 'Lookup Customer', desc: 'Find customer/member records' },
            ].map((tool) => (
              <label key={tool.value} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={data.enabledTools.includes(tool.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setData({ ...data, enabledTools: [...data.enabledTools, tool.value] });
                    } else {
                      setData({
                        ...data,
                        enabledTools: data.enabledTools.filter((v) => v !== tool.value),
                      });
                    }
                  }}
                  className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                />
                <span>
                  <span className="text-zinc-300">{tool.label}</span>
                  <span className="block text-xs text-zinc-600">{tool.desc}</span>
                </span>
              </label>
            ))}
          </div>
          {data.enabledTools.length === 0 && (
            <p className="text-xs text-zinc-600 mt-2">No tools enabled — agent will be text-only.</p>
          )}
        </Section>

        {/* Summary */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <SummaryRow label="Channel" value={data.channelEnabled ? `${data.channelType} via ${data.channelIntegration}` : 'Not configured (test only)'} />
            {data.channelEnabled && data.channelAddress && (
              <SummaryRow label="Send From" value={data.channelAddress} />
            )}
            <SummaryRow label="AI Provider" value={data.aiIntegration} />
            <SummaryRow label="Model" value={data.modelOverride || '(integration default)'} />
            <SummaryRow label="Ref Files" value={`${files.length} file${files.length !== 1 ? 's' : ''}`} />
            <SummaryRow label="FAQ Rules" value={`${data.faqOverrides.filter((f) => f.patterns.trim() && f.response.trim()).length}`} />
            <SummaryRow label="Tools" value={data.enabledTools.length > 0 ? `${data.enabledTools.length} enabled` : 'None'} />
            <SummaryRow label="Rate Limit" value={data.rateLimitPerHour > 0 ? `${data.rateLimitPerHour}/hr` : 'Unlimited'} />
            <SummaryRow label="Max Messages" value={String(data.maxMessagesPerConversation)} />
            <SummaryRow label="Timeout" value={`${data.conversationTimeoutMinutes}min`} />
            <SummaryRow
              label="Follow-Ups"
              value={
                data.followUpEnabled && data.followUpSequence.length > 0
                  ? `${data.followUpSequence.length} step${data.followUpSequence.length !== 1 ? 's' : ''} (${data.followUpAiGenerated ? 'AI' : 'template'})`
                  : 'Disabled'
              }
            />
            <SummaryRow label="Status" value={data.active ? 'Active' : 'Inactive'} />
          </div>
          <ContextBudget
            systemPromptChars={data.systemPrompt.length}
            initialMessageChars={data.initialMessage.length}
            fileChars={files.reduce((sum, f) => sum + f.charCount, 0)}
          />
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CONTEXT_WINDOW = 128_000;

function ContextBudget({
  systemPromptChars,
  initialMessageChars,
  fileChars,
}: {
  systemPromptChars: number;
  initialMessageChars: number;
  fileChars: number;
}) {
  const totalChars = systemPromptChars + initialMessageChars + fileChars;
  const estimatedTokens = Math.ceil(totalChars / 4);
  const pct = Math.min((estimatedTokens / CONTEXT_WINDOW) * 100, 100);

  const color =
    pct > 75 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-violet-500';

  if (totalChars === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800">
      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
        <span>Context budget (prompt + files)</span>
        <span>~{estimatedTokens.toLocaleString()} / {(CONTEXT_WINDOW).toLocaleString()} tokens</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct > 75 && (
        <p className="text-[10px] text-amber-400 mt-1">
          High context usage — consider trimming reference files to leave room for conversation history.
        </p>
      )}
    </div>
  );
}
