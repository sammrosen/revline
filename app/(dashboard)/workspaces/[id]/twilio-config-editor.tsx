'use client';

import { useState, useEffect } from 'react';

interface PhoneNumberConfig {
  number: string;
  label: string;
}

interface TwilioMeta {
  phoneNumbers: Record<string, PhoneNumberConfig>;
}

interface TwilioConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  workspaceSlug?: string;
}

const DEFAULT_CONFIG: TwilioMeta = {
  phoneNumbers: {},
};

function parseMeta(value: string): TwilioMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      phoneNumbers: parsed.phoneNumbers || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function serializeMeta(meta: TwilioMeta): string {
  return JSON.stringify({ phoneNumbers: meta.phoneNumbers }, null, 2);
}

function isValidE164(number: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(number);
}

function isValidKey(key: string): boolean {
  return /^[a-z][a-z0-9_-]*$/.test(key);
}

export function TwilioConfigEditor({
  value,
  onChange,
  error: externalError,
  workspaceSlug,
}: TwilioConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<TwilioMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => {
    if (!isJsonMode) {
      onChange(serializeMeta(meta));
    }
  }, [meta, isJsonMode, onChange]);

  function handleSwitchToJson() {
    setJsonText(serializeMeta(meta));
    setIsJsonMode(true);
    setJsonError(null);
  }

  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({ phoneNumbers: parsed.phoneNumbers || {} });
      setIsJsonMode(false);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON — fix before switching to structured mode');
    }
  }

  function handleJsonChange(newText: string) {
    setJsonText(newText);
    setJsonError(null);
    try {
      JSON.parse(newText);
      onChange(newText);
    } catch {
      setJsonError('Invalid JSON');
    }
  }

  function handleAddPhone() {
    setAddError(null);
    const key = newKey.trim().toLowerCase();
    if (!key) { setAddError('Key is required'); return; }
    if (!isValidKey(key)) {
      setAddError('Key must start with a letter and contain only lowercase letters, numbers, hyphens, underscores');
      return;
    }
    if (meta.phoneNumbers[key]) { setAddError(`Key "${key}" already exists`); return; }
    const number = newNumber.trim();
    if (!number) { setAddError('Phone number is required'); return; }
    if (!isValidE164(number)) {
      setAddError('Phone number must be E.164 format (e.g., +15551234567)');
      return;
    }
    const label = newLabel.trim() || key;
    setMeta({ phoneNumbers: { ...meta.phoneNumbers, [key]: { number, label } } });
    setNewKey('');
    setNewNumber('');
    setNewLabel('');
    setShowAddForm(false);
  }

  function handleRemovePhone(key: string) {
    const newPhones = { ...meta.phoneNumbers };
    delete newPhones[key];
    setMeta({ phoneNumbers: newPhones });
  }

  function handleStartEdit(key: string) {
    const phone = meta.phoneNumbers[key];
    if (!phone) return;
    setEditingKey(key);
    setEditNumber(phone.number);
    setEditLabel(phone.label);
  }

  function handleSaveEdit() {
    if (!editingKey) return;
    if (!isValidE164(editNumber.trim())) return;
    setMeta({
      phoneNumbers: {
        ...meta.phoneNumbers,
        [editingKey]: { number: editNumber.trim(), label: editLabel.trim() || editingKey },
      },
    });
    setEditingKey(null);
  }

  const phoneKeys = Object.keys(meta.phoneNumbers);
  const displayError = externalError || jsonError;

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
          rows={12}
          spellCheck={false}
        />
        {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
      </div>
    );
  }

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

      {/* Phone Numbers Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Phone Numbers</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Configure Twilio phone numbers for sending and receiving SMS. Each number gets a key used to reference it in workflows.
        </p>

        {phoneKeys.length > 0 ? (
          <div className="space-y-2 mb-4">
            {phoneKeys.map((key) => {
              const phone = meta.phoneNumbers[key];
              const isEditing = editingKey === key;

              if (isEditing) {
                return (
                  <div key={key} className="p-3 bg-zinc-900/50 border border-red-500/30 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                        {key}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-zinc-500 block mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          placeholder="+15551234567"
                          className={`w-full px-2.5 py-1.5 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none ${
                            editNumber && !isValidE164(editNumber.trim())
                              ? 'border-red-500/50'
                              : 'border-zinc-700 focus:border-red-500/50'
                          }`}
                          autoFocus
                        />
                        {editNumber && !isValidE164(editNumber.trim()) && (
                          <p className="text-[10px] text-red-400 mt-0.5">Must be E.164 format</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-500 block mb-1">Label</label>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Main Line"
                          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={!editNumber.trim() || !isValidE164(editNumber.trim())}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-mono text-red-400">{key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-zinc-300">{phone.number}</span>
                      <span className="text-zinc-600 text-xs">&mdash;</span>
                      <span className="text-sm text-zinc-400">{phone.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(key)}
                      className="px-2 py-1 text-[11px] text-zinc-500 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(key)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-zinc-900/50 border border-dashed border-zinc-700 rounded-lg mb-4 text-center">
            <p className="text-sm text-zinc-500">No phone numbers configured</p>
            <p className="text-xs text-zinc-600 mt-1">Add a Twilio phone number to start sending and receiving SMS</p>
          </div>
        )}

        {showAddForm ? (
          <div className="p-4 bg-zinc-900/50 border border-dashed border-red-500/30 rounded-lg space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Key <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => { setNewKey(e.target.value.toLowerCase()); setAddError(null); }}
                  placeholder="main"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm font-mono text-white focus:border-red-500/50 focus:outline-none"
                  autoFocus
                />
                <p className="text-[10px] text-zinc-600 mt-0.5">Used in workflows</p>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Phone Number <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newNumber}
                  onChange={(e) => { setNewNumber(e.target.value); setAddError(null); }}
                  placeholder="+15551234567"
                  className={`w-full px-2.5 py-1.5 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none ${
                    newNumber && !isValidE164(newNumber.trim())
                      ? 'border-red-500/50'
                      : 'border-zinc-700 focus:border-red-500/50'
                  }`}
                />
                <p className="text-[10px] text-zinc-600 mt-0.5">E.164 format</p>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Main Line"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-red-500/50 focus:outline-none"
                />
                <p className="text-[10px] text-zinc-600 mt-0.5">Display name</p>
              </div>
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddPhone}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
              >
                Add Phone Number
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewKey(''); setNewNumber(''); setNewLabel(''); setAddError(null); }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full py-2 text-sm border border-dashed border-zinc-700 text-zinc-400 rounded hover:border-zinc-600 hover:text-white transition-colors"
          >
            + Add Phone Number
          </button>
        )}
      </div>

      {/* Webhook Configuration Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Webhook Configuration</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Receive inbound SMS messages to trigger workflows and enable agent conversations.
        </p>

        <div className="space-y-4">
          {workspaceSlug && (
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Webhook URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/twilio-webhook?source=${workspaceSlug}`}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-zinc-400 select-all cursor-text"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/api/v1/twilio-webhook?source=${workspaceSlug}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="shrink-0 px-2.5 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                  title="Copy webhook URL"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Paste this URL in Twilio Console &rarr; Phone Numbers &rarr; Your Number &rarr; Messaging &rarr; &quot;A message comes in&quot;
              </p>
            </div>
          )}

          {workspaceSlug && (
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Voice Webhook URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/twilio-voice?source=${workspaceSlug}`}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-zinc-400 select-all cursor-text"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/api/v1/twilio-voice?source=${workspaceSlug}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="shrink-0 px-2.5 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                  title="Copy voice webhook URL"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Paste this URL in Twilio Console &rarr; Phone Numbers &rarr; Your Number &rarr; Voice &rarr; &quot;A call comes in&quot;. Used for missed-call handling via the Phone tab.
              </p>
            </div>
          )}

          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400">
              <span className="font-medium text-zinc-300">Signature Verification</span> — Twilio signs every webhook request with your Auth Token using HMAC-SHA1. Make sure your Auth Token is configured in <span className="text-red-400">Manage Secrets</span> above.
            </p>
          </div>

          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400 mb-2">Twilio will send these parameters on inbound SMS:</p>
            <div className="flex flex-wrap gap-1.5">
              {['From', 'To', 'Body', 'MessageSid', 'NumSegments'].map((param) => (
                <span
                  key={param}
                  className="px-2 py-0.5 text-[11px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 rounded"
                >
                  {param}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600 mt-2">
              Inbound messages fire the <span className="font-mono text-zinc-500">sms_received</span> workflow trigger with the sender&apos;s phone number and message body.
            </p>
          </div>
        </div>
      </div>

      {/* Workflow Actions Info */}
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Available Workflow Actions</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-red-400 text-sm mt-0.5">&#9993;</span>
            <div>
              <p className="text-sm text-zinc-300">Send SMS</p>
              <p className="text-xs text-zinc-500">
                Send an SMS message via Twilio. Supports {'{{lead.*}}'} and {'{{payload.*}}'} template variables in the message body.
                {phoneKeys.length > 1 && ` Choose from ${phoneKeys.length} configured phone numbers.`}
              </p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">
          Use the Workflows tab to configure when SMS messages are sent.
        </p>
      </div>

      {/* Preview */}
      {phoneKeys.length > 0 && (
        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
          <h4 className="text-sm font-medium text-red-400 mb-2">Preview</h4>
          <p className="text-xs text-zinc-400 mb-2">Configured phone numbers:</p>
          <div className="space-y-1">
            {phoneKeys.map((key) => {
              const phone = meta.phoneNumbers[key];
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-red-400">{key}</span>
                  <span className="text-zinc-600">&rarr;</span>
                  <span className="font-mono text-white">{phone.number}</span>
                  <span className="text-zinc-500">({phone.label})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phoneKeys.length === 0 && (
        <p className="text-xs text-amber-400">
          At least one phone number is required for sending and receiving SMS
        </p>
      )}

      {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
    </div>
  );
}
