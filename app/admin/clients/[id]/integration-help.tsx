'use client';

import { useState } from 'react';
import { 
  INTEGRATIONS, 
  type IntegrationTypeId,
  type IntegrationConfig 
} from '@/app/_lib/integrations/config';

interface IntegrationHelpProps {
  integration: IntegrationTypeId;
  context: 'create' | 'edit-meta';
  onCopyTemplate?: (template: string) => void;
}

export function IntegrationHelp({ integration, context, onCopyTemplate }: IntegrationHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const config: IntegrationConfig | undefined = INTEGRATIONS[integration];
  if (!config) return null;

  const templateJson = JSON.stringify(config.metaTemplate, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(templateJson);
      setCopied(true);
      onCopyTemplate?.(templateJson);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      onCopyTemplate?.(templateJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
        title={`Help: ${config.displayName} integration`}
      >
        ?
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg p-4 sm:p-6 max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className={`text-lg font-semibold ${config.color}`}>{config.displayName} Integration</h3>
            <p className="text-sm text-zinc-400 mt-1">
              {context === 'create' ? 'Setup guide and configuration' : 'Meta configuration reference'}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Structured editor note */}
        {config.hasStructuredEditor && (
          <div className="mb-6 p-3 bg-blue-950/30 border border-blue-900/50 rounded">
            <p className="text-xs text-blue-300">
              ✨ This integration has a <strong>structured editor</strong> - you can configure it without writing JSON!
            </p>
          </div>
        )}

        {/* Secret Info (only show in create context) */}
        {context === 'create' && config.secrets.length > 0 && (
          <div className="mb-6 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">
              {config.secrets.length > 1 ? 'Secrets' : `Secret: ${config.secrets[0].name}`}
            </h4>
            {config.secrets.map((secret, i) => (
              <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-zinc-800' : ''}>
                {config.secrets.length > 1 && (
                  <p className="text-xs text-zinc-400 font-medium mb-1">{secret.name}</p>
                )}
                <code className="text-xs text-zinc-500 block mb-1">{secret.placeholder}</code>
                <p className="text-xs text-zinc-400">{secret.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Meta Template */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-zinc-300">Meta Template (JSON)</h4>
            <button
              onClick={handleCopy}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                copied 
                  ? 'bg-green-600 text-white' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy Template'}
            </button>
          </div>
          <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
            {templateJson}
          </pre>
          <p className="text-xs text-zinc-500 mt-2">{config.metaDescription}</p>
        </div>

        {/* Meta Fields */}
        {config.metaFields.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Configuration Fields</h4>
            <div className="space-y-2">
              {config.metaFields.map((field) => (
                <div key={field.key} className="flex items-start gap-2 text-xs">
                  <code className="text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded shrink-0">
                    {field.key}
                  </code>
                  <span className="text-zinc-500">
                    {field.description}
                    {field.required && <span className="text-red-400 ml-1">*required</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {config.tips.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">💡 Tips</h4>
            <ul className="space-y-1">
              {config.tips.map((tip, i) => (
                <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-600">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {config.warnings && config.warnings.length > 0 && (
          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded">
            <h4 className="text-sm font-medium text-red-400 mb-2">⚠️ Important</h4>
            <ul className="space-y-1">
              {config.warnings.map((warning, i) => (
                <li key={i} className="text-xs text-red-300">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Smaller inline variant for quick template copy
export function IntegrationTemplateButton({ 
  integration, 
  onCopyTemplate 
}: { 
  integration: IntegrationTypeId; 
  onCopyTemplate: (template: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const config = INTEGRATIONS[integration];
  if (!config) return null;

  const templateJson = JSON.stringify(config.metaTemplate, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(templateJson);
      onCopyTemplate(templateJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopyTemplate(templateJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        copied 
          ? 'bg-green-600 text-white' 
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
      }`}
    >
      {copied ? '✓ Copied' : 'Use Template'}
    </button>
  );
}
