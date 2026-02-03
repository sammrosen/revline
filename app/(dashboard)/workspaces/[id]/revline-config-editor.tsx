'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BRANDING_SCHEMA, BOOKING_COPY_SCHEMA } from '@/app/_lib/templates';
import { DEFAULT_BRANDING, DEFAULT_BOOKING_COPY, isValidHexColor, isValidLogoUrl } from '@/app/_lib/config';

/**
 * Resolve a path template by replacing {slug} with actual workspace slug
 */
function resolveFormPath(pathTemplate: string, workspaceSlug: string): string {
  return pathTemplate.replace(/{slug}/g, workspaceSlug);
}

/**
 * RevLine configuration editor.
 * 
 * Tabs:
 * - Settings: Default source, general config
 * - Forms: Enable/disable forms for workflows
 * - Branding: Colors, logo, fonts
 * - Copy: Template-specific text (only for enabled templates)
 * 
 * Includes live preview iframe for visual feedback.
 */

// =============================================================================
// TYPES
// =============================================================================

interface FormConfig {
  enabled: boolean;
}

interface BrandingConfig {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  logo?: string;
  fontFamily?: 'inter' | 'poppins' | 'roboto' | 'system';
}

interface BookingCopyConfig {
  headline?: string;
  subhead?: string;
  submitButton?: string;
  successTitle?: string;
  successMessage?: string;
  footerText?: string;
}

interface CopyConfig {
  booking?: BookingCopyConfig;
}

interface FeaturesConfig {
  showPoweredBy?: boolean;
}

interface RevlineMeta {
  forms: Record<string, FormConfig>;
  settings: {
    defaultSource?: string;
  };
  branding?: BrandingConfig;
  copy?: CopyConfig;
  features?: FeaturesConfig;
}

interface FormTrigger {
  id: string;
  label: string;
  description?: string;
}

interface RegisteredForm {
  id: string;
  name: string;
  description: string;
  path: string;
  type: string;
  triggers: FormTrigger[];
}

export interface RevlineConfigEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integrationId?: string;
  workspaceId?: string;
  workspaceSlug?: string;
}

type TabType = 'settings' | 'forms' | 'branding' | 'copy';

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_CONFIG: RevlineMeta = {
  forms: {},
  settings: {
    defaultSource: '',
  },
  branding: {},
  copy: {},
  features: {
    showPoweredBy: true,
  },
};

