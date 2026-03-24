'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  Send,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  Zap,
  Clock,
  MessageSquare,
  DollarSign,
  Activity,
  History,
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  Wrench,
  ChevronRight,
  ScrollText,
  X,
  Brain,
  BookOpen,
  AlertTriangle,
  Shield,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  aiIntegration: string;
  channelIntegration: string;
  modelOverride: string | null;
  maxMessagesPerConversation: number;
  maxTokensPerConversation: number;
  active: boolean;
}

interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
  isEstimated: boolean;
}

type TurnLogEntry =
  | { type: 'ai_call'; ts: number; model: string; promptTokens: number; completionTokens: number; finishReason: string; durationMs: number; iteration: number }
  | { type: 'tool_call'; ts: number; tool: string; args: Record<string, unknown>; result: { success: boolean; data?: unknown; error?: string }; durationMs: number; iteration: number }
  | { type: 'faq_match'; ts: number; pattern: string; response: string }
  | { type: 'escalation'; ts: number; pattern: string }
  | { type: 'guardrail'; ts: number; guardrail: string; detail: string }
  | { type: 'event'; ts: number; event: string }
  | { type: 'error'; ts: number; source: string; message: string };

interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  responseDelaySkipped?: number;
  costEstimate?: CostEstimate;
  eventsEmitted?: string[];
  toolsUsed?: string[];
  turnLog?: TurnLogEntry[];
  error?: string;
  timestamp: Date;
}

interface ConversationSummary {
  id: string;
  status: string;
  messageCount: number;
  totalTokens: number;
  startedAt: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    promptTokens: number;
    completionTokens: number;
    turnLog?: unknown;
    createdAt: string;
  }>;
}

interface TestChatResponse {
  success: boolean;
  replyText: string | null;
  conversationId: string;
  isNewConversation: boolean;
  status: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  eventsEmitted: string[];
  latencyMs?: number;
  responseDelaySkipped?: number;
  toolsUsed?: string[];
  turnLog?: TurnLogEntry[];
  costEstimate: CostEstimate;
  model: string;
}

