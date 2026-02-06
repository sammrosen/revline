'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, ShieldCheck, AlertTriangle } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  isOwner: boolean;
  permissions: {
    canManageIntegrations: boolean;
    canManageWorkflows: boolean;
    canManageTemplates: boolean;
    canInviteMembers: boolean;
    canCreateWorkspaces: boolean;
    canAccessAllWorkspaces: boolean;
  };
  createdAt: string;
}

interface Access {
  isOwner: boolean;
  permissions: Member['permissions'];
}

const PERMISSION_LABELS: Record<keyof Member['permissions'], string> = {
  canManageIntegrations: 'Manage Integrations',
  canManageWorkflows: 'Manage Workflows',
  canManageTemplates: 'Manage Templates',
  canInviteMembers: 'Invite Members',
  canCreateWorkspaces: 'Create Workspaces',
  canAccessAllWorkspaces: 'Access All Workspaces',
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [access, setAccess] = useState<Access | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit member
  const [editingMember, setEditingMember] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      // Get orgs first
      const orgsRes = await fetch('/api/v1/organizations');
      const orgsData = await orgsRes.json();
      
      if (!orgsData.organizations?.length) {
        setError('No organization found');
        setLoading(false);
        return;
      }

      const currentOrgId = orgsData.organizations[0].id;
      setOrgId(currentOrgId);

      // Get org details for access info
      const orgRes = await fetch(`/api/v1/organizations/${currentOrgId}`);
      const orgData = await orgRes.json();
      setAccess(orgData.access);

      // Get members
      const res = await fetch(`/api/v1/organizations/${currentOrgId}/members`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to load members');
        return;
      }

      setMembers(data.members);
    } catch {
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Failed to add member');
        return;
      }

      // Refresh members list
      await fetchMembers();
      setShowAddForm(false);
      setNewEmail('');
    } catch {
      setAddError('Failed to add member');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!orgId || !confirm('Are you sure you want to remove this member?')) return;

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to remove member');
        return;
      }

      setMembers(members.filter((m) => m.id !== memberId));
    } catch {
      alert('Failed to remove member');
    }
  }

  async function handleTogglePermission(
    memberId: string,
    permission: keyof Member['permissions'],
    currentValue: boolean
  ) {
    if (!orgId) return;

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: { [permission]: !currentValue },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update permissions');
        return;
      }

      // Update local state
      setMembers(members.map((m) => 
        m.id === memberId 
          ? { ...m, permissions: { ...m.permissions, [permission]: !currentValue } }
          : m
      ));
    } catch {
      alert('Failed to update permissions');
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-zinc-800 rounded" />
            <div className="h-64 bg-zinc-900 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !members.length) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Users className="w-7 h-7" />
              Members
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your organization members and their permissions
            </p>
          </div>
          {(access?.isOwner || access?.permissions.canInviteMembers) && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
          )}
        </div>

        {/* Add Member Form */}
        {showAddForm && (
          <form onSubmit={handleAddMember} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
            <div className="flex gap-4">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-500"
                required
              />
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 bg-white text-black rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewEmail('');
                  setAddError(null);
                }}
                className="px-4 py-2 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
            {addError && (
              <p className="text-red-400 text-sm mt-2">{addError}</p>
            )}
            <p className="text-xs text-zinc-500 mt-2">
              User must already have an account. They will be added with default permissions.
            </p>
          </form>
        )}

        {/* Members List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {members.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No members yet. Add your first member to get started.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {members.map((member) => (
                <div key={member.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-lg font-medium">
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name || member.email.split('@')[0]}</span>
                          {member.isOwner && (
                            <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3" />
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-500">{member.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {access?.isOwner && !member.isOwner && (
                        <>
                          <button
                            onClick={() => setEditingMember(editingMember === member.id ? null : member.id)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                            title="Edit permissions"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Permissions Editor */}
                  {editingMember === member.id && !member.isOwner && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-sm text-zinc-400 mb-3">Permissions</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(PERMISSION_LABELS) as Array<keyof Member['permissions']>).map((perm) => (
                          <label
                            key={perm}
                            className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={member.permissions[perm]}
                              onChange={() => handleTogglePermission(member.id, perm, member.permissions[perm])}
                              className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-blue-500 focus:ring-0 focus:ring-offset-0"
                            />
                            <span className="text-sm">{PERMISSION_LABELS[perm]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compact permissions display when not editing */}
                  {editingMember !== member.id && !member.isOwner && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(Object.keys(member.permissions) as Array<keyof Member['permissions']>)
                        .filter((perm) => member.permissions[perm])
                        .map((perm) => (
                          <span
                            key={perm}
                            className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded"
                          >
                            {PERMISSION_LABELS[perm]}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
