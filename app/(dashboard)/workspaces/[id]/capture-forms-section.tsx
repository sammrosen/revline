'use client';

import { useState, useEffect, useCallback } from 'react';
import { CaptureFormEditor } from './capture-form-editor';
import { EmbedCodeModal } from './embed-code-modal';

/**
 * Capture Forms Section for Workspace Dashboard
 * 
 * Displays and manages capture forms for external form capture.
 * - List existing forms with stats
 * - Add new forms (ADMIN+ only)
 * - Edit/delete forms (ADMIN+ only)
 * - Get embed code
 * 
 * STANDARDS:
 * - Role-based access control
 * - Loading/error/empty states
 */

interface CaptureForm {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  security: {
    mode: 'browser' | 'server' | 'both';
    allowedOrigins: string[];
    rateLimitPerIp: number;
    hasSigningSecret: boolean;
  };
  allowedTargets: string[];
  triggerName: string;
  captureCount: number;
  lastCaptureAt: string | null;
  createdAt: string;
}

interface CaptureFormsSectionProps {
  workspaceId: string;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export function CaptureFormsSection({ workspaceId, userRole }: CaptureFormsSectionProps) {
  const [forms, setForms] = useState<CaptureForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingForm, setEditingForm] = useState<CaptureForm | null>(null);

  // Embed modal state
  const [embedForm, setEmbedForm] = useState<CaptureForm | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canManageForms = userRole === 'ADMIN' || userRole === 'OWNER';

  // Fetch forms
  const fetchForms = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/capture-forms`);
      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }
      const data = await response.json();
      setForms(data.forms || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Handle toggle enabled
  const handleToggleEnabled = async (form: CaptureForm) => {
    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/capture-forms/${form.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !form.enabled }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update form');
      }

      await fetchForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/capture-forms/${id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete form');
      }

      await fetchForms();
      setDeletingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle editor save
  const handleEditorSave = () => {
    setShowEditor(false);
    setEditingForm(null);
    fetchForms();
  };

  // Format date
  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  // Get mode badge
  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'browser':
        return 'bg-blue-500/20 text-blue-400';
      case 'server':
        return 'bg-purple-500/20 text-purple-400';
      case 'both':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Capture Forms</h2>
          <p className="text-sm text-zinc-400">
            Capture form submissions from external websites
          </p>
        </div>
        {canManageForms && !showEditor && (
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-black rounded font-medium transition-colors"
          >
            + Add Form
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-zinc-500">
          <div className="inline-block w-6 h-6 border-2 border-zinc-600 border-t-amber-500 rounded-full animate-spin mb-2" />
          <p className="text-sm">Loading forms...</p>
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <CaptureFormEditor
          workspaceId={workspaceId}
          editingForm={editingForm}
          onSave={handleEditorSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingForm(null);
          }}
        />
      )}

      {/* Forms list */}
      {!loading && !showEditor && (
        <>
          {forms.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-700 rounded-lg bg-zinc-900/30">
              <svg
                className="w-12 h-12 mx-auto text-zinc-600 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-zinc-500 mb-2">No capture forms defined</p>
              {canManageForms && (
                <p className="text-xs text-zinc-600">
                  Click &quot;Add Form&quot; to create your first capture form.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                >
                  {/* Delete confirmation */}
                  {deletingId === form.id ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">
                        Delete &quot;{form.name}&quot;?
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          disabled={deleteLoading}
                          className="px-3 py-1 text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(form.id)}
                          disabled={deleteLoading}
                          className="px-3 py-1 text-xs bg-red-600/80 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {deleteLoading ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Top row: toggle, name, badges, actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Enable toggle */}
                          {canManageForms && (
                            <button
                              onClick={() => handleToggleEnabled(form)}
                              className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                                form.enabled ? 'bg-amber-500' : 'bg-zinc-700'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                  form.enabled ? 'left-5' : 'left-0.5'
                                }`}
                              />
                            </button>
                          )}

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-white">
                                {form.name}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${getModeBadge(
                                  form.security.mode
                                )}`}
                              >
                                {form.security.mode}
                              </span>
                              {!form.enabled && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded">
                                  disabled
                                </span>
                              )}
                            </div>
                            {form.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {form.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEmbedForm(form)}
                            className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                            title="Get embed code"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                              />
                            </svg>
                          </button>
                          {canManageForms && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingForm(form);
                                  setShowEditor(true);
                                }}
                                className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                                title="Edit form"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingId(form.id)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                title="Delete form"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/50">
                        <div className="text-xs">
                          <span className="text-zinc-500">Captures:</span>{' '}
                          <span className="text-zinc-300">{form.captureCount}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-zinc-500">Last capture:</span>{' '}
                          <span className="text-zinc-400">
                            {formatDate(form.lastCaptureAt)}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-zinc-500">Trigger:</span>{' '}
                          <span className="text-amber-400/70 font-mono">
                            {form.triggerName}
                          </span>
                        </div>
                      </div>

                      {/* Allowed targets */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] text-zinc-500">Fields:</span>
                        {form.allowedTargets.slice(0, 5).map((target) => (
                          <span
                            key={target}
                            className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded font-mono"
                          >
                            {target}
                          </span>
                        ))}
                        {form.allowedTargets.length > 5 && (
                          <span className="text-[10px] text-zinc-600">
                            +{form.allowedTargets.length - 5} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Embed Code Modal */}
      {embedForm && (
        <EmbedCodeModal
          form={embedForm}
          workspaceId={workspaceId}
          onClose={() => setEmbedForm(null)}
        />
      )}
    </div>
  );
}
