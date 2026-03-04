'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BRANDING_SCHEMA, BOOKING_COPY_SCHEMA, SIGNUP_COPY_SCHEMA } from '@/app/_lib/templates';
import { 
  DEFAULT_SIGNUP_CONFIG,
  DEFAULT_THEME_MAPPING,
  DEFAULT_HEADER_STYLE,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_BRANDING,
  EXAMPLE_SIGNUP_PLAN,
  isValidHexColor, 
  isValidLogoUrl,
} from '@/app/_lib/config';
import type { SignupConfig, SignupPlan } from '@/app/_lib/types';
import { FormPreviewMock } from './_components/form-preview-mock';

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
 * - Build: Template-specific text and config (only for enabled templates)
 * 
 * Includes live mock preview for visual feedback (no API calls).
 */

// =============================================================================
// TYPES
// =============================================================================

interface FormConfig {
  enabled: boolean;
}

interface BrandingConfig {
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  color5?: string;
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
  footerEmail?: string;
}

interface CopyConfig {
  booking?: BookingCopyConfig;
}

interface FeaturesConfig {
  showPoweredBy?: boolean;
}

interface ThemeMapping {
  primary?: number;
  primaryHover?: number;
  background?: number;
  card?: number;
  text?: number;
  header?: number;
}

interface HeaderStyleConfig {
  variant?: 'pill' | 'plain';
  size?: 'sm' | 'base' | 'lg' | 'xl';
  bold?: boolean;
  italic?: boolean;
  textSize?: 'xs' | 'sm' | 'base' | 'lg';
  textWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

interface TextRoleStyle {
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

interface TypographyConfig {
  sectionHeader?: TextRoleStyle;
  pageTitle?: TextRoleStyle;
  body?: TextRoleStyle;
  label?: TextRoleStyle;
  caption?: TextRoleStyle;
}

interface RevlineMeta {
  forms: Record<string, FormConfig>;
  settings: {
    defaultSource?: string;
  };
  branding?: BrandingConfig;
  theme?: ThemeMapping;
  headerStyle?: HeaderStyleConfig;
  typography?: TypographyConfig;
  copy?: CopyConfig;
  features?: FeaturesConfig;
  signup?: SignupConfig;
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

type TabType = 'settings' | 'forms' | 'branding' | 'build';

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
  signup: undefined,
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
      signup: parsed.signup || undefined,
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
  const [showPreview, setShowPreview] = useState(true);
  const [previewForm, setPreviewForm] = useState<string>(''); // Which form to preview (empty = auto based on tab)
  
