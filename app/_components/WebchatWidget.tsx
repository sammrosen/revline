'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface WebchatWidgetProps {
  workspaceSlug: string;
  agentId: string;
  brandColor?: string;
  agentName?: string;
  collectEmail?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

function getOrCreateSessionId(): string {
  const key = 'revline_chat_session';
  if (typeof window === 'undefined') return crypto.randomUUID();

  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function WebchatWidget({
  workspaceSlug,
  agentId,
  brandColor = '#2563eb',
  agentName = 'Chat',
  collectEmail = false,
}: WebchatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(getOrCreateSessionId);

  // Email collection gate
  const [emailCollected, setEmailCollected] = useState(!collectEmail);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && emailCollected) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, emailCollected]);

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
          workspaceSlug,
          agentId,
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
  }, [workspaceSlug, agentId, sessionId, sending, visitorEmail, visitorName]);

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
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ backgroundColor: brandColor }}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform z-50"
          aria-label="Open chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200">
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
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
                  <div className="text-center text-gray-400 text-sm pt-8">
                    Send a message to get started
                  </div>
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
      )}
    </>
  );
}
