'use client';

import { useState, useEffect } from 'react';

/**
 * Resend meta configuration
 */
interface ResendMeta {
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

interface ResendConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string; // For future API calls if needed
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: ResendMeta = {
  fromEmail: '',
  fromName: '',
  replyTo: '',
};

/**
 * Parse meta string to ResendMeta, handling invalid JSON
 */
function parseMeta(value: string): ResendMeta {
  if (!value.trim()) {
    return DEFAULT_CONFIG;
  }
  try {
    const parsed = JSON.parse(value);
    return {
      fromEmail: parsed.fromEmail || '',
      fromName: parsed.fromName || '',
      replyTo: parsed.replyTo || '',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Structured editor for Resend configuration
 * 
 * Features:
 * - Sender settings: fromEmail, fromName, replyTo
 * - JSON toggle: Switch to raw JSON mode for power users
 * - Validation: Email format validation
 */
export function ResendConfigEditor({ 
  value, 
  onChange,
  error: externalError,
}: ResendConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<ResendMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      // Only include non-empty optional fields
      const output: Record<string, string> = {
        fromEmail: meta.fromEmail,
      };
      if (meta.fromName?.trim()) {
        output.fromName = meta.fromName;
      }
      if (meta.replyTo?.trim()) {
        output.replyTo = meta.replyTo;
      }
      const newJson = JSON.stringify(output, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // Switch to JSON mode
  function handleSwitchToJson() {
    const output: Record<string, string> = {
      fromEmail: meta.fromEmail,
    };
    if (meta.fromName?.trim()) {
      output.fromName = meta.fromName;
    }
    if (meta.replyTo?.trim()) {
      output.replyTo = meta.replyTo;
    }
    setJsonText(JSON.stringify(output, null, 2));
    setIsJsonMode(true);
    setJsonError(null);
  }

  // Switch to structured mode
  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({
        fromEmail: parsed.fromEmail || '',
        fromName: parsed.fromName || '',
        replyTo: parsed.replyTo || '',
      });
      setIsJsonMode(false);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON - fix before switching to structured mode');
    }
  }

  // Handle JSON text changes
  function handleJsonChange(newText: string) {
    setJsonText(newText);
    setJsonError(null);
    try {
      JSON.parse(newText);
      onChange(newText);
    } catch {
      // Don't update parent if JSON is invalid
      setJsonError('Invalid JSON');
    }
  }

  const displayError = externalError || jsonError;
  const fromEmailValid = isValidEmail(meta.fromEmail);
  const replyToValid = isValidEmail(meta.replyTo || '');

  // JSON Mode
  if (isJsonMode) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">JSON Mode</span>
          <button
            type="button"
            onClick={handleSwitchToStructured}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
          >
            Switch to Structured
          </button>
        </div>
        
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm"
          rows={8}
          spellCheck={false}
        />
        
        {displayError && (
          <p className="text-red-400 text-sm">{displayError}</p>
        )}
      </div>
    );
  }

  // Structured Mode
  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSwitchToJson}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
        >
          Switch to JSON
        </button>
      </div>

      {/* Sender Settings Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Sender Settings</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Configure the sender information for transactional emails sent via Resend.
        </p>
        
        <div className="space-y-4">
          {/* From Email */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              From Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={meta.fromEmail}
              onChange={(e) => setMeta({ ...meta, fromEmail: e.target.value })}
              placeholder="bookings@yourdomain.com"
              className={`w-full px-3 py-2 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none transition-colors ${
                !fromEmailValid ? 'border-red-500/50' : 'border-zinc-800 focus:border-indigo-500/50'
              }`}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Must be from a domain verified in Resend
            </p>
            {!fromEmailValid && (
              <p className="text-xs text-red-400 mt-1">Invalid email format</p>
            )}
          </div>

          {/* From Name */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              From Name
            </label>
            <input
              type="text"
              value={meta.fromName || ''}
              onChange={(e) => setMeta({ ...meta, fromName: e.target.value })}
              placeholder="Sports West"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Display name shown in recipient&apos;s inbox (e.g., &quot;Sports West&quot;)
            </p>
          </div>

          {/* Reply-To */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Reply-To Email
            </label>
            <input
              type="email"
              value={meta.replyTo || ''}
              onChange={(e) => setMeta({ ...meta, replyTo: e.target.value })}
              placeholder="support@yourdomain.com"
              className={`w-full px-3 py-2 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none transition-colors ${
                !replyToValid ? 'border-red-500/50' : 'border-zinc-800 focus:border-indigo-500/50'
              }`}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Where replies will be sent (leave empty to use from email)
            </p>
            {!replyToValid && (
              <p className="text-xs text-red-400 mt-1">Invalid email format</p>
            )}
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {meta.fromEmail && (
        <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
          <h4 className="text-sm font-medium text-indigo-400 mb-2">Preview</h4>
          <p className="text-xs text-zinc-400 mb-1">Emails will be sent from:</p>
          <p className="text-sm font-mono text-white">
            {meta.fromName ? `${meta.fromName} <${meta.fromEmail}>` : meta.fromEmail}
          </p>
          {meta.replyTo && (
            <>
              <p className="text-xs text-zinc-400 mt-2 mb-1">Replies will go to:</p>
              <p className="text-sm font-mono text-white">{meta.replyTo}</p>
            </>
          )}
        </div>
      )}

      {/* Workflow Actions Info */}
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Available Workflow Actions</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 text-sm">📧</span>
            <div>
              <p className="text-sm text-zinc-300">Send Email</p>
              <p className="text-xs text-zinc-500">
                Send a transactional email with custom subject and body
              </p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">
          Use the Workflows tab to configure when emails are sent.
        </p>
      </div>

      {/* Validation Warning */}
      {!meta.fromEmail.trim() && (
        <p className="text-xs text-amber-400">
          ⚠️ From Email is required for sending emails
        </p>
      )}

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}
    </div>
  );
}
