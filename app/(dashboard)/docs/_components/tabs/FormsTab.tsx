import { TipBox, WarningBox, CodeBlock } from '../shared';

export function FormsTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-rose-400">Forms</span> &amp; Sites
        </h2>
        <p className="text-zinc-300 mb-4">
          Forms are RevLine&apos;s front-end templates that power public-facing pages like booking 
          flows and membership signups. Each form declares its own <strong>baked-in operations</strong> (Layer 1) 
          and <strong>triggers</strong> that workflows (Layer 2) can react to.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Key Concepts</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>&bull; <strong>Forms</strong> &mdash; Registered in <code>FORM_REGISTRY</code>, each with a type, path, operations, and triggers</li>
            <li>&bull; <strong>Baked-in Operations</strong> &mdash; Hardcoded operations that run automatically (not user-configurable)</li>
            <li>&bull; <strong>Triggers</strong> &mdash; Events emitted by forms that workflows can listen to</li>
            <li>&bull; <strong>Templates</strong> &mdash; Organization-scoped copy and branding (headlines, buttons, colors)</li>
            <li>&bull; <strong>Sites</strong> &mdash; Custom domain routing for public workspace pages</li>
          </ul>
        </div>
      </section>

      {/* Baked-in Operations */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Baked-in Operations</h2>
        <p className="text-zinc-300 mb-4">
          Unlike workflow actions (which are user-configured), baked-in operations are declared 
          in the form definition and execute automatically. They have two phases:
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-amber-400 mb-2">Pre Phase</h3>
            <p className="text-sm text-zinc-400">
              Operations that run <strong>before</strong> the user takes an async action. These prepare 
              data, validate eligibility, and send notifications.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-blue-400 mb-2">Trigger Phase</h3>
            <p className="text-sm text-zinc-400">
              Operations that run <strong>when</strong> the user completes the action (e.g., clicks 
              a magic link). These perform the main side effect.
            </p>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Async Gap</h3>
          <p className="text-sm text-zinc-400">
            Between the pre and trigger phases is an <strong>async gap</strong> &mdash; a point where 
            the system waits for the user to take action (click a magic link, confirm a booking, 
            complete a payment). This is visualized as a dashed node on the network graph.
          </p>
        </div>
      </section>

      {/* Current Forms */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Current Forms</h2>

        {/* Magic Link Booking */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-6">
          <h3 className="text-lg font-medium text-white mb-1">ABC Appointment Booking</h3>
          <p className="text-xs text-zinc-500 mb-4">
            Form ID: <code>magic-link-booking</code> &nbsp;|&nbsp; 
            Type: <code>booking</code> &nbsp;|&nbsp; 
            Path: <code>/public/&#123;slug&#125;/book</code>
          </p>

          <p className="text-sm text-zinc-400 mb-4">
            A multi-step booking form with magic link confirmation. The user enters their barcode, 
            the system verifies eligibility, sends a magic link email, and the user confirms to 
            complete the booking.
          </p>

          <h4 className="font-medium text-zinc-300 mb-2 text-sm">Baked-in Operations</h4>
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-3 text-sm">
              <span className="text-amber-400 text-xs font-medium px-1.5 py-0.5 bg-amber-900/30 rounded shrink-0">PRE</span>
              <div>
                <code className="text-white">abc_ignite.lookup_member</code>
                <span className="text-zinc-500"> &mdash; Find member by barcode</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-amber-400 text-xs font-medium px-1.5 py-0.5 bg-amber-900/30 rounded shrink-0">PRE</span>
              <div>
                <code className="text-white">abc_ignite.check_eligibility</code>
                <span className="text-zinc-500"> &mdash; Verify booking eligibility (conditional)</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-amber-400 text-xs font-medium px-1.5 py-0.5 bg-amber-900/30 rounded shrink-0">PRE</span>
              <div>
                <code className="text-white">resend.send_email</code>
                <span className="text-zinc-500"> &mdash; Send magic link email</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-600 pl-2">
              &#8230; <span className="italic">async gap: user clicks magic link</span> &#8230;
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-blue-400 text-xs font-medium px-1.5 py-0.5 bg-blue-900/30 rounded shrink-0">TRIGGER</span>
              <div>
                <code className="text-white">abc_ignite.enroll_member</code>
                <span className="text-zinc-500"> &mdash; Book appointment</span>
              </div>
            </div>
          </div>

          <h4 className="font-medium text-zinc-300 mb-2 text-sm">Triggers (for Workflows)</h4>
          <div className="space-y-1 text-sm">
            <div>
              <code className="text-purple-400">revline.booking-confirmed</code>
              <span className="text-zinc-500"> &mdash; Fires when user confirms booking via magic link</span>
            </div>
            <div>
              <code className="text-purple-400">revline.booking-waitlisted</code>
              <span className="text-zinc-500"> &mdash; Fires when booking goes to waitlist (event full)</span>
            </div>
          </div>
        </div>

        {/* Membership Signup */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-1">Membership Signup</h3>
          <p className="text-xs text-zinc-500 mb-4">
            Form ID: <code>membership-signup</code> &nbsp;|&nbsp; 
            Type: <code>signup</code> &nbsp;|&nbsp; 
            Path: <code>/public/&#123;slug&#125;/signup</code>
          </p>

          <p className="text-sm text-zinc-400 mb-4">
            A multi-step signup form for new memberships. Collects personal info, contact details, 
            and processes payment. No baked-in operations &mdash; all automation runs through workflows.
          </p>

          <h4 className="font-medium text-zinc-300 mb-2 text-sm">Baked-in Operations</h4>
          <p className="text-sm text-zinc-500 italic mb-4">None &mdash; this form relies entirely on workflows for automation.</p>

          <h4 className="font-medium text-zinc-300 mb-2 text-sm">Triggers (for Workflows)</h4>
          <div className="space-y-1 text-sm">
            <div>
              <code className="text-purple-400">revline.signup-completed</code>
              <span className="text-zinc-500"> &mdash; Fires when user completes all signup steps</span>
            </div>
            <div>
              <code className="text-purple-400">revline.signup-started</code>
              <span className="text-zinc-500"> &mdash; Fires when user begins the signup flow</span>
            </div>
            <div>
              <code className="text-purple-400">revline.signup-abandoned</code>
              <span className="text-zinc-500"> &mdash; Fires when user leaves without completing</span>
            </div>
          </div>
        </div>
      </section>

      {/* How Forms Connect to Workflows */}
      <section>
        <h2 className="text-xl font-semibold mb-4">How Forms Connect to Workflows</h2>
        <p className="text-zinc-300 mb-4">
          Form triggers become available as workflow trigger operations through the 
          <strong> RevLine adapter</strong>. This is the bridge between Layer 1 (baked-in) and Layer 2 (user-built).
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">The Connection Flow</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Form declares triggers in <code>FORM_REGISTRY</code> (e.g., <code>booking-confirmed</code>)</li>
            <li>2. Form is enabled on a workspace via RevLine integration config</li>
            <li>3. Trigger appears in the workflow builder as <code>revline.booking-confirmed</code></li>
            <li>4. User creates a workflow with that trigger and adds actions</li>
            <li>5. When the form&apos;s trigger fires, matching workflows execute</li>
          </ol>
        </div>

        <CodeBlock language="json" title="Example: Workflow reacting to a form trigger">{`{
  "name": "Post-Booking Automation",
  "trigger": "revline.booking-confirmed",
  "actions": [
    { "action": "revline.create_lead", "params": {} },
    { "action": "revline.update_lead_stage", "params": { "stage": "BOOKED" } },
    { "action": "mailerlite.add_to_group", "params": { "group": "booked" } }
  ]
}`}</CodeBlock>

        <WarningBox title="Dynamic Triggers">
          RevLine form triggers are workspace-scoped. They only appear in the workflow builder if 
          the form is enabled on that workspace. This ensures workspace isolation &mdash; you 
          can&apos;t create a workflow for a form that isn&apos;t active.
        </WarningBox>
      </section>

      {/* Enabling Forms */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Enabling Forms</h2>
        <p className="text-zinc-300 mb-4">
          Forms are enabled per-workspace through the RevLine integration configuration.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Setup Steps</h3>
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <span>Add the <strong>RevLine</strong> integration to the workspace (if not already present)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <span>Click <strong>&quot;Configure&quot;</strong> on the RevLine integration</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <span>Toggle the forms you want to enable (e.g., ABC Appointment Booking)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">4.</span>
              <span>Configure form-specific settings (copy, branding via organization templates)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">5.</span>
              <span>The form is now live at its public URL and triggers are available in the workflow builder</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Sites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Sites &amp; Custom Domains</h2>
        <p className="text-zinc-300 mb-4">
          Sites are how RevLine routes custom domains to workspace content. When a request arrives 
          on a custom domain, the site registry resolves it to the correct workspace and page.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-2">Public Page URLs</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Booking Form</span>
              <code className="text-white">/public/&#123;slug&#125;/book</code>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Signup Form</span>
              <code className="text-white">/public/&#123;slug&#125;/signup</code>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            With a custom domain, these become <code>book.yourbusiness.com/book</code> etc.
          </p>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">How Domain Resolution Works</h3>
          <ol className="space-y-1 text-sm text-zinc-400">
            <li>1. Request arrives at <code>book.yourbusiness.com</code></li>
            <li>2. Site registry (<code>app/_lib/sites/registry.ts</code>) maps hostname to site config</li>
            <li>3. Site config identifies the workspace</li>
            <li>4. Request is routed to the correct page layout and content</li>
          </ol>
        </div>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">For Developers</h2>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Files</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <div>
                <code className="text-white">app/_lib/forms/registry.ts</code>
                <p className="text-xs text-zinc-500 mt-1">
                  <code>FORM_REGISTRY</code> &mdash; all form definitions with baked-in operations and triggers.
                </p>
              </div>
              <div>
                <code className="text-white">app/_lib/templates/schemas.ts</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Template copy/branding field schemas (booking, signup).
                </p>
              </div>
              <div>
                <code className="text-white">app/_lib/sites/registry.ts</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Site definitions and domain-to-site resolution.
                </p>
              </div>
              <div>
                <code className="text-white">app/_lib/booking/</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Provider-agnostic booking system: magic link generation, verification, provider adapters.
                </p>
              </div>
              <div>
                <code className="text-white">app/api/v1/form-submit/route.ts</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Generic form submission handler with deduplication.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Adding a New Form</h3>
            <ol className="space-y-1 text-sm text-zinc-400">
              <li>1. Define form in <code>FORM_REGISTRY</code> with type, path, operations, and triggers</li>
              <li>2. Create page components at the form&apos;s path</li>
              <li>3. Add template schema in <code>app/_lib/templates/schemas.ts</code> if the form needs copy config</li>
              <li>4. Operations reference existing integration adapters &mdash; no new adapter needed unless using a new service</li>
              <li>5. Triggers automatically appear in the workflow builder when the form is enabled</li>
            </ol>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Patterns</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>- Form submissions are deduplicated (same data within same minute)</li>
              <li>- Form ID uniqueness is checked across workspaces via <code>/api/v1/check-form-id</code></li>
              <li>- Baked-in operations use existing adapter patterns (not raw API calls)</li>
              <li>- Magic link tokens are hashed before storage (never stored in plaintext)</li>
              <li>- Booking confirmation re-verifies eligibility before final booking</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
