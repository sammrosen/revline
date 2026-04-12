'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, ArrowLeft, Loader2, FileText, Check } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface PromptTemplateVariable {
  key: string;
  label: string;
  description: string;
  required: boolean;
  source: 'user_input' | 'ai_generated';
  placeholder: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: PromptTemplateVariable[];
}

export interface GenerateResult {
  prompt: string;
  initialMessage?: string;
  suggestedTools?: string[];
}

interface PromptTemplatePickerProps {
  workspaceId: string;
  onGenerate: (result: GenerateResult) => void;
  onClose: () => void;
}

// =============================================================================
// CATEGORY LABELS
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  receptionist: 'Receptionist',
  appointment_booker: 'Booking',
  support: 'Support',
};

// =============================================================================
// COMPONENT
// =============================================================================

type Step = 'pick' | 'fill' | 'preview';

export function PromptTemplatePicker({
  workspaceId,
  onGenerate,
  onClose,
}: PromptTemplatePickerProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('pick');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [referenceContent, setReferenceContent] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerateResult | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/v1/agents/templates');
        if (!res.ok) throw new Error('Failed to load templates');
        const data = await res.json();
        setTemplates(Array.isArray(data.data) ? data.data : []);
      } catch {
        setError('Failed to load templates');
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setSelectedTemplate(template);
    // Pre-populate empty variable values
    const initial: Record<string, string> = {};
    for (const v of template.variables) {
      initial[v.key] = '';
    }
    setVariables(initial);
    setReferenceContent('');
    setGeneratedResult(null);
    setError(null);
    setStep('fill');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;

    // Validate required user_input variables
    const missingRequired = selectedTemplate.variables.filter(
      (v) => v.required && v.source === 'user_input' && !variables[v.key]?.trim()
    );
    if (missingRequired.length > 0) {
      setError(`Please fill in: ${missingRequired.map((v) => v.label).join(', ')}`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/agents/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          variables,
          ...(referenceContent.trim() ? { referenceContent: referenceContent.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Generation failed');
      }

      const data = await res.json();
      const result: GenerateResult = {
        prompt: data.data.prompt,
        initialMessage: data.data.initialMessage || undefined,
        suggestedTools: data.data.suggestedTools || undefined,
      };

      setGeneratedResult(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate, variables, referenceContent, workspaceId]);

  const handleApply = useCallback(() => {
    if (generatedResult) {
      onGenerate(generatedResult);
    }
  }, [generatedResult, onGenerate]);

  const handleBack = useCallback(() => {
    if (step === 'fill') {
      setStep('pick');
      setSelectedTemplate(null);
      setError(null);
    } else if (step === 'preview') {
      setStep('fill');
      setError(null);
    }
  }, [step]);

  const hasAiGeneratedVars = selectedTemplate?.variables.some((v) => v.source === 'ai_generated') ?? false;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            {step !== 'pick' && (
              <button
                onClick={handleBack}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-medium text-white">
              {step === 'pick' && 'Choose a Template'}
              {step === 'fill' && selectedTemplate?.name}
              {step === 'preview' && 'Preview Generated Prompt'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Step 1: Pick template */}
          {step === 'pick' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">No templates available.</p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-violet-500/50 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-medium text-white">{template.name}</span>
                      <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{template.description}</p>
                    <p className="text-[10px] text-zinc-600 mt-2">
                      {template.variables.filter((v) => v.required).length} required fields
                    </p>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Step 2: Fill variables */}
          {step === 'fill' && selectedTemplate && (
            <div className="space-y-4">
              {/* User-input variables */}
              {selectedTemplate.variables
                .filter((v) => v.source === 'user_input')
                .map((v) => (
                  <div key={v.key}>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      {v.label}
                      {v.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      value={variables[v.key] || ''}
                      onChange={(e) => setVariables((prev) => ({ ...prev, [v.key]: e.target.value }))}
                      placeholder={v.placeholder}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-zinc-600 mt-0.5">{v.description}</p>
                  </div>
                ))}

              {/* AI-generated variables (shown as disabled) */}
              {hasAiGeneratedVars && (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-3">
                    These fields will be filled by AI{referenceContent.trim() ? ' using your reference content' : ' with placeholder text you can edit later'}:
                  </p>
                  {selectedTemplate.variables
                    .filter((v) => v.source === 'ai_generated')
                    .map((v) => (
                      <div key={v.key} className="mb-3">
                        <label className="block text-xs font-medium text-zinc-500 mb-1">
                          {v.label}
                          <span className="text-violet-400/60 font-normal ml-1">AI-generated</span>
                        </label>
                        <div className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded text-sm text-zinc-600 italic">
                          {v.placeholder}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Reference content for AI */}
              {hasAiGeneratedVars && (
                <div className="pt-2 border-t border-zinc-800">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Reference Content
                    <span className="text-zinc-600 font-normal ml-1">— optional</span>
                  </label>
                  <textarea
                    value={referenceContent}
                    onChange={(e) => setReferenceContent(e.target.value)}
                    placeholder="Paste business info, website copy, or service descriptions. AI will use this to generate context-specific prompt sections."
                    rows={4}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none resize-y"
                  />
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Without reference content, AI-generated fields will contain placeholder text for manual editing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview generated prompt */}
          {step === 'preview' && generatedResult && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Generated System Prompt
                </label>
                <textarea
                  value={generatedResult.prompt}
                  readOnly
                  rows={14}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white font-mono focus:outline-none resize-y"
                />
              </div>

              {generatedResult.initialMessage && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Initial Message
                  </label>
                  <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300">
                    {generatedResult.initialMessage}
                  </div>
                </div>
              )}

              {generatedResult.suggestedTools && generatedResult.suggestedTools.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Suggested Tools
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedResult.suggestedTools.map((tool) => (
                      <span
                        key={tool}
                        className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400">
                  This will replace your current system prompt{generatedResult.initialMessage ? ', initial message,' : ''}{generatedResult.suggestedTools?.length ? ' and enabled tools' : ''}. You can edit everything after applying.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          {step === 'fill' && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-violet-600 rounded hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Prompt
                </>
              )}
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-violet-600 rounded hover:bg-violet-500 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Use This Prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
