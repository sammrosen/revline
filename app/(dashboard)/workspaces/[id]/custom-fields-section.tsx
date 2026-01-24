'use client';

import { useState, useEffect, useCallback } from 'react';
import { CustomFieldForm } from './custom-field-form';

/**
 * Custom Fields Section for Workspace Settings
 * 
 * Displays and manages custom field definitions for a workspace.
 * - List existing field definitions
 * - Add new fields (ADMIN+ only)
 * - Edit existing fields (ADMIN+ only)
 * - Delete fields with confirmation (ADMIN+ only)
 * 
 * STANDARDS:
 * - Role-based access control
 * - Loading/error/empty states
 * - Fail-safe defaults
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

interface CustomFieldsSectionProps {
  workspaceId: string;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export function CustomFieldsSection({ workspaceId, userRole }: CustomFieldsSectionProps) {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  
  // Delete confirmation
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Role check
  const canManageFields = userRole === 'ADMIN' || userRole === 'OWNER';

  // Fetch fields
  const fetchFields = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/custom-fields`);
      if (!response.ok) {
        throw new Error('Failed to fetch custom fields');
      }
      const data = await response.json();
      setFields(data.fields || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fields');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  // Handle delete
  const handleDelete = async (key: string) => {
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/custom-fields/${key}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete field');
      }

      // Refresh fields
      await fetchFields();
      setDeletingKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle form save
  const handleFormSave = () => {
    setShowForm(false);
    setEditingField(null);
    fetchFields();
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setShowForm(false);
    setEditingField(null);
  };

  // Open edit form
  const handleEdit = (field: FieldDefinition) => {
    setEditingField(field);
    setShowForm(true);
  };

  // Field type badge color
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'TEXT':
        return 'bg-blue-500/20 text-blue-400';
      case 'NUMBER':
        return 'bg-purple-500/20 text-purple-400';
      case 'DATE':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-medium text-white">Custom Fields</h3>
        {canManageFields && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-black rounded font-medium transition-colors"
          >
            + Add Field
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-400 mb-4">
        Define custom fields to store additional data on leads.
      </p>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-8 text-center text-zinc-500">
          <div className="inline-block w-6 h-6 border-2 border-zinc-600 border-t-amber-500 rounded-full animate-spin mb-2" />
          <p className="text-sm">Loading fields...</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-4">
          <CustomFieldForm
            workspaceId={workspaceId}
            editingField={editingField}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* Fields list */}
      {!loading && !showForm && (
        <>
          {fields.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-zinc-700 rounded-lg">
              <p className="text-zinc-500 mb-2">No custom fields defined</p>
              {canManageFields && (
                <p className="text-xs text-zinc-600">
                  Click &quot;Add Field&quot; to create your first custom field.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg"
                >
                  {/* Delete confirmation overlay */}
                  {deletingKey === field.key ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">
                        Delete &quot;{field.label}&quot;?
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingKey(null)}
                          disabled={deleteLoading}
                          className="px-3 py-1 text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(field.key)}
                          disabled={deleteLoading}
                          className="px-3 py-1 text-xs bg-red-600/80 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {deleteLoading ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Top row: key, type badge, required */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono text-white">
                            {field.key}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTypeBadgeClass(field.fieldType)}`}>
                            {field.fieldType}
                          </span>
                          {field.required && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                              required
                            </span>
                          )}
                        </div>
                        {/* Label and description */}
                        <p className="text-xs text-zinc-400 mt-1">
                          {field.label}
                          {field.description && (
                            <span className="text-zinc-600"> — {field.description}</span>
                          )}
                        </p>
                        {field.defaultValue && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            Default: {field.defaultValue}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      {canManageFields && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEdit(field)}
                            className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                            title="Edit field"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingKey(field.key)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete field"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Info */}
      {!showForm && (
        <div className="mt-4 p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
          <h4 className="text-xs font-medium text-zinc-400 mb-1">How Custom Fields Work</h4>
          <ul className="text-[11px] text-zinc-500 space-y-0.5">
            <li>• Fields are stored on leads captured through forms or API</li>
            <li>• Use <code className="text-amber-400/70">{'{{lead.custom.fieldKey}}'}</code> in email templates</li>
            <li>• Configure form field mappings in RevLine integration</li>
          </ul>
        </div>
      )}
    </div>
  );
}
