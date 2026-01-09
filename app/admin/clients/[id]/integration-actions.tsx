'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IntegrationHelp, IntegrationTemplateButton } from './integration-help';
import { MailerLiteConfigEditor } from './mailerlite-config-editor';
import { StripeConfigEditor } from './stripe-config-editor';
import { AbcIgniteConfigEditor } from './abc-ignite-config-editor';

type IntegrationType = 'MAILERLITE' | 'STRIPE' | 'CALENDLY' | 'MANYCHAT' | 'ABC_IGNITE';

// Available secret names by integration type
const AVAILABLE_SECRET_NAMES: Record<IntegrationType, string[]> = {
  MAILERLITE: ['API Key'],
  STRIPE: ['Webhook Secret', 'API Key'],
  CALENDLY: ['Webhook Secret'],
  MANYCHAT: ['API Key'],
  ABC_IGNITE: ['App ID', 'App Key'],
};

interface SecretSummary {
  id: string;
  name: string;
}

interface Integration {
  id: string;
  integration: string;
  meta: unknown;
  secrets?: SecretSummary[];
}

interface WorkflowDependency {
  id: string;
  name: string;
}

interface IntegrationActionsProps {
  integration: Integration;
  /** Workflows that depend on this integration */
  dependentWorkflows?: WorkflowDependency[];
}

