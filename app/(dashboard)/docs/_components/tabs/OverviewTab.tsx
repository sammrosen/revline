import { TipBox } from '../shared';

export function OverviewTab() {
  return (
    <div className="space-y-8">
      {/* What is RevLine */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">What is RevLine?</h2>
        <p className="text-zinc-300 mb-4">
          RevLine is a multi-client automation platform for managing landing pages, 
          email capture, payment processing, and booking integrations. It centralizes 
          all client configurations in one place with encrypted secrets and configurable workflows.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Before RevLine</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Per-client environment variables</li>
              <li>• Hardcoded automation logic</li>
              <li>• Manual webhook management</li>
              <li>• No centralized monitoring</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">With RevLine</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Database-backed encrypted secrets</li>
              <li>• Configurable workflow engine</li>
              <li>• Centralized integration management</li>
              <li>• Health monitoring & event logs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Core Concepts */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Core Concepts</h2>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Clients</h3>
            <p className="text-sm text-zinc-400">
              Each business you manage. Has a unique slug used for routing webhooks and 
              identifying leads. Example: <code className="text-white">acme_fitness</code>
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Integrations</h3>
            <p className="text-sm text-zinc-400">
              Connections to external services (MailerLite, Stripe, Calendly, ABC Ignite). 
              Each integration has encrypted secrets and JSON configuration.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Workflows</h3>
            <p className="text-sm text-zinc-400">
              Automation rules that connect triggers to actions. Example: When a Stripe 
              payment succeeds, update the lead stage and add them to a MailerLite group.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Events</h3>
            <p className="text-sm text-zinc-400">
              Audit log of everything that happens. Every email capture, payment, booking, 
              and workflow execution is logged for debugging and monitoring.
            </p>
          </div>
        </div>
      </section>

      {/* Onboarding Flow */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Client Onboarding Flow</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">1</span>
              <div>
                <p className="font-medium text-white">Collect Information</p>
                <p className="text-sm text-zinc-400">Get client name, slug, API keys, and webhook secrets from their accounts.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">2</span>
              <div>
                <p className="font-medium text-white">Create Client</p>
                <p className="text-sm text-zinc-400">Add the client in RevLine with their name, slug, and timezone.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">3</span>
              <div>
                <p className="font-medium text-white">Add Integrations</p>
                <p className="text-sm text-zinc-400">Configure each integration with secrets and settings (MailerLite, Stripe, etc.)</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">4</span>
              <div>
                <p className="font-medium text-white">Set Up Workflows</p>
                <p className="text-sm text-zinc-400">Create workflows to connect triggers to actions based on client needs.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">5</span>
              <div>
                <p className="font-medium text-white">Test & Verify</p>
                <p className="text-sm text-zinc-400">Run health checks and test each flow (email capture, payment, booking).</p>
              </div>
            </li>
          </ol>
        </div>
        <TipBox title="Time Estimate">
          A complete client onboarding typically takes <strong>~2 hours</strong>: 
          15 min collecting info, 30 min setup, 30 min workflows, 30 min testing.
        </TipBox>
      </section>

      {/* Quick Reference */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Quick Reference</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-zinc-300 mb-3">API Endpoints</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Email Capture</span>
                <code className="text-white">/api/subscribe</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Stripe Webhook</span>
                <code className="text-white">/api/stripe-webhook</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Calendly Webhook</span>
                <code className="text-white">/api/calendly-webhook</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">ABC Ignite Webhook</span>
                <code className="text-white">/api/abc-ignite-webhook</code>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-zinc-300 mb-3">Lead Stages</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                <span className="text-zinc-400">CAPTURED</span>
                <span className="text-zinc-600">- Email submitted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                <span className="text-zinc-400">BOOKED</span>
                <span className="text-zinc-600">- Call scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-zinc-400">PAID</span>
                <span className="text-zinc-600">- Payment received</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-zinc-400">DEAD</span>
                <span className="text-zinc-600">- Inactive/unsubscribed</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
