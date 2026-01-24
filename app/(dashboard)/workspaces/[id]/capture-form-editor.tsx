'use client';

import { useState, useEffect } from 'react';

/**
 * Capture Form Editor Component
 * 
 * Form for creating or editing capture forms.
 * 
 * STANDARDS:
 * - Client-side validation for UX
 * - Server-side validation enforced by API
 */

interface FormSecurity {
  mode: 'browser' | 'server' | 'both';
  allowedOrigins: string[];
  rateLimitPerIp: number;
  hasSigningSecret?: boolean;
}

interface CaptureForm {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  security: FormSecurity;
  allowedTargets: string[];
  triggerName: string;
}

interface CustomField {
  key: string;
  label: string;
}

interface CaptureFormEditorProps {
  workspaceId: string;
  editingForm: CaptureForm | null;
  onSave: () => void;
  onCancel: () => void;
}

const LEAD_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'source', label: 'Source' },
];

const SECURITY_MODES = [
  { value: 'browser', label: 'Browser Only', description: 'For client-side JS capture' },
  { value: 'server', label: 'Server Only', description: 'Requires HMAC signature' },
  { value: 'both', label: 'Both', description: 'Accept browser or server requests' },
];

export function CaptureFormEditor({
  workspaceId,
  editingForm,
  onSave,
  onCancel,
}: CaptureFormEditorProps) {
  const isEditing = !!editingForm;

  // Form state
  const [name, setName] = useState(editingForm?.name || '');
  const [description, setDescription] = useState(editingForm?.description || '');
  const [enabled, setEnabled] = useState(editingForm?.enabled ?? true);
  const [securityMode, setSecurityMode] = useState<'browser' | 'server' | 'both'>(
    editingForm?.security.mode || 'browser'
  );
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>(
    editingForm?.security.allowedOrigins || []
  );
  const [rateLimitPerIp, setRateLimitPerIp] = useState(
    editingForm?.security.rateLimitPerIp || 10
  );
  const [triggerName, setTriggerName] = useState(editingForm?.triggerName || 'form_captured');
  const [selectedTargets, setSelectedTargets] = useState<string[]>(
    editingForm?.allowedTargets || ['email']
  );

  // Custom fields from workspace
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Origin input
  const [originInput, setOriginInput] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch custom fields
  useEffect(() => {
    fetch(`/api/v1/workspaces/${workspaceId}/custom-fields`)
      .then((res) => res.json())
      .then((data) => {
        if (data.fields) {
          setCustomFields(data.fields.map((f: { key: string; label: string }) => ({
            key: f.key,
            label: f.label,
          })));
        }
      })
      .catch(() => {
        // Silent fail
      });
  }, [workspaceId]);

  // Handle target toggle
  // Email is now optional - capture is observational and accepts any data
  const handleToggleTarget = (target: string) => {
    setSelectedTargets((prev) =>
      prev.includes(target)
        ? prev.filter((t) => t !== target)
        : [...prev, target]
    );
  };

  // Handle add origin
  const handleAddOrigin = () => {
    const trimmed = originInput.trim();
    if (!trimmed) return;

    // Basic URL validation
    try {
      // Allow wildcards like *.example.com
      if (!trimmed.startsWith('*.')) {
        new URL(trimmed);
      }
    } catch {
      setError('Invalid origin URL');
      return;
    }

    if (!allowedOrigins.includes(trimmed)) {
      setAllowedOrigins([...allowedOrigins, trimmed]);
    }
    setOriginInput('');
  };

  // Handle remove origin
  const handleRemoveOrigin = (origin: string) => {
    setAllowedOrigins(allowedOrigins.filter((o) => o !== origin));
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (selectedTargets.length === 0) {
      setError('At least one target field is required');
      return;
    }

    if (!selectedTargets.includes('email')) {
      setError('Email must be included in target fields');
      return;
    }

    setSaving(true);

    try {
      const url = isEditing
        ? `/api/v1/workspaces/${workspaceId}/capture-forms/${editingForm.id}`
        : `/api/v1/workspaces/${workspaceId}/capture-forms`;

      const method = isEditing ? 'PATCH' : 'POST';

      const body = {
        name: name.trim(),
        description: description.trim() || null,
        enabled,
        security: {
          mode: securityMode,
          allowedOrigins,
          rateLimitPerIp,
        },
        allowedTargets: selectedTargets,
        triggerName: triggerName.trim() || 'form_captured',
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save form');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
    >
      <h3 className="text-sm font-medium text-zinc-300 mb-4">
        {isEditing ? 'Edit Capture Form' : 'Create Capture Form'}
      </h3>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Form Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., ABC Signup Capture"
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Description <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this form captures..."
            rows={2}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors resize-none"
          />
        </div>

        {/* Security Mode */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Security Mode
          </label>
          <div className="flex gap-2">
            {SECURITY_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setSecurityMode(mode.value as 'browser' | 'server' | 'both')}
                className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                  securityMode === mode.value
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
                title={mode.description}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-1">
            {securityMode === 'browser' && 'Accepts requests from client-side JavaScript (rate limited, origin validated)'}
            {securityMode === 'server' && 'Requires HMAC signature for server-to-server integration'}
            {securityMode === 'both' && 'Accepts both browser and signed server requests'}
          </p>
        </div>

        {/* Allowed Origins (for browser mode) */}
        {(securityMode === 'browser' || securityMode === 'both') && (
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Allowed Origins <span className="text-zinc-600">(browser mode)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOrigin())}
                placeholder="https://example.com or *.example.com"
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleAddOrigin}
                className="px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 transition-colors"
              >
                Add
              </button>
            </div>
            {allowedOrigins.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {allowedOrigins.map((origin) => (
                  <span
                    key={origin}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs"
                  >
                    {origin}
                    <button
                      type="button"
                      onClick={() => handleRemoveOrigin(origin)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600">
                No origins specified - all origins will be accepted (less secure)
              </p>
            )}
          </div>
        )}

        {/* Rate Limit */}
        {(securityMode === 'browser' || securityMode === 'both') && (
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Rate Limit (per IP, per minute)
            </label>
            <input
              type="number"
              value={rateLimitPerIp}
              onChange={(e) => setRateLimitPerIp(parseInt(e.target.value) || 10)}
              min={1}
              max={100}
              className="w-24 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
            />
          </div>
        )}

        {/* Trigger Name */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Workflow Trigger Name
          </label>
          <input
            type="text"
            value={triggerName}
            onChange={(e) => setTriggerName(e.target.value)}
            placeholder="form_captured"
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors"
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Workflows can listen for this trigger with adapter &quot;capture&quot;
          </p>
        </div>

        {/* Allowed Target Fields */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Allowed Target Fields <span className="text-red-400">*</span>
          </label>
          <p className="text-[10px] text-zinc-600 mb-2">
            Select which fields can be captured. All fields are optional.
          </p>

          {/* Lead fields */}
          <div className="space-y-1.5 mb-3">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
              Lead Fields
            </span>
            <div className="flex flex-wrap gap-2">
              {LEAD_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors ${
                    selectedTargets.includes(field.key)
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(field.key)}
                    onChange={() => handleToggleTarget(field.key)}
                    disabled={field.key === 'email'}
                    className="sr-only"
                  />
                  <span className="text-xs">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
                Custom Fields
              </span>
              <div className="flex flex-wrap gap-2">
                {customFields.map((field) => {
                  const target = `custom.${field.key}`;
                  return (
                    <label
                      key={target}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors ${
                        selectedTargets.includes(target)
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(target)}
                        onChange={() => handleToggleTarget(target)}
                        className="sr-only"
                      />
                      <span className="text-xs">{field.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {customFields.length === 0 && (
            <p className="text-[10px] text-zinc-600">
              No custom fields defined.{' '}
              <span className="text-amber-400/70">
                Go to Settings → Custom Fields to create some.
              </span>
            </p>
          )}
        </div>

        {/* Enabled checkbox */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/50"
            />
            <span className="text-sm text-zinc-300">Enabled</span>
          </label>
        </div>
      </div>

      {/* Form actions */}
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
            saving || !name.trim()
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-black'
          }`}
        >
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Form'}
        </button>
      </div>
    </form>
  );
}
