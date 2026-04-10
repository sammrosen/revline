'use client';

import { useState } from 'react';

interface GoogleCalendarMetaConfig {
  calendarId: string;
  timezone: string;
  defaultDuration: number;
}

interface GoogleCalendarConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const DEFAULT_CONFIG: GoogleCalendarMetaConfig = {
  calendarId: 'primary',
  timezone: 'America/New_York',
  defaultDuration: 30,
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
] as const;

const DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
  { value: 120, label: '120 minutes' },
] as const;

function parseMeta(value: string): GoogleCalendarMetaConfig {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      calendarId: parsed.calendarId ?? DEFAULT_CONFIG.calendarId,
      timezone: parsed.timezone ?? DEFAULT_CONFIG.timezone,
      defaultDuration: parsed.defaultDuration ?? DEFAULT_CONFIG.defaultDuration,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function GoogleCalendarConfigEditor({ value, onChange, error }: GoogleCalendarConfigEditorProps) {
  const [meta, setMeta] = useState<GoogleCalendarMetaConfig>(() => parseMeta(value));

  // Serialize to JSON and notify parent on change
  function handleChange(updates: Partial<GoogleCalendarMetaConfig>): void {
    const next = { ...meta, ...updates };
    setMeta(next);
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-medium text-zinc-300">Google Calendar Configuration</h4>

        {/* Calendar ID */}
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Calendar ID</label>
          <input
            type="text"
            value={meta.calendarId}
            onChange={(e) => handleChange({ calendarId: e.target.value })}
            placeholder="primary"
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Use &quot;primary&quot; for the default calendar, or a specific calendar ID.
          </p>
        </div>

        {/* Timezone */}
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Timezone</label>
          <select
            value={meta.timezone}
            onChange={(e) => handleChange({ timezone: e.target.value })}
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white outline-none focus:border-zinc-600 transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default Duration */}
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Default Appointment Duration</label>
          <select
            value={meta.defaultDuration}
            onChange={(e) => handleChange({ defaultDuration: Number(e.target.value) })}
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white outline-none focus:border-zinc-600 transition-colors"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
