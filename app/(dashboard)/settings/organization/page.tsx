'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Save, AlertTriangle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  workspaceCount: number;
  templateCount: number;
}

interface Access {
  isOwner: boolean;
  permissions: {
    canManageIntegrations: boolean;
    canManageWorkflows: boolean;
    canManageTemplates: boolean;
    canInviteMembers: boolean;
    canCreateWorkspaces: boolean;
    canAccessAllWorkspaces: boolean;
  };
}

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    fetchOrganization();
  }, []);

  async function fetchOrganization() {
    try {
      // First get user's orgs to find current one
      const orgsRes = await fetch('/api/v1/organizations');
      const orgsData = await orgsRes.json();
      
      if (!orgsData.organizations || orgsData.organizations.length === 0) {
        setError('No organization found');
        setLoading(false);
        return;
      }

      // Get the first org (current org)
      const orgId = orgsData.organizations[0].id;
      
      const res = await fetch(`/api/v1/organizations/${orgId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to load organization');
        setLoading(false);
        return;
      }

      setOrganization(data.organization);
      setAccess(data.access);
      setName(data.organization.name);
      setSlug(data.organization.slug);
    } catch (err) {
      setError('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!organization || !access?.isOwner) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save changes');
        return;
      }

      setOrganization({ ...organization, name: data.organization.name, slug: data.organization.slug });
      setSuccess('Organization settings saved');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-zinc-800 rounded" />
            <div className="h-64 bg-zinc-900 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Building2 className="w-7 h-7" />
            Organization Settings
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your organization details and settings
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{organization?.memberCount || 0}</div>
            <div className="text-sm text-zinc-500">Members</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{organization?.workspaceCount || 0}</div>
            <div className="text-sm text-zinc-500">Workspaces</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{organization?.templateCount || 0}</div>
            <div className="text-sm text-zinc-500">Templates</div>
          </div>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Organization Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!access?.isOwner}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="My Organization"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium mb-2">
                Organization Slug
              </label>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                disabled={!access?.isOwner}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                placeholder="my-organization"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Used in URLs and API calls. Only lowercase letters, numbers, and hyphens.
              </p>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            {success && (
              <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                {success}
              </div>
            )}

            {access?.isOwner && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {!access?.isOwner && (
              <p className="text-sm text-zinc-500 text-center">
                Only organization owners can modify these settings.
              </p>
            )}
          </div>
        </form>

        {/* Created At */}
        {organization?.createdAt && (
          <p className="text-xs text-zinc-600 mt-4 text-center">
            Organization created {new Date(organization.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
