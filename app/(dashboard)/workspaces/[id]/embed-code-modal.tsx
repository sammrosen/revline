'use client';

import { useState } from 'react';

/**
 * Embed Code Modal
 * 
 * Shows the embed code for a capture form with configuration options.
 * Users can specify:
 * - Form selector (CSS selector for the target form)
 * - Field mappings (source field → target field)
 * 
 * STANDARDS:
 * - Copy to clipboard functionality
 * - Clear instructions
 */

interface FormSecurity {
  mode: 'browser' | 'server' | 'both';
  allowedOrigins: string[];
  rateLimitPerIp: number;
  hasSigningSecret?: boolean;
}

interface CaptureForm {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  security: FormSecurity;
  allowedTargets: string[];
  triggerName: string;
}

interface FieldMapping {
  source: string;
  target: string;
}

interface EmbedCodeModalProps {
  form: CaptureForm;
  workspaceId: string;
  onClose: () => void;
}

export function EmbedCodeModal({ form, workspaceId, onClose }: EmbedCodeModalProps) {
  const [formSelector, setFormSelector] = useState('#signup-form');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { source: 'email', target: 'email' },
  ]);
  const [copied, setCopied] = useState(false);

  // Generate embed code
  const generateEmbedCode = () => {
    const fieldsStr = fieldMappings
      .filter(m => m.source && m.target)
      .map(m => `${m.source}:${m.target}`)
      .join(',');

    const endpoint = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/v1/capture/`
      : 'https://revline.app/api/v1/capture/';

    const scriptSrc = typeof window !== 'undefined'
      ? `${window.location.origin}/capture.js`
      : 'https://revline.app/capture.js';

    return `<!-- RevLine Form Capture: ${form.name} -->
<script
  src="${scriptSrc}"
  data-form-id="${form.id}"
  data-form-selector="${formSelector}"
  data-fields="${fieldsStr}"
  data-endpoint="${endpoint}"
  async
></script>`;
  };

  // Handle add mapping
  const handleAddMapping = () => {
    setFieldMappings([...fieldMappings, { source: '', target: '' }]);
  };

  // Handle remove mapping
  const handleRemoveMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  // Handle update mapping
  const handleUpdateMapping = (index: number, field: 'source' | 'target', value: string) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  // Handle copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateEmbedCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = generateEmbedCode();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <div>
            <h2 className="text-lg font-medium text-white">Embed Code</h2>
            <p className="text-sm text-zinc-400">{form.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Instructions */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded">
            <h3 className="text-sm font-medium text-amber-400 mb-1">How it works</h3>
            <ol className="text-xs text-amber-300/80 space-y-1 list-decimal list-inside">
              <li>Configure the form selector to match your target form</li>
              <li>Map your form field names to RevLine target fields</li>
              <li>Copy the embed code and add it to your site (before &lt;/body&gt;)</li>
              <li>When users submit the form, data is captured automatically</li>
            </ol>
          </div>

          {/* Form Selector */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Form Selector (CSS selector for your form)
            </label>
            <input
              type="text"
              value={formSelector}
              onChange={(e) => setFormSelector(e.target.value)}
              placeholder="#signup-form or .contact-form"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors"
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              Use the ID (#myForm) or class (.myForm) of your form element
            </p>
          </div>

          {/* Field Mappings */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Field Mappings (source field → target field)
            </label>
            <p className="text-[10px] text-zinc-600 mb-2">
              Map your form&apos;s field names to the allowed targets for this capture form.
            </p>

            <div className="space-y-2">
              {fieldMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mapping.source}
                    onChange={(e) => handleUpdateMapping(index, 'source', e.target.value)}
                    placeholder="form field name"
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm font-mono text-white focus:border-amber-500/50 outline-none transition-colors"
                  />
                  <span className="text-zinc-600">→</span>
                  <select
                    value={mapping.target}
                    onChange={(e) => handleUpdateMapping(index, 'target', e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-amber-500/50 outline-none transition-colors"
                  >
                    <option value="">Select target...</option>
                    {form.allowedTargets.map((target) => (
                      <option key={target} value={target}>
                        {target}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveMapping(index)}
                    disabled={fieldMappings.length <= 1}
                    className="p-2 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddMapping}
              className="mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              + Add another mapping
            </button>
          </div>

          {/* Generated Code */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-400">Generated Embed Code</label>
              <button
                onClick={handleCopy}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  copied
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto">
              {generateEmbedCode()}
            </pre>
          </div>

          {/* Form ID for reference */}
          <div className="text-xs text-zinc-500">
            <span className="font-medium">Form ID:</span>{' '}
            <code className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">{form.id}</code>
          </div>

          {/* Warning if form disabled */}
          {!form.enabled && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-sm text-red-400">
                Warning: This form is currently disabled. Enable it in the form settings for captures to work.
              </p>
            </div>
          )}

          {/* Origin warning */}
          {form.security.allowedOrigins.length > 0 && (
            <div className="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded">
              <p className="text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">Allowed origins:</span>{' '}
                {form.security.allowedOrigins.join(', ')}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Captures will only be accepted from these origins.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
