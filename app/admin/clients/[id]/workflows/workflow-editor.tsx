'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

interface WorkflowAction {
  adapter: string;
  operation: string;
  params: Record<string, unknown>;
}

interface TriggerOption {
  adapterId: string;
  adapterName: string;
  triggers: Array<{ name: string; label: string; description?: string }>;
}

interface ActionOption {
  adapterId: string;
  adapterName: string;
  requiresIntegration: boolean;
  actions: Array<{ name: string; label: string; description?: string }>;
}

interface WorkflowEditorProps {
  clientId: string;
  workflowId?: string;
  initialData?: {
    name: string;
    description: string | null;
    enabled: boolean;
    triggerAdapter: string;
    triggerOperation: string;
    triggerFilter: Record<string, unknown> | null;
    actions: WorkflowAction[];
  };
  configuredIntegrations: string[];
  mailerliteGroups?: Record<string, { id: string; name: string }>;
  stripeProducts?: Record<string, string>; // key -> product name
}

interface WorkflowEditorModalProps extends WorkflowEditorProps {
  onClose?: () => void;
  onSave?: () => void;
}

export function WorkflowEditor({
  clientId,
  workflowId,
  initialData,
  configuredIntegrations,
  mailerliteGroups = {},
  stripeProducts = {},
  onClose,
  onSave,
}: WorkflowEditorModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registry data
  const [triggers, setTriggers] = useState<TriggerOption[]>([]);
  const [actionOptions, setActionOptions] = useState<ActionOption[]>([]);

  // Form state
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [triggerAdapter, setTriggerAdapter] = useState(
    initialData?.triggerAdapter || ''
  );
  const [triggerOperation, setTriggerOperation] = useState(
    initialData?.triggerOperation || ''
  );
  const [triggerFilterJson, setTriggerFilterJson] = useState(
    initialData?.triggerFilter ? JSON.stringify(initialData.triggerFilter, null, 2) : ''
  );
  const [actions, setActions] = useState<WorkflowAction[]>(
    initialData?.actions || []
  );
  
  // Stripe product filter (extracted from triggerFilter for UI)
  const [selectedStripeProduct, setSelectedStripeProduct] = useState<string>(
    (initialData?.triggerFilter?.product as string) || ''
  );
  
  // Determine if we should show structured filter UI vs raw JSON
  // Always show product selector for Stripe, even if no products configured yet
  const isStripeTrigger = triggerAdapter === 'stripe';
  const hasStripeProducts = Object.keys(stripeProducts).length > 0;
  
  // Disable-first modal state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  
  // Check if workflow is active and being edited
  const isEditingActiveWorkflow = workflowId && initialData?.enabled;

  // Load registry data
  useEffect(() => {
    async function loadRegistry() {
      try {
        const response = await fetch('/api/admin/workflow-registry');
        if (response.ok) {
          const data = await response.json();
          setTriggers(data.data.triggers || []);
          setActionOptions(data.data.actions || []);
        }
      } catch (err) {
        console.error('Failed to load registry:', err);
      }
    }
    loadRegistry();
  }, []);

  // Handle disabling workflow before editing
  const handleDisableWorkflow = async () => {
    if (!workflowId) return;
    
    setIsDisabling(true);
    try {
      const response = await fetch(`/api/admin/workflows/${workflowId}/toggle`, {
        method: 'PATCH',
      });
      
      if (response.ok) {
        setEnabled(false);
        setShowDisableModal(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to disable workflow');
      }
    } catch (err) {
      console.error('Failed to disable workflow:', err);
      setError('Failed to disable workflow');
    } finally {
      setIsDisabling(false);
    }
  };

  // Get available triggers for selected adapter
  const availableTriggers =
    triggers.find((t) => t.adapterId === triggerAdapter)?.triggers || [];

  // Filter action options to only show configured integrations
  const availableActions = actionOptions.filter(
    (a) => !a.requiresIntegration || configuredIntegrations.includes(a.adapterId.toUpperCase())
  );

  const handleAddAction = () => {
    setActions([
      ...actions,
      { adapter: '', operation: '', params: {} },
    ]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionChange = (
    index: number,
    field: keyof WorkflowAction,
    value: unknown
  ) => {
    const newActions = [...actions];
    if (field === 'adapter') {
      newActions[index] = { adapter: value as string, operation: '', params: {} };
    } else if (field === 'operation') {
      newActions[index] = { ...newActions[index], operation: value as string, params: {} };
    } else if (field === 'params') {
      newActions[index] = { ...newActions[index], params: value as Record<string, unknown> };
    }
    setActions(newActions);
  };

  const handleParamChange = (
    actionIndex: number,
    paramName: string,
    value: unknown
  ) => {
    const newActions = [...actions];
    newActions[actionIndex] = {
      ...newActions[actionIndex],
      params: { ...newActions[actionIndex].params, [paramName]: value },
    };
    setActions(newActions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build trigger filter - prefer structured UI over raw JSON
    let triggerFilter: Record<string, unknown> | null = null;
    
    if (isStripeTrigger && selectedStripeProduct) {
      // Use the Stripe product selector
      triggerFilter = { product: selectedStripeProduct };
    } else if (!isStripeTrigger && triggerFilterJson.trim()) {
      // Use raw JSON for other integrations
      try {
        triggerFilter = JSON.parse(triggerFilterJson);
      } catch {
        setError('Invalid trigger filter JSON');
        setLoading(false);
        return;
      }
    }

    // Validate
    if (!name.trim()) {
      setError('Name is required');
      setLoading(false);
      return;
    }
    if (!triggerAdapter || !triggerOperation) {
      setError('Trigger is required');
      setLoading(false);
      return;
    }
    if (actions.length === 0) {
      setError('At least one action is required');
      setLoading(false);
      return;
    }
    for (const action of actions) {
      if (!action.adapter || !action.operation) {
        setError('All actions must have an adapter and operation');
        setLoading(false);
        return;
      }
    }

    try {
      const payload = {
        clientId,
        name: name.trim(),
        description: description.trim() || null,
        enabled,
        triggerAdapter,
        triggerOperation,
        triggerFilter,
        actions,
      };

      const url = workflowId
        ? `/api/admin/workflows/${workflowId}`
        : '/api/admin/workflows';
      const method = workflowId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save workflow');
      }

      // Close modal and refresh
      if (onSave) {
        onSave();
      }
      if (onClose) {
        onClose();
      } else {
        // Fallback for page-based usage
        router.push(`/admin/clients/${clientId}`);
        router.refresh();
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  // Form content (shared between modal and page)
  const formContent = (
    <form onSubmit={handleSubmit} className={onClose ? "space-y-6" : "space-y-8"}>
      {/* Disable-First Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-white">Workflow is Active</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  This workflow is currently enabled and processing events.
                  You must disable it before making changes.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDisableWorkflow}
                disabled={isDisabling}
                className="flex-1 px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {isDisabling ? 'Disabling...' : 'Disable & Edit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisableModal(false);
                  if (onClose) onClose();
                }}
                disabled={isDisabling}
                className="px-4 py-2 text-zinc-400 hover:text-white text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Workflow Warning Banner */}
      {isEditingActiveWorkflow && enabled && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-400">
              This workflow is active. Disable it to make changes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDisableModal(true)}
            className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-sm rounded hover:bg-yellow-500/30 transition-colors"
          >
            Disable
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Basic Info</h3>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Calendly Booking Flow"
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
            rows={2}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              enabled ? 'bg-green-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                enabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
          <span className="text-sm text-zinc-400">
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Trigger</h3>
        <p className="text-sm text-zinc-500">When should this workflow run?</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Integration
            </label>
            <select
              value={triggerAdapter}
              onChange={(e) => {
                setTriggerAdapter(e.target.value);
                setTriggerOperation('');
              }}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-zinc-600"
            >
              <option value="">Select integration...</option>
              {triggers.map((t) => (
                <option key={t.adapterId} value={t.adapterId}>
                  {t.adapterName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Event
            </label>
            <select
              value={triggerOperation}
              onChange={(e) => setTriggerOperation(e.target.value)}
              disabled={!triggerAdapter}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-zinc-600 disabled:opacity-50"
            >
              <option value="">Select event...</option>
              {availableTriggers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stripe Product Filter */}
        {isStripeTrigger && (
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Product (optional)
            </label>
            {hasStripeProducts ? (
              <select
                value={selectedStripeProduct}
                onChange={(e) => setSelectedStripeProduct(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="">All products</option>
                {Object.entries(stripeProducts).map(([key, productName]) => (
                  <option key={key} value={key}>
                    {productName} ({key})
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  value={selectedStripeProduct}
                  onChange={(e) => setSelectedStripeProduct(e.target.value)}
                  placeholder="e.g., coaching, fit1"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
                <p className="mt-1 text-xs text-yellow-500">
                  💡 Tip: Configure products in Stripe integration settings to use a dropdown
                </p>
              </>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Only trigger for payments matching this product key
            </p>
          </div>
        )}

        {/* Raw JSON Filter (for other integrations) */}
        {!isStripeTrigger && (
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Filter (optional, JSON)
            </label>
            <textarea
              value={triggerFilterJson}
              onChange={(e) => setTriggerFilterJson(e.target.value)}
              placeholder='e.g., {"product": "fit1"}'
              rows={2}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono text-sm resize-none"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Only run workflow when payload matches this filter
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Actions</h3>
            <p className="text-sm text-zinc-500">What should happen?</p>
          </div>
          <button
            type="button"
            onClick={handleAddAction}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm rounded hover:bg-zinc-700 transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Action
          </button>
        </div>

        {actions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No actions yet. Add an action to define what happens when this workflow
            runs.
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action, index) => (
              <ActionEditor
                key={index}
                index={index}
                action={action}
                actionOptions={availableActions}
                allActionOptions={actionOptions}
                configuredIntegrations={configuredIntegrations}
                mailerliteGroups={mailerliteGroups}
                onChange={handleActionChange}
                onParamChange={handleParamChange}
                onRemove={() => handleRemoveAction(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className={onClose ? "flex gap-3 pt-4 border-t border-zinc-800" : "flex items-center justify-end gap-4"}>
        {onClose ? (
          <>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {loading ? 'Saving...' : workflowId ? 'Update Workflow' : 'Create Workflow'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-zinc-400 hover:text-white text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-white text-black font-medium rounded hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : workflowId ? 'Save Changes' : 'Create Workflow'}
            </button>
          </>
        )}
      </div>
    </form>
  );

  // Render as modal if onClose is provided, otherwise render as page
  if (onClose) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {workflowId ? 'Edit Workflow' : 'New Workflow'}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {workflowId ? 'Update workflow configuration' : 'Create a new automation workflow'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {formContent}
        </div>
      </div>
    );
  }

  // Page-based rendering (for backwards compatibility)
  return formContent;
}

// =============================================================================
// ACTION EDITOR
// =============================================================================

interface ActionEditorProps {
  index: number;
  action: WorkflowAction;
  actionOptions: ActionOption[];
  allActionOptions: ActionOption[]; // All options including unconfigured
  configuredIntegrations: string[];
  mailerliteGroups: Record<string, { id: string; name: string }>;
  onChange: (index: number, field: keyof WorkflowAction, value: unknown) => void;
  onParamChange: (index: number, param: string, value: unknown) => void;
  onRemove: () => void;
}

function ActionEditor({
  index,
  action,
  actionOptions,
  allActionOptions,
  configuredIntegrations,
  mailerliteGroups,
  onChange,
  onParamChange,
  onRemove,
}: ActionEditorProps) {
  const selectedAdapter = actionOptions.find((a) => a.adapterId === action.adapter);
  const availableOperations = selectedAdapter?.actions || [];
  
  // Check if the selected adapter requires integration but isn't configured
  const adapterInfo = allActionOptions.find((a) => a.adapterId === action.adapter);
  const isUnconfiguredIntegration = adapterInfo?.requiresIntegration && 
    !configuredIntegrations.includes(adapterInfo.adapterId.toUpperCase());
  
  // Check for missing group param when using MailerLite
  const isMissingGroup = action.adapter === 'mailerlite' && 
    (action.operation === 'add_to_group' || action.operation === 'remove_from_group') &&
    Object.keys(mailerliteGroups).length === 0;

  return (
    <div className={`bg-zinc-800/50 border rounded-lg p-4 space-y-4 ${
      isUnconfiguredIntegration || isMissingGroup 
        ? 'border-yellow-500/50' 
        : 'border-zinc-700'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-400">
            Action {index + 1}
          </span>
          {isUnconfiguredIntegration && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              Not configured
            </span>
          )}
          {isMissingGroup && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              No groups configured
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <svg
            className="w-5 h-5"
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Integration
          </label>
          <select
            value={action.adapter}
            onChange={(e) => onChange(index, 'adapter', e.target.value)}
            className={`w-full px-3 py-2 bg-zinc-900 border rounded text-white text-sm focus:outline-none focus:border-zinc-600 ${
              isUnconfiguredIntegration ? 'border-yellow-500/50' : 'border-zinc-700'
            }`}
          >
            <option value="">Select...</option>
            {actionOptions.map((a) => (
              <option key={a.adapterId} value={a.adapterId}>
                {a.adapterName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Operation
          </label>
          <select
            value={action.operation}
            onChange={(e) => onChange(index, 'operation', e.target.value)}
            disabled={!action.adapter}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-zinc-600 disabled:opacity-50"
          >
            <option value="">Select...</option>
            {availableOperations.map((op) => (
              <option key={op.name} value={op.name}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action-specific params */}
      {action.adapter === 'mailerlite' && action.operation === 'add_to_group' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Group
          </label>
          <select
            value={(action.params.group as string) || ''}
            onChange={(e) => onParamChange(index, 'group', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-zinc-600"
          >
            <option value="">Select group...</option>
            {Object.entries(mailerliteGroups).map(([key, group]) => (
              <option key={key} value={key}>
                {group.name} ({key})
              </option>
            ))}
          </select>
        </div>
      )}

      {action.adapter === 'mailerlite' && action.operation === 'remove_from_group' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Group
          </label>
          <select
            value={(action.params.group as string) || ''}
            onChange={(e) => onParamChange(index, 'group', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-zinc-600"
          >
            <option value="">Select group...</option>
            {Object.entries(mailerliteGroups).map(([key, group]) => (
              <option key={key} value={key}>
                {group.name} ({key})
              </option>
            ))}
          </select>
        </div>
      )}

      {action.adapter === 'revline' && action.operation === 'update_lead_stage' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Stage
          </label>
          <select
            value={(action.params.stage as string) || ''}
            onChange={(e) => onParamChange(index, 'stage', e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-zinc-600"
          >
            <option value="">Select stage...</option>
            <option value="CAPTURED">Captured</option>
            <option value="BOOKED">Booked</option>
            <option value="PAID">Paid</option>
            <option value="DEAD">Dead</option>
          </select>
        </div>
      )}

      {action.adapter === 'revline' && action.operation === 'create_lead' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Source (optional)
          </label>
          <input
            type="text"
            value={(action.params.source as string) || ''}
            onChange={(e) => onParamChange(index, 'source', e.target.value)}
            placeholder="e.g., landing, calendly"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      )}

      {action.adapter === 'revline' && action.operation === 'emit_event' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Event Type
          </label>
          <input
            type="text"
            value={(action.params.eventType as string) || ''}
            onChange={(e) => onParamChange(index, 'eventType', e.target.value)}
            placeholder="e.g., custom_event"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      )}
    </div>
  );
}

