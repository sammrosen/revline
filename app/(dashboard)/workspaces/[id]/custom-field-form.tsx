'use client';

import { useState } from 'react';

/**
 * Custom Field Form Component
 * 
 * Form for creating or editing custom field definitions.
 * - Create: all fields editable
 * - Edit: key and fieldType are readonly
 * 
 * STANDARDS:
 * - Client-side validation for UX
 * - Server-side validation enforced by API
 * - Clear error messages
 */

interface FieldDefinition {
  key: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE';
  required: boolean;
  description: string | null;
  defaultValue: string | null;
  displayOrder: number;
}

interface CustomFieldFormProps {
  workspaceId: string;
  editingField: FieldDefinition | null;
  onSave: () => void;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text', description: 'Free-form text up to 1000 characters' },
  { value: 'NUMBER', label: 'Number', description: 'Numeric values (integers or decimals)' },
  { value: 'DATE', label: 'Date', description: 'ISO 8601 date format' },
];

export function CustomFieldForm({
  workspaceId,
  editingField,
  onSave,
  onCancel,
}: CustomFieldFormProps) {
  const isEditing = !!editingField;

  // Form state
  const [key, setKey] = useState(editingField?.key || '');
  const [label, setLabel] = useState(editingField?.label || '');
  const [fieldType, setFieldType] = useState<'TEXT' | 'NUMBER' | 'DATE'>(
    editingField?.fieldType || 'TEXT'
  );
  const [required, setRequired] = useState(editingField?.required || false);
  const [description, setDescription] = useState(editingField?.description || '');
  const [defaultValue, setDefaultValue] = useState(editingField?.defaultValue || '');
  const [displayOrder, setDisplayOrder] = useState(editingField?.displayOrder || 0);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key format validation
  const keyRegex = /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;
  const isKeyValid = key === '' || keyRegex.test(key);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!key.trim()) {
      setError('Key is required');
      return;
    }
    if (!keyRegex.test(key)) {
      setError('Key must start with a letter and contain only letters, numbers, and underscores');
      return;
    }
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    setSaving(true);

    try {
      const url = isEditing
        ? `/api/v1/workspaces/${workspaceId}/custom-fields/${editingField.key}`
        : `/api/v1/workspaces/${workspaceId}/custom-fields`;

      const method = isEditing ? 'PATCH' : 'POST';

      const body = isEditing
        ? {
            label: label.trim(),
            required,
            description: description.trim() || null,
            defaultValue: defaultValue.trim() || null,
            displayOrder,
          }
        : {
            key: key.trim(),
            label: label.trim(),
            fieldType,
            required,
            description: description.trim() || undefined,
            defaultValue: defaultValue.trim() || undefined,
            displayOrder,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save field');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-4">
        {isEditing ? 'Edit Field' : 'Add New Field'}
      </h4>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Key field */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Field Key <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={isEditing}
            placeholder="e.g., barcode, membershipType"
            className={`w-full px-3 py-2 bg-zinc-900 border rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors ${
              isEditing
                ? 'border-zinc-800 text-zinc-500 cursor-not-allowed'
                : isKeyValid
                  ? 'border-zinc-700'
                  : 'border-red-500/50'
            }`}
          />
          {!isEditing && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Must start with a letter. Only letters, numbers, and underscores allowed.
            </p>
          )}
          {isEditing && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Key cannot be changed after creation.
            </p>
          )}
        </div>

        {/* Label field */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Display Label <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Member Barcode"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
          />
        </div>

        {/* Field Type */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Field Type <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            {FIELD_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => !isEditing && setFieldType(type.value as 'TEXT' | 'NUMBER' | 'DATE')}
                disabled={isEditing}
                className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                  fieldType === type.value
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : isEditing
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
                title={type.description}
              >
                {type.label}
              </button>
            ))}
          </div>
          {isEditing && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Field type cannot be changed after creation.
            </p>
          )}
        </div>

        {/* Required checkbox */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/50"
            />
            <span className="text-sm text-zinc-300">Required field</span>
          </label>
          <p className="text-[10px] text-zinc-600 mt-1 ml-6">
            If checked, validation will require this field to have a value.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Description <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this field is for..."
            rows={2}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors resize-none"
          />
        </div>

        {/* Default Value */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Default Value <span className="text-zinc-600">(optional)</span>
          </label>
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Value to use when none is provided"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
          />
        </div>

        {/* Display Order */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5">
            Display Order
          </label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
            min={0}
            className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Lower numbers appear first.
          </p>
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
          disabled={saving || !key.trim() || !label.trim() || !isKeyValid}
          className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
            saving || !key.trim() || !label.trim() || !isKeyValid
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-black'
          }`}
        >
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Field'}
        </button>
      </div>
    </form>
  );
}
