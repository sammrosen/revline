'use client';

import { useState, useEffect } from 'react';

/**
 * ABC Ignite meta configuration
 */
interface AbcIgniteMeta {
  clubNumber: string;
  defaultEventTypeId?: string;
  eventTypes?: Record<string, { id: string; name: string }>;
}

interface AbcIgniteConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: AbcIgniteMeta = {
  clubNumber: '',
  defaultEventTypeId: '',
  eventTypes: {},
};

/**
 * Parse meta string to AbcIgniteMeta, handling invalid JSON
 */
function parseMeta(value: string): AbcIgniteMeta {
  if (!value.trim()) {
    return DEFAULT_CONFIG;
  }
  try {
    const parsed = JSON.parse(value);
    return {
      clubNumber: parsed.clubNumber || '',
      defaultEventTypeId: parsed.defaultEventTypeId || '',
      eventTypes: parsed.eventTypes || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Structured editor for ABC Ignite configuration
 * 
 * Features:
 * - Club Number input (required)
 * - Default Event Type selection
 * - Event Types lookup table
 * - JSON toggle for power users
 */
export function AbcIgniteConfigEditor({ 
  value, 
  onChange,
  error: externalError,
}: AbcIgniteConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<AbcIgniteMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // New event type form state
  const [newEventKey, setNewEventKey] = useState('');
  const [newEventId, setNewEventId] = useState('');
  const [newEventName, setNewEventName] = useState('');

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      // Only include eventTypes if there are entries
      const output: AbcIgniteMeta = {
        clubNumber: meta.clubNumber,
        defaultEventTypeId: meta.defaultEventTypeId || '',
      };
      if (meta.eventTypes && Object.keys(meta.eventTypes).length > 0) {
        output.eventTypes = meta.eventTypes;
      }
      const newJson = JSON.stringify(output, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // Switch to JSON mode
  function handleSwitchToJson() {
    const output: AbcIgniteMeta = {
      clubNumber: meta.clubNumber,
      defaultEventTypeId: meta.defaultEventTypeId || '',
    };
    if (meta.eventTypes && Object.keys(meta.eventTypes).length > 0) {
      output.eventTypes = meta.eventTypes;
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
        clubNumber: parsed.clubNumber || '',
        defaultEventTypeId: parsed.defaultEventTypeId || '',
        eventTypes: parsed.eventTypes || {},
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
      setJsonError('Invalid JSON');
    }
  }

  // Add a new event type
  function handleAddEventType() {
    if (!newEventKey.trim() || !newEventId.trim()) return;
    
    const key = newEventKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    setMeta(prev => ({
      ...prev,
      eventTypes: {
        ...prev.eventTypes,
        [key]: {
          id: newEventId.trim(),
          name: newEventName.trim() || key,
        },
      },
    }));
    
    setNewEventKey('');
    setNewEventId('');
    setNewEventName('');
  }

  // Remove an event type
  function handleRemoveEventType(key: string) {
    setMeta(prev => {
      const newEventTypes = { ...prev.eventTypes };
      delete newEventTypes[key];
      return { ...prev, eventTypes: newEventTypes };
    });
  }

  const eventTypeKeys = Object.keys(meta.eventTypes || {});
  const displayError = externalError || jsonError;

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
          rows={10}
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

      {/* Club Configuration */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Club Configuration</h4>
        <p className="text-xs text-zinc-500 mb-3">
          Required settings for connecting to ABC Ignite calendar API.
        </p>
        
        <div className="space-y-4 p-4 bg-zinc-950 rounded border border-zinc-800">
          {/* Club Number - Required */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Club Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={meta.clubNumber}
              onChange={(e) => setMeta(prev => ({ ...prev, clubNumber: e.target.value }))}
              placeholder="e.g., 12345"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-orange-500/50 outline-none transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Find this in your ABC Ignite admin dashboard or API documentation
            </p>
          </div>

          {/* Default Event Type - Optional */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Default Event Type ID <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              type="text"
              value={meta.defaultEventTypeId || ''}
              onChange={(e) => setMeta(prev => ({ ...prev, defaultEventTypeId: e.target.value }))}
              placeholder="e.g., PT_SESSION"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-orange-500/50 outline-none transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Default event type used when no specific type is selected
            </p>
          </div>
        </div>
      </div>

      {/* Event Types Lookup Table */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Event Types</h4>
        <p className="text-xs text-zinc-500 mb-3">
          Map friendly names to ABC Ignite event type IDs. Use these keys in workflows.
        </p>
        
        {/* Existing event types */}
        <div className="space-y-2 mb-4">
          {eventTypeKeys.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No event types configured. Add one below (optional).</p>
          ) : (
            eventTypeKeys.map((key) => (
              <div 
                key={key}
                className="flex items-center gap-2 p-3 bg-zinc-950 rounded border border-zinc-800"
              >
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Key</label>
                    <span className="text-sm font-mono text-zinc-300">{key}</span>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Name</label>
                    <span className="text-sm text-zinc-300">{meta.eventTypes?.[key]?.name || '-'}</span>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Event Type ID</label>
                    <span className="text-sm font-mono text-zinc-300">{meta.eventTypes?.[key]?.id || '-'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEventType(key)}
                  className="text-red-400/80 hover:text-red-400 text-sm px-2"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add new event type form */}
        <div className="flex items-end gap-2 p-3 bg-zinc-900/50 rounded border border-dashed border-zinc-700">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Key</label>
            <input
              type="text"
              value={newEventKey}
              onChange={(e) => setNewEventKey(e.target.value)}
              placeholder="pt_session"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Name</label>
            <input
              type="text"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="Personal Training"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Event Type ID</label>
            <input
              type="text"
              value={newEventId}
              onChange={(e) => setNewEventId(e.target.value)}
              placeholder="PT_123"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleAddEventType}
            disabled={!newEventKey.trim() || !newEventId.trim()}
            className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Validation Warning */}
      {!meta.clubNumber.trim() && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-200/90">
          <span className="text-amber-400 font-medium">⚠️ Required:</span> Club Number must be set for API calls to work.
        </div>
      )}

      {/* Tips */}
      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-200/80">
        <span className="text-orange-400 font-medium">💡 Tips:</span>
        <ul className="mt-1 space-y-0.5 list-disc list-inside text-orange-200/60">
          <li>Event types can be fetched from the API once App ID/Key are configured</li>
          <li>Use event type keys in workflow actions for easier configuration</li>
          <li>app_id and app_key are sent as headers on every API request</li>
        </ul>
      </div>

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}
    </div>
  );
}
