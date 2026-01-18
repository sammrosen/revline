'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TimezoneSelector } from './timezone-selector';
import { AdminApi } from '@/app/_lib/api-paths';

export default function NewWorkspacePage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('America/New_York'); // Default to ET
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Auto-generate slug from name
  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  }

  function generateSlug(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(AdminApi.workspaces.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create workspace');
        return;
      }

      router.push(`/workspaces/${data.id}`);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-xl mx-auto">
        <Link
          href="/workspaces"
          className="text-zinc-400 hover:text-white text-sm mb-4 inline-block"
        >
          ← Back to Workspaces
        </Link>

        <h1 className="text-2xl font-bold mb-8">Add New Workspace</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
              placeholder="Acme Fitness"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Slug (used in ?source= parameter)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white font-mono"
              placeholder="acme_fitness"
              required
            />
            <p className="text-xs text-zinc-500 mt-1">
              Webhook URL: /api/v1/stripe-webhook?source={slug || 'slug'}
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Timezone <span className="text-red-400">*</span>
            </label>
            <TimezoneSelector 
              value={timezone} 
              onChange={setTimezone}
              required
            />
            <p className="text-xs text-zinc-500 mt-1">
              Used for health check business hours (4am-11pm workspace time)
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
