import { DocHero, StepList, TipBox, WarningBox, CodeBlock } from '../_components';

export default function GettingStartedPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <DocHero
        badge="Getting Started"
        title="Set Up Your First Workspace"
        titleGradient="First Workspace"
        description="Get RevLine running for a new client in under 2 hours. This guide walks through workspace creation, integration setup, and your first workflow."
      />

      {/* Prerequisites */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Prerequisites</h2>
        <p className="text-zinc-400 mb-4">Before you begin, gather the following from your client:</p>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Required</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                Client name and business email
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                Desired workspace slug (e.g., <code className="text-white">acme_fitness</code>)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                Timezone for the workspace
              </li>
            </ul>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Integration Credentials</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">○</span>
                MailerLite API key + Group IDs
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">○</span>
                Stripe webhook secret
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">○</span>
                Calendly webhook signing key
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">○</span>
                ABC Ignite App ID + App Key (if applicable)
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Step-by-Step Setup</h2>
        
        <StepList
          steps={[
            {
              title: 'Create the Workspace',
              description: 'Navigate to Workspaces → New Workspace. Enter the client name, slug, and timezone. The slug is used for webhook URLs and must be unique.',
            },
            {
              title: 'Add Integrations',
              description: 'From the workspace detail page, go to the Integrations tab. Add each integration the client needs, entering API keys and configuration.',
            },
            {
              title: 'Configure Workflows',
              description: 'Go to the Workflows tab and create automations. Connect triggers (like Stripe payments) to actions (like adding to a MailerLite group).',
            },
            {
              title: 'Set Up Capture Forms',
              description: 'If using the capture system, create forms in the Capture Forms section. Get the embed code to add to client websites.',
            },
            {
              title: 'Test Everything',
              description: 'Use the Testing tab to simulate events and verify workflows execute correctly. Check the Events log for execution history.',
            },
          ]}
        />
        
        <TipBox title="Time Estimate">
          A complete client onboarding typically takes <strong>~2 hours</strong>: 15 min collecting info, 30 min setup, 30 min workflows, 30 min testing.
        </TipBox>
      </section>

      {/* Workspace Configuration */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Workspace Configuration</h2>
        <p className="text-zinc-400 mb-4">
          Each workspace is an isolated environment with its own:
        </p>
        
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
            <p className="text-2xl mb-1">🔐</p>
            <p className="font-medium text-white text-sm">Encrypted Secrets</p>
            <p className="text-xs text-zinc-500 mt-1">AES-256-GCM</p>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
            <p className="text-2xl mb-1">📊</p>
            <p className="font-medium text-white text-sm">Lead Database</p>
            <p className="text-xs text-zinc-500 mt-1">Isolated per workspace</p>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
            <p className="text-2xl mb-1">⚡</p>
            <p className="font-medium text-white text-sm">Workflows</p>
            <p className="text-xs text-zinc-500 mt-1">Custom automations</p>
          </div>
        </div>

        <WarningBox title="Slug Format">
          Workspace slugs must be lowercase letters, numbers, and underscores only. They cannot be changed after creation as they&apos;re used in webhook URLs.
        </WarningBox>
      </section>

      {/* Webhook URLs */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Webhook URLs</h2>
        <p className="text-zinc-400 mb-4">
          Configure these webhook URLs in your client&apos;s external services:
        </p>
        
        <CodeBlock title="Webhook Endpoints" language="text">
{`Stripe:    https://yourdomain.com/api/stripe-webhook?source={slug}
Calendly:  https://yourdomain.com/api/calendly-webhook?source={slug}
Capture:   https://yourdomain.com/api/v1/capture/{formId}`}
        </CodeBlock>
        
        <p className="text-sm text-zinc-500 mt-2">
          Replace <code className="text-zinc-300">{'{slug}'}</code> with the workspace slug and <code className="text-zinc-300">{'{formId}'}</code> with the capture form ID.
        </p>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/docs/capture" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-amber-400 transition-colors">Capture System →</p>
            <p className="text-sm text-zinc-400 mt-1">Learn how to capture leads from external forms</p>
          </a>
          <a href="/docs/workflows" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-purple-400 transition-colors">Workflows →</p>
            <p className="text-sm text-zinc-400 mt-1">Build trigger-action automations</p>
          </a>
        </div>
      </section>
    </div>
  );
}
