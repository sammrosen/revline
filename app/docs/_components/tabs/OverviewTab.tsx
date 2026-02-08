import { TipBox } from '../shared';

export function OverviewTab() {
  return (
    <div className="space-y-8">
      {/* What is RevLine */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">What is RevLine?</h2>
        <p className="text-zinc-300 mb-4">
          RevLine is a multi-workspace automation platform for managing integrations, workflows, 
          booking flows, email capture, and payment processing. It centralizes all workspace 
          configurations with encrypted secrets, configurable workflows, and a two-layer 
          automation system.
        </p>
        <p className="text-zinc-400 text-sm mb-4">
          Built on five core principles: <strong className="text-white">agnostic</strong>, 
          <strong className="text-white"> extensible</strong>, 
          <strong className="text-white"> decoupled</strong>, 
          <strong className="text-white"> secure</strong>, 
          <strong className="text-white"> reliable</strong>.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Before RevLine</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>&bull; Per-workspace environment variables</li>
              <li>&bull; Hardcoded automation logic</li>
              <li>&bull; Manual webhook management</li>
              <li>&bull; No centralized monitoring</li>
              <li>&bull; No booking or form infrastructure</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">With RevLine</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>&bull; Database-backed encrypted secrets</li>
              <li>&bull; Two-layer automation (forms + workflows)</li>
              <li>&bull; 7 integration adapters</li>
              <li>&bull; Health monitoring, event logs, network graph</li>
              <li>&bull; Provider-agnostic booking and form system</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Core Concepts */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Core Concepts</h2>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Organizations</h3>
            <p className="text-sm text-zinc-400">
              Top-level container. Each organization has members with granular permissions, 
              templates for forms, and one or more workspaces. See the <strong>Organizations</strong> tab 
              for details.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Workspaces</h3>
            <p className="text-sm text-zinc-400">
              Each business you manage. Has a unique slug for routing, customizable lead stages, 
              optional custom domain, and its own integrations, leads, and workflows. 
              Example: <code className="text-white">acme_fitness</code>
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Integrations</h3>
            <p className="text-sm text-zinc-400">
              Connections to external services. 7 adapters: MailerLite, Stripe, Calendly, ManyChat, 
              ABC Ignite, RevLine (forms), and Resend (transactional email). Each has encrypted 
              secrets and JSON configuration.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Forms &amp; Templates</h3>
            <p className="text-sm text-zinc-400">
              <strong>Layer 1</strong> of automation. Forms declare baked-in operations that run 
              automatically (e.g., the booking flow: lookup &rarr; eligibility &rarr; magic link &rarr; enroll). 
              Templates provide org-scoped copy and branding. See the <strong>Forms &amp; Sites</strong> tab.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Workflows</h3>
            <p className="text-sm text-zinc-400">
              <strong>Layer 2</strong> of automation. User-configured rules that connect triggers to 
              actions. Example: When a booking is confirmed, update the lead stage and add to 
              a MailerLite group. See the <strong>Workflows</strong> tab.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Events</h3>
            <p className="text-sm text-zinc-400">
              Append-only audit log. Every email capture, payment, booking, workflow execution, and 
              integration call is logged with timestamps, success/failure, and error details. 
              Events are the primary debugging surface.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Leads</h3>
            <p className="text-sm text-zinc-400">
              Pipeline tracking for captured contacts. Each lead has a stage (customizable per 
              workspace &mdash; defaults: CAPTURED, BOOKED, PAID, DEAD), source, event history, 
              and <strong>custom properties</strong> (schema-validated fields like barcode, member type, etc.). 
              Unique per workspace+email. See the <strong>Organizations</strong> tab for custom lead properties.
            </p>
          </div>
        </div>
      </section>

      {/* Data Hierarchy */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Data Hierarchy</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm">
          <div className="space-y-1 text-zinc-400">
            <div><span className="text-emerald-400">Organization</span></div>
            <div className="pl-4">&rarr; Members <span className="text-zinc-600">(owner + members with permissions)</span></div>
            <div className="pl-4">&rarr; Templates <span className="text-zinc-600">(booking, signup copy/branding)</span></div>
            <div className="pl-4">&rarr; <span className="text-amber-400">Workspace</span></div>
            <div className="pl-8">&rarr; Integrations <span className="text-zinc-600">(7 types, encrypted secrets)</span></div>
            <div className="pl-8">&rarr; Leads <span className="text-zinc-600">(email, stage, source, events)</span></div>
            <div className="pl-8">&rarr; Workflows <span className="text-zinc-600">(trigger &rarr; filter &rarr; actions)</span></div>
            <div className="pl-8">&rarr; Forms <span className="text-zinc-600">(booking, signup &mdash; baked-in ops)</span></div>
            <div className="pl-8">&rarr; Events <span className="text-zinc-600">(append-only audit log)</span></div>
          </div>
        </div>
      </section>

      {/* Onboarding Flow */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Workspace Onboarding Flow</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">1</span>
              <div>
                <p className="font-medium text-white">Create Organization</p>
                <p className="text-sm text-zinc-400">Set up the org, invite team members, configure permissions.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">2</span>
              <div>
                <p className="font-medium text-white">Create Workspace</p>
                <p className="text-sm text-zinc-400">Add the workspace with name, slug, and timezone. Optionally set up custom domain and lead stages.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">3</span>
              <div>
                <p className="font-medium text-white">Add Integrations</p>
                <p className="text-sm text-zinc-400">Configure each integration with secrets and settings (MailerLite, Stripe, ABC Ignite, Resend, etc.)</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">4</span>
              <div>
                <p className="font-medium text-white">Enable Forms</p>
                <p className="text-sm text-zinc-400">Configure the RevLine integration, enable forms (booking, signup), customize copy via templates.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">5</span>
              <div>
                <p className="font-medium text-white">Build Workflows</p>
                <p className="text-sm text-zinc-400">Create workflows to react to form triggers and webhook events (update stages, add to groups, etc.)</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">6</span>
              <div>
                <p className="font-medium text-white">Test &amp; Verify</p>
                <p className="text-sm text-zinc-400">Run health checks, test each flow, verify events in the dashboard. Use the testing panel for API testing.</p>
              </div>
            </li>
          </ol>
        </div>
        <TipBox title="Time Estimate">
          A complete workspace onboarding typically takes <strong>1-2 hours</strong>: 
          15 min setup, 30 min integrations, 30 min workflows, 15 min testing.
        </TipBox>
      </section>

      {/* Quick Reference */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Quick Reference</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-zinc-300 mb-3">Key API Endpoints</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Email Capture</span>
                <code className="text-white text-xs">/api/v1/subscribe</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Form Submit</span>
                <code className="text-white text-xs">/api/v1/form-submit</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Stripe Webhook</span>
                <code className="text-white text-xs">/api/v1/stripe-webhook</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Calendly Webhook</span>
                <code className="text-white text-xs">/api/v1/calendly-webhook</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Booking Flow</span>
                <code className="text-white text-xs">/api/v1/booking/*</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Health Check</span>
                <code className="text-white text-xs">/api/v1/health</code>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-zinc-300 mb-3">Default Lead Stages</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                <span className="text-zinc-400">CAPTURED</span>
                <span className="text-zinc-600">&mdash; Email submitted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                <span className="text-zinc-400">BOOKED</span>
                <span className="text-zinc-600">&mdash; Appointment scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-zinc-400">PAID</span>
                <span className="text-zinc-600">&mdash; Payment received</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-zinc-400">DEAD</span>
                <span className="text-zinc-600">&mdash; Inactive/unsubscribed</span>
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Stages are customizable per workspace. See the Organizations tab.
            </p>
          </div>
        </div>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">For Developers</h2>
        <p className="text-zinc-300 mb-4">
          New to the codebase? Start with the <strong>Platform</strong> tab for architecture, 
          two-layer system details, security patterns, and a key files reference. For integration 
          details, see each integration&apos;s tab.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Recommended Reading</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-zinc-400"><strong className="text-white">Platform</strong> &mdash; Architecture, directory structure, key files</p>
            </div>
            <div>
              <p className="text-zinc-400"><strong className="text-white">Organizations</strong> &mdash; Permissions, roles, access control</p>
            </div>
            <div>
              <p className="text-zinc-400"><strong className="text-white">Forms &amp; Sites</strong> &mdash; Two-layer system, baked-in operations</p>
            </div>
            <div>
              <p className="text-zinc-400"><strong className="text-white">Testing</strong> &mdash; Test flows, testing panel, debugging</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
