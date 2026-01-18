'use client';

import { useState, useEffect } from 'react';

/**
 * Event type from ABC Ignite API (sync response)
 */
interface AbcIgniteEventType {
  eventTypeId: string;
  name: string;
  category?: string;
  duration?: number;
  maxAttendees?: number;
  isAvailableOnline?: boolean;
  levelId?: string;  // From eventTrainingLevels[0]
}

/**
 * ABC Ignite meta configuration
 */
interface AbcIgniteMeta {
  clubNumber: string;
  defaultEventTypeId?: string;
  defaultEmployeeId?: string;
  eventTypes?: Record<string, { 
    id: string; 
    name: string; 
    category: string;
    duration?: number;
    levelId?: string;
  }>;
  employees?: Record<string, {
    id: string;
    name: string;
    title?: string;
  }>;
}

interface AbcIgniteConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
  /** Integration ID for sync API calls (only available in Edit mode) */
  integrationId?: string;
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: AbcIgniteMeta = {
  clubNumber: '',
  defaultEventTypeId: '',
  defaultEmployeeId: '',
  eventTypes: {},
  employees: {},
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
      defaultEmployeeId: parsed.defaultEmployeeId || '',
      eventTypes: parsed.eventTypes || {},
      employees: parsed.employees || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Generate a slug key from event name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 30);
}

/**
 * Structured editor for ABC Ignite configuration
 * 
 * Features:
 * - Club Number input (required)
 * - Sync event types from ABC Ignite API (includes category from sync)
 * - Default Event Type dropdown (from synced events)
 * - JSON toggle for power users
 */
