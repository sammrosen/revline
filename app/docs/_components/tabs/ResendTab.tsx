import { TipBox, CodeBlock, SecretTable } from '../shared';

export function ResendTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-pink-400">Resend</span> Integration
        </h2>
        <p className="text-zinc-300 mb-4">
          Resend handles transactional email &mdash; booking confirmations, magic link emails, and 
          other system-generated messages. Unlike MailerLite (which handles marketing lists), 
          Resend is for operational emails that are part of a user flow.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Current Usage</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>&bull; <strong>Magic link emails</strong> &mdash; Sent during the booking flow to confirm appointments</li>
            <li>&bull; <strong>Booking confirmations</strong> &mdash; Confirmation email after successful booking</li>
            <li>&bull; <strong>Workflow action</strong> &mdash; <code>resend.send_email</code> available in workflows</li>
          </ul>
        </div>
      </section>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <span><strong>Resend account</strong> &mdash; Sign up at <code>resend.com</code></span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <span><strong>Verified domain</strong> &mdash; Add and verify your sending domain in Resend</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <span><strong>API key</strong> &mdash; Generate an API key from the Resend dashboard</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Secrets */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Secrets</h2>
        <SecretTable
          secrets={[
            {
              name: 'API Key',
              placeholder: 're_xxxxxxxxxxxxx',
              description: 'From Resend dashboard → API Keys',
              required: true,
            },
          ]}
        />
      </section>

      {/* Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Resend configuration uses the <strong>structured editor</strong> to set sender details 
          for the workspace.
        </p>

        <CodeBlock language="json" title="Resend Meta (JSON)">{`{
  "fromEmail": "bookings@yourbusiness.com",
  "fromName": "Your Business Name",
  "replyTo": "support@yourbusiness.com"
}`}</CodeBlock>

        <TipBox title="Workspace-Scoped Senders">
          Each workspace can have its own sender address. If no Resend integration is configured 
          on a workspace, the system falls back to the default sender from environment variables. 
          This means booking emails will still work even without a workspace-level Resend setup.
        </TipBox>
      </section>

      {/* Workspace-Scoped Senders */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Workspace-Scoped Senders</h2>
        <p className="text-zinc-300 mb-4">
          The sender address for transactional emails is resolved in this order:
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">1</span>
              <div>
                <p className="font-medium text-white">Workspace Resend Integration</p>
                <p className="text-sm text-zinc-400">If the workspace has a Resend integration with <code>fromEmail</code> in its meta, that address is used.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">2</span>
              <div>
                <p className="font-medium text-white">Environment Variable Fallback</p>
                <p className="text-sm text-zinc-400">If no workspace integration, falls back to <code>RESEND_FROM_EMAIL</code> env var.</p>
              </div>
            </li>
          </ol>
        </div>

        <p className="text-sm text-zinc-400 mt-4">
          This means you can run multiple workspaces with different sender addresses (e.g., 
          <code>bookings@clienta.com</code> and <code>bookings@clientb.com</code>) without 
          sharing credentials.
        </p>
      </section>

      {/* Workflow Actions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Workflow Actions</h2>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-1">
            <code className="text-pink-400">resend.send_email</code>
          </h3>
          <p className="text-sm text-zinc-400 mb-3">Send a transactional email via Resend</p>
          <div className="bg-zinc-950 rounded p-3">
            <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
            <div className="text-sm space-y-1">
              <div>
                <code className="text-white">template</code>
                <span className="text-zinc-500"> &mdash; Email template identifier (e.g., &quot;booking-confirm&quot;)</span>
              </div>
              <div>
                <code className="text-white">subject</code>
                <span className="text-zinc-500"> &mdash; Email subject line (optional, template default used)</span>
              </div>
            </div>
          </div>
        </div>

        <TipBox>
          Resend is primarily used by baked-in form operations (magic link emails) rather than 
          user-built workflows. However, the <code>resend.send_email</code> action is available 
          in the workflow builder for custom transactional email needs.
        </TipBox>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">For Developers</h2>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Files</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <div>
                <code className="text-white">app/_lib/integrations/resend.adapter.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Resend adapter &mdash; handles API calls, sender resolution</p>
              </div>
              <div>
                <code className="text-white">app/_lib/email/index.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Email service &mdash; sends emails with workspace-scoped senders</p>
              </div>
              <div>
                <code className="text-white">app/_lib/email/templates/</code>
                <p className="text-xs text-zinc-500 mt-1">Email templates (booking confirmation, etc.)</p>
              </div>
              <div>
                <code className="text-white">app/_lib/workflow/executors/resend.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Workflow executor for <code>resend.send_email</code> action</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Patterns</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>- API key stored as encrypted secret, never in meta</li>
              <li>- Sender address resolved from workspace config, then env fallback</li>
              <li>- Email sending failures logged but never break the main flow</li>
              <li>- Templates use plain text + HTML variants for accessibility</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