interface RegistryTestField {
  name: string;
  label: string;
  type: 'email' | 'text' | 'number' | 'select' | 'datetime';
  required: boolean;
  default?: string | number;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

interface RegistryOption {
  key: string;
  label: string;
  description?: string;
  testFields: RegistryTestField[];
}

interface TriggerResult {
  trigger: string;
  workflowsFound: number;
  workflowsExecuted: number;
  allSucceeded: boolean;
  duration: number;
  executions: Array<{
    workflowName: string;
    status: string;
    results: Array<{
      action: string;
      success: boolean;
      data?: { dryRun?: boolean; summary?: string; [key: string]: unknown };
      error?: string;
    }>;
  }>;
}

interface ActionResult {
  action: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration: number;
}

interface WorkflowPreview {
  id: string;
  name: string;
  triggerAdapter: string;
  triggerOperation: string;
  enabled: boolean;
  actions: Array<{ adapter: string; operation: string; params: Record<string, unknown> }>;
}

const DRY_RUN_ADAPTERS = new Set(['resend', 'twilio', 'mailerlite', 'abc_ignite']);

// ---------------------------------------------------------------------------
// Quick-send presets
// ---------------------------------------------------------------------------

const QUICK_MESSAGES = [
  { label: 'Escalate', message: 'I want to talk to a real person', icon: '🙋' },
  { label: 'Book Appt', message: "I'd like to book an appointment", icon: '📅' },
  { label: 'Gibberish', message: 'asdf jkl qwerty zxcv', icon: '🔀' },
  { label: 'Goodbye', message: 'Thanks, that\'s all I needed. Bye!', icon: '👋' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TestingChatPanelProps {
  workspaceId: string;
}

export function TestingChatPanel({ workspaceId }: TestingChatPanelProps) {
  // Agent selection
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loadingBots, setLoadingBots] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<string>('ACTIVE');
  const [totalMessages, setTotalMessages] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // Prompt editor
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptOverride, setPromptOverride] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testConversations, setTestConversations] = useState<ConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Workflow tester
  const [testerOpen, setTesterOpen] = useState(false);
  const [testerMode, setTesterMode] = useState<'triggers' | 'actions'>('triggers');
  const [registryTriggers, setRegistryTriggers] = useState<RegistryOption[]>([]);
  const [registryActions, setRegistryActions] = useState<RegistryOption[]>([]);
  const [selectedTesterKey, setSelectedTesterKey] = useState('');
  const [testerFieldValues, setTesterFieldValues] = useState<Record<string, string | number>>({});
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerResult, setTesterResult] = useState<TriggerResult | ActionResult | null>(null);
  const [testerError, setTesterError] = useState<string | null>(null);

  // Action preview
  const [workflowPreviews, setWorkflowPreviews] = useState<WorkflowPreview[]>([]);

  // Turn log side panel
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [expandedLogEntries, setExpandedLogEntries] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = agents.find((b) => b.id === selectedAgentId);

  const allTurnLogs = messages.flatMap((msg, msgIdx) =>
    (msg.turnLog || []).map((entry, entryIdx) => ({ ...entry, msgIdx, entryIdx }))
  );

  // Auto-scroll log panel when new entries arrive
  useEffect(() => {
    if (logPanelOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allTurnLogs.length, logPanelOpen]);

  // -------------------------------------------------------------------------
  // Fetch agents
  // -------------------------------------------------------------------------

  const fetchAgents = useCallback(async () => {
    setLoadingBots(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents`);
      const json = await res.json();
      if (res.ok && json.data) {
        const activeBots = (json.data as Agent[]).filter((b) => b.active);
        setAgents(activeBots);
        if (activeBots.length > 0 && !selectedAgentId) {
          setSelectedAgentId(activeBots[0].id);
        }
      }
    } catch {
      // silently fail — empty bot list will show empty state
    } finally {
      setLoadingBots(false);
    }
  }, [workspaceId, selectedAgentId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // -------------------------------------------------------------------------
  // Fetch workflow registry (triggers + actions)
  // -------------------------------------------------------------------------

  useEffect(() => {
    async function loadRegistry() {
      try {
        const res = await fetch(`/api/v1/workflow-registry?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;

        const triggers: RegistryOption[] = (data?.triggers || []).flatMap(
          (adapter: { adapterId: string; adapterName: string; triggers: Array<{ name: string; label: string; description?: string; testFields?: RegistryTestField[] }> }) =>
            adapter.triggers.map((t) => ({
              key: `${adapter.adapterId}.${t.name}`,
              label: `${adapter.adapterName}: ${t.label}`,
              description: t.description,
              testFields: t.testFields || [],
            }))
        );
        setRegistryTriggers(triggers);

        const actions: RegistryOption[] = (data?.actions || []).flatMap(
          (adapter: { adapterId: string; adapterName: string; actions: Array<{ name: string; label: string; description?: string; testFields?: RegistryTestField[] }> }) =>
            adapter.actions
              .filter((a) => a.testFields && a.testFields.length > 0)
              .map((a) => ({
                key: `${adapter.adapterId}.${a.name}`,
                label: `${adapter.adapterName}: ${a.label}`,
                description: a.description,
                testFields: a.testFields || [],
              }))
        );
        setRegistryActions(actions);
      } catch {
        // silently fail
      }
    }
    loadRegistry();
  }, [workspaceId]);

  // Fetch workspace workflows for action preview
  useEffect(() => {
    async function loadWorkflows() {
      try {
        const res = await fetch(`/api/v1/workflows?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) return;
        const json = await res.json();
        const workflows = json.data?.workflows || [];
        setWorkflowPreviews(
          workflows.map((w: WorkflowPreview) => ({
            id: w.id,
            name: w.name,
            triggerAdapter: w.triggerAdapter,
            triggerOperation: w.triggerOperation,
            enabled: w.enabled,
            actions: w.actions || [],
          }))
        );
      } catch {
        // silently fail
      }
    }
    loadWorkflows();
  }, [workspaceId]);

  // Compute matched workflows for selected trigger
  const matchedWorkflows = (() => {
    if (testerMode !== 'triggers' || !selectedTesterKey) return [];
    const [adapter, operation] = selectedTesterKey.split('.');
    return workflowPreviews.filter(
      (w) => w.enabled && w.triggerAdapter === adapter && w.triggerOperation === operation
    );
  })();

  // When tester selection changes, reset field values to defaults
  useEffect(() => {
    const options = testerMode === 'triggers' ? registryTriggers : registryActions;
    const selected = options.find((o) => o.key === selectedTesterKey);
    if (selected) {
      const defaults: Record<string, string | number> = {};
      selected.testFields.forEach((f) => {
        if (f.default !== undefined) defaults[f.name] = f.default;
        else defaults[f.name] = '';
      });
      setTesterFieldValues(defaults);
    }
    setTesterResult(null);
    setTesterError(null);
  }, [selectedTesterKey, testerMode, registryTriggers, registryActions]);

  // Auto-select first option when registry loads or mode changes
  useEffect(() => {
    const options = testerMode === 'triggers' ? registryTriggers : registryActions;
    if (options.length > 0 && !options.find((o) => o.key === selectedTesterKey)) {
      setSelectedTesterKey(options[0].key);
    }
  }, [testerMode, registryTriggers, registryActions, selectedTesterKey]);

  // When agent changes, load its prompt and reset conversation
  useEffect(() => {
    if (selectedAgent) {
      setOriginalPrompt(selectedAgent.systemPrompt);
      setPromptOverride(selectedAgent.systemPrompt);
    }
    resetConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------------------------------------------------------------
  // Conversation management
  // -------------------------------------------------------------------------

  function resetConversation() {
    setMessages([]);
    setConversationId(null);
    setConversationStatus('ACTIVE');
    setTotalMessages(0);
    setTotalTokens(0);
    setTotalCost(0);
  }

  async function clearAllTestConversations() {
    if (!selectedAgentId) return;
    try {
      await fetch(
        `/api/v1/workspaces/${workspaceId}/agents/${selectedAgentId}/test-chat`,
        { method: 'DELETE' }
      );
      setTestConversations([]);
      resetConversation();
    } catch {
      // ignore
    }
  }

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  async function sendMessage(text: string) {
    if (!text.trim() || !selectedAgentId || sending) return;

    const userMsg: ChatMessageData = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);

    try {
      const isOverridden = promptOverride !== originalPrompt;

      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/agents/${selectedAgentId}/test-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: text.trim(),
            ...(isOverridden ? { systemPromptOverride: promptOverride } : {}),
            ...(conversationId ? { conversationId } : {}),
          }),
        }
      );

      const json = await res.json();
      const data = json.data as TestChatResponse;

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      setConversationStatus(data.status);
      setTotalMessages((prev) => prev + 2);
      setTotalTokens((prev) => prev + (data.usage?.totalTokens || 0));
      setTotalCost((prev) => prev + (data.costEstimate?.totalCost || 0));

      const botMsg: ChatMessageData = {
        role: 'assistant',
        content: data.replyText || (data.error ? `[Error: ${data.error}]` : '[No response]'),
        promptTokens: data.usage?.promptTokens,
        completionTokens: data.usage?.completionTokens,
        latencyMs: data.latencyMs,
        responseDelaySkipped: data.responseDelaySkipped,
        costEstimate: data.costEstimate,
        eventsEmitted: data.eventsEmitted,
        toolsUsed: data.toolsUsed,
        turnLog: data.turnLog,
        error: data.error,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: ChatMessageData = {
        role: 'assistant',
        content: `[Request failed: ${err instanceof Error ? err.message : 'Unknown error'}]`,
        error: 'Request failed',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  // -------------------------------------------------------------------------
  // Workflow tester execution
  // -------------------------------------------------------------------------

  async function fireTester() {
    if (testerLoading) return;
    setTesterLoading(true);
    setTesterResult(null);
    setTesterError(null);

    try {
      if (testerMode === 'triggers') {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/test-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: selectedTesterKey,
            ...testerFieldValues,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setTesterError(json.error || json.message || 'Trigger execution failed');
        } else {
          setTesterResult((json.data || json) as TriggerResult);
        }
      } else {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/test-action-direct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: selectedTesterKey,
            ...testerFieldValues,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setTesterError(json.error || json.message || 'Action execution failed');
        } else {
          setTesterResult(json.data as ActionResult);
        }
      }
    } catch (err) {
      setTesterError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setTesterLoading(false);
      if (selectedAgentId) {
        fetchHistory();
        setHistoryOpen(true);
      }
    }
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  async function fetchHistory() {
    if (!selectedAgentId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/agents/${selectedAgentId}/test-chat?limit=20`
      );
      const json = await res.json();
      if (res.ok) {
        setTestConversations(json.data?.conversations || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }

  function loadConversation(conv: ConversationSummary) {
    setConversationId(conv.id);
    setConversationStatus(conv.status);
    setTotalMessages(conv.messageCount);
    setTotalTokens(conv.totalTokens);

    const loaded: ChatMessageData[] = conv.messages.map((m) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
      promptTokens: m.promptTokens || undefined,
      completionTokens: m.completionTokens || undefined,
      turnLog: Array.isArray(m.turnLog) ? m.turnLog as TurnLogEntry[] : undefined,
      timestamp: new Date(m.createdAt),
    }));

    setMessages(loaded);
    setHistoryOpen(false);
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function formatCost(cost: number): string {
    if (cost < 0.0001) return '<$0.0001';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(4)}`;
  }

  const maxMsgs = selectedAgent?.maxMessagesPerConversation || 50;
  const maxTkns = selectedAgent?.maxTokensPerConversation || 100000;
  const msgPercent = Math.min((totalMessages / maxMsgs) * 100, 100);
  const tknPercent = Math.min((totalTokens / maxTkns) * 100, 100);

  // -------------------------------------------------------------------------
  // Loading / empty states
  // -------------------------------------------------------------------------

  if (loadingBots) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
        <Bot className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-400 text-sm">No active agents configured.</p>
        <p className="text-zinc-500 text-xs mt-1">Create an agent in the Agents tab to start testing.</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Top bar: Agent selector + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-violet-500"
          >
            {agents.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.aiIntegration})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={resetConversation}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="New conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Chat
        </button>
        <button
          type="button"
          onClick={() => {
            setHistoryOpen(!historyOpen);
            if (!historyOpen) fetchHistory();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            historyOpen
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          title="View test history"
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>
        <button
          type="button"
          onClick={() => setLogPanelOpen(!logPanelOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            logPanelOpen
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          title="Toggle tool execution logs"
        >
          <ScrollText className="w-3.5 h-3.5" />
          Logs
          {allTurnLogs.length > 0 && (
            <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full leading-none">
              {allTurnLogs.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={clearAllTestConversations}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-red-400 hover:bg-red-500/10 transition-colors"
          title="Clear all test conversations"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All
        </button>
      </div>

      {/* History panel */}
      {historyOpen && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-zinc-400 mb-2">Test Conversations</p>
          {loadingHistory ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mx-auto" />
          ) : testConversations.length === 0 ? (
            <p className="text-xs text-zinc-500">No test conversations yet.</p>
          ) : (
            <div className="space-y-1">
              {testConversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => loadConversation(conv)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    conv.id === conversationId
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="font-mono">{conv.id.slice(0, 8)}...</span>
                  <span className="ml-2">{conv.messageCount} msgs</span>
                  <span className="ml-2">{conv.totalTokens.toLocaleString()} tkns</span>
                  <span className={`ml-2 ${
                    conv.status === 'ACTIVE' ? 'text-emerald-400' :
                    conv.status === 'COMPLETED' ? 'text-zinc-500' :
                    conv.status === 'ESCALATED' ? 'text-amber-400' :
                    'text-zinc-500'
                  }`}>
                    {conv.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt editor (collapsible) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setPromptOpen(!promptOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            System Prompt
            {promptOverride !== originalPrompt && (
              <span className="text-amber-400 text-[10px] font-semibold ml-1">MODIFIED</span>
            )}
          </span>
          {promptOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {promptOpen && (
          <div className="border-t border-zinc-800 p-3 space-y-2">
            <textarea
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
              rows={6}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono resize-y focus:outline-none focus:border-violet-500"
              placeholder="System prompt..."
            />
            {promptOverride !== originalPrompt && (
              <button
                type="button"
                onClick={() => setPromptOverride(originalPrompt)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Reset to original
              </button>
            )}
          </div>
        )}
      </div>

      {/* Guardrail bar */}
      {conversationId && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-3">
              <span className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${
                conversationStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                conversationStatus === 'COMPLETED' ? 'bg-zinc-700 text-zinc-400' :
                conversationStatus === 'ESCALATED' ? 'bg-amber-500/20 text-amber-400' :
                conversationStatus === 'TIMED_OUT' ? 'bg-red-500/20 text-red-400' :
                'bg-zinc-700 text-zinc-400'
              }`}>
                {conversationStatus}
              </span>
              <span className="text-zinc-500 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {formatCost(totalCost)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Messages</span>
                <span>{totalMessages}/{maxMsgs}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    msgPercent > 90 ? 'bg-red-500' : msgPercent > 70 ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
                  style={{ width: `${msgPercent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Tokens</span>
                <span>{totalTokens.toLocaleString()}/{maxTkns.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    tknPercent > 90 ? 'bg-red-500' : tknPercent > 70 ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
                  style={{ width: `${tknPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat messages + Log panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex">
          {/* Chat column */}
          <div className={`${logPanelOpen ? 'flex-1 min-w-0' : 'w-full'} flex flex-col`}>
            <div className="h-[400px] overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <Bot className="w-10 h-10 mb-2" />
                  <p className="text-sm">Send a message to start testing</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-violet-500/20 text-violet-100 border border-violet-500/30'
                          : msg.error
                            ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Metadata for bot responses */}
                    {msg.role === 'assistant' && (msg.promptTokens || msg.latencyMs || msg.eventsEmitted?.length || msg.toolsUsed?.length) && (
                      <div className="flex flex-wrap gap-2 mt-1 px-1">
                        {msg.promptTokens !== undefined && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            tokens: {msg.promptTokens}/{msg.completionTokens}
                          </span>
                        )}
                        {msg.costEstimate && msg.costEstimate.isEstimated && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <DollarSign className="w-2.5 h-2.5" />
                            {formatCost(msg.costEstimate.totalCost)}
                          </span>
                        )}
                        {msg.latencyMs !== undefined && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {msg.latencyMs}ms
                          </span>
                        )}
                        {msg.responseDelaySkipped !== undefined && msg.responseDelaySkipped > 0 && (
                          <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            delay: {msg.responseDelaySkipped}s (skipped)
                          </span>
                        )}
                        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                          <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
                            <Wrench className="w-2.5 h-2.5" />
                            {msg.toolsUsed.join(', ')}
                          </span>
                        )}
                        {msg.eventsEmitted && msg.eventsEmitted.length > 0 && (
                          <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" />
                            {msg.eventsEmitted.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Turn log side panel */}
          {logPanelOpen && (
            <div className="w-[280px] flex-shrink-0 border-l border-zinc-800 flex flex-col h-[400px]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ScrollText className="w-3 h-3" />
                  Turn Log
                </span>
                <button
                  type="button"
                  onClick={() => setLogPanelOpen(false)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {allTurnLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                    <ScrollText className="w-6 h-6 mb-1.5" />
                    <p className="text-[10px]">No activity yet</p>
                    <p className="text-[10px] text-zinc-700 mt-0.5">Send a message to see the log</p>
                  </div>
                ) : (
                  (() => {
                    const grouped = new Map<number, typeof allTurnLogs>();
                    for (const entry of allTurnLogs) {
                      const turnNum = Math.floor(entry.msgIdx / 2) + 1;
                      if (!grouped.has(turnNum)) grouped.set(turnNum, []);
                      grouped.get(turnNum)!.push(entry);
                    }
                    return Array.from(grouped.entries()).map(([turnNum, entries]) => {
                      const turnKey = `turn-${turnNum}`;
                      const isTurnExpanded = expandedLogEntries.has(turnKey);
                      const turnDuration = entries.reduce((sum, e) => sum + ('durationMs' in e ? (e as { durationMs: number }).durationMs : 0), 0);
                      return (
                        <div key={turnKey}>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedLogEntries((prev) => {
                                const next = new Set(prev);
                                if (next.has(turnKey)) next.delete(turnKey);
                                else next.add(turnKey);
                                return next;
                              });
                            }}
                            className="w-full flex items-center gap-1.5 text-left px-1 py-1"
                          >
                            <ChevronRight className={`w-2.5 h-2.5 text-zinc-500 transition-transform flex-shrink-0 ${isTurnExpanded ? 'rotate-90' : ''}`} />
                            <span className="text-[10px] font-semibold text-zinc-400">Turn {turnNum}</span>
                            <span className="text-[9px] text-zinc-600">{entries.length} action{entries.length !== 1 ? 's' : ''}</span>
                            {turnDuration > 0 && <span className="text-[9px] text-zinc-600 ml-auto">{turnDuration}ms</span>}
                          </button>
                          {isTurnExpanded && (
                            <div className="space-y-1 ml-2">
                              {entries.map((entry) => {
                                const entryKey = `${entry.msgIdx}-${entry.entryIdx}`;
                                const isExpanded = expandedLogEntries.has(entryKey);
                                return (
                                  <div key={entryKey} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1">
                                    {entry.type === 'ai_call' && (
                                      <>
                                        <div className="flex items-center gap-1.5">
                                          <Brain className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
                                          <span className="text-[10px] font-medium text-zinc-300 truncate">{entry.model}</span>
                                          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 flex-shrink-0">{entry.finishReason}</span>
                                          <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">{entry.durationMs}ms</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 pl-4">
                                          <span className="text-[9px] text-zinc-600">{entry.promptTokens} in / {entry.completionTokens} out</span>
                                          {entry.iteration > 0 && <span className="text-[9px] text-zinc-700">iter {entry.iteration}</span>}
                                        </div>
                                      </>
                                    )}

                                    {entry.type === 'tool_call' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setExpandedLogEntries((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(entryKey)) next.delete(entryKey);
                                              else next.add(entryKey);
                                              return next;
                                            });
                                          }}
                                          className="w-full flex items-center gap-1.5 text-left"
                                        >
                                          <ChevronRight className={`w-2.5 h-2.5 text-zinc-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                          <Wrench className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                                          <span className="text-[10px] font-medium text-zinc-300 truncate">{entry.tool}</span>
                                          <span className={`text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0 ${
                                            entry.result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                          }`}>
                                            {entry.result.success ? 'OK' : 'FAIL'}
                                          </span>
                                          <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">{entry.durationMs}ms</span>
                                        </button>
                                        {isExpanded && (
                                          <div className="mt-1.5 space-y-1.5 pl-5">
                                            <div>
                                              <span className="text-[10px] text-zinc-500 block mb-0.5">Args</span>
                                              <pre className="text-[10px] text-zinc-400 bg-zinc-900 rounded px-2 py-1 overflow-x-auto max-h-28 overflow-y-auto font-mono whitespace-pre-wrap break-all">
{JSON.stringify(entry.args, null, 2)}
                                              </pre>
                                            </div>
                                            <div>
                                              <span className="text-[10px] text-zinc-500 block mb-0.5">Result</span>
                                              <pre className={`text-[10px] rounded px-2 py-1 overflow-x-auto max-h-28 overflow-y-auto font-mono whitespace-pre-wrap break-all ${
                                                entry.result.success ? 'text-emerald-400/80 bg-emerald-500/5' : 'text-red-400/80 bg-red-500/5'
                                              }`}>
{entry.result.success ? JSON.stringify(entry.result.data, null, 2) : entry.result.error || 'Unknown error'}
                                              </pre>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {entry.type === 'faq_match' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setExpandedLogEntries((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(entryKey)) next.delete(entryKey);
                                              else next.add(entryKey);
                                              return next;
                                            });
                                          }}
                                          className="w-full flex items-center gap-1.5 text-left"
                                        >
                                          <ChevronRight className={`w-2.5 h-2.5 text-zinc-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                          <BookOpen className="w-2.5 h-2.5 text-cyan-400 flex-shrink-0" />
                                          <span className="text-[10px] font-medium text-cyan-400">FAQ Match</span>
                                        </button>
                                        {isExpanded && (
                                          <div className="mt-1 pl-5 space-y-1">
                                            <p className="text-[9px] text-zinc-500">Pattern: <span className="text-zinc-400">{entry.pattern}</span></p>
                                            <p className="text-[9px] text-zinc-500">Response: <span className="text-zinc-400">{entry.response.slice(0, 100)}{entry.response.length > 100 ? '...' : ''}</span></p>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {entry.type === 'escalation' && (
                                      <div className="flex items-center gap-1.5">
                                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                                        <span className="text-[10px] font-medium text-amber-400">Escalated</span>
                                        <span className="text-[9px] text-zinc-600 truncate">{entry.pattern}</span>
                                      </div>
                                    )}

                                    {entry.type === 'guardrail' && (
                                      <div className="flex items-center gap-1.5">
                                        <Shield className="w-2.5 h-2.5 text-orange-400 flex-shrink-0" />
                                        <span className="text-[10px] font-medium text-orange-400">{entry.guardrail.replace(/_/g, ' ')}</span>
                                        <span className="text-[9px] text-zinc-600 truncate ml-auto">{entry.detail}</span>
                                      </div>
                                    )}

                                    {entry.type === 'event' && (
                                      <div className="flex items-center gap-1.5">
                                        <Zap className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                                        <span className="text-[10px] text-zinc-400">{entry.event}</span>
                                      </div>
                                    )}

                                    {entry.type === 'error' && (
                                      <div className="flex items-center gap-1.5">
                                        <XCircle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                                        <span className="text-[10px] font-medium text-red-400">{entry.source}</span>
                                        <span className="text-[9px] text-red-400/70 truncate">{entry.message}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Quick-send buttons */}
        <div className="border-t border-zinc-800 px-3 py-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-zinc-500 mr-1">Quick:</span>
          {QUICK_MESSAGES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => sendMessage(q.message)}
              disabled={sending || conversationStatus !== 'ACTIVE'}
              className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {q.icon} {q.label}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="border-t border-zinc-800 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputText);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                conversationStatus !== 'ACTIVE'
                  ? `Conversation ${conversationStatus.toLowerCase()} — start a new chat`
                  : 'Type a message...'
              }
              disabled={sending || conversationStatus !== 'ACTIVE'}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending || conversationStatus !== 'ACTIVE'}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Workflow Tester (collapsible) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setTesterOpen(!testerOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Workflow Tester
          </span>
          {testerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {testerOpen && (
          <div className="border-t border-zinc-800 p-3 space-y-3">
            {/* Mode toggle */}
            <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setTesterMode('triggers')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  testerMode === 'triggers'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                Triggers
              </button>
              <button
                type="button"
                onClick={() => setTesterMode('actions')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  testerMode === 'actions'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Play className="w-3 h-3" />
                Actions
              </button>
            </div>

            {/* Dropdown */}
            {(() => {
              const options = testerMode === 'triggers' ? registryTriggers : registryActions;
              if (options.length === 0) {
                return (
                  <p className="text-[10px] text-zinc-500">
                    {testerMode === 'triggers'
                      ? 'No triggers registered. Configure workflows to see available triggers.'
                      : 'No testable actions registered.'}
                  </p>
                );
              }

              const selected = options.find((o) => o.key === selectedTesterKey);
              const fields = selected?.testFields || [];

              return (
                <>
                  <select
                    value={selectedTesterKey}
                    onChange={(e) => setSelectedTesterKey(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {options.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {selected?.description && (
                    <p className="text-[10px] text-zinc-500">{selected.description}</p>
                  )}

                  {/* Dynamic test fields */}
                  {fields.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-zinc-400">Test Fields</span>
                        <button
                          type="button"
                          onClick={() => {
                            const defaults: Record<string, string | number> = {};
                            fields.forEach((f) => {
                              if (f.default !== undefined) defaults[f.name] = f.default;
                              else defaults[f.name] = '';
                            });
                            setTesterFieldValues(defaults);
                          }}
                          className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          Fill Defaults
                        </button>
                      </div>
                      {fields.map((field) => (
                        <div key={field.name}>
                          <label className="block text-[10px] text-zinc-500 mb-0.5">
                            {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                          </label>
                          {field.type === 'select' && field.options ? (
                            <select
                              value={testerFieldValues[field.name] ?? field.default ?? ''}
                              onChange={(e) => setTesterFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                            >
                              {field.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                              value={testerFieldValues[field.name] ?? field.default ?? ''}
                              onChange={(e) => setTesterFieldValues((prev) => ({
                                ...prev,
                                [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                              }))}
                              placeholder={field.placeholder || (field.default ? String(field.default) : '')}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action preview for triggers */}
                  {testerMode === 'triggers' && matchedWorkflows.length > 0 && (
                    <div className="bg-zinc-950 border border-zinc-700/50 rounded-lg p-2.5 space-y-1.5">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3 h-3" />
                        Actions Preview
                      </p>
                      {matchedWorkflows.map((wf) => (
                        <div key={wf.id}>
                          <p className="text-[10px] font-medium text-zinc-300">{wf.name}</p>
                          {wf.actions.map((a, i) => {
                            const isDryRun = DRY_RUN_ADAPTERS.has(a.adapter);
                            return (
                              <div key={i} className="flex items-center gap-1.5 ml-2 mt-0.5">
                                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${isDryRun ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                <span className="text-[10px] text-zinc-400">{a.adapter}.{a.operation}</span>
                                {isDryRun && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-500">dry-run</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      {matchedWorkflows.some((wf) => wf.actions.some((a) => DRY_RUN_ADAPTERS.has(a.adapter))) && (
                        <p className="text-[9px] text-zinc-600 mt-1">External API calls are simulated in test mode.</p>
                      )}
                    </div>
                  )}

                  {testerMode === 'triggers' && matchedWorkflows.length === 0 && selectedTesterKey && (
                    <p className="text-[10px] text-zinc-600">No enabled workflows match this trigger.</p>
                  )}

                  {/* Execute button */}
                  <button
                    type="button"
                    onClick={fireTester}
                    disabled={testerLoading}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      testerMode === 'triggers'
                        ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30'
                        : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                    }`}
                  >
                    {testerMode === 'triggers' ? <Zap className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {testerLoading
                      ? 'Executing...'
                      : testerMode === 'triggers'
                        ? 'Fire Trigger'
                        : 'Execute Action'}
                  </button>

                  {/* Results */}
                  {testerError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-400 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        {testerError}
                      </p>
                    </div>
                  )}

                  {testerResult && testerMode === 'triggers' && 'workflowsFound' in testerResult && (
                    <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">
                          {testerResult.workflowsFound} workflow{testerResult.workflowsFound !== 1 ? 's' : ''} found,{' '}
                          {testerResult.workflowsExecuted} executed
                        </span>
                        <span className={`font-medium ${testerResult.allSucceeded ? 'text-emerald-400' : 'text-red-400'}`}>
                          {testerResult.allSucceeded ? 'All passed' : 'Has failures'}
                        </span>
                      </div>
                      {testerResult.executions.map((exec, i) => (
                        <div key={i} className="border-t border-zinc-800 pt-2">
                          <p className="text-[10px] font-medium text-zinc-300">{exec.workflowName}</p>
                          {exec.results.map((r, j) => (
                            <div key={j} className="mt-1">
                              <div className="flex items-center gap-1.5">
                                {r.data?.dryRun ? (
                                  <Eye className="w-3 h-3 text-amber-400" />
                                ) : r.success ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-400" />
                                )}
                                <span className="text-[10px] text-zinc-400">{r.action}</span>
                                {r.data?.dryRun && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                    DRY RUN
                                  </span>
                                )}
                                {r.error && <span className="text-[10px] text-red-400 ml-1">- {r.error}</span>}
                              </div>
                              {r.data?.dryRun && r.data?.summary && (
                                <p className="text-[9px] text-zinc-500 ml-[18px] mt-0.5">{r.data.summary}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                      <p className="text-[10px] text-zinc-600">{testerResult.duration}ms</p>
                    </div>
                  )}

                  {testerResult && testerMode === 'actions' && 'action' in testerResult && (
                    <div className={`rounded-lg px-3 py-2 ${
                      testerResult.success
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}>
                      <div className="flex items-center gap-1.5 text-xs">
                        {testerResult.success
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className={testerResult.success ? 'text-emerald-400' : 'text-red-400'}>
                          {testerResult.action} — {testerResult.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      {testerResult.error && (
                        <p className="text-[10px] text-red-400 mt-1">{testerResult.error}</p>
                      )}
                      {testerResult.data && Object.keys(testerResult.data).length > 0 && (
                        <pre className="text-[10px] text-zinc-500 mt-1 overflow-x-auto max-h-24 overflow-y-auto">
                          {JSON.stringify(testerResult.data, null, 2)}
                        </pre>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-1">{testerResult.duration}ms</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