export function AbcIgniteConfigEditor({ 
  value, 
  onChange,
  error: externalError,
  integrationId,
}: AbcIgniteConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<AbcIgniteMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [availableEventTypes, setAvailableEventTypes] = useState<AbcIgniteEventType[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(new Set());

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      const output: AbcIgniteMeta = {
        clubNumber: meta.clubNumber,
      };
      if (meta.defaultEventTypeId) {
        output.defaultEventTypeId = meta.defaultEventTypeId;
      }
      if (meta.defaultEmployeeId) {
        output.defaultEmployeeId = meta.defaultEmployeeId;
      }
      if (meta.eventTypes && Object.keys(meta.eventTypes).length > 0) {
        output.eventTypes = meta.eventTypes;
      }
      if (meta.employees && Object.keys(meta.employees).length > 0) {
        output.employees = meta.employees;
      }
      const newJson = JSON.stringify(output, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // Switch to JSON mode
  function handleSwitchToJson() {
    const output: AbcIgniteMeta = {
      clubNumber: meta.clubNumber,
    };
    if (meta.defaultEventTypeId) {
      output.defaultEventTypeId = meta.defaultEventTypeId;
    }
    if (meta.defaultEmployeeId) {
      output.defaultEmployeeId = meta.defaultEmployeeId;
    }
    if (meta.eventTypes && Object.keys(meta.eventTypes).length > 0) {
      output.eventTypes = meta.eventTypes;
    }
    if (meta.employees && Object.keys(meta.employees).length > 0) {
      output.employees = meta.employees;
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
        defaultEmployeeId: parsed.defaultEmployeeId || '',
        eventTypes: parsed.eventTypes || {},
        employees: parsed.employees || {},
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

  // Fetch event types from ABC Ignite
  async function handleSync() {
    if (!integrationId) {
      setSyncError('Save the integration first, then sync event types.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const res = await fetch(`/api/v1/admin/integrations/${integrationId}/sync-event-types`);
      const data = await res.json();

      if (!res.ok) {
        setSyncError(data.error || 'Failed to sync event types');
        return;
      }

      setAvailableEventTypes(data.eventTypes || []);
      setSelectedEventTypes(new Set());
      setShowSyncDialog(true);
    } catch {
      setSyncError('Network error - check your connection');
    } finally {
      setIsSyncing(false);
    }
  }

  // Toggle event type selection
  function toggleEventType(eventTypeId: string) {
    setSelectedEventTypes(prev => {
      const next = new Set(prev);
      if (next.has(eventTypeId)) {
        next.delete(eventTypeId);
      } else {
        next.add(eventTypeId);
      }
      return next;
    });
  }

  // Add selected event types to config
  function handleAddSelectedEventTypes() {
    const newEventTypes = { ...meta.eventTypes };
    
    for (const eventType of availableEventTypes) {
      if (selectedEventTypes.has(eventType.eventTypeId)) {
        const key = slugify(eventType.name);
        // Don't overwrite existing keys
        if (!newEventTypes[key]) {
          newEventTypes[key] = {
            id: eventType.eventTypeId,
            name: eventType.name,
            category: eventType.category || 'Event',
            duration: eventType.duration,
            levelId: eventType.levelId,  // From eventTrainingLevels[0]
          };
        }
      }
    }

    setMeta(prev => ({ ...prev, eventTypes: newEventTypes }));
    setShowSyncDialog(false);
    setSelectedEventTypes(new Set());
  }

  // Remove an event type
  function handleRemoveEventType(key: string) {
    setMeta(prev => {
      const newEventTypes = { ...prev.eventTypes };
      delete newEventTypes[key];
      // Clear default if it was the removed one
      const wasDefault = prev.defaultEventTypeId === key;
      return { 
        ...prev, 
        eventTypes: newEventTypes,
        defaultEventTypeId: wasDefault ? '' : prev.defaultEventTypeId,
      };
    });
  }

  // Set an event type as default
  function handleSetDefault(key: string) {
    setMeta(prev => ({ ...prev, defaultEventTypeId: key }));
  }

  // ===========================================================================
  // EMPLOYEE MANAGEMENT
  // ===========================================================================
  
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ key: '', id: '', name: '', title: '' });
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  // Add a new employee
  function handleAddEmployee() {
    const { key, id, name } = newEmployee;
    
    // Validate
    if (!key.trim() || !id.trim() || !name.trim()) {
      setEmployeeError('Key, ABC ID, and Name are required');
      return;
    }
    
    // Check for duplicate key
    if (meta.employees?.[key]) {
      setEmployeeError(`Employee key "${key}" already exists`);
      return;
    }
    
    // Add employee
    setMeta(prev => ({
      ...prev,
      employees: {
        ...prev.employees,
        [key]: {
          id: id.trim(),
          name: name.trim(),
          title: newEmployee.title.trim() || undefined,
        },
      },
    }));
    
    // Reset form
    setNewEmployee({ key: '', id: '', name: '', title: '' });
    setShowAddEmployee(false);
    setEmployeeError(null);
  }

  // Remove an employee
  function handleRemoveEmployee(key: string) {
    setMeta(prev => {
      const newEmployees = { ...prev.employees };
      delete newEmployees[key];
      // Clear default if it was the removed one
      const wasDefault = prev.defaultEmployeeId === key;
      return { 
        ...prev, 
        employees: newEmployees,
        defaultEmployeeId: wasDefault ? '' : prev.defaultEmployeeId,
      };
    });
  }

  // Set an employee as default
  function handleSetDefaultEmployee(key: string) {
    setMeta(prev => ({ ...prev, defaultEmployeeId: key }));
  }

  const eventTypeKeys = Object.keys(meta.eventTypes || {});
  const employeeKeys = Object.keys(meta.employees || {});
  const displayError = externalError || jsonError || syncError;
  const canSync = !!integrationId;

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

  // Sync Dialog
  if (showSyncDialog) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-medium text-zinc-300">Select Event Types</h4>
          <button
            type="button"
            onClick={() => setShowSyncDialog(false)}
            className="text-zinc-400 hover:text-white text-lg"
          >
            ×
          </button>
        </div>
        
        <p className="text-xs text-zinc-500">
          Found {availableEventTypes.length} event types at club {meta.clubNumber}. 
          Select which ones to add to your RevLine config.
        </p>

        {availableEventTypes.length === 0 ? (
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded text-center">
            <p className="text-sm text-zinc-400">No event types found.</p>
            <p className="text-xs text-zinc-500 mt-1">
              Make sure your club has event types configured in ABC Ignite.
            </p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {availableEventTypes.map((et) => {
              const isSelected = selectedEventTypes.has(et.eventTypeId);
              const alreadyAdded = Object.values(meta.eventTypes || {}).some(
                e => e.id === et.eventTypeId
              );
              
              return (
                <label
                  key={et.eventTypeId}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-orange-500/10 border-orange-500/30' 
                      : alreadyAdded
                        ? 'bg-zinc-900/50 border-zinc-800 opacity-50'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleEventType(et.eventTypeId)}
                    disabled={alreadyAdded}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{et.name}</p>
                    <p className="text-xs text-zinc-500">
                      <span className={`${et.category === 'Appointment' ? 'text-blue-400' : 'text-green-400'}`}>
                        {et.category || 'Event'}
                      </span>
                      {' • '}{et.duration || '?'} min • {et.maxAttendees || 1} max
                      {alreadyAdded && <span className="text-zinc-400 ml-2">(already added)</span>}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleAddSelectedEventTypes}
            disabled={selectedEventTypes.size === 0}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Selected ({selectedEventTypes.size})
          </button>
          <button
            type="button"
            onClick={() => setShowSyncDialog(false)}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
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
          Enter your ABC Ignite club number to connect.
        </p>
        
        <div className="p-4 bg-zinc-950 rounded border border-zinc-800">
          <label className="text-xs text-zinc-400 block mb-1.5">
            Club Number <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={meta.clubNumber}
            onChange={(e) => setMeta(prev => ({ ...prev, clubNumber: e.target.value }))}
            placeholder="Your ABC Ignite club number"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-orange-500/50 outline-none transition-colors"
          />
          <p className="text-xs text-zinc-600 mt-1">
            Find this in your ABC Ignite admin dashboard
          </p>
        </div>
      </div>

      {/* Event Types */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">Event Types</h4>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || !meta.clubNumber}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? (
              <>
                <span className="animate-spin">⟳</span>
                Syncing...
              </>
            ) : (
              <>
                🔄 Sync from ABC Ignite
              </>
            )}
          </button>
        </div>
        
        {!canSync && (
          <p className="text-xs text-amber-400/80 mb-3">
            💡 Save the integration with your App ID and App Key, then use Sync to fetch event types.
          </p>
        )}
        
        {/* Event types list */}
        <div className="space-y-2">
          {eventTypeKeys.length === 0 ? (
            <div className="p-4 bg-zinc-950 border border-dashed border-zinc-700 rounded text-center">
              <p className="text-sm text-zinc-500 italic">
                No event types configured.
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {canSync 
                  ? 'Click "Sync from ABC Ignite" to fetch available event types.'
                  : 'Save the integration first, then sync event types.'}
              </p>
            </div>
          ) : (
            eventTypeKeys.map((key) => {
              const isDefault = meta.defaultEventTypeId === key;
              const eventType = meta.eventTypes?.[key];
              const isAppointment = eventType?.category === 'Appointment';
              
              return (
                <div 
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded border transition-colors ${
                    isDefault 
                      ? 'bg-orange-500/10 border-orange-500/30' 
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-orange-400">{key}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isAppointment 
                          ? 'bg-blue-500/20 text-blue-300' 
                          : 'bg-green-500/20 text-green-300'
                      }`}>
                        {eventType?.category || 'Event'}
                      </span>
                      {isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {eventType?.name}
                      {eventType?.duration && ` • ${eventType.duration} min`}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono truncate">
                      {eventType?.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(key)}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveEventType(key)}
                      className="px-2 py-1 text-xs text-red-400/80 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Employees */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">Employees</h4>
          <button
            type="button"
            onClick={() => setShowAddEmployee(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors"
          >
            + Add Employee
          </button>
        </div>
        
        <p className="text-xs text-zinc-500 mb-3">
          Configure employees for availability booking. Employee IDs must be obtained from ABC Ignite.
        </p>

        {/* Add Employee Form */}
        {showAddEmployee && (
          <div className="p-4 bg-zinc-900 border border-zinc-700 rounded mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Key (slug)</label>
                <input
                  type="text"
                  value={newEmployee.key}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="e.g., trainer1"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm font-mono text-white focus:border-orange-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">ABC Employee ID</label>
                <input
                  type="text"
                  value={newEmployee.id}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="ABC Ignite employee ID"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm font-mono text-white focus:border-orange-500/50 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., John Smith"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-orange-500/50 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={newEmployee.title}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Personal Trainer"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:border-orange-500/50 outline-none"
                />
              </div>
            </div>
            {employeeError && (
              <p className="text-red-400 text-xs">{employeeError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddEmployee}
                className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Add Employee
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddEmployee(false);
                  setNewEmployee({ key: '', id: '', name: '', title: '' });
                  setEmployeeError(null);
                }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Employee List */}
        <div className="space-y-2">
          {employeeKeys.length === 0 ? (
            <div className="p-4 bg-zinc-950 border border-dashed border-zinc-700 rounded text-center">
              <p className="text-sm text-zinc-500 italic">
                No employees configured.
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Add employees to enable availability booking.
              </p>
            </div>
          ) : (
            employeeKeys.map((key) => {
              const isDefault = meta.defaultEmployeeId === key;
              const employee = meta.employees?.[key];
              
              return (
                <div 
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded border transition-colors ${
                    isDefault 
                      ? 'bg-orange-500/10 border-orange-500/30' 
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-orange-400">{key}</span>
                      {employee?.title && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                          {employee.title}
                        </span>
                      )}
                      {isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {employee?.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono truncate">
                      {employee?.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultEmployee(key)}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmployee(key)}
                      className="px-2 py-1 text-xs text-red-400/80 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Validation Warning */}
      {!meta.clubNumber.trim() && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-200/90">
          <span className="text-amber-400 font-medium">Warning:</span> Club Number must be set to sync event types.
        </div>
      )}

      {/* Tips */}
      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-200/80">
        <span className="text-orange-400 font-medium">Tips:</span>
        <ul className="mt-1 space-y-0.5 list-disc list-inside text-orange-200/60">
          <li>Use Sync to fetch event types after adding your App ID and App Key</li>
          <li>Event category (Appointment vs Event) comes from ABC Ignite</li>
          <li>Set a default event type for workflows that don&apos;t specify one</li>
          <li>Add employees to enable employee-based availability booking</li>
        </ul>
      </div>

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}
    </div>
  );
}
