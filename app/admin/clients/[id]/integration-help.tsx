'use client';

import { useState } from 'react';

type IntegrationType = 'MAILERLITE' | 'STRIPE' | 'CALENDLY' | 'MANYCHAT';

interface IntegrationHelpProps {
  integration: IntegrationType;
  context: 'create' | 'edit-meta';
  onCopyTemplate?: (template: string) => void;
}

interface IntegrationInfo {
  name: string;
  color: string;
  secretLabel: string;
  secretPlaceholder: string;
  secretDescription: string;
  metaTemplate: object;
  metaDescription: string;
  metaFields: { key: string; description: string; required?: boolean }[];
  tips: string[];
  warnings?: string[];
  hasStructuredEditor?: boolean;
}

const INTEGRATION_INFO: Record<IntegrationType, IntegrationInfo> = {
  MAILERLITE: {
    name: 'MailerLite',
    color: 'text-green-400',
    secretLabel: 'API Key',
    secretPlaceholder: 'mlsk_xxxxxxxxxxxxx',
    secretDescription: 'Get from MailerLite → Settings → API',
    hasStructuredEditor: true,
    metaTemplate: {
      groups: {
        welcome: { id: '123456', name: 'Welcome List' },
        customers: { id: '789012', name: 'Paying Customers' },
      },
      routing: {
        'lead.captured': 'welcome',
        'lead.paid': 'customers',
        'lead.booked': null,
      },
    },
    metaDescription: 'Configure named groups and route actions to them',
    metaFields: [
      { key: 'groups.*', description: 'Named groups with MailerLite ID and display name', required: true },
      { key: 'routing.lead.captured', description: 'Group for email captures from landing pages' },
      { key: 'routing.lead.paid', description: 'Group for paying customers (Stripe)' },
      { key: 'routing.lead.paid:*', description: 'Program-specific groups (e.g., lead.paid:fit1)' },
      { key: 'routing.lead.booked', description: 'Group for Calendly bookings (optional)' },
    ],
    tips: [
      'Use the structured editor for easier configuration',
      'Get group IDs from MailerLite URL: /groups/123456 → ID is 123456',
      'Set routing to null to disable an action (won\'t add to any group)',
      'For program-specific routing, switch to JSON mode',
    ],
    warnings: [
      'Never put API keys in meta - they go in the Secret field',
    ],
  },
  STRIPE: {
    name: 'Stripe',
    color: 'text-purple-400',
    secretLabel: 'Webhook Signing Secret',
    secretPlaceholder: 'whsec_xxxxxxxxxxxxx',
    secretDescription: 'From Developers → Webhooks → Your endpoint → Signing secret',
    metaTemplate: {},
    metaDescription: 'Usually empty - Stripe payment routing is handled via MailerLite config',
    metaFields: [
      { key: 'productMap', description: 'Optional: Map price IDs to program names' },
      { key: 'apiKey', description: 'Optional: Stripe API key (uses env default if not set)' },
    ],
    tips: [
      'Webhook URL: /api/stripe-webhook?source=client_slug',
      'Event to subscribe: checkout.session.completed',
      'Use Stripe Payment Link metadata (program=fit1) for routing',
      'Customer routing is configured in MailerLite integration',
    ],
    warnings: [
      'Do NOT put Stripe API keys in meta unless needed',
      'Webhook secret is shown only once - save it!',
    ],
  },
  CALENDLY: {
    name: 'Calendly',
    color: 'text-cyan-400',
    secretLabel: 'Webhook Signing Key',
    secretPlaceholder: 'your_signing_key_from_calendly',
    secretDescription: 'From Integrations → Webhooks → Your endpoint',
    metaTemplate: {
      schedulingUrls: {
        discovery: 'https://calendly.com/yourname/30min',
      },
      addToBookedSegment: false,
    },
    metaDescription: 'Store scheduling URLs and configuration flags',
    metaFields: [
      { key: 'schedulingUrls.*', description: 'Named URLs for different call types' },
      { key: 'addToBookedSegment', description: 'Whether to add booked leads to a MailerLite segment' },
    ],
    tips: [
      'Webhook URL: /api/calendly-webhook',
      'Subscribe to: invitee.created, invitee.canceled',
      'Calendly links should include utm_source=client_slug',
      'Booking routing is configured in MailerLite integration (lead.booked)',
    ],
  },
  MANYCHAT: {
    name: 'ManyChat',
    color: 'text-blue-400',
    secretLabel: 'API Token',
    secretPlaceholder: 'your_manychat_api_token',
    secretDescription: 'From ManyChat → Settings → API',
    metaTemplate: {
      flowIds: {
        welcome: 'flow_123456',
      },
      tagMappings: {
        lead: ['tag_id_1', 'tag_id_2'],
      },
    },
    metaDescription: 'Store flow IDs and tag mappings for automation',
    metaFields: [
      { key: 'flowIds.*', description: 'Named flow IDs for different automations' },
      { key: 'tagMappings.*', description: 'Map internal names to ManyChat tag IDs' },
    ],
    tips: [
      'ManyChat is primarily a traffic driver to landing pages',
      'Email capture happens on the landing page via EmailCapture',
      'Use UTM parameters to track ManyChat traffic sources',
    ],
  },
};

export function IntegrationHelp({ integration, context, onCopyTemplate }: IntegrationHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const info = INTEGRATION_INFO[integration];
  if (!info) return null;

  const templateJson = JSON.stringify(info.metaTemplate, null, 2);

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
        title={`Help: ${info.name} integration`}
      >
        ?
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className={`text-lg font-semibold ${info.color}`}>{info.name} Integration</h3>
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
        {info.hasStructuredEditor && (
          <div className="mb-6 p-3 bg-blue-950/30 border border-blue-900/50 rounded">
            <p className="text-xs text-blue-300">
              ✨ This integration has a <strong>structured editor</strong> - you can configure it without writing JSON!
            </p>
          </div>
        )}

        {/* Secret Info (only show in create context) */}
        {context === 'create' && (
          <div className="mb-6 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Secret: {info.secretLabel}</h4>
            <code className="text-xs text-zinc-500 block mb-2">{info.secretPlaceholder}</code>
            <p className="text-xs text-zinc-400">{info.secretDescription}</p>
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
          <p className="text-xs text-zinc-500 mt-2">{info.metaDescription}</p>
        </div>

        {/* Meta Fields */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-zinc-300 mb-3">Configuration Fields</h4>
          <div className="space-y-2">
            {info.metaFields.map((field) => (
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

        {/* Tips */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">💡 Tips</h4>
          <ul className="space-y-1">
            {info.tips.map((tip, i) => (
              <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                <span className="text-zinc-600">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Warnings */}
        {info.warnings && info.warnings.length > 0 && (
          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded">
            <h4 className="text-sm font-medium text-red-400 mb-2">⚠️ Important</h4>
            <ul className="space-y-1">
              {info.warnings.map((warning, i) => (
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
  integration: IntegrationType; 
  onCopyTemplate: (template: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const info = INTEGRATION_INFO[integration];
  if (!info) return null;

  const templateJson = JSON.stringify(info.metaTemplate, null, 2);

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
