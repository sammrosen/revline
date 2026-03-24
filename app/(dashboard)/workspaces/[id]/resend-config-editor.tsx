'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Resend template definition (matches ResendTemplate in types)
 */
interface ResendTemplate {
  id: string;
  name: string;
  variables?: string[];
}

/**
 * Remote template from the Resend API
 */
interface RemoteTemplate {
  id: string;
  name: string;
  variables?: Array<{ key: string; type: string; fallbackValue?: string | number }>;
}

/**
 * Resend meta configuration (mirrors types/index.ts ResendMeta)
 */
interface ResendMeta {
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  templates?: Record<string, ResendTemplate>;
}

/**
 * Lead property definition (matches LeadPropertyDefinition in types)
 */
interface LeadProperty {
  key: string;
  label: string;
  type: string;
}

interface ResendConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string; // For API calls to fetch templates
  workspaceId?: string;   // For fetching lead properties
  workspaceSlug?: string; // For constructing webhook URL
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: ResendMeta = {
  fromEmail: '',
  fromName: '',
  replyTo: '',
  templates: {},
};

/**
 * Parse meta string to ResendMeta, handling invalid JSON
 */
function parseMeta(value: string): ResendMeta {
  if (!value.trim()) {
    return DEFAULT_CONFIG;
  }
  try {
    const parsed = JSON.parse(value);
    return {
      fromEmail: parsed.fromEmail || '',
      fromName: parsed.fromName || '',
      replyTo: parsed.replyTo || '',
      templates: parsed.templates || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Serialize meta to JSON for parent, including templates
 */
function serializeMeta(meta: ResendMeta): string {
  const output: Record<string, unknown> = {
    fromEmail: meta.fromEmail,
  };
  if (meta.fromName?.trim()) {
    output.fromName = meta.fromName;
  }
  if (meta.replyTo?.trim()) {
    output.replyTo = meta.replyTo;
  }
  if (meta.templates && Object.keys(meta.templates).length > 0) {
    output.templates = meta.templates;
  }
  return JSON.stringify(output, null, 2);
}

/**
 * Structured editor for Resend configuration
 * 
 * Features:
 * - Sender settings: fromEmail, fromName, replyTo
 * - Templates: Fetch from Resend account, select and configure with aliases
 * - JSON toggle: Switch to raw JSON mode for power users
 * - Validation: Email format validation
 */
export function ResendConfigEditor({ 
  value, 
  onChange,
  error: externalError,
  integrationId,
  workspaceId,
  workspaceSlug,
}: ResendConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<ResendMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Template fetching state
  const [remoteTemplates, setRemoteTemplates] = useState<RemoteTemplate[]>([]);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Adding template state
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);
  const [newTemplateAlias, setNewTemplateAlias] = useState('');

  // Lead properties for variable reference
  const [leadProperties, setLeadProperties] = useState<LeadProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      const newJson = serializeMeta(meta);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // Switch to JSON mode
  function handleSwitchToJson() {
    setJsonText(serializeMeta(meta));
    setIsJsonMode(true);
    setJsonError(null);
  }

  // Switch to structured mode
  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({
        fromEmail: parsed.fromEmail || '',
        fromName: parsed.fromName || '',
        replyTo: parsed.replyTo || '',
        templates: parsed.templates || {},
      });
      setIsJsonMode(false);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON - fix before switching to structured mode');
    }
  }

  // Handle JSON text changes
  function handleJsonChange(newText: string) {
    setJsonText(newText);
    setJsonError(null);
    try {
      JSON.parse(newText);
      onChange(newText);
    } catch {
      // Don't update parent if JSON is invalid
      setJsonError('Invalid JSON');
    }
  }

  // Fetch templates from Resend API
  const handleFetchTemplates = useCallback(async () => {
    if (!integrationId) {
      setFetchError('Integration ID not available');
      return;
    }

    setFetchingTemplates(true);
    setFetchError(null);

    try {
      const response = await fetch(`/api/v1/integrations/${integrationId}/resend-templates`);
      const data = await response.json();

      if (!response.ok) {
        setFetchError(data.error || 'Failed to fetch templates');
        return;
      }

      setRemoteTemplates(data.data || []);
      setHasFetched(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setFetchingTemplates(false);
    }
  }, [integrationId]);

  // Fetch lead properties for variable reference
  useEffect(() => {
    if (!workspaceId) return;
    setLoadingProperties(true);
    fetch(`/api/v1/workspaces/${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        const schema = data.leadPropertySchema ?? [];
        setLeadProperties(
          schema.map((p: { key: string; label: string; type: string }) => ({
            key: p.key,
            label: p.label,
            type: p.type,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingProperties(false));
  }, [workspaceId]);

  // Add a remote template to the config
  function handleAddTemplate(remote: RemoteTemplate) {
    const alias = newTemplateAlias.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!alias) return;

    // Check for duplicate alias
    if (meta.templates?.[alias]) {
      return; // Already exists
    }

    const template: ResendTemplate = {
      id: remote.id,
      name: remote.name,
      variables: remote.variables?.map((v) => v.key) || [],
    };

    setMeta({
      ...meta,
      templates: {
        ...(meta.templates || {}),
        [alias]: template,
      },
    });

    // Reset add state
    setAddingTemplateId(null);
    setNewTemplateAlias('');
  }

  // Remove a template from config
  function handleRemoveTemplate(alias: string) {
    const newTemplates = { ...(meta.templates || {}) };
    delete newTemplates[alias];
    setMeta({
      ...meta,
      templates: newTemplates,
    });
  }

  const displayError = externalError || jsonError;
  const fromEmailValid = isValidEmail(meta.fromEmail);
  const replyToValid = isValidEmail(meta.replyTo || '');
  const configuredTemplates = meta.templates || {};
  const configuredTemplateIds = new Set(
    Object.values(configuredTemplates).map((t) => t.id)
  );

  // JSON Mode
  if (isJsonMode) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">JSON Mode</span>
          <button
            type="button"
            onClick={handleSwitchToStructured}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
          >
            Switch to Structured
          </button>
        </div>
        
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm"
          rows={12}
          spellCheck={false}
        />
        
        {displayError && (
          <p className="text-red-400 text-sm">{displayError}</p>
        )}
      </div>
    );
  }

  // Structured Mode
  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSwitchToJson}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
        >
          Switch to JSON
        </button>
      </div>

      {/* Sender Settings Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Sender Settings</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Configure the sender information for transactional emails sent via Resend.
        </p>
        
        <div className="space-y-4">
          {/* From Email */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              From Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={meta.fromEmail}
              onChange={(e) => setMeta({ ...meta, fromEmail: e.target.value })}
              placeholder="bookings@yourdomain.com"
              className={`w-full px-3 py-2 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none transition-colors ${
                !fromEmailValid ? 'border-red-500/50' : 'border-zinc-800 focus:border-indigo-500/50'
              }`}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Must be from a domain verified in Resend
            </p>
            {!fromEmailValid && (
              <p className="text-xs text-red-400 mt-1">Invalid email format</p>
            )}
          </div>

          {/* From Name */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              From Name
            </label>
            <input
              type="text"
              value={meta.fromName || ''}
              onChange={(e) => setMeta({ ...meta, fromName: e.target.value })}
              placeholder="Sports West"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Display name shown in recipient&apos;s inbox (e.g., &quot;Sports West&quot;)
            </p>
          </div>

          {/* Reply-To */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Reply-To Email
            </label>
            <input
              type="email"
              value={meta.replyTo || ''}
              onChange={(e) => setMeta({ ...meta, replyTo: e.target.value })}
              placeholder="support@yourdomain.com"
              className={`w-full px-3 py-2 bg-zinc-950 border rounded text-sm font-mono text-white focus:outline-none transition-colors ${
                !replyToValid ? 'border-red-500/50' : 'border-zinc-800 focus:border-indigo-500/50'
              }`}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Where replies will be sent (leave empty to use from email)
            </p>
            {!replyToValid && (
              <p className="text-xs text-red-400 mt-1">Invalid email format</p>
            )}
          </div>
        </div>
      </div>

      {/* Webhook Configuration Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Webhook Configuration</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Receive Resend delivery events (bounces, complaints, failures) to automatically update lead error states and trigger workflows.
        </p>

        <div className="space-y-4">
          {/* Webhook URL (read-only) */}
          {workspaceSlug && (
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">
                Webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/resend-webhook?source=${workspaceSlug}`}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-zinc-400 select-all cursor-text"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/api/v1/resend-webhook?source=${workspaceSlug}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="flex-shrink-0 px-2.5 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                  title="Copy webhook URL"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Paste this URL in Resend Dashboard &rarr; Webhooks &rarr; Add Endpoint
              </p>
            </div>
          )}

          {/* Webhook Secret note */}
          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400">
              <span className="font-medium text-zinc-300">Webhook Signing Secret</span> — Add the <span className="font-mono text-zinc-500">whsec_...</span> secret via <span className="text-indigo-400">Manage Secrets</span> above (secret name: &quot;Webhook Secret&quot;).
            </p>
          </div>

          {/* Recommended events note */}
          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400 mb-2">Enable these events in Resend:</p>
            <div className="flex flex-wrap gap-1.5">
              {['email.bounced', 'email.complained', 'email.failed', 'email.delivery_delayed', 'email.delivered'].map((evt) => (
                <span
                  key={evt}
                  className="px-2 py-0.5 text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded"
                >
                  {evt}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600 mt-2">
              Bounces and complaints set <span className="font-mono text-zinc-500">errorState</span> on leads. Delivered events clear transient delays.
            </p>
          </div>
        </div>
      </div>

      {/* Inbound Email (Agent Channel) Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Inbound Email (Agent Channel)</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Receive email replies so AI agents can have bidirectional email conversations. Requires Resend inbound domain setup.
        </p>

        <div className="space-y-4">
          {workspaceSlug && (
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">
                Inbound Webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/resend-inbound?source=${workspaceSlug}`}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-zinc-400 select-all cursor-text"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/api/v1/resend-inbound?source=${workspaceSlug}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="shrink-0 px-2.5 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                  title="Copy inbound webhook URL"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Configure this URL in Resend Dashboard &rarr; Inbound &rarr; Webhook Destination
              </p>
            </div>
          )}

          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-2">
            <p className="text-xs text-zinc-300 font-medium">Setup Steps</p>
            <ol className="text-[11px] text-zinc-400 space-y-1.5 list-decimal list-inside">
              <li>Add an inbound domain in Resend (e.g., <span className="font-mono text-zinc-300">reply.yourdomain.com</span>)</li>
              <li>Point MX records for that subdomain to Resend&apos;s inbound mail servers</li>
              <li>Set the inbound webhook URL above as the destination</li>
              <li>Uses the same <span className="font-mono text-zinc-500">Webhook Secret</span> from the delivery webhooks above</li>
            </ol>
          </div>

          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
            <p className="text-[11px] text-indigo-400">
              Once configured, select <span className="font-medium">Email / RESEND</span> as the channel in the Agent Editor.
              Inbound emails route to active agent conversations or fire the <span className="font-mono">resend.email_received</span> workflow trigger.
            </p>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {meta.fromEmail && (
        <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
          <h4 className="text-sm font-medium text-indigo-400 mb-2">Preview</h4>
          <p className="text-xs text-zinc-400 mb-1">Emails will be sent from:</p>
          <p className="text-sm font-mono text-white">
            {meta.fromName ? `${meta.fromName} <${meta.fromEmail}>` : meta.fromEmail}
          </p>
          {meta.replyTo && (
            <>
              <p className="text-xs text-zinc-400 mt-2 mb-1">Replies will go to:</p>
              <p className="text-sm font-mono text-white">{meta.replyTo}</p>
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* Templates Section */}
      {/* ================================================================== */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Email Templates</h4>
        <p className="text-xs text-zinc-500 mb-4">
          Design templates in the Resend dashboard, then fetch and configure them here for use in workflows.
        </p>

        {/* Configured Templates */}
        {Object.keys(configuredTemplates).length > 0 && (
          <div className="space-y-2 mb-4">
            {Object.entries(configuredTemplates).map(([alias, template]) => (
              <div
                key={alias}
                className="flex items-start justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-indigo-400">{alias}</span>
                    <span className="text-zinc-600 text-xs">-</span>
                    <span className="text-sm text-zinc-300 truncate">{template.name}</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 font-mono truncate">
                    ID: {template.id}
                  </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {template.variables.map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded"
                        >
                          {`{{{${v}}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTemplate(alias)}
                  className="text-zinc-600 hover:text-red-400 p-1 transition-colors flex-shrink-0 ml-2"
                  title="Remove template"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Variable Reference — shows what lead properties are available for template variables */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-4">
          <h5 className="text-xs font-medium text-zinc-400 mb-1.5">Template Variable Reference</h5>
          <p className="text-[11px] text-zinc-600 mb-3">
            Use these as suggested variable names in your Resend templates. The workflow action maps them to your lead data automatically.
          </p>

          {/* Reserved names warning */}
          <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded mb-3">
            <p className="text-[11px] text-amber-400 font-medium mb-1">Resend Reserved Names</p>
            <p className="text-[10px] text-amber-400/70 mb-1.5">
              These names are reserved by Resend and cannot be used as template variables:
            </p>
            <div className="flex flex-wrap gap-1">
              {['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'UNSUBSCRIBE_URL', 'contact', 'this'].map((name) => (
                <span
                  key={name}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-500/10 text-amber-400/80 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-amber-400/60 mt-1.5">
              Use alternatives like <span className="font-mono">LEAD_EMAIL</span>, <span className="font-mono">MEMBER_NAME</span> instead, and map them to your lead properties in the workflow action.
            </p>
          </div>

          {/* Built-in lead fields */}
          <div className="mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Built-in Lead Fields</p>
            <div className="space-y-1">
              {[
                { key: 'email', suggested: 'LEAD_EMAIL', desc: 'Lead email address' },
                { key: 'source', suggested: 'SOURCE', desc: 'Lead source identifier' },
                { key: 'stage', suggested: 'STAGE', desc: 'Lead stage (e.g., CAPTURED, PAID)' },
              ].map((field) => (
                <div key={field.key} className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono text-zinc-400 min-w-[80px]">lead.{field.key}</span>
                  <span className="text-zinc-600">&rarr;</span>
                  <span className="font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                    {field.suggested}
                  </span>
                  <span className="text-zinc-600 text-[10px]">{field.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom lead properties */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Custom Lead Properties</p>
            {loadingProperties ? (
              <p className="text-[11px] text-zinc-600">Loading...</p>
            ) : leadProperties.length > 0 ? (
              <div className="space-y-1">
                {leadProperties.map((prop) => {
                  const upperKey = prop.key.toUpperCase();
                  // Check if the uppercase key collides with a reserved name
                  const isReserved = ['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'UNSUBSCRIBE_URL'].includes(upperKey);
                  const suggestedName = isReserved ? `LEAD_${upperKey}` : upperKey;

                  return (
                    <div key={prop.key} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-zinc-400 min-w-[80px]">lead.{prop.key}</span>
                      <span className="text-zinc-600">&rarr;</span>
                      <span className={`font-mono px-1.5 py-0.5 rounded border ${
                        isReserved
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}>
                        {suggestedName}
                      </span>
                      <span className="text-[9px] text-zinc-600">{prop.type}</span>
                      {isReserved && (
                        <span className="text-[9px] text-amber-400/70">(renamed - reserved)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-600 italic">
                No custom properties defined. Add them in Settings &rarr; Lead Properties.
              </p>
            )}
          </div>

          <p className="text-[10px] text-zinc-600 mt-3 pt-2 border-t border-zinc-800/50">
            In the Resend template editor, use <span className="font-mono text-zinc-400">{'{{{VARIABLE_NAME}}}'}</span> syntax.
            The variable name in Resend does not need to match your lead property name — the workflow action handles the mapping.
          </p>
        </div>

        {/* Fetch Templates Button */}
        {integrationId && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleFetchTemplates}
              disabled={fetchingTemplates}
              className="w-full px-3 py-2 text-sm border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {fetchingTemplates
                ? 'Fetching templates...'
                : hasFetched
                  ? 'Refresh Templates from Resend'
                  : 'Fetch Templates from Resend'}
            </button>

            {fetchError && (
              <p className="text-xs text-red-400">{fetchError}</p>
            )}

            {/* Remote Templates List */}
            {hasFetched && remoteTemplates.length === 0 && !fetchError && (
              <p className="text-xs text-zinc-500 text-center py-2">
                No templates found. Create templates in the Resend dashboard first.
              </p>
            )}

            {remoteTemplates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-500">
                  Available templates ({remoteTemplates.length}):
                </p>
                {remoteTemplates.map((remote) => {
                  const isAlreadyAdded = configuredTemplateIds.has(remote.id);
                  const isAdding = addingTemplateId === remote.id;

                  return (
                    <div
                      key={remote.id}
                      className={`p-3 border rounded-lg transition-colors ${
                        isAlreadyAdded
                          ? 'bg-green-500/5 border-green-500/20'
                          : isAdding
                            ? 'bg-indigo-500/5 border-indigo-500/30'
                            : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-300">{remote.name}</p>
                          {remote.variables && remote.variables.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {remote.variables.map((v) => (
                                <span
                                  key={v.key}
                                  className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded"
                                >
                                  {v.key}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isAlreadyAdded ? (
                          <span className="text-xs text-green-400 flex-shrink-0 ml-2">Added</span>
                        ) : isAdding ? null : (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingTemplateId(remote.id);
                              // Auto-suggest alias from template name
                              setNewTemplateAlias(
                                remote.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-|-$/g, '')
                              );
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 border border-indigo-500/30 rounded hover:border-indigo-500/50 transition-colors flex-shrink-0 ml-2"
                          >
                            + Add
                          </button>
                        )}
                      </div>

                      {/* Alias input when adding */}
                      {isAdding && (
                        <div className="mt-3 flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-[11px] text-zinc-500 block mb-1">
                              Alias (used in workflows)
                            </label>
                            <input
                              type="text"
                              value={newTemplateAlias}
                              onChange={(e) => setNewTemplateAlias(e.target.value)}
                              placeholder="e.g., welcome, payment-confirm"
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm font-mono text-white focus:border-indigo-500/50 focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTemplateAlias.trim()) {
                                  handleAddTemplate(remote);
                                } else if (e.key === 'Escape') {
                                  setAddingTemplateId(null);
                                  setNewTemplateAlias('');
                                }
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddTemplate(remote)}
                            disabled={!newTemplateAlias.trim()}
                            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingTemplateId(null);
                              setNewTemplateAlias('');
                            }}
                            className="px-2 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!integrationId && (
          <p className="text-xs text-zinc-500">
            Save the integration first, then you can fetch and configure templates.
          </p>
        )}
      </div>

      {/* Workflow Actions Info */}
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Available Workflow Actions</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 text-sm mt-0.5">&#9993;</span>
            <div>
              <p className="text-sm text-zinc-300">Send Email</p>
              <p className="text-xs text-zinc-500">
                {Object.keys(configuredTemplates).length > 0
                  ? `Send using a configured template (${Object.keys(configuredTemplates).length} available) with lead variable mapping`
                  : 'Send a transactional email with custom subject and body'}
              </p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">
          Use the Workflows tab to configure when emails are sent.
        </p>
      </div>

      {/* Validation Warning */}
      {!meta.fromEmail.trim() && (
        <p className="text-xs text-amber-400">
          From Email is required for sending emails
        </p>
      )}

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}
    </div>
  );
}
