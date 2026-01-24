'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeadStage } from '@prisma/client';

/**
 * Lead Detail Modal
 * 
 * Shows full lead details with custom fields editing capability.
 * Fetches lead data including custom fields when opened.
 * 
 * STANDARDS:
 * - Role-based access control (MEMBER+ can edit)
 * - Loading/error states
 * - Fail-safe defaults
 */

interface CustomFieldDefinition {
  key: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE';
  required: boolean;
  description: string | null;
}

interface LeadDetail {
  id: string;
  email: string;
  stage: LeadStage;
  source: string | null;
  errorState: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  lastEventAt: string;
}

interface Event {
  id: string;
  system: string;
  eventType: string;
  success: boolean;
  createdAt: string;
}

interface LeadDetailModalProps {
  leadId: string;
  workspaceId: string;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  onClose: () => void;
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function StageBadge({ stage }: { stage: LeadStage }) {
  const colors = {
    CAPTURED: 'bg-blue-500/20 text-blue-400',
    BOOKED: 'bg-emerald-500/20 text-emerald-400',
    PAID: 'bg-green-500/20 text-green-400',
    DEAD: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded font-medium ${colors[stage]}`}>
      {stage}
    </span>
  );
}

export function LeadDetailModal({
  leadId,
  workspaceId,
  userRole,
  onClose,
}: LeadDetailModalProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Custom data editing
  const [editedCustomData, setEditedCustomData] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canEditLeads = userRole !== 'VIEWER';

  // Fetch lead data
  const fetchLead = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/leads/${leadId}?includeRawCustomData=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch lead');
      }
      const data = await response.json();
      setLead(data);
      setEditedCustomData(data.customFields || {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lead');
    }
  }, [leadId]);

  // Fetch custom field definitions
  const fetchFieldDefinitions = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/custom-fields`);
      if (!response.ok) return;
      const data = await response.json();
      setFieldDefinitions(data.fields || []);
    } catch {
      // Silent fail - field definitions just won't show labels
    }
  }, [workspaceId]);

  // Fetch recent events for this lead
  const fetchEvents = useCallback(async () => {
    // Events are fetched from the workspace page data
    // For now, we'll show a placeholder - could add a dedicated endpoint later
    setEvents([]);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLead(), fetchFieldDefinitions(), fetchEvents()])
      .finally(() => setLoading(false));
  }, [fetchLead, fetchFieldDefinitions, fetchEvents]);

  // Handle custom field value change
  const handleFieldChange = (key: string, value: unknown) => {
    setEditedCustomData(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Save custom data
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/leads/${leadId}/custom-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedCustomData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await response.json();
      setEditedCustomData(data.customData || {});
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Get field type for rendering appropriate input
  const getFieldType = (key: string) => {
    const definition = fieldDefinitions.find(f => f.key === key);
    return definition?.fieldType || 'TEXT';
  };

  const getFieldLabel = (key: string) => {
    const definition = fieldDefinitions.find(f => f.key === key);
    return definition?.label || key;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <h2 className="text-lg font-medium text-white">Lead Details</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="py-12 text-center text-zinc-500">
              <div className="inline-block w-6 h-6 border-2 border-zinc-600 border-t-amber-500 rounded-full animate-spin mb-2" />
              <p className="text-sm">Loading lead...</p>
            </div>
          )}

          {/* Lead data */}
          {!loading && lead && (
            <div className="space-y-6">
              {/* Core fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Email</label>
                  <p className="text-white font-mono text-sm">{lead.email}</p>
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Stage</label>
                    <StageBadge stage={lead.stage} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Source</label>
                    <p className="text-zinc-300 text-sm">{lead.source || '—'}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Created</label>
                    <p className="text-zinc-400 text-sm">{formatDateTime(lead.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Last Activity</label>
                    <p className="text-zinc-400 text-sm">{formatDateTime(lead.lastEventAt)}</p>
                  </div>
                </div>

                {lead.errorState && (
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Error State</label>
                    <p className="text-red-400 text-sm">{lead.errorState}</p>
                  </div>
                )}
              </div>

              {/* Custom Fields */}
              <div className="pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Custom Fields</h3>
                
                {fieldDefinitions.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">
                    No custom fields defined for this workspace.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {fieldDefinitions.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs text-zinc-400 block mb-1">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        {canEditLeads ? (
                          getFieldType(field.key) === 'DATE' ? (
                            <input
                              type="date"
                              value={(editedCustomData[field.key] as string) || ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
                            />
                          ) : getFieldType(field.key) === 'NUMBER' ? (
                            <input
                              type="number"
                              value={(editedCustomData[field.key] as number) ?? ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white font-mono focus:border-amber-500/50 outline-none transition-colors"
                            />
                          ) : (
                            <input
                              type="text"
                              value={(editedCustomData[field.key] as string) || ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
                            />
                          )
                        ) : (
                          <p className="text-zinc-300 text-sm">
                            {editedCustomData[field.key] !== undefined 
                              ? String(editedCustomData[field.key]) 
                              : '—'}
                          </p>
                        )}
                        {field.description && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Save button */}
                {canEditLeads && fieldDefinitions.length > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                        hasChanges && !saving
                          ? 'bg-amber-500 hover:bg-amber-600 text-black'
                          : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    {saveSuccess && (
                      <span className="text-sm text-green-400">Saved!</span>
                    )}
                  </div>
                )}
              </div>

              {/* Recent Events placeholder */}
              {events.length > 0 && (
                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">Recent Events</h3>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center gap-2 text-xs">
                        <span className={event.success ? 'text-green-400' : 'text-red-400'}>
                          {event.success ? '✓' : '✕'}
                        </span>
                        <span className="text-zinc-300">{event.eventType}</span>
                        <span className="text-zinc-600">({event.system})</span>
                        <span className="text-zinc-500 ml-auto">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