function parseMeta(value: string): RevlineMeta {
  if (!value.trim()) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(value);
    return {
      forms: parsed.forms || {},
      settings: {
        defaultSource: parsed.settings?.defaultSource || '',
      },
      branding: parsed.branding || {},
      copy: parsed.copy || {},
      features: parsed.features || { showPoweredBy: true },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function RevlineConfigEditor({ 
  value, 
  onChange, 
  error,
  workspaceSlug,
}: RevlineConfigEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [meta, setMeta] = useState<RevlineMeta>(() => parseMeta(value));
  const [jsonText, setJsonText] = useState(value);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewError, setPreviewError] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  // Resizable panel state - deferred to avoid hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  const [editorWidth, setEditorWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mark as mounted after hydration
  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  // Form registry state
  const [registeredForms, setRegisteredForms] = useState<RegisteredForm[]>([]);

  // Fetch available forms from registry on mount
  useEffect(() => {
    fetch('/api/v1/forms')
      .then(res => res.json())
      .then(data => {
        if (data.forms) {
          setRegisteredForms(data.forms);
        }
      })
      .catch(() => {
        // Silent fail - forms list just won't show
      });
  }, []);

  // Handle panel resize dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 25% and 75%
      setEditorWidth(Math.max(25, Math.min(75, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Derive the display JSON from meta when in structured mode
  const displayJsonText = isJsonMode ? jsonText : JSON.stringify(meta, null, 2);

  // Update meta and notify parent
  const updateMeta = useCallback((newMeta: RevlineMeta) => {
    setMeta(newMeta);
    onChange(JSON.stringify(newMeta, null, 2));
    // Trigger preview refresh with debounce
    setPreviewKey(k => k + 1);
  }, [onChange]);

  // Toggle between JSON and structured mode
  function toggleJsonMode() {
    if (!isJsonMode) {
      setJsonText(JSON.stringify(meta, null, 2));
    }
    setIsJsonMode(!isJsonMode);
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    onChange(text);
    try {
      const parsed = JSON.parse(text);
      setMeta({
        forms: parsed.forms || {},
        settings: {
          defaultSource: parsed.settings?.defaultSource || '',
        },
        branding: parsed.branding || {},
        copy: parsed.copy || {},
        features: parsed.features || { showPoweredBy: true },
      });
    } catch {
      // Invalid JSON, don't update meta
    }
  }

  // Check if booking form is enabled (for showing copy tab)
  const hasBookingForm = Object.keys(meta.forms).some(id => 
    meta.forms[id]?.enabled && (id === 'booking' || id.includes('booking'))
  );

  const tabs: { id: TabType; label: string; show: boolean }[] = [
    { id: 'settings', label: 'Settings', show: true },
    { id: 'forms', label: 'Forms', show: true },
    { id: 'branding', label: 'Branding', show: true },
    { id: 'copy', label: 'Copy', show: hasBookingForm },
  ];

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleJsonMode}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isJsonMode ? '← Editor' : 'JSON →'}
        </button>
      </div>

      {isJsonMode ? (
        /* JSON Mode */
        <div className="max-w-3xl">
          <textarea
            value={displayJsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm min-h-[400px] outline-none focus:border-zinc-700"
            spellCheck={false}
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      ) : (
        /* Structured Editor with Resizable Panels */
        <div 
          ref={containerRef}
          className="flex h-[calc(100vh-280px)] min-h-[400px]"
          style={hasMounted && isDragging ? { cursor: 'col-resize' } : undefined}
        >
          {/* Editor Panel */}
          <div 
            className="overflow-y-auto pr-2"
            style={{ width: hasMounted && showPreview && (activeTab === 'branding' || activeTab === 'copy') && workspaceSlug ? `${editorWidth}%` : '100%' }}
          >
            <div className="space-y-4">
              {activeTab === 'settings' && (
                <SettingsTab 
                  meta={meta} 
                  updateMeta={updateMeta} 
                />
              )}
              
              {activeTab === 'forms' && (
                <FormsTab 
                  meta={meta} 
                  updateMeta={updateMeta}
                  registeredForms={registeredForms}
                  workspaceSlug={workspaceSlug}
                />
              )}
              
              {activeTab === 'branding' && (
                <BrandingTab 
                  meta={meta} 
                  updateMeta={updateMeta} 
                />
              )}
              
              {activeTab === 'copy' && hasBookingForm && (
                <CopyTab 
                  meta={meta} 
                  updateMeta={updateMeta} 
                />
              )}
              
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          </div>

          {/* Draggable Divider */}
          {showPreview && (activeTab === 'branding' || activeTab === 'copy') && workspaceSlug && (
            <div
              className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-zinc-700/50 transition-colors"
              onMouseDown={() => setIsDragging(true)}
            >
              <div className="w-0.5 h-8 bg-zinc-700 group-hover:bg-zinc-500 rounded-full transition-colors" />
            </div>
          )}

          {/* Preview Panel */}
          {(activeTab === 'branding' || activeTab === 'copy') && workspaceSlug && (
            <div 
              className="flex flex-col pl-2"
              style={{ width: hasMounted && showPreview ? `${100 - editorWidth}%` : 'auto' }}
            >
              {/* Preview Header */}
              <div className="text-xs text-zinc-500 mb-2 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span>Live Preview</span>
                  {showPreview && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                      Interactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {showPreview && (
                    <>
                      {/* Zoom Controls */}
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                        className="text-zinc-400 hover:text-zinc-300 p-1"
                        title="Zoom out"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-[10px] text-zinc-500 min-w-[32px] text-center">
                        {previewZoom}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                        className="text-zinc-400 hover:text-zinc-300 p-1"
                        title="Zoom in"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(100)}
                        className="text-zinc-400 hover:text-zinc-300 p-1 text-[10px]"
                        title="Reset zoom"
                      >
                        Reset
                      </button>
                      <div className="w-px h-3 bg-zinc-700 mx-1" />
                      <button
                        type="button"
                        onClick={() => setPreviewKey(k => k + 1)}
                        className="text-zinc-400 hover:text-zinc-300 p-1"
                        title="Refresh preview"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-zinc-400 hover:text-zinc-300 p-1"
                    title={showPreview ? 'Hide preview' : 'Show preview'}
                  >
                    {showPreview ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              {showPreview && (
                <div className="flex-1 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
                  {previewError ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs text-zinc-500">Preview unavailable</p>
                    </div>
                  ) : (
                    <div 
                      className="h-full overflow-auto"
                      style={{ 
                        transform: `scale(${previewZoom / 100})`,
                        transformOrigin: 'top left',
                        width: `${10000 / previewZoom}%`,
                        height: `${10000 / previewZoom}%`,
                      }}
                    >
                      <iframe
                        key={previewKey}
                        src={`/public/${workspaceSlug}/book?preview=true`}
                        className="w-full h-full bg-white"
                        style={{ minHeight: '800px' }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        onError={() => setPreviewError(true)}
                      />
                    </div>
                  )}
                </div>
              )}

              {showPreview && (
                <p className="text-[10px] text-zinc-600 mt-1 shrink-0">
                  Drag divider to resize • Fully interactive
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SETTINGS TAB
// =============================================================================

function SettingsTab({ 
  meta, 
  updateMeta 
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-3">General Settings</h4>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Default Source
            </label>
            <input
              type="text"
              value={meta.settings.defaultSource || ''}
              onChange={(e) => updateMeta({
                ...meta,
                settings: { ...meta.settings, defaultSource: e.target.value },
              })}
              placeholder="e.g., landing, website"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Used when no source is specified in form submissions
            </p>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Show &quot;Powered by RevLine&quot;
            </label>
            <button
              type="button"
              onClick={() => updateMeta({
                ...meta,
                features: { 
                  ...meta.features, 
                  showPoweredBy: !meta.features?.showPoweredBy 
                },
              })}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                meta.features?.showPoweredBy !== false ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <span 
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  meta.features?.showPoweredBy !== false ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FORMS TAB
// =============================================================================

function FormsTab({ 
  meta, 
  updateMeta,
  registeredForms,
  workspaceSlug,
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
  registeredForms: RegisteredForm[];
  workspaceSlug?: string;
}) {
  function enableForm(formId: string) {
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { enabled: true },
      },
    });
  }

  function toggleForm(formId: string) {
    const current = meta.forms[formId];
    updateMeta({
      ...meta,
      forms: {
        ...meta.forms,
        [formId]: { enabled: !current?.enabled },
      },
    });
  }

  function removeForm(formId: string) {
    const newForms = { ...meta.forms };
    delete newForms[formId];
    updateMeta({ ...meta, forms: newForms });
  }

  const enabledFormIds = Object.keys(meta.forms);
  const availableForms = registeredForms.filter(f => !meta.forms[f.id]);

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-3">Enabled Forms</h4>
      
      {enabledFormIds.length === 0 ? (
        <p className="text-sm text-zinc-500 italic py-2">
          No forms enabled. Select from available forms below.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {enabledFormIds.map((formId) => {
            const form = meta.forms[formId];
            const registeredForm = registeredForms.find(f => f.id === formId);
            const isRegistered = !!registeredForm;
            
            return (
              <div 
                key={formId}
                className={`p-3 bg-zinc-900 rounded border ${
                  isRegistered ? 'border-zinc-800' : 'border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleForm(formId)}
                    className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                      form.enabled ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span 
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        form.enabled ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-white">
                        {registeredForm?.name || formId}
                      </span>
                      {isRegistered ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                          {registeredForm.type}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                          not registered
                        </span>
                      )}
                    </div>
                    {registeredForm?.path && workspaceSlug && (
                      <a
                        href={resolveFormPath(registeredForm.path, workspaceSlug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-500 hover:text-amber-400 transition-colors flex items-center gap-1 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {resolveFormPath(registeredForm.path, workspaceSlug)}
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeForm(formId)}
                    className="text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove form"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {registeredForm?.triggers?.length ? (
                  <div className="mt-2 pt-2 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-zinc-500">triggers:</span>
                      {registeredForm.triggers.map(t => (
                        <span 
                          key={t.id} 
                          className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded font-mono" 
                          title={t.description || t.label}
                        >
                          {t.id}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      
      {registeredForms.length > 0 && (
        <div className="pt-3 border-t border-zinc-800/50">
          <p className="text-xs text-zinc-500 mb-2">Available forms:</p>
          {availableForms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableForms.map(form => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => enableForm(form.id)}
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors flex items-center gap-1.5"
                  title={`${form.description}\n\nTriggers: ${form.triggers?.map(t => t.id).join(', ') || 'none'}`}
                >
                  <span className="text-green-400">+</span>
                  <span className="font-medium">{form.name}</span>
                  <span className="text-zinc-500">({form.type})</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-zinc-600 italic">All registered forms are enabled</span>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BRANDING TAB
// =============================================================================

function BrandingTab({ 
  meta, 
  updateMeta 
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
}) {
  const branding = meta.branding || {};

  function updateBranding(field: keyof BrandingConfig, value: string) {
    updateMeta({
      ...meta,
      branding: { ...branding, [field]: value },
    });
  }

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-3">Branding</h4>
      
      <div className="space-y-4">
        {BRANDING_SCHEMA.map(field => (
          <div key={field.key}>
            <label className="text-xs text-zinc-400 block mb-1.5">
              {field.label}
            </label>
            
            {field.type === 'color' && (
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(branding as Record<string, string>)[field.key] || field.default}
                  onChange={(e) => updateBranding(field.key as keyof BrandingConfig, e.target.value)}
                  className="w-10 h-10 rounded border border-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={(branding as Record<string, string>)[field.key] || ''}
                  onChange={(e) => updateBranding(field.key as keyof BrandingConfig, e.target.value)}
                  placeholder={field.default}
                  className={`flex-1 px-3 py-2 bg-zinc-900 border rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors ${
                    (branding as Record<string, string>)[field.key] && !isValidHexColor((branding as Record<string, string>)[field.key])
                      ? 'border-red-500/50'
                      : 'border-zinc-700'
                  }`}
                />
              </div>
            )}
            
            {field.type === 'url' && (
              <input
                type="text"
                value={(branding as Record<string, string>)[field.key] || ''}
                onChange={(e) => updateBranding(field.key as keyof BrandingConfig, e.target.value)}
                placeholder={field.placeholder}
                className={`w-full px-3 py-2 bg-zinc-900 border rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors ${
                  (branding as Record<string, string>)[field.key] && !isValidLogoUrl((branding as Record<string, string>)[field.key])
                    ? 'border-red-500/50'
                    : 'border-zinc-700'
                }`}
              />
            )}
            
            {field.type === 'select' && field.options && (
              <select
                value={(branding as Record<string, string>)[field.key] || field.default}
                onChange={(e) => updateBranding(field.key as keyof BrandingConfig, e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
              >
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            
            <p className="text-xs text-zinc-600 mt-1">{field.description}</p>
          </div>
        ))}
      </div>
      
      {/* Reset to defaults */}
      <div className="mt-4 pt-4 border-t border-zinc-800/50">
        <button
          type="button"
          onClick={() => updateMeta({ ...meta, branding: {} })}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// COPY TAB
// =============================================================================

function CopyTab({ 
  meta, 
  updateMeta 
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
}) {
  const bookingCopy = meta.copy?.booking || {};

  function updateCopy(field: keyof BookingCopyConfig, value: string) {
    updateMeta({
      ...meta,
      copy: {
        ...meta.copy,
        booking: { ...bookingCopy, [field]: value },
      },
    });
  }

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-3">Booking Page Copy</h4>
      
      <div className="space-y-4">
        {BOOKING_COPY_SCHEMA.fields.map(field => (
          <div key={field.key}>
            <label className="text-xs text-zinc-400 block mb-1.5">
              {field.label}
            </label>
            
            {field.multiline ? (
              <textarea
                value={(bookingCopy as Record<string, string>)[field.key] || ''}
                onChange={(e) => updateCopy(field.key as keyof BookingCopyConfig, e.target.value)}
                placeholder={field.placeholder || field.default}
                maxLength={field.maxLength}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors resize-none"
              />
            ) : (
              <input
                type="text"
                value={(bookingCopy as Record<string, string>)[field.key] || ''}
                onChange={(e) => updateCopy(field.key as keyof BookingCopyConfig, e.target.value)}
                placeholder={field.placeholder || field.default}
                maxLength={field.maxLength}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
              />
            )}
            
            <div className="flex justify-between mt-1">
              <p className="text-xs text-zinc-600">{field.description}</p>
              <span className="text-xs text-zinc-600">
                {((bookingCopy as Record<string, string>)[field.key] || '').length}/{field.maxLength}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Reset to defaults */}
      <div className="mt-4 pt-4 border-t border-zinc-800/50">
        <button
          type="button"
          onClick={() => updateMeta({ 
            ...meta, 
            copy: { ...meta.copy, booking: {} } 
          })}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
