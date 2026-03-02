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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Chatbot {
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

interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  costEstimate?: CostEstimate;
  eventsEmitted?: string[];
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
  costEstimate: CostEstimate;
  model: string;
}

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
  // Chatbot selection
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [selectedChatbotId, setSelectedChatbotId] = useState<string>('');
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

  // Trigger simulator
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerFrom, setTriggerFrom] = useState('');
  const [triggerTo, setTriggerTo] = useState('');
  const [triggerBody, setTriggerBody] = useState('Hello');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedChatbot = chatbots.find((b) => b.id === selectedChatbotId);

  // -------------------------------------------------------------------------
  // Fetch chatbots
  // -------------------------------------------------------------------------

  const fetchChatbots = useCallback(async () => {
    setLoadingBots(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/chatbots`);
      const json = await res.json();
      if (res.ok && json.data) {
        const activeBots = (json.data as Chatbot[]).filter((b) => b.active);
        setChatbots(activeBots);
        if (activeBots.length > 0 && !selectedChatbotId) {
          setSelectedChatbotId(activeBots[0].id);
        }
      }
    } catch {
      // silently fail — empty bot list will show empty state
    } finally {
      setLoadingBots(false);
    }
  }, [workspaceId, selectedChatbotId]);

  useEffect(() => {
    fetchChatbots();
  }, [fetchChatbots]);

  // When chatbot changes, load its prompt and reset conversation
  useEffect(() => {
    if (selectedChatbot) {
      setOriginalPrompt(selectedChatbot.systemPrompt);
      setPromptOverride(selectedChatbot.systemPrompt);
    }
    resetConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatbotId]);

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
    if (!selectedChatbotId) return;
    try {
      await fetch(
        `/api/v1/workspaces/${workspaceId}/chatbots/${selectedChatbotId}/test-chat`,
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
    if (!text.trim() || !selectedChatbotId || sending) return;

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
        `/api/v1/workspaces/${workspaceId}/chatbots/${selectedChatbotId}/test-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: text.trim(),
            ...(isOverridden ? { systemPromptOverride: promptOverride } : {}),
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
        costEstimate: data.costEstimate,
        eventsEmitted: data.eventsEmitted,
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
  // Trigger simulation
  // -------------------------------------------------------------------------

  async function simulateTrigger() {
    if (!selectedChatbotId || sending) return;
    setSending(true);

    try {
      const isOverridden = promptOverride !== originalPrompt;

      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/chatbots/${selectedChatbotId}/test-trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: triggerFrom || undefined,
            to: triggerTo || undefined,
            messageBody: triggerBody || 'Hello',
            ...(isOverridden ? { systemPromptOverride: promptOverride } : {}),
          }),
        }
      );

      const json = await res.json();
      const data = json.data as TestChatResponse;

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      setConversationStatus(data.status);

      const triggerMsg: ChatMessageData = {
        role: 'user',
        content: `[Trigger simulated] ${triggerBody || 'Hello'}`,
        timestamp: new Date(),
      };

      const botMsg: ChatMessageData = {
        role: 'assistant',
        content: data.replyText || (data.error ? `[Error: ${data.error}]` : '[No response]'),
        promptTokens: data.usage?.promptTokens,
        completionTokens: data.usage?.completionTokens,
        latencyMs: data.latencyMs,
        costEstimate: data.costEstimate,
        eventsEmitted: data.eventsEmitted,
        error: data.error,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, triggerMsg, botMsg]);
      setTotalMessages((prev) => prev + 2);
      setTotalTokens((prev) => prev + (data.usage?.totalTokens || 0));
      setTotalCost((prev) => prev + (data.costEstimate?.totalCost || 0));
    } catch (err) {
      const errorMsg: ChatMessageData = {
        role: 'assistant',
        content: `[Trigger failed: ${err instanceof Error ? err.message : 'Unknown error'}]`,
        error: 'Trigger failed',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  async function fetchHistory() {
    if (!selectedChatbotId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/chatbots/${selectedChatbotId}/test-chat?limit=20`
      );
      const json = await res.json();
      if (res.ok) {
        setTestConversations(json.data || []);
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

  const maxMsgs = selectedChatbot?.maxMessagesPerConversation || 50;
  const maxTkns = selectedChatbot?.maxTokensPerConversation || 100000;
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

  if (chatbots.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
        <Bot className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-400 text-sm">No active chatbots configured.</p>
        <p className="text-zinc-500 text-xs mt-1">Create a chatbot in the Chatbots tab to start testing.</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Top bar: Chatbot selector + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <select
            value={selectedChatbotId}
            onChange={(e) => setSelectedChatbotId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-violet-500"
          >
            {chatbots.map((b) => (
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

      {/* Chat messages */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
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
                {msg.role === 'assistant' && (msg.promptTokens || msg.latencyMs || msg.eventsEmitted?.length) && (
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

      {/* Trigger simulator (collapsible) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setTriggerOpen(!triggerOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Trigger Simulator
          </span>
          {triggerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {triggerOpen && (
          <div className="border-t border-zinc-800 p-3 space-y-2">
            <p className="text-[10px] text-zinc-500">
              Simulate a workflow trigger (e.g. route_to_chatbot action) hitting this bot.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={triggerFrom}
                onChange={(e) => setTriggerFrom(e.target.value)}
                placeholder="From (contact address)"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
              <input
                type="text"
                value={triggerTo}
                onChange={(e) => setTriggerTo(e.target.value)}
                placeholder="To (bot address)"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <input
              type="text"
              value={triggerBody}
              onChange={(e) => setTriggerBody(e.target.value)}
              placeholder="Message body"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={simulateTrigger}
              disabled={sending}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap className="w-3.5 h-3.5" />
              {sending ? 'Simulating...' : 'Simulate Inbound Trigger'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