export function IntegrationActions({ integration, dependentWorkflows = [] }: IntegrationActionsProps) {
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [showManageSecrets, setShowManageSecrets] = useState(false);
  const [metaText, setMetaText] = useState(JSON.stringify(integration.meta || {}, null, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Secrets state
  const [secrets, setSecrets] = useState<SecretSummary[]>(integration.secrets || []);
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [showUpdateSecret, setShowUpdateSecret] = useState<string | null>(null);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [dangerZoneDeleteText, setDangerZoneDeleteText] = useState('');

  const integrationType = integration.integration as IntegrationType;
  const isMailerLite = integrationType === 'MAILERLITE';
  const isStripe = integrationType === 'STRIPE';
  const isAbcIgnite = integrationType === 'ABC_IGNITE';
  
  // Check if this integration has dependent workflows
  const hasDependents = dependentWorkflows.length > 0;

  // Get available secret names (not already used)
  const usedSecretNames = secrets.map(s => s.name);
  const availableSecretNames = AVAILABLE_SECRET_NAMES[integrationType]?.filter(
    name => !usedSecretNames.includes(name)
  ) || [];
  const canAddMoreSecrets = availableSecretNames.length > 0;

  // Load secrets on mount if not provided
  useEffect(() => {
    if (!integration.secrets) {
      loadSecrets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration.id]);

  async function loadSecrets() {
    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}/secrets`);
      if (res.ok) {
        const data = await res.json();
        setSecrets(data.secrets || []);
      }
    } catch {
      console.error('Failed to load secrets');
    }
  }

  async function handleDelete() {
    const expectedText = `delete ${integration.integration.toLowerCase()}`;
    if (dangerZoneDeleteText !== expectedText) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
        return;
      }

      router.refresh();
      setShowManageSecrets(false);
      setDangerZoneDeleteText('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateMeta() {
    setLoading(true);
    setError('');

    try {
      let parsedMeta = null;
      if (metaText.trim()) {
        try {
          parsedMeta = JSON.parse(metaText);
        } catch {
          setError('Invalid JSON');
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/admin/integrations/${integration.id}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: parsedMeta }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }

      setShowEditMeta(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSecret() {
    if (!newSecretName.trim() || !newSecretValue.trim()) {
      setError('Name and value are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSecretName.trim(),
          plaintextValue: newSecretValue,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add secret');
        return;
      }

      setSecrets([...secrets, { id: data.id, name: data.name }]);
      setNewSecretName('');
      setNewSecretValue('');
      setShowAddSecret(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSecret(secretId: string) {
    if (!newSecretValue.trim()) {
      setError('New value is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}/secrets/${secretId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaintextValue: newSecretValue,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update secret');
        return;
      }

      setNewSecretValue('');
      setShowUpdateSecret(null);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSecret(secretId: string) {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}/secrets/${secretId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete secret');
        return;
      }

      setSecrets(secrets.filter(s => s.id !== secretId));
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  // Edit Meta Modal
  if (showEditMeta) {
    const hasStructuredEditor = isMailerLite || isStripe || isAbcIgnite;
    const modalTitle = isMailerLite 
      ? 'MailerLite Configuration' 
      : isStripe 
        ? 'Stripe Configuration' 
        : isAbcIgnite
          ? 'ABC Ignite Configuration'
          : 'Meta Config';
    const modalDescription = isMailerLite 
      ? 'Configure MailerLite groups. Use the Workflows tab to set up automations.'
      : isStripe
        ? 'Configure product mappings for payment routing.'
        : isAbcIgnite
          ? 'Configure club settings and sync event types from ABC Ignite.'
          : 'Update non-sensitive configuration (group IDs, product maps, etc.)';

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">Edit {modalTitle}</h3>
            {!hasStructuredEditor && (
              <IntegrationHelp 
                integration={integrationType}
                context="edit-meta"
                onCopyTemplate={(template) => setMetaText(template)}
              />
            )}
          </div>
          <p className="text-sm text-zinc-400 mb-4">{modalDescription}</p>
          
          {isMailerLite ? (
            <MailerLiteConfigEditor
              value={metaText}
              onChange={setMetaText}
              error={error}
            />
          ) : isStripe ? (
            <StripeConfigEditor
              value={metaText}
              onChange={setMetaText}
              error={error}
            />
          ) : isAbcIgnite ? (
            <AbcIgniteConfigEditor
              value={metaText}
              onChange={setMetaText}
              error={error}
              integrationId={integration.id}
            />
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <IntegrationTemplateButton 
                  integration={integrationType}
                  onCopyTemplate={(template) => setMetaText(template)}
                />
              </div>
              <textarea
                value={metaText}
                onChange={(e) => setMetaText(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm mb-4"
                rows={12}
              />
            </>
          )}

          {error && !hasStructuredEditor && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleUpdateMeta}
              disabled={loading}
              className="px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setShowEditMeta(false);
                setMetaText(JSON.stringify(integration.meta || {}, null, 2));
                setError('');
              }}
              className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Manage Secrets Modal
  if (showManageSecrets) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-lg w-full">
          <h3 className="text-lg font-semibold mb-2">Manage Secrets</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Add, update, or remove secrets for this integration. Secrets are encrypted at rest.
          </p>

          {/* Existing Secrets */}
          <div className="space-y-2 mb-4">
            {secrets.length === 0 ? (
              <p className="text-sm text-zinc-500 italic py-4 text-center">No secrets configured</p>
            ) : (
              secrets.map((secret) => (
                <div 
                  key={secret.id}
                  className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800"
                >
                  <div>
                    <span className="text-sm font-medium text-white">{secret.name}</span>
                    <span className="text-xs text-zinc-500 ml-2 font-mono">••••••••</span>
                  </div>
                  <div className="flex gap-1">
                    {showUpdateSecret === secret.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="password"
                          value={newSecretValue}
                          onChange={(e) => setNewSecretValue(e.target.value)}
                          placeholder="New value"
                          className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white w-40"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateSecret(secret.id)}
                          disabled={loading}
                          className="px-2 py-1 text-xs bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowUpdateSecret(null);
                            setNewSecretValue('');
                          }}
                          className="px-2 py-1 text-xs text-zinc-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setShowUpdateSecret(secret.id);
                            setNewSecretValue('');
                          }}
                          className="px-2 py-1 text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600"
                        >
                          Rotate
                        </button>
                        <button
                          onClick={() => handleDeleteSecret(secret.id)}
                          disabled={loading}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Secret Form */}
          {showAddSecret ? (
            <div className="p-3 bg-zinc-950 rounded border border-dashed border-zinc-700 mb-4">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <select
                  value={newSecretName}
                  onChange={(e) => setNewSecretName(e.target.value)}
                  className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                >
                  {availableSecretNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  placeholder="Secret value"
                  className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddSecret}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50"
                >
                  Add Secret
                </button>
                <button
                  onClick={() => {
                    setShowAddSecret(false);
                    setNewSecretName('');
                    setNewSecretValue('');
                  }}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : canAddMoreSecrets ? (
            <button
              onClick={() => {
                setNewSecretName(availableSecretNames[0] || '');
                setShowAddSecret(true);
              }}
              className="w-full py-2 text-sm border border-dashed border-zinc-700 text-zinc-400 rounded hover:border-zinc-600 hover:text-white mb-4"
            >
              + Add Secret
            </button>
          ) : null}

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {/* Danger Zone */}
          <div className="mt-6 border-t border-zinc-800 pt-6">
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400/80 text-lg">⚠️</span>
                <h4 className="text-sm font-semibold text-red-400/90">Danger Zone</h4>
              </div>
              
              {hasDependents ? (
                <>
                  <p className="text-xs text-zinc-400 mb-3">
                    This integration cannot be deleted because it&apos;s used by active workflows.
                    Remove or update these workflows first:
                  </p>
                  <ul className="text-xs text-yellow-400 mb-3 ml-4 list-disc">
                    {dependentWorkflows.map((w) => (
                      <li key={w.id}>{w.name}</li>
                    ))}
                  </ul>
                  <button
                    disabled
                    className="w-full px-4 py-2 bg-zinc-700 text-zinc-400 rounded cursor-not-allowed text-sm font-medium"
                  >
                    Cannot Delete (Used by {dependentWorkflows.length} workflow{dependentWorkflows.length !== 1 ? 's' : ''})
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-400 mb-3">
                    Delete this integration. This action cannot be undone. Webhooks and API calls will stop working immediately.
                  </p>
                  <p className="text-xs text-zinc-300 mb-2">
                    Type <span className="font-mono font-bold">delete {integration.integration.toLowerCase()}</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={dangerZoneDeleteText}
                    onChange={(e) => setDangerZoneDeleteText(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm mb-3"
                    placeholder={`delete ${integration.integration.toLowerCase()}`}
                  />
                  <button
                    onClick={handleDelete}
                    disabled={dangerZoneDeleteText !== `delete ${integration.integration.toLowerCase()}` || loading}
                    className="w-full px-4 py-2 bg-red-600/80 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {loading ? 'Deleting...' : 'Delete Integration'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setShowManageSecrets(false);
                setShowAddSecret(false);
                setShowUpdateSecret(null);
                setNewSecretName('');
                setNewSecretValue('');
                setDangerZoneDeleteText('');
                setError('');
              }}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Actions
  return (
    <div className="flex items-center justify-end gap-1.5 sm:gap-2">
      <button
        onClick={() => setShowManageSecrets(true)}
        className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors whitespace-nowrap"
      >
        Secrets ({secrets.length})
      </button>
      <button
        onClick={() => setShowEditMeta(true)}
        className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors whitespace-nowrap"
      >
        Configure
      </button>
    </div>
  );
}
