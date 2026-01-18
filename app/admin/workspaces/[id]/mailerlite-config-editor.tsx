'use client';

import { useState, useEffect } from 'react';

/**
 * MailerLite group configuration
 */
interface MailerLiteGroup {
  id: string;
  name: string;
}

/**
 * MailerLite meta configuration
 * Groups are referenced by key in workflow actions (e.g., add_to_group with group: "welcome")
 */
interface MailerLiteMeta {
  groups: Record<string, MailerLiteGroup>;
}

interface MailerLiteConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: MailerLiteMeta = {
  groups: {},
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
 * - JSON toggle: Switch to raw JSON mode for power users
 * 
 * Note: Action routing is now handled by the Workflows tab.
 * Groups defined here are referenced by key in workflow actions.
 */
export function MailerLiteConfigEditor({ 
  value, 
  onChange,
  error: externalError,
}: MailerLiteConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<MailerLiteMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // New group form state
  const [newGroupKey, setNewGroupKey] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  
  // Delete confirmation state
  const [deleteGroupKey, setDeleteGroupKey] = useState<string | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState('');

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
      return { groups: newGroups };
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

  const groupKeys = Object.keys(meta.groups);
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

      {/* Groups Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">MailerLite Groups</h4>
        <p className="text-xs text-zinc-500 mb-3">
          Define groups here. Use the <span className="text-zinc-400">Workflows</span> tab to configure when subscribers are added to each group.
        </p>
        
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

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}

      {/* Delete Group Confirmation Modal */}
      {deleteGroupKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-0 sm:p-4">
          <div className="bg-zinc-900 border-0 sm:border sm:border-red-500/30 rounded-none sm:rounded-lg p-4 sm:p-6 max-w-md w-full h-full sm:h-auto flex flex-col justify-center sm:block">
            <h4 className="text-lg font-semibold text-red-400/90 mb-2">Delete Group</h4>
            <p className="text-sm text-zinc-400 mb-3">
              This will remove the <span className="font-mono text-white">{deleteGroupKey}</span> group.
              Make sure no workflows reference this group.
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
    </div>
  );
}
