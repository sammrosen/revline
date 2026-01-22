'use client';

import { useState, useEffect } from 'react';

/**
 * Simplified Resend config for Add Integration flow.
 * Collects the required fromEmail and optional fromName/replyTo.
 */
interface ResendMeta {
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

interface ResendAddConfigProps {
  value: string;
  onChange: (value: string) => void;
}

const DEFAULT_CONFIG: ResendMeta = {
  fromEmail: '',
  fromName: '',
  replyTo: '',
};

function parseMeta(value: string): ResendMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
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
 * Simplified Resend config for the Add Integration form.
 * Collects sender email and name configuration.
 */
export function ResendAddConfig({ value, onChange }: ResendAddConfigProps) {
  const [meta, setMeta] = useState<ResendMeta>(() => parseMeta(value));

  // Sync to parent
  useEffect(() => {
    const output: Record<string, string> = {
      fromEmail: meta.fromEmail,
    };
    if (meta.fromName.trim()) {
      output.fromName = meta.fromName;
    }
    if (meta.replyTo.trim()) {
      output.replyTo = meta.replyTo;
    }
    onChange(JSON.stringify(output, null, 2));
  }, [meta, onChange]);

  const isValidEmail = (email: string) => {
    return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
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
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-indigo-500/50 outline-none transition-colors"
        />
        <p className="text-xs text-zinc-600 mt-1">
          Must be from a domain verified in Resend
        </p>
      </div>

      {/* From Name */}
      <div>
        <label className="text-xs text-zinc-400 block mb-1.5">
          From Name
        </label>
        <input
          type="text"
          value={meta.fromName}
          onChange={(e) => setMeta({ ...meta, fromName: e.target.value })}
          placeholder="Sports West"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-indigo-500/50 outline-none transition-colors"
        />
        <p className="text-xs text-zinc-600 mt-1">
          Display name shown in recipient&apos;s inbox
        </p>
      </div>

      {/* Reply-To */}
      <div>
        <label className="text-xs text-zinc-400 block mb-1.5">
          Reply-To Email
        </label>
        <input
          type="email"
          value={meta.replyTo}
          onChange={(e) => setMeta({ ...meta, replyTo: e.target.value })}
          placeholder="support@yourdomain.com"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-indigo-500/50 outline-none transition-colors"
        />
        <p className="text-xs text-zinc-600 mt-1">
          Where replies will be sent (optional)
        </p>
      </div>

      {/* Info Box - What's next */}
      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
        <h4 className="text-sm font-medium text-indigo-400 mb-2">
          After saving, you&apos;ll be able to:
        </h4>
        <ul className="text-xs text-indigo-200/70 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">📧</span>
            <span>Send transactional emails from your workflows</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">⚡</span>
            <span>Use the &quot;Send Email&quot; action in workflow automations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">🔄</span>
            <span>Update sender settings anytime in the config editor</span>
          </li>
        </ul>
        <p className="text-[11px] text-zinc-500 mt-3">
          Make sure your domain is verified in Resend before sending emails.
        </p>
      </div>

      {/* Validation */}
      {!meta.fromEmail.trim() && (
        <p className="text-xs text-amber-400">
          ⚠️ From Email is required
        </p>
      )}
      {meta.fromEmail && !isValidEmail(meta.fromEmail) && (
        <p className="text-xs text-red-400">
          ⚠️ Invalid email format
        </p>
      )}
      {meta.replyTo && !isValidEmail(meta.replyTo) && (
        <p className="text-xs text-red-400">
          ⚠️ Reply-To has invalid email format
        </p>
      )}
    </div>
  );
}