  // Resizable panel state
  const [editorWidth, setEditorWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Simple unsaved changes detection: compare serialized meta to value prop
  // value prop = what's saved in parent/database, meta = current editor state
  const hasUnsavedChanges = JSON.stringify(meta, null, 2) !== value;
  
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
        signup: parsed.signup || undefined,
      });
    } catch {
      // Invalid JSON, don't update meta
    }
  }

  // Get enabled form IDs for Build tab
  const enabledFormIds = Object.keys(meta.forms).filter(id => meta.forms[id]?.enabled);
  const hasEnabledForms = enabledFormIds.length > 0;
  
  // Selected form for Build tab (track which form is being edited)
  // Store raw selection in state, derive effective selection below
  const [selectedBuildFormRaw, setSelectedBuildForm] = useState<string>('');
  
  // Derive effective selected form: use raw selection if valid, else first enabled form
  const selectedBuildForm = enabledFormIds.includes(selectedBuildFormRaw) 
    ? selectedBuildFormRaw 
    : (enabledFormIds[0] || '');

  const tabs: { id: TabType; label: string; show: boolean }[] = [
    { id: 'settings', label: 'Settings', show: true },
    { id: 'forms', label: 'Forms', show: true },
    { id: 'branding', label: 'Branding', show: true },
    { id: 'build', label: 'Build', show: hasEnabledForms },
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
          style={isDragging ? { cursor: 'col-resize' } : undefined}
        >
          {/* Editor Panel */}
          <div 
            className="overflow-y-auto pr-2"
            style={{ width: showPreview && (activeTab === 'branding' || activeTab === 'build') && workspaceSlug ? `${editorWidth}%` : '100%' }}
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
              
              {activeTab === 'build' && hasEnabledForms && (
                <BuildTab 
                  meta={meta} 
                  updateMeta={updateMeta}
                  registeredForms={registeredForms}
                  selectedForm={selectedBuildForm}
                  onSelectForm={setSelectedBuildForm}
                />
              )}
              
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          </div>

          {/* Draggable Divider */}
          {showPreview && (activeTab === 'branding' || activeTab === 'build') && workspaceSlug && (
            <div
              className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-zinc-700/50 transition-colors"
              onMouseDown={() => setIsDragging(true)}
            >
              <div className="w-0.5 h-8 bg-zinc-700 group-hover:bg-zinc-500 rounded-full transition-colors" />
            </div>
          )}

          {/* Preview Panel */}
          {(activeTab === 'branding' || activeTab === 'build') && workspaceSlug && (
            <div 
              className="flex flex-col pl-2"
              style={{ width: showPreview ? `${100 - editorWidth}%` : 'auto' }}
            >
              {/* Preview Header */}
              <div className="text-xs text-zinc-500 mb-2 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span>Live Preview</span>
                  {showPreview && (
                    <span className="px-1.5 py-0.5 bg-zinc-700 text-zinc-300 rounded text-[10px]">
                      Preview
                    </span>
                  )}
                  {/* Form selector for preview */}
                  {showPreview && enabledFormIds.length > 0 && (
                    <select
                      value={previewForm || (activeTab === 'build' ? selectedBuildForm : enabledFormIds[0])}
                      onChange={(e) => setPreviewForm(e.target.value)}
                      className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-300 focus:border-amber-500/50 outline-none"
                    >
                      {enabledFormIds.map(formId => {
                        const formInfo = registeredForms.find(f => f.id === formId);
                        return (
                          <option key={formId} value={formId}>
                            {formInfo?.name || formId}
                          </option>
                        );
                      })}
                    </select>
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
                <div className="flex-1 overflow-hidden rounded border border-zinc-800 bg-white">
                  <div 
                    className="h-full overflow-auto"
                    style={{ 
                      transform: `scale(${previewZoom / 100})`,
                      transformOrigin: 'top left',
                      width: `${10000 / previewZoom}%`,
                      height: `${10000 / previewZoom}%`,
                    }}
                  >
                    <FormPreviewMock
                      branding={meta.branding}
                      theme={meta.theme}
                      headerStyle={meta.headerStyle}
                      typography={meta.typography}
                      copy={meta.copy?.booking}
                      workspaceName={workspaceSlug}
                      formType={(previewForm || selectedBuildForm || '').includes('signup') ? 'signup' : 'booking'}
                      signupConfig={meta.signup}
                    />
                  </div>
                </div>
              )}

              {showPreview && (
                <div className="mt-1 shrink-0 space-y-1">
                  {hasUnsavedChanges && (
                    <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Unsaved changes
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-600">
                    Drag divider to resize
                  </p>
                </div>
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
                    className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${
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
                    className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
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
// LOGO UPLOAD FIELD
// =============================================================================

function LogoUploadField({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (v: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size (500KB limit)
    if (file.size > 500 * 1024) {
      setError('Image must be under 500KB');
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const isDataUrl = value?.startsWith('data:');

  return (
    <div className="space-y-2">
      {/* Preview thumbnail if logo exists */}
      {value && (
        <div className="flex items-center gap-3 p-2 bg-zinc-900 rounded border border-zinc-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={value} 
            alt="Logo preview" 
            className="h-10 w-auto max-w-[120px] object-contain rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 truncate">
              {isDataUrl ? 'Uploaded image' : value}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
            title="Remove logo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Upload and URL input row */}
      <div className="flex gap-2">
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleFileChange} 
          className="hidden"
        />
        
        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-sm text-zinc-300 transition-colors flex items-center gap-2 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Upload
        </button>
        
        {/* URL input */}
        <input
          type="text"
          value={isDataUrl ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste https:// URL"
          className={`flex-1 px-3 py-2 bg-zinc-900 border rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors ${
            value && !isDataUrl && !isValidLogoUrl(value)
              ? 'border-red-500/50'
              : 'border-zinc-700'
          }`}
        />
      </div>
      
      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
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
            
            {field.type === 'url' && field.key === 'logo' && (
              <LogoUploadField
                value={(branding as Record<string, string>)[field.key] || ''}
                onChange={(value) => updateBranding(field.key as keyof BrandingConfig, value)}
              />
            )}
            
            {field.type === 'url' && field.key !== 'logo' && (
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
// BUILD TAB
// =============================================================================

function BuildTab({ 
  meta, 
  updateMeta,
  registeredForms,
  selectedForm,
  onSelectForm,
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
  registeredForms: RegisteredForm[];
  selectedForm: string;
  onSelectForm: (formId: string) => void;
}) {
  const enabledFormIds = Object.keys(meta.forms).filter(id => meta.forms[id]?.enabled);
  const selectedFormInfo = registeredForms.find(f => f.id === selectedForm);
  
  // Determine the form type for showing appropriate sections
  const isBookingForm = selectedForm.includes('booking') || selectedFormInfo?.type === 'booking';
  const isSignupForm = selectedForm.includes('signup') || selectedFormInfo?.type === 'signup';

  return (
    <div className="space-y-4">
      {/* Form Selector */}
      <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-zinc-300">Editing Form</h4>
            <p className="text-xs text-zinc-500 mt-0.5">Select which form to configure</p>
          </div>
          <select
            value={selectedForm}
            onChange={(e) => onSelectForm(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors min-w-[200px]"
          >
            {enabledFormIds.map(formId => {
              const formInfo = registeredForms.find(f => f.id === formId);
              return (
                <option key={formId} value={formId}>
                  {formInfo?.name || formId}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Form-specific Copy Section */}
      {isBookingForm && (
        <BookingCopySection meta={meta} updateMeta={updateMeta} />
      )}
      
      {isSignupForm && (
        <>
          <SignupCopySection meta={meta} updateMeta={updateMeta} />
          <SignupConfigSection meta={meta} updateMeta={updateMeta} />
        </>
      )}
      
      {/* Theme Mapping */}
      <ThemeSection meta={meta} updateMeta={updateMeta} />

      {/* Typography (includes header style) */}
      <TypographySection meta={meta} updateMeta={updateMeta} />

      {/* Fallback for unknown form types */}
      {!isBookingForm && !isSignupForm && selectedForm && (
        <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-500 text-center py-4">
            No configuration options available for this form type.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// THEME SECTION (for Build tab)
// =============================================================================

const THEME_SLOTS: { key: keyof Required<ThemeMapping>; label: string; description: string }[] = [
  { key: 'header', label: 'Header', description: 'Top navigation bar' },
  { key: 'primary', label: 'Accent', description: 'Buttons, headers, step indicator' },
  { key: 'primaryHover', label: 'Accent Hover', description: 'Hover state for buttons' },
  { key: 'background', label: 'Page Background', description: 'Page background' },
  { key: 'card', label: 'Card Background', description: 'Card and panel surfaces' },
  { key: 'text', label: 'Text', description: 'Body text and headings' },
];

function ThemeSection({
  meta,
  updateMeta,
}: {
  meta: RevlineMeta;
  updateMeta: (m: RevlineMeta) => void;
}) {
  const theme = meta.theme ?? {};
  const branding = meta.branding ?? {};

  const palette = [
    branding.color1 || DEFAULT_BRANDING.color1,
    branding.color2 || DEFAULT_BRANDING.color2,
    branding.color3 || DEFAULT_BRANDING.color3,
    branding.color4 || DEFAULT_BRANDING.color4,
    branding.color5 || DEFAULT_BRANDING.color5,
  ];

  const updateThemeSlot = (key: keyof ThemeMapping, index: number) => {
    updateMeta({
      ...meta,
      theme: { ...theme, [key]: index },
    });
  };

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-1">Theme</h4>
      <p className="text-xs text-zinc-500 mb-3">Assign palette colors to form elements</p>

      <div className="space-y-2">
        {THEME_SLOTS.map(({ key, label, description }) => {
          const selected = theme[key] ?? DEFAULT_THEME_MAPPING[key];

          return (
            <div key={key} className="flex items-center justify-between py-1">
              <div className="min-w-0">
                <span className="text-sm text-zinc-300">{label}</span>
                <span className="text-xs text-zinc-600 ml-2 hidden sm:inline">{description}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-3">
                {palette.map((color, i) => {
                  const idx = i + 1;
                  const isSelected = selected === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => updateThemeSlot(key, idx)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        isSelected
                          ? 'border-amber-400 scale-110 ring-1 ring-amber-400/40'
                          : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Color ${idx}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// TYPOGRAPHY SECTION (for Build tab)
// =============================================================================

const TYPO_ROLES: { key: keyof TypographyConfig; label: string; description: string }[] = [
  { key: 'sectionHeader', label: 'Section Header', description: 'Colored bar headings' },
  { key: 'pageTitle', label: 'Page Title', description: 'Success & confirmation titles' },
  { key: 'body', label: 'Body', description: 'General text & descriptions' },
  { key: 'label', label: 'Label', description: 'Form field labels' },
  { key: 'caption', label: 'Caption', description: 'Helper text & fine print' },
];

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'SM' },
  { value: 'base', label: 'Base' },
  { value: 'lg', label: 'LG' },
  { value: 'xl', label: 'XL' },
  { value: '2xl', label: '2XL' },
  { value: '3xl', label: '3XL' },
];

const WEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' },
];

const FONT_FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'system', label: 'System' },
];

function TypographySection({
  meta,
  updateMeta,
}: {
  meta: RevlineMeta;
  updateMeta: (m: RevlineMeta) => void;
}) {
  const typo = meta.typography ?? {};
  const hs = meta.headerStyle || {};

  const updateRole = (role: keyof TypographyConfig, field: keyof TextRoleStyle, value: string) => {
    updateMeta({
      ...meta,
      typography: {
        ...typo,
        [role]: { ...(typo[role] || {}), [field]: value },
      },
    });
  };

  const updateFontFamily = (value: string) => {
    updateMeta({
      ...meta,
      branding: { ...(meta.branding || {}), fontFamily: value as BrandingConfig['fontFamily'] },
    });
  };

  const updateHeaderStyle = (field: keyof HeaderStyleConfig, value: string | boolean) => {
    updateMeta({
      ...meta,
      headerStyle: { ...hs, [field]: value },
    });
  };

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-1">Typography</h4>
      <p className="text-xs text-zinc-500 mb-3">Font family and size/weight per text role</p>

      <div className="mb-4">
        <label className="text-xs text-zinc-400 mb-1 block">Font Family</label>
        <select
          value={meta.branding?.fontFamily || 'inter'}
          onChange={(e) => updateFontFamily(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
        >
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Text roles */}
      <div className="space-y-2">
        {TYPO_ROLES.map(({ key, label, description }) => {
          const role = typo[key] || {};
          const size = role.size ?? DEFAULT_TYPOGRAPHY[key].size;
          const weight = role.weight ?? DEFAULT_TYPOGRAPHY[key].weight;

          return (
            <div key={key} className="flex items-center justify-between gap-2 py-1">
              <div className="min-w-0 flex-1">
                <span className="text-sm text-zinc-300">{label}</span>
                <span className="text-xs text-zinc-600 ml-2 hidden sm:inline">{description}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={size}
                  onChange={(e) => updateRole(key, 'size', e.target.value)}
                  className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
                >
                  {SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={weight}
                  onChange={(e) => updateRole(key, 'weight', e.target.value)}
                  className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
                >
                  {WEIGHT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Header name style — divider */}
      <div className="border-t border-zinc-800 mt-4 pt-4">
        <h5 className="text-sm font-medium text-zinc-300 mb-1">Header Name</h5>
        <p className="text-xs text-zinc-500 mb-3">Workspace name in the top bar when no logo is set</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Style</label>
            <select
              value={hs.variant || DEFAULT_HEADER_STYLE.variant}
              onChange={(e) => updateHeaderStyle('variant', e.target.value)}
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
            >
              <option value="pill">Pill Badge</option>
              <option value="plain">Plain Text</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Size</label>
            <select
              value={hs.size || DEFAULT_HEADER_STYLE.size}
              onChange={(e) => updateHeaderStyle('size', e.target.value)}
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
            >
              <option value="sm">Small</option>
              <option value="base">Base</option>
              <option value="lg">Large</option>
              <option value="xl">XL</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hs.bold ?? DEFAULT_HEADER_STYLE.bold}
              onChange={(e) => updateHeaderStyle('bold', e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-sm text-zinc-300">Bold</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hs.italic ?? DEFAULT_HEADER_STYLE.italic}
              onChange={(e) => updateHeaderStyle('italic', e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-sm text-zinc-300">Italic</span>
          </label>
        </div>

        {/* Header right-side text */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-zinc-800/50">
          <div className="min-w-0 flex-1">
            <span className="text-sm text-zinc-300">Header Text</span>
            <span className="text-xs text-zinc-600 ml-2 hidden sm:inline">Right-side link/label</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={hs.textSize || DEFAULT_HEADER_STYLE.textSize}
              onChange={(e) => updateHeaderStyle('textSize', e.target.value)}
              className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
            >
              <option value="xs">XS</option>
              <option value="sm">SM</option>
              <option value="base">Base</option>
              <option value="lg">LG</option>
            </select>
            <select
              value={hs.textWeight || DEFAULT_HEADER_STYLE.textWeight}
              onChange={(e) => updateHeaderStyle('textWeight', e.target.value)}
              className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
            >
              {WEIGHT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BOOKING COPY SECTION (for Build tab)
// =============================================================================

function BookingCopySection({ 
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
      <h4 className="text-sm font-medium text-zinc-300 mb-3">Copy</h4>
      
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
          Reset copy to defaults
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SIGNUP COPY SECTION (for Build tab)
// =============================================================================

function SignupCopySection({ 
  meta, 
  updateMeta 
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
}) {
  const signupCopy = meta.signup?.copy || {};

  function updateCopy(field: string, value: string) {
    updateMeta({
      ...meta,
      signup: {
        ...meta.signup,
        enabled: meta.signup?.enabled ?? false,
        club: meta.signup?.club || DEFAULT_SIGNUP_CONFIG.club,
        plans: meta.signup?.plans || [],
        policies: meta.signup?.policies || DEFAULT_SIGNUP_CONFIG.policies,
        features: meta.signup?.features || DEFAULT_SIGNUP_CONFIG.features,
        copy: { ...signupCopy, [field]: value },
      },
    });
  }

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-3">Copy</h4>
      
      <div className="space-y-4">
        {SIGNUP_COPY_SCHEMA.fields.map(field => (
          <div key={field.key}>
            <label className="text-xs text-zinc-400 block mb-1.5">
              {field.label}
            </label>
            
            {field.multiline ? (
              <textarea
                value={(signupCopy as Record<string, string>)[field.key] || ''}
                onChange={(e) => updateCopy(field.key, e.target.value)}
                placeholder={field.placeholder || field.default}
                maxLength={field.maxLength}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors resize-none"
              />
            ) : (
              <input
                type="text"
                value={(signupCopy as Record<string, string>)[field.key] || ''}
                onChange={(e) => updateCopy(field.key, e.target.value)}
                placeholder={field.placeholder || field.default}
                maxLength={field.maxLength}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
              />
            )}
            
            <div className="flex justify-between mt-1">
              <p className="text-xs text-zinc-600">{field.description}</p>
              {field.maxLength && (
                <span className="text-xs text-zinc-600">
                  {((signupCopy as Record<string, string>)[field.key] || '').length}/{field.maxLength}
                </span>
              )}
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
            signup: meta.signup ? { ...meta.signup, copy: {} } : undefined
          })}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset copy to defaults
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SIGNUP CONFIG SECTION (for Build tab)
// =============================================================================

function SignupConfigSection({ 
  meta, 
  updateMeta 
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
}) {
  const signupConfig: SignupConfig = meta.signup || DEFAULT_SIGNUP_CONFIG;
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  
  // Update signup config
  const updateSignup = (updates: Partial<SignupConfig>) => {
    updateMeta({
      ...meta,
      signup: { ...signupConfig, ...updates },
    });
  };
  
  // Update club info
  const updateClub = (field: keyof SignupConfig['club'], value: string) => {
    updateSignup({
      club: { ...signupConfig.club, [field]: value },
    });
  };
  
  // Update policies
  const updatePolicy = (field: keyof SignupConfig['policies'], value: string) => {
    updateSignup({
      policies: { ...signupConfig.policies, [field]: value },
    });
  };
  
  // Update features
  const updateFeature = (field: keyof SignupConfig['features'], value: boolean) => {
    updateSignup({
      features: { ...signupConfig.features, [field]: value },
    });
  };
  
  // Add a new plan
  const addPlan = () => {
    const newPlan: SignupPlan = {
      ...EXAMPLE_SIGNUP_PLAN,
      id: `plan-${Date.now()}`,
      name: `New Plan ${signupConfig.plans.length + 1}`,
    };
    updateSignup({
      plans: [...signupConfig.plans, newPlan],
    });
    setEditingPlanIndex(signupConfig.plans.length);
  };
  
  // Update a plan
  const updatePlan = (index: number, updates: Partial<SignupPlan>) => {
    const newPlans = [...signupConfig.plans];
    newPlans[index] = { ...newPlans[index], ...updates };
    updateSignup({ plans: newPlans });
  };
  
  // Delete a plan
  const deletePlan = (index: number) => {
    const newPlans = signupConfig.plans.filter((_, i) => i !== index);
    updateSignup({ plans: newPlans });
    setEditingPlanIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-zinc-300">Signup Enabled</h4>
            <p className="text-xs text-zinc-500 mt-0.5">Enable the public signup form</p>
          </div>
          <button
            type="button"
            onClick={() => updateSignup({ enabled: !signupConfig.enabled })}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              signupConfig.enabled ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <span 
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                signupConfig.enabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
      
      {signupConfig.enabled && (
        <>
          {/* Club Info */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Club Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Club Name</label>
                <input
                  type="text"
                  value={signupConfig.club.name}
                  onChange={(e) => updateClub('name', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="Your Gym Name"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Address</label>
                <input
                  type="text"
                  value={signupConfig.club.address}
                  onChange={(e) => updateClub('address', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="123 Fitness Way"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">City</label>
                <input
                  type="text"
                  value={signupConfig.club.city}
                  onChange={(e) => updateClub('city', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="Anytown"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">State</label>
                  <input
                    type="text"
                    value={signupConfig.club.state}
                    onChange={(e) => updateClub('state', e.target.value.toUpperCase().slice(0, 2))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={signupConfig.club.zip}
                    onChange={(e) => updateClub('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                    placeholder="90210"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Plans */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-zinc-300">Membership Plans</h4>
              <button
                type="button"
                onClick={addPlan}
                className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
              >
                + Add Plan
              </button>
            </div>
            
            {signupConfig.plans.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No plans configured. Add a plan to get started.</p>
            ) : (
              <div className="space-y-2">
                {signupConfig.plans.map((plan, index) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg overflow-hidden ${
                      editingPlanIndex === index ? 'border-amber-500/50' : 'border-zinc-700'
                    }`}
                  >
                    {/* Plan header */}
                    <div
                      className="flex items-center justify-between p-3 bg-zinc-800/50 cursor-pointer"
                      onClick={() => setEditingPlanIndex(editingPlanIndex === index ? null : index)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">{plan.name}</span>
                        <span className="text-xs text-amber-400">${plan.price}/{plan.period === 'month' ? 'mo' : 'yr'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deletePlan(index); }}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Delete plan"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg
                          className={`w-4 h-4 text-zinc-400 transition-transform ${editingPlanIndex === index ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Plan editor */}
                    {editingPlanIndex === index && (
                      <div className="p-3 space-y-3 border-t border-zinc-700">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">Plan Name</label>
                            <input
                              type="text"
                              value={plan.name}
                              onChange={(e) => updatePlan(index, { name: e.target.value })}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Price</label>
                              <input
                                type="number"
                                value={plan.price}
                                onChange={(e) => updatePlan(index, { price: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Period</label>
                              <select
                                value={plan.period}
                                onChange={(e) => updatePlan(index, { period: e.target.value as 'month' | 'year' })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                              >
                                <option value="month">Monthly</option>
                                <option value="year">Yearly</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Image URL</label>
                          <input
                            type="text"
                            value={plan.image || ''}
                            onChange={(e) => updatePlan(index, { image: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                            placeholder="https://example.com/plan-image.jpg"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Promo Note</label>
                          <input
                            type="text"
                            value={plan.promoNote || ''}
                            onChange={(e) => updatePlan(index, { promoNote: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                            placeholder="e.g., $0 Enrollment Fee!"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Benefits (one per line)</label>
                          <textarea
                            value={plan.benefits.join('\n')}
                            onChange={(e) => updatePlan(index, { benefits: e.target.value.split('\n') })}
                            onBlur={(e) => updatePlan(index, { benefits: e.target.value.split('\n').filter(b => b.trim()) })}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none resize-none"
                            rows={4}
                            placeholder="Full gym access&#10;Locker room access&#10;Free fitness assessment"
                          />
                        </div>
                        
                        {/* Pricing Details */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-zinc-400">Pricing Details</label>
                            <button
                              type="button"
                              onClick={() => updatePlan(index, {
                                pricingDetails: [...plan.pricingDetails, { label: '', value: '' }],
                              })}
                              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                            >
                              + Add Row
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {plan.pricingDetails.map((detail, di) => (
                              <div key={di} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={detail.label}
                                  onChange={(e) => {
                                    const rows = [...plan.pricingDetails];
                                    rows[di] = { ...rows[di], label: e.target.value };
                                    updatePlan(index, { pricingDetails: rows });
                                  }}
                                  placeholder="Label"
                                  className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none"
                                />
                                <input
                                  type="text"
                                  value={detail.value}
                                  onChange={(e) => {
                                    const rows = [...plan.pricingDetails];
                                    rows[di] = { ...rows[di], value: e.target.value };
                                    updatePlan(index, { pricingDetails: rows });
                                  }}
                                  placeholder="Value"
                                  className="w-20 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none"
                                />
                                <input
                                  type="text"
                                  value={detail.strikethrough || ''}
                                  onChange={(e) => {
                                    const rows = [...plan.pricingDetails];
                                    rows[di] = { ...rows[di], strikethrough: e.target.value || undefined };
                                    updatePlan(index, { pricingDetails: rows });
                                  }}
                                  placeholder="Strike"
                                  className="w-16 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = plan.pricingDetails.filter((_, ri) => ri !== di);
                                    updatePlan(index, { pricingDetails: rows });
                                  }}
                                  className="text-zinc-600 hover:text-red-400 transition-colors text-sm px-1"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {plan.pricingDetails.length === 0 && (
                              <p className="text-xs text-zinc-600 italic">No pricing details — click + Add Row</p>
                            )}
                          </div>
                        </div>

                        {/* Plan disclaimer */}
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Plan Fine Print</label>
                          <input
                            type="text"
                            value={plan.disclaimer || ''}
                            onChange={(e) => updatePlan(index, { disclaimer: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                            placeholder="e.g., Cancellation requires 30-day notice"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">Due Today</label>
                            <input
                              type="number"
                              value={plan.paymentDetails.dueToday}
                              onChange={(e) => updatePlan(index, { 
                                paymentDetails: { ...plan.paymentDetails, dueToday: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">Recurring</label>
                            <input
                              type="number"
                              value={plan.paymentDetails.recurring}
                              onChange={(e) => updatePlan(index, { 
                                paymentDetails: { ...plan.paymentDetails, recurring: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">Fees</label>
                            <input
                              type="number"
                              value={plan.paymentDetails.fees}
                              onChange={(e) => updatePlan(index, { 
                                paymentDetails: { ...plan.paymentDetails, fees: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Policy Links */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Policy Links</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Privacy Policy URL</label>
                <input
                  type="url"
                  value={signupConfig.policies.privacy || ''}
                  onChange={(e) => updatePolicy('privacy', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="https://example.com/privacy"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Terms URL</label>
                <input
                  type="url"
                  value={signupConfig.policies.terms || ''}
                  onChange={(e) => updatePolicy('terms', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="https://example.com/terms"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Accessibility URL</label>
                <input
                  type="url"
                  value={signupConfig.policies.accessibility || ''}
                  onChange={(e) => updatePolicy('accessibility', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="https://example.com/accessibility"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cancellation URL</label>
                <input
                  type="url"
                  value={signupConfig.policies.cancellation || ''}
                  onChange={(e) => updatePolicy('cancellation', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="https://example.com/cancel"
                />
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Footer</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Page Disclaimer</label>
                <input
                  type="text"
                  value={signupConfig.copy?.disclaimer || ''}
                  onChange={(e) => updateSignup({
                    copy: { ...(signupConfig.copy || {}), disclaimer: e.target.value },
                  })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none"
                  placeholder="e.g., Results may vary from individual to individual."
                />
                <p className="text-xs text-zinc-600 mt-1">Shown at the bottom of every page with an asterisk</p>
              </div>
              <label className="flex items-center justify-between pt-1">
                <span className="text-sm text-zinc-300">Show &ldquo;Powered by RevLine&rdquo;</span>
                <input
                  type="checkbox"
                  checked={signupConfig.features.showPoweredBy ?? true}
                  onChange={(e) => updateFeature('showPoweredBy', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                />
              </label>
            </div>
          </div>

          {/* Features */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Features</h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Show Promo Code Field</span>
                <input
                  type="checkbox"
                  checked={signupConfig.features.showPromoCode ?? true}
                  onChange={(e) => updateFeature('showPromoCode', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Require SMS Consent</span>
                <input
                  type="checkbox"
                  checked={signupConfig.features.requireSmsConsent ?? true}
                  onChange={(e) => updateFeature('requireSmsConsent', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                />
              </label>
            </div>
          </div>
          
          {/* Reset to defaults */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => updateMeta({ 
                ...meta, 
                signup: DEFAULT_SIGNUP_CONFIG 
              })}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Reset all config to defaults
            </button>
          </div>
        </>
      )}
    </div>
  );
}

