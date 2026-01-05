'use client';

import { useState, useEffect } from 'react';
import { getRegisteredActions } from '@/app/_lib/actions';

/**
 * MailerLite group configuration
 */
interface MailerLiteGroup {
  id: string;
  name: string;
}

/**
 * MailerLite meta configuration
 */
interface MailerLiteMeta {
  groups: Record<string, MailerLiteGroup>;
  routing: Record<string, string | null>;
}

interface MailerLiteConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
  stripeProducts?: string[]; // Product names from Stripe integration
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: MailerLiteMeta = {
  groups: {},
  routing: {},
};

/**
 * Parse meta string to MailerLiteMeta, handling invalid JSON
 */
function parseMeta(value: string): MailerLiteMeta {
  if (!value.trim()) {
    return DEFAULT_CONFIG;
  }
  try {
    const parsed = JSON.parse(value);
    return {
      groups: parsed.groups || {},
      routing: parsed.routing || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Structured editor for MailerLite configuration
 * 
 * Features:
 * - Groups section: Add/edit/delete groups (key, name, MailerLite ID)
 * - Routing section: For each action, dropdown to select group (or "None")
 * - JSON toggle: Switch to raw JSON mode for power users
 */
export function MailerLiteConfigEditor({ 
  value, 
  onChange,
  error: externalError,
  stripeProducts = [],
}: MailerLiteConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<MailerLiteMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // New group form state
  const [newGroupKey, setNewGroupKey] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  
  // New route form state
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [newRouteAction, setNewRouteAction] = useState('');
  const [newRouteProgram, setNewRouteProgram] = useState('');
  
  // Delete confirmation state
  const [deleteGroupKey, setDeleteGroupKey] = useState<string | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState('');
  const [deleteRouteAction, setDeleteRouteAction] = useState<string | null>(null);
  const [deleteRouteConfirm, setDeleteRouteConfirm] = useState('');

  const actions = getRegisteredActions();

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      const newJson = JSON.stringify(meta, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // Switch to JSON mode
  function handleSwitchToJson() {
    setJsonText(JSON.stringify(meta, null, 2));
    setIsJsonMode(true);
    setJsonError(null);
  }

  // Switch to structured mode
  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({
        groups: parsed.groups || {},
        routing: parsed.routing || {},
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

  // Add a new group
  function handleAddGroup() {
    if (!newGroupKey.trim() || !newGroupId.trim()) return;
    
    const key = newGroupKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    setMeta(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [key]: {
          id: newGroupId.trim(),
          name: newGroupName.trim() || key,
        },
      },
    }));
    
    setNewGroupKey('');
    setNewGroupName('');
    setNewGroupId('');
  }

  // Remove a group (with confirmation)
  function confirmRemoveGroup(key: string) {
    const expectedText = `delete ${key}`;
    if (deleteGroupConfirm !== expectedText) return;
    
    setMeta(prev => {
      const newGroups = { ...prev.groups };
      delete newGroups[key];
      
      // Also remove any routing that references this group
      const newRouting = { ...prev.routing };
      for (const [action, groupKey] of Object.entries(newRouting)) {
        if (groupKey === key) {
          delete newRouting[action];
        }
      }
      
      return { groups: newGroups, routing: newRouting };
    });
    
    setDeleteGroupKey(null);
    setDeleteGroupConfirm('');
  }

  // Update group
  function handleUpdateGroup(key: string, field: 'id' | 'name', value: string) {
    setMeta(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [key]: {
          ...prev.groups[key],
          [field]: value,
        },
      },
    }));
  }

  // Update routing for an action
  function handleRoutingChange(action: string, groupKey: string) {
    setMeta(prev => ({
      ...prev,
      routing: {
        ...prev.routing,
        [action]: groupKey,
      },
    }));
  }

  // Add a new route
  function handleAddRoute() {
    if (!newRouteAction || groupKeys.length === 0) return;
    
    // Combine action + program for program-specific routing
    const fullAction = newRouteAction === 'lead.paid' && newRouteProgram.trim()
      ? `lead.paid:${newRouteProgram.trim()}`
      : newRouteAction;
    
    setMeta(prev => ({
      ...prev,
      routing: {
        ...prev.routing,
        [fullAction]: groupKeys[0], // Default to first group
      },
    }));
    
    setNewRouteAction('');
    setNewRouteProgram('');
    setShowAddRoute(false);
  }

  // Remove a route (with confirmation)
  function confirmRemoveRoute(action: string) {
    const expectedText = `delete ${action}`;
    if (deleteRouteConfirm !== expectedText) return;
    
    setMeta(prev => {
      const newRouting = { ...prev.routing };
      delete newRouting[action];
      return { ...prev, routing: newRouting };
    });
    
    setDeleteRouteAction(null);
    setDeleteRouteConfirm('');
  }

  const groupKeys = Object.keys(meta.groups);
  const configuredRoutes = Object.entries(meta.routing).filter(([, group]) => group !== null);
  const availableActions = actions.filter(a => !meta.routing[a.action]);
  const displayError = externalError || jsonError;

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
          rows={16}
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

      {/* Groups Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-3">MailerLite Groups</h4>
        
        {/* Existing groups */}
        <div className="space-y-2 mb-4">
          {groupKeys.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No groups configured. Add one below.</p>
          ) : (
            groupKeys.map((key) => (
              <div 
                key={key}
                className="flex items-center gap-2 p-3 bg-zinc-950 rounded border border-zinc-800"
              >
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Key</label>
                    <span className="text-sm font-mono text-zinc-300">{key}</span>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Name</label>
                    <input
                      type="text"
                      value={meta.groups[key].name}
                      onChange={(e) => handleUpdateGroup(key, 'name', e.target.value)}
                      className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">MailerLite ID</label>
                    <input
                      type="text"
                      value={meta.groups[key].id}
                      onChange={(e) => handleUpdateGroup(key, 'id', e.target.value)}
                      className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteGroupKey(key)}
                  className="text-red-400/80 hover:text-red-400 text-sm px-2"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add new group form */}
        <div className="flex items-end gap-2 p-3 bg-zinc-900/50 rounded border border-dashed border-zinc-700">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Key</label>
            <input
              type="text"
              value={newGroupKey}
              onChange={(e) => setNewGroupKey(e.target.value)}
              placeholder="welcome"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Name</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Welcome List"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">MailerLite Group ID</label>
            <input
              type="text"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              placeholder="123456789"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleAddGroup}
            disabled={!newGroupKey.trim() || !newGroupId.trim()}
            className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Routing Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-3">Action Routing</h4>
        <p className="text-xs text-zinc-500 mb-3">
          Configure which group subscribers are added to for each action.
        </p>
        
        {/* Configured routes */}
        <div className="space-y-2 mb-4">
          {configuredRoutes.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No routes configured. Add one below.</p>
          ) : (
            configuredRoutes.map(([action, groupKey]) => {
              const actionInfo = actions.find(a => a.action === action);
              const isCustomAction = !actionInfo;
              
              return (
                <div 
                  key={action}
                  className="flex items-center gap-4 p-3 bg-zinc-950 rounded border border-zinc-800"
                >
                  <div className="flex-1">
                    <span className="text-sm text-white">
                      {actionInfo?.name || action}
                    </span>
                    <span className="text-xs text-zinc-500 block">
                      {actionInfo?.description || (isCustomAction ? 'Custom action' : '')}
                    </span>
                  </div>
                  <div className="w-48">
                    <select
                      value={groupKey || ''}
                      onChange={(e) => handleRoutingChange(action, e.target.value)}
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                    >
                      {groupKeys.map((key) => (
                        <option key={key} value={key}>
                          {meta.groups[key].name} ({key})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteRouteAction(action)}
                    className="text-red-400/80 hover:text-red-400 text-sm px-2"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add route form */}
        {groupKeys.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">Add a group above before configuring routes.</p>
        ) : showAddRoute ? (
          <div className="p-3 bg-zinc-900/50 rounded border border-dashed border-zinc-700">
            <div className="flex items-end gap-2 mb-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 block mb-1">Action</label>
                <select
                  value={newRouteAction}
                  onChange={(e) => {
                    setNewRouteAction(e.target.value);
                    if (e.target.value !== 'lead.paid') {
                      setNewRouteProgram('');
                    }
                  }}
                  className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white"
                >
                  <option value="">Select action...</option>
                  {availableActions.map(({ action, name }) => (
                    <option key={action} value={action}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              {newRouteAction === 'lead.paid' && (
                <div className="w-40">
                  <label className="text-xs text-zinc-500 block mb-1">
                    Product <span className="text-zinc-600">(optional)</span>
                  </label>
                  {stripeProducts.length > 0 ? (
                    <select
                      value={newRouteProgram}
                      onChange={(e) => setNewRouteProgram(e.target.value)}
                      className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white"
                    >
                      <option value="">All payments</option>
                      {stripeProducts.map((product) => (
                        <option key={product} value={product}>
                          {product}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newRouteProgram}
                      onChange={(e) => setNewRouteProgram(e.target.value)}
                      placeholder="e.g., coaching"
                      className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white"
                    />
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleAddRoute}
                disabled={!newRouteAction}
                className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddRoute(false);
                  setNewRouteAction('');
                  setNewRouteProgram('');
                }}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            {newRouteAction === 'lead.paid' && (
              <p className="text-xs text-zinc-500">
                {stripeProducts.length > 0 
                  ? 'Select a product to route specific payments, or "All payments" for any purchase.'
                  : 'Configure products in your Stripe integration to enable the product dropdown.'}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddRoute(true)}
            className="text-sm text-zinc-400 hover:text-white border border-dashed border-zinc-700 px-3 py-2 rounded hover:border-zinc-600"
          >
            + Add Route
          </button>
        )}

        {/* Program-specific routing hint */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-200/80">
          <span className="text-blue-400">💡 Tip:</span> When adding a &quot;Lead Paid&quot; route, select a product 
          to route payments from specific Stripe products to different groups.
          {stripeProducts.length === 0 && (
            <span className="text-zinc-400 block mt-1">
              Add products in your Stripe integration to enable the product dropdown.
            </span>
          )}
        </div>
      </div>

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}

      {/* Delete Group Confirmation Modal */}
      {deleteGroupKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6 max-w-md w-full">
            <h4 className="text-lg font-semibold text-red-400/90 mb-2">Delete Group</h4>
            <p className="text-sm text-zinc-400 mb-3">
              This will remove the <span className="font-mono text-white">{deleteGroupKey}</span> group 
              and any routes using it.
            </p>
            <p className="text-xs text-zinc-300 mb-2">
              Type <span className="font-mono font-bold">delete {deleteGroupKey}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteGroupConfirm}
              onChange={(e) => setDeleteGroupConfirm(e.target.value)}
              placeholder={`delete ${deleteGroupKey}`}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => confirmRemoveGroup(deleteGroupKey)}
                disabled={deleteGroupConfirm !== `delete ${deleteGroupKey}`}
                className="flex-1 px-4 py-2 bg-red-600/80 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Delete Group
              </button>
              <button
                onClick={() => {
                  setDeleteGroupKey(null);
                  setDeleteGroupConfirm('');
                }}
                className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Route Confirmation Modal */}
      {deleteRouteAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6 max-w-md w-full">
            <h4 className="text-lg font-semibold text-red-400/90 mb-2">Delete Route</h4>
            <p className="text-sm text-zinc-400 mb-3">
              This will remove the routing for <span className="font-mono text-white">{deleteRouteAction}</span>.
            </p>
            <p className="text-xs text-zinc-300 mb-2">
              Type <span className="font-mono font-bold">delete {deleteRouteAction}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteRouteConfirm}
              onChange={(e) => setDeleteRouteConfirm(e.target.value)}
              placeholder={`delete ${deleteRouteAction}`}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => confirmRemoveRoute(deleteRouteAction)}
                disabled={deleteRouteConfirm !== `delete ${deleteRouteAction}`}
                className="flex-1 px-4 py-2 bg-red-600/80 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Delete Route
              </button>
              <button
                onClick={() => {
                  setDeleteRouteAction(null);
                  setDeleteRouteConfirm('');
                }}
                className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

