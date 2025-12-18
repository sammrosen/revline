'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const INTEGRATION_TYPES = ['MAILERLITE', 'STRIPE', 'CALENDLY', 'MANYCHAT'] as const;

interface AddIntegrationFormProps {
  clientId: string;
}

export function AddIntegrationForm({ clientId }: AddIntegrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [integration, setIntegration] = useState<string>('MAILERLITE');
  const [secret, setSecret] = useState('');
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
          plaintextSecret: secret,
          meta: parsedMeta,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add integration');
        return;
      }

      setIsOpen(false);
      setSecret('');
      setMeta('');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-zinc-400 hover:text-white border border-zinc-700 px-3 py-2 rounded hover:border-zinc-600 transition-colors"
      >
        + Add Integration
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="font-medium mb-4">Add Integration</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Type</label>
          <select
            value={integration}
            onChange={(e) => setIntegration(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white"
          >
            {INTEGRATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Secret (API Key / Webhook Secret)
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono"
            placeholder="Paste secret here (encrypted on save)"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Meta (JSON, optional)
          </label>
          <textarea
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm"
            placeholder='{"groupIds": {"lead": "123", "customer": "456"}}'
            rows={3}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-white text-black rounded text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Integration'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

