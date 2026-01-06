'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IntegrationHelp, IntegrationTemplateButton } from './integration-help';
import { MailerLiteConfigEditor } from './mailerlite-config-editor';
import { StripeConfigEditor } from './stripe-config-editor';

const INTEGRATION_TYPES = ['MAILERLITE', 'STRIPE', 'CALENDLY', 'MANYCHAT'] as const;
type IntegrationType = typeof INTEGRATION_TYPES[number];

interface SecretInput {
  name: string;
  value: string;
}

interface AddIntegrationFormProps {
  clientId: string;
}

// Available secret names by integration type
const AVAILABLE_SECRET_NAMES: Record<IntegrationType, string[]> = {
  MAILERLITE: ['API Key'],
  STRIPE: ['Webhook Secret', 'API Key'],
  CALENDLY: ['Webhook Secret'],
  MANYCHAT: ['API Key'],
};

// Default MailerLite meta template
const DEFAULT_MAILERLITE_META = JSON.stringify({
  groups: {},
}, null, 2);

// Default Stripe meta template
const DEFAULT_STRIPE_META = JSON.stringify({
  products: {},
}, null, 2);

export function AddIntegrationForm({ clientId }: AddIntegrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [integration, setIntegration] = useState<IntegrationType>('MAILERLITE');
  const [secrets, setSecrets] = useState<SecretInput[]>([{ name: 'API Key', value: '' }]);
  const [meta, setMeta] = useState(DEFAULT_MAILERLITE_META);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate secrets
    const validSecrets = secrets.filter(s => s.name.trim() && s.value.trim());
    if (validSecrets.length === 0) {
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

      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
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
    setSecrets([{ name: AVAILABLE_SECRET_NAMES[integration][0] || 'API Key', value: '' }]);
    setMeta(integration === 'MAILERLITE' ? DEFAULT_MAILERLITE_META : '');
  }

  function handleIntegrationChange(newType: IntegrationType) {
    setIntegration(newType);
    // Set appropriate defaults for each type
    const defaultName = AVAILABLE_SECRET_NAMES[newType][0] || 'API Key';
    setSecrets([{ name: defaultName, value: '' }]);
    if (newType === 'MAILERLITE') {
      setMeta(DEFAULT_MAILERLITE_META);
    } else if (newType === 'STRIPE') {
      setMeta(DEFAULT_STRIPE_META);
    } else {
      setMeta('');
    }
  }

  function updateSecret(index: number, field: 'name' | 'value', value: string) {
    const newSecrets = [...secrets];
    newSecrets[index] = { ...newSecrets[index], [field]: value };
    setSecrets(newSecrets);
  }

  function addSecret() {
    // Find the next available secret name that isn't already used
    const usedNames = secrets.map(s => s.name);
    const availableNames = AVAILABLE_SECRET_NAMES[integration].filter(n => !usedNames.includes(n));
    if (availableNames.length > 0) {
      setSecrets([...secrets, { name: availableNames[0], value: '' }]);
    }
  }

  // Get unused secret names for dropdown
  function getAvailableNamesForIndex(index: number): string[] {
    const currentName = secrets[index]?.name;
    const usedNames = secrets.map((s, i) => i !== index ? s.name : null).filter(Boolean);
    return AVAILABLE_SECRET_NAMES[integration].filter(n => n === currentName || !usedNames.includes(n));
  }

  // Check if more secrets can be added
  const canAddMoreSecrets = secrets.length < AVAILABLE_SECRET_NAMES[integration].length;

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

  const isMailerLite = integration === 'MAILERLITE';
  const isStripe = integration === 'STRIPE';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsOpen(false)}>
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
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
          {/* ... existing form content ... */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-semibold text-zinc-300">Integration Type</label>
                {!isMailerLite && (
                  <IntegrationHelp 
                    integration={integration} 
                    context="create"
                    onCopyTemplate={(template) => setMeta(template)}
                  />
                )}
              </div>
              <select
                value={integration}
                onChange={(e) => handleIntegrationChange(e.target.value as IntegrationType)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-md text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              >
                {INTEGRATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secrets Section */}
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
            
            {/* Integration-specific hints */}
            <div className="mt-3 pt-3 border-t border-zinc-800/50">
              {isMailerLite && (
                <p className="text-xs text-zinc-500">
                  💡 Get API Key from MailerLite → Settings → API
                </p>
              )}
              {isStripe && (
                <p className="text-xs text-zinc-500">
                  💡 Get Webhook Secret from Stripe → Developers → Webhooks → Your endpoint
                </p>
              )}
            </div>
          </div>

          {/* Configuration Editor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-zinc-300">
                {isMailerLite ? 'MailerLite Routing' : isStripe ? 'Stripe Product Map' : 'Meta (JSON, optional)'}
              </label>
              {!isMailerLite && !isStripe && (
                <IntegrationTemplateButton 
                  integration={integration}
                  onCopyTemplate={(template) => setMeta(template)}
                />
              )}
            </div>
            
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
