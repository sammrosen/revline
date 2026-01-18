'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IntegrationHelp, IntegrationTemplateButton } from './integration-help';
import { MailerLiteConfigEditor } from './mailerlite-config-editor';
import { StripeConfigEditor } from './stripe-config-editor';
import { AbcIgniteAddConfig } from './abc-ignite-add-config';
import { RevlineAddConfig } from './revline-add-config';
import { lockScroll, unlockScroll } from '@/app/_lib/utils/scroll-lock';
import { 
  INTEGRATION_TYPES, 
  INTEGRATIONS, 
  getSecretNames, 
  getDefaultMeta,
  type IntegrationTypeId 
} from '@/app/_lib/integrations/config';

interface SecretInput {
  name: string;
  value: string;
}

export interface AddIntegrationFormProps {
  workspaceId: string;
}

export function AddIntegrationForm({ workspaceId }: AddIntegrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [integration, setIntegration] = useState<IntegrationTypeId>('MAILERLITE');
  const [secrets, setSecrets] = useState<SecretInput[]>([{ name: 'API Key', value: '' }]);
  const [meta, setMeta] = useState(getDefaultMeta('MAILERLITE'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Lock body scroll when modal is open (mobile UX)
  useEffect(() => {
    if (isOpen) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => unlockScroll();
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate secrets (RevLine doesn't require secrets)
    const validSecrets = secrets.filter(s => s.name.trim() && s.value.trim());
    const requiresSecrets = integration !== 'REVLINE';
    if (requiresSecrets && validSecrets.length === 0) {
      setError('At least one secret is required');
      return;
    }

    // Check for duplicate names
    const names = validSecrets.map(s => s.name.trim());
    if (new Set(names).size !== names.length) {
      setError('Secret names must be unique');
      return;
    }

    setLoading(true);

    try {
      let parsedMeta = null;
      if (meta.trim()) {
        try {
          parsedMeta = JSON.parse(meta);
        } catch {
          setError('Invalid JSON in meta field');
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/api/v1/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          integration,
          secrets: validSecrets.map(s => ({
            name: s.name.trim(),
            plaintextValue: s.value,
          })),
          meta: parsedMeta,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add integration');
        return;
      }

      setIsOpen(false);
      resetForm();
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    const secretNames = getSecretNames(integration);
    setSecrets([{ name: secretNames[0] || 'API Key', value: '' }]);
    setMeta(getDefaultMeta(integration));
  }

  function handleIntegrationChange(newType: IntegrationTypeId) {
    setIntegration(newType);
    const secretNames = getSecretNames(newType);
    setSecrets([{ name: secretNames[0] || 'API Key', value: '' }]);
    setMeta(getDefaultMeta(newType));
  }

  function updateSecret(index: number, field: 'name' | 'value', value: string) {
    const newSecrets = [...secrets];
    newSecrets[index] = { ...newSecrets[index], [field]: value };
    setSecrets(newSecrets);
  }

  function addSecret() {
    const availableNames = getSecretNames(integration);
    const usedNames = secrets.map(s => s.name);
    const unusedNames = availableNames.filter(n => !usedNames.includes(n));
    if (unusedNames.length > 0) {
      setSecrets([...secrets, { name: unusedNames[0], value: '' }]);
    }
  }

  function getAvailableNamesForIndex(index: number): string[] {
    const allNames = getSecretNames(integration);
    const currentName = secrets[index]?.name;
    const usedNames = secrets.map((s, i) => i !== index ? s.name : null).filter(Boolean);
    return allNames.filter(n => n === currentName || !usedNames.includes(n));
  }

  const canAddMoreSecrets = secrets.length < getSecretNames(integration).length;

  function removeSecret(index: number) {
    if (secrets.length > 1) {
      setSecrets(secrets.filter((_, i) => i !== index));
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 px-4 py-2 rounded hover:bg-zinc-800 transition-all active:scale-95"
      >
        <span>+ Add Integration</span>
      </button>
    );
  }

  const config = INTEGRATIONS[integration];
  const isMailerLite = integration === 'MAILERLITE';
  const isStripe = integration === 'STRIPE';
  const isAbcIgnite = integration === 'ABC_IGNITE';
  const isRevline = integration === 'REVLINE';

  // Get the first secret's description as hint
  const secretHint = config?.secrets[0]?.description;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 z-50" onClick={() => setIsOpen(false)}>
      <div 
        className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg p-4 sm:p-6 max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Add or Replace Integration</h3>
            <p className="text-sm text-zinc-400">
              Adding a duplicate type will <span className="text-amber-400 font-medium underline decoration-amber-400/30">replace</span> the existing one.
            </p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-semibold text-zinc-300">Integration Type</label>
                {!isMailerLite && !isStripe && !isAbcIgnite && !isRevline && (
                  <IntegrationHelp 
                    integration={integration} 
                    context="create"
                    onCopyTemplate={(template) => setMeta(template)}
                  />
                )}
              </div>
              <select
                value={integration}
                onChange={(e) => handleIntegrationChange(e.target.value as IntegrationTypeId)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-md text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              >
                {INTEGRATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INTEGRATIONS[type]?.displayName || type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secrets Section - hidden for RevLine */}
          {!isRevline && (
            <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
              <label className="block text-sm font-semibold text-zinc-300 mb-3">
                Secrets
              </label>
              <div className="space-y-3">
                {secrets.map((secret, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={secret.name}
                      onChange={(e) => updateSecret(index, 'name', e.target.value)}
                      className="w-40 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm outline-none"
                    >
                      {getAvailableNamesForIndex(index).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="password"
                      value={secret.value}
                      onChange={(e) => updateSecret(index, 'value', e.target.value)}
                      placeholder="Secret value (encrypted on save)"
                      className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white font-mono text-sm outline-none focus:border-zinc-500 transition-colors"
                    />
                    {secrets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSecret(index)}
                        className="px-2 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canAddMoreSecrets && (
                <button
                  type="button"
                  onClick={addSecret}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <span className="text-lg">+</span> Add another secret
                </button>
              )}
              
              {/* Dynamic integration hint from config */}
              {secretHint && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-xs text-zinc-500">
                    💡 {secretHint}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Configuration Editor */}
          <div>
            {!isRevline && (
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-zinc-300">
                  {config?.metaDescription ? `${config.displayName} Config` : 'Meta (JSON, optional)'}
                </label>
                {!isMailerLite && !isStripe && !isAbcIgnite && (
                  <IntegrationTemplateButton 
                    integration={integration}
                    onCopyTemplate={(template) => setMeta(template)}
                  />
                )}
              </div>
            )}
            
            {isMailerLite ? (
              <MailerLiteConfigEditor
                value={meta}
                onChange={setMeta}
              />
            ) : isStripe ? (
              <StripeConfigEditor
                value={meta}
                onChange={setMeta}
              />
            ) : isAbcIgnite ? (
              <AbcIgniteAddConfig
                value={meta}
                onChange={setMeta}
              />
            ) : isRevline ? (
              <RevlineAddConfig
                value={meta}
                onChange={setMeta}
              />
            ) : (
              <textarea
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm min-h-[150px] outline-none focus:border-zinc-700 transition-colors"
                placeholder="{}"
              />
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-zinc-800">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-white text-black rounded-md font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Saving Integration...' : 'Save Integration'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
              className="px-6 py-2.5 bg-zinc-800 text-white rounded-md font-medium hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
