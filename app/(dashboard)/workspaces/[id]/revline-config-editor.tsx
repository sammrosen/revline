'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BRANDING_SCHEMA, BOOKING_COPY_SCHEMA, SIGNUP_COPY_SCHEMA, LANDING_COPY_SCHEMA } from '@/app/_lib/templates';
import { 
  DEFAULT_SIGNUP_CONFIG,
  DEFAULT_THEME_MAPPING,
  DEFAULT_HEADER_STYLE,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_BRANDING,
  DEFAULT_LANDING_COPY,
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

interface LandingImageEntry {
  url: string;
  position?: string;
}

interface LandingCopyConfig {
  heroHeadline?: string;
  heroSubhead?: string;
  heroCtaText?: string;
  heroCtaLink?: string;
  heroBackgroundImage?: string;
  heroBackgroundPosition?: string;
  heroBackgroundSize?: string;
  phoneNumber?: string;
  servicesTitle?: string;
  services?: Array<{ title: string; description: string; image?: string; ctaLink?: string }>;
  images?: Array<string | LandingImageEntry>;
  contactTitle?: string;
  contactSubhead?: string;
  contactSubmitText?: string;
  contactSuccessMessage?: string;
  consentText?: string;
  formFields?: Array<{ id: string; label: string; type: 'text' | 'email' | 'tel' | 'textarea'; required?: boolean; placeholder?: string }>;
  footerText?: string;
  footerEmail?: string;
  sections?: { hero?: boolean; services?: boolean; gallery?: boolean; footer?: boolean };
}

interface CopyConfig {
  booking?: BookingCopyConfig;
  landing?: LandingCopyConfig;
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

interface PageStyleOverrides {
  typography?: TypographyConfig;
  headerStyle?: HeaderStyleConfig;
  logoSize?: number;
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
  pageStyles?: Record<string, PageStyleOverrides>;
  copy?: CopyConfig;
  features?: FeaturesConfig;
  signup?: SignupConfig;
  webchat?: {
    agentId: string;
    enabled: boolean;
    collectEmail?: boolean;
  };
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
  agents?: Record<string, string>;
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
      theme: parsed.theme,
      headerStyle: parsed.headerStyle,
      typography: parsed.typography,
      pageStyles: parsed.pageStyles,
      copy: parsed.copy || {},
      features: parsed.features || { showPoweredBy: true },
      signup: parsed.signup || undefined,
      webchat: parsed.webchat,
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
  agents,
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
                  agents={agents}
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
                    {(() => {
                      const pft = (previewForm || selectedBuildForm || '').includes('landing')
                        ? 'landing'
                        : (previewForm || selectedBuildForm || '').includes('signup')
                          ? 'signup'
                          : 'booking';
                      const ps = meta.pageStyles?.[pft];
                      return (
                        <FormPreviewMock
                          branding={meta.branding}
                          theme={meta.theme}
                          headerStyle={ps?.headerStyle ?? meta.headerStyle}
                          typography={ps?.typography ?? meta.typography}
                          logoSize={ps?.logoSize}
                          copy={meta.copy?.booking}
                          landingCopy={meta.copy?.landing}
                          workspaceName={workspaceSlug}
                          formType={pft}
                          signupConfig={meta.signup}
                          webchat={meta.webchat}
                        />
                      );
                    })()}
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

const IMAGE_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const MAX_UPLOAD_MB = 10;

const IMAGE_LIMITS = {
  logo:       { maxDim: 512,  maxBytes: 400_000, quality: 0.85 },
  hero:       { maxDim: 1920, maxBytes: 1_500_000, quality: 0.75 },
  gallery:    { maxDim: 1280, maxBytes: 600_000, quality: 0.75 },
  service:    { maxDim: 800,  maxBytes: 400_000, quality: 0.75 },
  image:      { maxDim: 1280, maxBytes: 800_000, quality: 0.8 },
} as const;

type ImagePreset = keyof typeof IMAGE_LIMITS;

function compressImage(
  file: File,
  preset: ImagePreset = 'image',
): Promise<string> {
  const { maxDim, maxBytes, quality } = IMAGE_LIMITS[preset];
  const preserveAlpha = (preset === 'logo') && (file.type === 'image/png' || file.type === 'image/webp');

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      if (preserveAlpha) {
        const result = canvas.toDataURL('image/png');
        if (result.length > maxBytes) {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(result);
        }
        return;
      }

      let q = quality;
      let result = canvas.toDataURL('image/jpeg', q);
      while (result.length > maxBytes && q > 0.3) {
        q -= 0.1;
        result = canvas.toDataURL('image/jpeg', q);
      }
      resolve(result);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

function ImageUploadField({
  value,
  onChange,
  preset = 'image',
  previewHeight = 'h-10',
  previewAspect,
  previewBgClass,
  label = 'image',
}: {
  value: string;
  onChange: (v: string) => void;
  preset?: ImagePreset;
  previewHeight?: string;
  previewAspect?: string;
  previewBgClass?: string;
  label?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_UPLOAD_MB}MB`);
      return;
    }

    try {
      setCompressing(true);
      const dataUrl = await compressImage(file, preset);
      onChange(dataUrl);
    } catch {
      setError('Failed to process image');
    } finally {
      setCompressing(false);
    }
  };

  const isDataUrl = value?.startsWith('data:');

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-3 p-2 bg-zinc-900 rounded border border-zinc-700">
          <div className={previewBgClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={`${label} preview`}
              className={`${previewHeight} ${previewAspect ?? 'w-auto max-w-[120px] object-cover'} rounded`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 truncate">
              {isDataUrl ? 'Uploaded image' : value}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
            title={`Remove ${label}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={compressing}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 rounded text-sm text-zinc-300 transition-colors flex items-center gap-2 shrink-0"
        >
          {IMAGE_ICON}
          {compressing ? 'Compressing…' : 'Upload'}
        </button>

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

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

function LogoUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <ImageUploadField value={value} onChange={onChange} preset="logo" label="logo" previewAspect="w-auto max-w-[120px] object-contain" previewBgClass="bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23e5e7eb%22%2F%3E%3Crect%20x%3D%228%22%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23e5e7eb%22%2F%3E%3Crect%20x%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3Crect%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E')] rounded" />;
}

function GalleryAddImage({ onAdd }: { onAdd: (url: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_UPLOAD_MB}MB`);
      return;
    }

    try {
      setCompressing(true);
      const dataUrl = await compressImage(file, 'gallery');
      onAdd(dataUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setError('Failed to process image');
    } finally {
      setCompressing(false);
    }
  };

  const handleUrlAdd = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isValidLogoUrl(trimmed)) {
      setError('Enter a valid https:// URL');
      return;
    }
    setError(null);
    onAdd(trimmed);
    setUrlInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={compressing}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 rounded text-sm text-zinc-300 transition-colors flex items-center gap-2 shrink-0"
        >
          {IMAGE_ICON}
          {compressing ? 'Compressing…' : 'Upload'}
        </button>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlAdd(); } }}
          placeholder="Or paste https:// image URL"
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors"
        />
        {urlInput.trim() && (
          <button
            type="button"
            onClick={handleUrlAdd}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded text-sm text-white transition-colors shrink-0"
          >
            Add
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
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
  agents,
}: { 
  meta: RevlineMeta; 
  updateMeta: (m: RevlineMeta) => void;
  registeredForms: RegisteredForm[];
  selectedForm: string;
  onSelectForm: (formId: string) => void;
  agents?: Record<string, string>;
}) {
  const enabledFormIds = Object.keys(meta.forms).filter(id => meta.forms[id]?.enabled);
  const selectedFormInfo = registeredForms.find(f => f.id === selectedForm);
  
  // Determine the form type for showing appropriate sections
  const isBookingForm = selectedForm.includes('booking') || selectedFormInfo?.type === 'booking';
  const isSignupForm = selectedForm.includes('signup') || selectedFormInfo?.type === 'signup';
  const isLandingForm = selectedForm.includes('landing') || selectedFormInfo?.type === 'landing';

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

      {/* Form-specific Copy + Typography Section */}
      {isBookingForm && (
        <>
          <BookingCopySection meta={meta} updateMeta={updateMeta} />
          <LogoSizeControl meta={meta} updateMeta={updateMeta} formType="booking" />
          <TypographySection meta={meta} updateMeta={updateMeta} formType="booking" />
        </>
      )}
      
      {isSignupForm && (
        <>
          <SignupCopySection meta={meta} updateMeta={updateMeta} />
          <SignupConfigSection meta={meta} updateMeta={updateMeta} />
          <LogoSizeControl meta={meta} updateMeta={updateMeta} formType="signup" />
          <TypographySection meta={meta} updateMeta={updateMeta} formType="signup" />
        </>
      )}

      {isLandingForm && (
        <>
          <LandingBuildSection meta={meta} updateMeta={updateMeta} agents={agents} />
          <LogoSizeControl meta={meta} updateMeta={updateMeta} formType="landing" />
          <TypographySection meta={meta} updateMeta={updateMeta} formType="landing" />
        </>
      )}
      
      {/* Theme Mapping */}
      <ThemeSection meta={meta} updateMeta={updateMeta} />

      {/* Fallback for unknown form types */}
      {!isBookingForm && !isSignupForm && !isLandingForm && selectedForm && (
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
  formType,
}: {
  meta: RevlineMeta;
  updateMeta: (m: RevlineMeta) => void;
  formType: string;
}) {
  const ps = meta.pageStyles?.[formType];
  const typo = ps?.typography ?? {};
  const hs = ps?.headerStyle || {};

  const updatePageStyle = (updates: Partial<PageStyleOverrides>) => {
    updateMeta({
      ...meta,
      pageStyles: {
        ...meta.pageStyles,
        [formType]: { ...ps, ...updates },
      },
    });
  };

  const updateRole = (role: keyof TypographyConfig, field: keyof TextRoleStyle, value: string) => {
    updatePageStyle({
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
    updatePageStyle({
      headerStyle: { ...hs, [field]: value },
    });
  };

  const showHeaderText = formType !== 'landing';

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

      {/* Header name style */}
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

        {showHeaderText && (
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
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LOGO SIZE STEPPER (for Build tab — per-form)
// =============================================================================

const LOGO_SIZE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const LOGO_SIZE_LABELS: Record<number, string> = {
  0.5: 'XS', 0.75: 'S', 1: 'M', 1.25: 'L', 1.5: 'XL', 1.75: 'XXL', 2: 'Max',
};

function LogoSizeControl({
  meta,
  updateMeta,
  formType,
}: {
  meta: RevlineMeta;
  updateMeta: (m: RevlineMeta) => void;
  formType: string;
}) {
  const ps = meta.pageStyles?.[formType];
  const current = ps?.logoSize ?? 1;
  const idx = LOGO_SIZE_STEPS.indexOf(current as typeof LOGO_SIZE_STEPS[number]);
  const stepIdx = idx === -1 ? 2 : idx; // default to index 2 (1 = "M")

  const setLogoSize = (size: number) => {
    updateMeta({
      ...meta,
      pageStyles: {
        ...meta.pageStyles,
        [formType]: { ...ps, logoSize: size },
      },
    });
  };

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-1">Logo Size</h4>
      <p className="text-xs text-zinc-500 mb-3">Adjust the logo size on the public page</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={stepIdx <= 0}
          onClick={() => setLogoSize(LOGO_SIZE_STEPS[stepIdx - 1])}
          className="w-8 h-8 flex items-center justify-center rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-medium"
        >
          −
        </button>
        <span className="text-sm text-zinc-200 font-medium w-8 text-center">
          {LOGO_SIZE_LABELS[current] ?? `${current}x`}
        </span>
        <button
          type="button"
          disabled={stepIdx >= LOGO_SIZE_STEPS.length - 1}
          onClick={() => setLogoSize(LOGO_SIZE_STEPS[stepIdx + 1])}
          className="w-8 h-8 flex items-center justify-center rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-medium"
        >
          +
        </button>
        <span className="text-xs text-zinc-500 ml-1">({current}×)</span>
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

// =============================================================================
// COLLAPSIBLE SECTION (shared helper for Build tab)
// =============================================================================

function CollapsibleSection({
  title,
  enabled,
  onToggle,
  defaultOpen = false,
  alwaysOn = false,
  children,
}: {
  title: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  defaultOpen?: boolean;
  alwaysOn?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isEnabled = alwaysOn || enabled !== false;

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-zinc-300">{title}</span>
        </div>
        {!alwaysOn && onToggle && (
          <div
            onClick={(e) => { e.stopPropagation(); onToggle(!isEnabled); }}
            className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
              isEnabled ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                isEnabled ? 'left-4' : 'left-0.5'
              }`}
            />
          </div>
        )}
      </button>
      {open && (
        <div className={`px-4 pb-4 ${!isEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LANDING BUILD SECTION (for Build tab -- collapsible groups)
// =============================================================================

const HERO_FIELDS = ['heroHeadline', 'heroSubhead', 'heroCtaText', 'phoneNumber', 'heroBackgroundImage'];
const FORM_FIELDS_KEYS = ['contactTitle', 'contactSubhead', 'contactSubmitText', 'contactSuccessMessage', 'consentText'];
const FOOTER_FIELDS = ['footerText', 'footerEmail'];

const IMAGE_POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top left', label: 'Top Left' },
  { value: 'top right', label: 'Top Right' },
  { value: 'bottom left', label: 'Bottom Left' },
  { value: 'bottom right', label: 'Bottom Right' },
];

const FIELD_TYPE_OPTIONS: { value: 'text' | 'email' | 'tel' | 'textarea'; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Long Text' },
];

const MAX_FORM_FIELDS = 10;
const MAX_GALLERY_IMAGES = 9;
const MAX_SERVICES = 6;

function LandingBuildSection({
  meta,
  updateMeta,
  agents,
}: {
  meta: RevlineMeta;
  updateMeta: (m: RevlineMeta) => void;
  agents?: Record<string, string>;
}) {
  const fieldIdCounter = useRef(0);
  const landingCopy = meta.copy?.landing || {};
  const sections = landingCopy.sections || { hero: true, services: true, gallery: true, footer: true };
  const fields = landingCopy.formFields || DEFAULT_LANDING_COPY.formFields;
  const galleryImages: LandingImageEntry[] = (landingCopy.images || []).map(
    entry => typeof entry === 'string' ? { url: entry } : entry
  );

  function updateCopy(field: string, value: string) {
    updateMeta({
      ...meta,
      copy: { ...meta.copy, landing: { ...landingCopy, [field]: value } },
    });
  }

  function updateSections(updates: Partial<NonNullable<LandingCopyConfig['sections']>>) {
    updateMeta({
      ...meta,
      copy: { ...meta.copy, landing: { ...landingCopy, sections: { ...sections, ...updates } } },
    });
  }

  function updateFields(newFields: LandingCopyConfig['formFields']) {
    updateMeta({
      ...meta,
      copy: { ...meta.copy, landing: { ...landingCopy, formFields: newFields } },
    });
  }

  function updateFieldAt(index: number, updates: Partial<NonNullable<LandingCopyConfig['formFields']>[number]>) {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    updateFields(next);
  }

  function addField() {
    if (fields.length >= MAX_FORM_FIELDS) return;
    updateFields([
      ...fields,
      { id: `field_${++fieldIdCounter.current}`, label: 'New Field', type: 'text' as const, required: false, placeholder: '' },
    ]);
  }

  function removeField(index: number) {
    updateFields(fields.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    updateFields(next);
  }

  function updateGalleryImages(images: LandingImageEntry[]) {
    updateMeta({
      ...meta,
      copy: { ...meta.copy, landing: { ...landingCopy, images } },
    });
  }

  function addGalleryImage(url: string) {
    if (galleryImages.length >= MAX_GALLERY_IMAGES) return;
    updateGalleryImages([...galleryImages, { url }]);
  }

  function removeGalleryImage(index: number) {
    updateGalleryImages(galleryImages.filter((_, i) => i !== index));
  }

  function moveGalleryImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= galleryImages.length) return;
    const next = [...galleryImages];
    [next[index], next[target]] = [next[target], next[index]];
    updateGalleryImages(next);
  }

  function updateGalleryImagePosition(index: number, position: string) {
    const next = [...galleryImages];
    next[index] = { ...next[index], position };
    updateGalleryImages(next);
  }

  type ServiceEntry = { title: string; description: string; image?: string; ctaLink?: string };
  const services: ServiceEntry[] = landingCopy.services || DEFAULT_LANDING_COPY.services;

  function updateServices(next: ServiceEntry[]) {
    updateMeta({
      ...meta,
      copy: { ...meta.copy, landing: { ...landingCopy, services: next } },
    });
  }

  function updateServiceAt(index: number, updates: Partial<ServiceEntry>) {
    const next = [...services];
    next[index] = { ...next[index], ...updates };
    updateServices(next);
  }

  function addService() {
    if (services.length >= MAX_SERVICES) return;
    updateServices([...services, { title: 'New Service', description: 'A brief description of this service.' }]);
  }

  function removeService(index: number) {
    updateServices(services.filter((_, i) => i !== index));
  }

  function moveService(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= services.length) return;
    const next = [...services];
    [next[index], next[target]] = [next[target], next[index]];
    updateServices(next);
  }

  function renderCopyField(key: string) {
    const schema = LANDING_COPY_SCHEMA.fields.find(f => f.key === key);
    if (!schema) return null;
    const val = (landingCopy as Record<string, string>)[key] || '';

    if (key === 'heroBackgroundImage') {
      return (
        <div key={key} className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">{schema.label}</label>
            <ImageUploadField
              value={val}
              onChange={(v) => updateCopy(key, v)}
              preset="hero"
              previewHeight="h-20"
              previewAspect="w-40 aspect-video"
              label="hero background"
            />
            <p className="text-xs text-zinc-600 mt-1">{schema.description}</p>
          </div>
          {val && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Position</label>
                <select
                  value={landingCopy.heroBackgroundPosition || 'center'}
                  onChange={(e) => updateCopy('heroBackgroundPosition', e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
                >
                  {IMAGE_POSITION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Size</label>
                <select
                  value={landingCopy.heroBackgroundSize || 'cover'}
                  onChange={(e) => updateCopy('heroBackgroundSize', e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors"
                >
                  <option value="cover">Cover (fill, may crop)</option>
                  <option value="contain">Contain (fit, may letterbox)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={key}>
        <label className="text-xs text-zinc-400 block mb-1.5">{schema.label}</label>
        {schema.multiline ? (
          <textarea
            value={val}
            onChange={(e) => updateCopy(key, e.target.value)}
            placeholder={schema.placeholder || schema.default}
            maxLength={schema.maxLength}
            rows={3}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors resize-none"
          />
        ) : (
          <input
            type="text"
            value={val}
            onChange={(e) => updateCopy(key, e.target.value)}
            placeholder={schema.placeholder || schema.default}
            maxLength={schema.maxLength}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
          />
        )}
        <div className="flex justify-between mt-1">
          <p className="text-xs text-zinc-600">{schema.description}</p>
          {schema.maxLength && (
            <span className="text-xs text-zinc-600">{val.length}/{schema.maxLength}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hero Section */}
      <CollapsibleSection
        title="Hero"
        enabled={sections.hero}
        onToggle={(v) => updateSections({ hero: v })}
        defaultOpen={true}
      >
        <div className="space-y-4">
          {HERO_FIELDS.map(renderCopyField)}
        </div>
      </CollapsibleSection>

      {/* Form Section */}
      <CollapsibleSection title="Contact Form" alwaysOn defaultOpen={true}>
        <div className="space-y-4 mb-4">
          {FORM_FIELDS_KEYS.map(renderCopyField)}
        </div>

        {/* Form field editor */}
        <div className="border-t border-zinc-800/50 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-medium text-zinc-400">Form Fields</h4>
              <p className="text-xs text-zinc-500 mt-0.5">
                {fields.length}/{MAX_FORM_FIELDS} fields
              </p>
            </div>
            <button
              type="button"
              onClick={addField}
              disabled={fields.length >= MAX_FORM_FIELDS}
              className="text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-3 py-1.5 rounded transition-colors"
            >
              + Add Field
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0}
                      className="text-zinc-500 hover:text-zinc-300 disabled:text-zinc-700 text-xs leading-none" title="Move up">▲</button>
                    <button type="button" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1}
                      className="text-zinc-500 hover:text-zinc-300 disabled:text-zinc-700 text-xs leading-none" title="Move down">▼</button>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">{field.id}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-xs text-zinc-400">Required</span>
                      <input type="checkbox" checked={field.required ?? false}
                        onChange={(e) => updateFieldAt(i, { required: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50" />
                    </label>
                    <button type="button" onClick={() => removeField(i)}
                      className="text-zinc-500 hover:text-red-400 transition-colors text-sm" title="Remove field">✕</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Label</label>
                    <input type="text" value={field.label} onChange={(e) => updateFieldAt(i, { label: e.target.value })}
                      maxLength={50} className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Type</label>
                    <select value={field.type} onChange={(e) => updateFieldAt(i, { type: e.target.value as 'text' | 'email' | 'tel' | 'textarea' })}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors">
                      {FIELD_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Placeholder</label>
                    <input type="text" value={field.placeholder || ''} onChange={(e) => updateFieldAt(i, { placeholder: e.target.value })}
                      maxLength={80} className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:border-amber-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Field ID</label>
                    <input type="text" value={field.id} onChange={(e) => updateFieldAt(i, { id: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                      maxLength={30} className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white font-mono focus:border-amber-500/50 outline-none transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <button type="button" onClick={() => updateFields(DEFAULT_LANDING_COPY.formFields)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Reset fields to defaults
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Services Section */}
      <CollapsibleSection
        title="Services"
        enabled={sections.services}
        onToggle={(v) => updateSections({ services: v })}
      >
        <div className="space-y-4">
          {renderCopyField('servicesTitle')}

          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {services.length}/{MAX_SERVICES} services
            </p>
          </div>

          {services.map((svc, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-mono w-5 shrink-0">{i + 1}</span>
                <input
                  type="text"
                  value={svc.title}
                  onChange={(e) => updateServiceAt(i, { title: e.target.value })}
                  className="flex-1 bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                  placeholder="Service title"
                />
                <button type="button" onClick={() => moveService(i, -1)} disabled={i === 0}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors" title="Move up">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                </button>
                <button type="button" onClick={() => moveService(i, 1)} disabled={i === services.length - 1}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors" title="Move down">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button type="button" onClick={() => removeService(i)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition-colors" title="Remove service">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <textarea
                value={svc.description}
                onChange={(e) => updateServiceAt(i, { description: e.target.value })}
                rows={2}
                className="w-full bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-zinc-700 focus:border-blue-500 focus:outline-none resize-none"
                placeholder="Short description (shown on hover)"
              />

              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Image (optional)</label>
                <ImageUploadField
                  value={svc.image || ''}
                  onChange={(v) => updateServiceAt(i, { image: v || undefined })}
                  preset="service"
                  previewHeight="h-16"
                  previewAspect="aspect-video w-28"
                  label="service image"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-500">CTA Link</label>
                <input
                  type="text"
                  value={svc.ctaLink || ''}
                  onChange={(e) => updateServiceAt(i, { ctaLink: e.target.value || undefined })}
                  className="w-full bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                  placeholder="#contact (default)"
                />
              </div>
            </div>
          ))}

          {services.length < MAX_SERVICES && (
            <button type="button" onClick={addService}
              className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
              + Add Service
            </button>
          )}

          {services.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/50">
              <button type="button" onClick={() => updateServices(DEFAULT_LANDING_COPY.services)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Reset services to defaults
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Gallery Section */}
      <CollapsibleSection
        title="Gallery"
        enabled={sections.gallery}
        onToggle={(v) => updateSections({ gallery: v })}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {galleryImages.length}/{MAX_GALLERY_IMAGES} images
            </p>
          </div>

          {galleryImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galleryImages.map((img, i) => (
                <div key={i} className="group relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Gallery ${i + 1}`}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: img.position || 'center' }}
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        el.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                        const span = document.createElement('span');
                        span.className = 'text-xs text-zinc-600';
                        span.textContent = 'Failed to load';
                        el.parentElement!.appendChild(span);
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => moveGalleryImage(i, -1)}
                        disabled={i === 0}
                        className="p-1.5 bg-zinc-800/90 rounded text-zinc-300 hover:text-white disabled:text-zinc-600 text-xs"
                        title="Move left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGalleryImage(i, 1)}
                        disabled={i === galleryImages.length - 1}
                        className="p-1.5 bg-zinc-800/90 rounded text-zinc-300 hover:text-white disabled:text-zinc-600 text-xs"
                        title="Move right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(i)}
                        className="p-1.5 bg-zinc-800/90 rounded text-red-400 hover:text-red-300 text-xs"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="px-2 py-1.5 border-t border-zinc-800">
                    <select
                      value={img.position || 'center'}
                      onChange={(e) => updateGalleryImagePosition(i, e.target.value)}
                      className="w-full px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-300 focus:border-amber-500/50 outline-none transition-colors"
                    >
                      {IMAGE_POSITION_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {galleryImages.length < MAX_GALLERY_IMAGES && (
            <GalleryAddImage onAdd={addGalleryImage} />
          )}
        </div>
      </CollapsibleSection>

      {/* Footer Section */}
      <CollapsibleSection
        title="Footer"
        enabled={sections.footer}
        onToggle={(v) => updateSections({ footer: v })}
      >
        <div className="space-y-4">
          {FOOTER_FIELDS.map(renderCopyField)}
        </div>
      </CollapsibleSection>

      {/* Webchat Section */}
      <CollapsibleSection
        title="Webchat"
        enabled={meta.webchat?.enabled ?? false}
        onToggle={(v) => updateMeta({ ...meta, webchat: { ...meta.webchat, agentId: meta.webchat?.agentId || '', enabled: v } })}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Agent</label>
            {agents && Object.keys(agents).length > 0 ? (
              <select
                value={meta.webchat?.agentId || ''}
                onChange={(e) => updateMeta({ ...meta, webchat: { ...meta.webchat, agentId: e.target.value, enabled: meta.webchat?.enabled ?? false } })}
                className="w-full bg-zinc-800 text-white text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select an agent...</option>
                {Object.entries(agents).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-zinc-500">No agents configured. Create an agent in the Agents tab first.</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={meta.webchat?.collectEmail ?? false}
              onChange={(e) => updateMeta({ ...meta, webchat: { ...meta.webchat, agentId: meta.webchat?.agentId || '', enabled: meta.webchat?.enabled ?? false, collectEmail: e.target.checked } })}
              className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-zinc-300">Collect visitor email before chat</span>
          </label>
        </div>
      </CollapsibleSection>
    </div>
  );
}
