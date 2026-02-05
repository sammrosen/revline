'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';

interface Template {
  id: string;
  type: string;
  name: string;
  schema: {
    fields: Array<{
      key: string;
      label: string;
      description?: string;
      default?: string;
      maxLength?: number;
      placeholder?: string;
      multiline?: boolean;
    }>;
  };
  defaultCopy: Record<string, string>;
  defaultBranding: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    logo?: string;
    fontFamily?: string;
  } | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Access {
  isOwner: boolean;
  permissions: {
    canManageTemplates: boolean;
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [access, setAccess] = useState<Access | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
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

      // Get templates
      const res = await fetch(`/api/v1/organizations/${currentOrgId}/templates`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to load templates');
        return;
      }

      setTemplates(data.templates);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleEnabled(templateId: string, currentEnabled: boolean) {
    if (!orgId) return;

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update template');
        return;
      }

      setTemplates(templates.map((t) => 
        t.id === templateId ? { ...t, enabled: !currentEnabled } : t
      ));
    } catch (err) {
      alert('Failed to update template');
    }
  }

  async function handleDelete(templateId: string, templateName: string) {
    if (!orgId || !confirm(`Are you sure you want to delete "${templateName}"?`)) return;

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete template');
        return;
      }

      setTemplates(templates.filter((t) => t.id !== templateId));
    } catch (err) {
      alert('Failed to delete template');
    }
  }

  const canManage = access?.isOwner || access?.permissions.canManageTemplates;

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

  if (error && !templates.length) {
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
              <FileText className="w-7 h-7" />
              Templates
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage form templates available to your organization&apos;s workspaces
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => alert('Template editor coming soon!')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          )}
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-4">No templates yet.</p>
            {canManage && (
              <p className="text-sm text-zinc-500">
                Run the organization seed script to create default templates.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`bg-zinc-900 border rounded-lg p-6 ${
                  template.enabled ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                        {template.type}
                      </span>
                      {!template.enabled && (
                        <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">
                      {template.schema.fields.length} field{template.schema.fields.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleEnabled(template.id, template.enabled)}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                        title={template.enabled ? 'Disable template' : 'Enable template'}
                      >
                        {template.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => alert('Template editor coming soon!')}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                        title="Edit template"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Fields Preview */}
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Fields</p>
                  <div className="flex flex-wrap gap-2">
                    {template.schema.fields.map((field) => (
                      <div
                        key={field.key}
                        className="text-xs bg-zinc-800 px-2 py-1 rounded"
                        title={field.description}
                      >
                        {field.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Branding Preview */}
                {template.defaultBranding?.primaryColor && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Branding</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: template.defaultBranding.primaryColor }}
                        title="Primary color"
                      />
                      {template.defaultBranding.secondaryColor && (
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: template.defaultBranding.secondaryColor }}
                          title="Secondary color"
                        />
                      )}
                      {template.defaultBranding.backgroundColor && (
                        <div
                          className="w-6 h-6 rounded border border-zinc-700"
                          style={{ backgroundColor: template.defaultBranding.backgroundColor }}
                          title="Background color"
                        />
                      )}
                      {template.defaultBranding.fontFamily && (
                        <span className="text-xs text-zinc-500 ml-2">
                          {template.defaultBranding.fontFamily}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
