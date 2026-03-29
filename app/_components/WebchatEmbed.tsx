'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface WebchatEmbedProps {
  workspaceSlug: string;
  agentId: string;
  configId?: string;
  brandColor?: string;
  agentName?: string;
  collectEmail?: boolean;
  greeting?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

function newSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Panel-only chat UI designed for iframe embedding.
 * No floating bubble, no fixed positioning -- fills its container.
 * Communicates with the parent frame via postMessage for close events.
 */
export function WebchatEmbed({
  workspaceSlug,
  agentId,
  configId,
  brandColor = '#2563eb',
  agentName = 'Chat',
  collectEmail = false,
  greeting,
}: WebchatEmbedProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(newSessionId);

  const [emailCollected, setEmailCollected] = useState(!collectEmail);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');

  const resetConversation = useCallback(() => {
    setMessages([]);
    setSessionId(newSessionId());
    setInput('');
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (emailCollected) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [emailCollected]);

  // Signal the parent loader that the iframe is ready
  useEffect(() => {
    window.parent.postMessage({ type: 'revline-chat-ready' }, '*');
  }, []);

  const notifyParent = useCallback((type: string, data?: Record<string, unknown>) => {
    window.parent.postMessage({ type: `revline-chat-${type}`, ...data }, '*');
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(configId
            ? { configId }
            : { workspaceSlug, agentId }),
          sessionId,
          message: text.trim(),
          ...(visitorEmail && { visitorEmail }),
          ...(visitorName && { visitorName }),
        }),
      });

      const data = await res.json();

      if (data.success && data.data?.reply) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.data.reply,
          timestamp: Date.now(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Sorry, I wasn\'t able to respond. Please try again.',
          timestamp: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Connection error. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  }, [configId, workspaceSlug, agentId, sessionId, sending, visitorEmail, visitorName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorEmail && collectEmail) return;
    setEmailCollected(true);
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div
        style={{ backgroundColor: brandColor }}
        className="px-4 py-3 flex items-center justify-between text-white shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-semibold text-sm">{agentName}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={resetConversation}
              className="text-white/60 hover:text-white transition-colors p-1"
              aria-label="New conversation"
              title="New conversation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button
            onClick={() => notifyParent('close')}
            className="text-white/80 hover:text-white transition-colors p-1"
            aria-label="Minimize chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Email collection gate */}
      {!emailCollected && (
        <div className="flex-1 flex items-center justify-center p-6">
          <form onSubmit={handleEmailSubmit} className="w-full space-y-3">
            <p className="text-sm text-gray-600 text-center mb-4">
              Enter your info to start chatting
            </p>
            <input
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': brandColor + '40' } as React.CSSProperties}
            />
            <input
              type="email"
              required
              value={visitorEmail}
              onChange={(e) => setVisitorEmail(e.target.value)}
              placeholder="Your email"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': brandColor + '40' } as React.CSSProperties}
            />
            <button
              type="submit"
              style={{ backgroundColor: brandColor }}
              className="w-full text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Start Chat
            </button>
          </form>
        </div>
      )}

      {/* Messages area */}
      {emailCollected && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              greeting ? (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-gray-100 text-gray-800">
                    {greeting}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm pt-8">
                  Send a message to get started
                </div>
              )
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: brandColor } : undefined}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
                style={{ '--tw-ring-color': brandColor + '40' } as React.CSSProperties}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                style={{ backgroundColor: brandColor }}
                className="text-white rounded-lg px-3 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
