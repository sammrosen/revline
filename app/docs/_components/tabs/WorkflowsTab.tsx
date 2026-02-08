import { TipBox, WarningBox, CodeBlock } from '../shared';

export function WorkflowsTab() {
  return (
    <div className="space-y-8">
      {/* What is a Workflow */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">What is a Workflow?</h2>
        <p className="text-zinc-300 mb-4">
          A workflow connects a <strong>trigger</strong> (an event that happens) to one or more 
          <strong> actions</strong> (operations to execute). When the trigger fires, all actions 
          run in sequence. Workflows are <strong>Layer 2</strong> of RevLine&apos;s automation 
          system &mdash; they react to events from forms (Layer 1) and external webhooks.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-purple-400">Trigger</span>
            <span>&rarr;</span>
            <span className="text-zinc-500">[Filter]</span>
            <span>&rarr;</span>
            <span className="text-green-400">Action 1</span>
            <span>&rarr;</span>
            <span className="text-green-400">Action 2</span>
            <span>&rarr;</span>
            <span className="text-green-400">...</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg">
          <p className="text-sm text-amber-200">
            <strong>Two-Layer Context:</strong> Baked-in operations (Layer 1) run automatically 
            from form definitions regardless of workflows. Workflows (Layer 2) are user-configured 
            responses to triggers. Both layers are visible on the network graph.
          </p>
        </div>
      </section>

      {/* Available Triggers */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Available Triggers</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Triggers are events that start a workflow. They come from integrations or form events.
        </p>

        {/* External Triggers */}
        <h3 className="text-lg font-medium text-zinc-300 mb-3">External Triggers (Webhooks)</h3>
        <div className="overflow-x-auto scrollbar-hide mb-6">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium">Integration</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">revline.email_captured</code></td>
                <td className="py-3 text-zinc-400">RevLine</td>
                <td className="py-3 text-zinc-400">Lead submits email on landing page</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">stripe.payment_succeeded</code></td>
                <td className="py-3 text-zinc-400">Stripe</td>
                <td className="py-3 text-zinc-400">One-time payment completes</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">stripe.subscription_created</code></td>
                <td className="py-3 text-zinc-400">Stripe</td>
                <td className="py-3 text-zinc-400">New subscription starts</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">stripe.subscription_canceled</code></td>
                <td className="py-3 text-zinc-400">Stripe</td>
                <td className="py-3 text-zinc-400">Subscription is canceled</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">calendly.booking_created</code></td>
                <td className="py-3 text-zinc-400">Calendly</td>
                <td className="py-3 text-zinc-400">Someone books a call</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">calendly.booking_canceled</code></td>
                <td className="py-3 text-zinc-400">Calendly</td>
                <td className="py-3 text-zinc-400">Booking is canceled</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">manychat.dm_received</code></td>
                <td className="py-3 text-zinc-400">ManyChat</td>
                <td className="py-3 text-zinc-400">DM received matching keyword</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Form Triggers */}
        <h3 className="text-lg font-medium text-zinc-300 mb-3">Form Triggers (RevLine)</h3>
        <p className="text-zinc-400 text-sm mb-3">
          These triggers come from enabled forms. They are <strong>workspace-scoped</strong> &mdash; a trigger 
          only appears in the workflow builder if that form is enabled on the workspace.
        </p>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium">Form</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">revline.booking-confirmed</code></td>
                <td className="py-3 text-zinc-400">ABC Appointment Booking</td>
                <td className="py-3 text-zinc-400">User confirms booking via magic link</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">revline.booking-waitlisted</code></td>
                <td className="py-3 text-zinc-400">ABC Appointment Booking</td>
                <td className="py-3 text-zinc-400">Booking added to waitlist (event full)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">revline.signup-completed</code></td>
                <td className="py-3 text-zinc-400">Membership Signup</td>
                <td className="py-3 text-zinc-400">User completes all signup steps</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">revline.signup-started</code></td>
                <td className="py-3 text-zinc-400">Membership Signup</td>
                <td className="py-3 text-zinc-400">User begins the signup flow</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-purple-400">revline.signup-abandoned</code></td>
                <td className="py-3 text-zinc-400">Membership Signup</td>
                <td className="py-3 text-zinc-400">User leaves without completing</td>
              </tr>
            </tbody>
          </table>
        </div>
        <TipBox title="Dynamic Triggers">
          RevLine form triggers only appear if the form is enabled on the workspace. Enable forms 
          in the RevLine integration configuration. See the <strong>Forms &amp; Sites</strong> tab.
        </TipBox>
      </section>

      {/* Available Actions */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Available Actions</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Actions are operations a workflow can execute. Some require specific integrations to be configured.
        </p>
        
        {/* RevLine Actions */}
        <h3 className="text-lg font-medium text-zinc-300 mb-3 mt-6">RevLine (always available)</h3>
        <div className="space-y-2 mb-6">
          <ActionCard
            name="revline.create_lead"
            label="Create/Update Lead"
            description="Create or update a lead record. Can set custom properties on creation."
            params={[
              { key: 'source', description: 'Lead source identifier (optional)' },
              { key: 'properties', description: 'Custom property values (optional)' },
              { key: 'captureProperties', description: 'true to auto-extract from trigger payload (optional)' },
            ]}
          />
          <ActionCard
            name="revline.update_lead_stage"
            label="Update Lead Stage"
            description="Update the stage of a lead (supports custom stages)"
            params={[{ key: 'stage', description: 'Stage name (e.g., CAPTURED, BOOKED, PAID, or custom)' }]}
          />
          <ActionCard
            name="revline.update_lead_properties"
            label="Update Lead Properties"
            description="Set or merge custom properties on an existing lead"
            params={[
              { key: 'properties', description: 'Property values to set (merged with existing)' },
              { key: 'fromPayload', description: 'true to auto-extract from trigger payload (optional)' },
            ]}
          />
          <ActionCard
            name="revline.emit_event"
            label="Log Custom Event"
            description="Emit a custom event to the event log"
            params={[
              { key: 'eventType', description: 'Event type name' },
              { key: 'success', description: 'true | false' },
            ]}
          />
        </div>

        {/* MailerLite Actions */}
        <h3 className="text-lg font-medium text-green-400 mb-3">MailerLite</h3>
        <div className="space-y-2 mb-6">
          <ActionCard
            name="mailerlite.add_to_group"
            label="Add to Group"
            description="Add subscriber to a MailerLite group, optionally mapping lead properties to subscriber fields"
            params={[
              { key: 'group', description: 'Group key from config (e.g., "leads", "customers")' },
              { key: 'fields', description: 'Map lead properties to MailerLite fields (optional)' },
            ]}
          />
          <ActionCard
            name="mailerlite.remove_from_group"
            label="Remove from Group"
            description="Remove subscriber from a MailerLite group"
            params={[{ key: 'group', description: 'Group key from config' }]}
          />
          <ActionCard
            name="mailerlite.add_tag"
            label="Add Tag"
            description="Add a tag to a subscriber"
            params={[{ key: 'tag', description: 'Tag name to add' }]}
          />
        </div>

        {/* ABC Ignite Actions */}
        <h3 className="text-lg font-medium text-orange-400 mb-3">ABC Ignite</h3>
        <div className="space-y-2 mb-6">
          <ActionCard
            name="abc_ignite.lookup_member"
            label="Lookup Member"
            description="Find a member by barcode and return their memberId"
            params={[]}
          />
          <ActionCard
            name="abc_ignite.check_availability"
            label="Check Availability"
            description="Check employee availability for an event type"
            params={[
              { key: 'employeeId', description: 'Employee ID (optional)' },
              { key: 'eventTypeId', description: 'Event type ID (optional)' },
            ]}
          />
          <ActionCard
            name="abc_ignite.enroll_member"
            label="Enroll Member"
            description="Book a member into a calendar event"
            params={[
              { key: 'eventId', description: 'ABC Ignite event ID' },
              { key: 'checkBalance', description: 'Check session balance before booking' },
            ]}
          />
          <ActionCard
            name="abc_ignite.unenroll_member"
            label="Unenroll Member"
            description="Cancel a member booking from a calendar event"
            params={[{ key: 'eventId', description: 'ABC Ignite event ID' }]}
          />
        </div>

        {/* Resend Actions */}
        <h3 className="text-lg font-medium text-pink-400 mb-3">Resend</h3>
        <div className="space-y-2 mb-6">
          <ActionCard
            name="resend.send_email"
            label="Send Email"
            description="Send a transactional email via Resend. Templates support {{lead.propertyKey}} variables."
            params={[
              { key: 'template', description: 'Email template identifier' },
              { key: 'subject', description: 'Email subject (optional, uses template default)' },
            ]}
          />
        </div>

        {/* ManyChat Actions */}
        <h3 className="text-lg font-medium text-blue-400 mb-3">ManyChat</h3>
        <div className="space-y-2">
          <ActionCard
            name="manychat.trigger_flow"
            label="Trigger Flow"
            description="Trigger a ManyChat flow for a subscriber"
            params={[{ key: 'flowId', description: 'ManyChat flow ID' }]}
          />
          <ActionCard
            name="manychat.add_tag"
            label="Add Tag"
            description="Add a tag to a ManyChat subscriber"
            params={[{ key: 'tag', description: 'Tag name' }]}
          />
        </div>
      </section>

      {/* Creating a Workflow */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Creating a Workflow</h2>
        <ol className="space-y-4">
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">1</span>
            <div>
              <p className="font-medium text-white">Go to the workspace&apos;s Workflows tab</p>
              <p className="text-sm text-zinc-400">Navigate to the workspace detail page, switch to the &quot;Workflows&quot; tab, and toggle to list view</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">2</span>
            <div>
              <p className="font-medium text-white">Click &quot;+ New Workflow&quot;</p>
              <p className="text-sm text-zinc-400">Opens the workflow editor modal</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">3</span>
            <div>
              <p className="font-medium text-white">Select a trigger</p>
              <p className="text-sm text-zinc-400">Choose what event should start this workflow. RevLine form triggers only appear if the form is enabled.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">4</span>
            <div>
              <p className="font-medium text-white">Add actions</p>
              <p className="text-sm text-zinc-400">Add one or more actions with their parameters. Actions run in sequence.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">5</span>
            <div>
              <p className="font-medium text-white">Save and enable</p>
              <p className="text-sm text-zinc-400">The workflow is validated before it can be enabled. Fix any errors shown.</p>
            </div>
          </li>
        </ol>
        <WarningBox title="Validation Required">
          Workflows are validated before they can be enabled. The system checks that required 
          integrations are configured, action parameters are valid, and trigger operations exist. 
          Active workflows cannot be edited &mdash; disable first, then edit.
        </WarningBox>
      </section>

      {/* Trigger Filters */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Trigger Filters</h2>
        <p className="text-zinc-300 mb-4">
          Filters let workflows run only when specific conditions match. This is useful for 
          product-specific routing.
        </p>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-400 mb-2">Example: Only run for &quot;fit1&quot; product purchases</p>
            <CodeBlock language="json">{`{ "product": "fit1" }`}</CodeBlock>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-400 mb-2">Example: Multiple conditions (AND)</p>
            <CodeBlock language="json">{`{ "product": "premium", "amount": 99900 }`}</CodeBlock>
          </div>
        </div>
        <TipBox title="Multi-Product Setup">
          Create separate workflows for each product, each with a filter matching the Stripe 
          metadata. Use <code>program</code> metadata on Stripe Payment Links.
        </TipBox>
      </section>

      {/* Common Patterns */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Common Workflow Patterns</h2>
        
        <div className="space-y-6">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Email Capture &rarr; MailerLite</h3>
            <p className="text-sm text-zinc-400 mb-3">Add new leads to a MailerLite group</p>
            <CodeBlock language="json">{`{
  "trigger": "revline.email_captured",
  "actions": [
    { "action": "revline.create_lead", "params": {} },
    { "action": "mailerlite.add_to_group", "params": { "group": "leads" } }
  ]
}`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Payment &rarr; Update Stage + Customer Group</h3>
            <p className="text-sm text-zinc-400 mb-3">Mark lead as paid and add to customers group</p>
            <CodeBlock language="json">{`{
  "trigger": "stripe.payment_succeeded",
  "actions": [
    { "action": "revline.update_lead_stage", "params": { "stage": "PAID" } },
    { "action": "mailerlite.add_to_group", "params": { "group": "customers" } }
  ]
}`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Booking Confirmed &rarr; Lead Pipeline</h3>
            <p className="text-sm text-zinc-400 mb-3">Update lead and notify when a booking is confirmed via magic link</p>
            <CodeBlock language="json">{`{
  "trigger": "revline.booking-confirmed",
  "actions": [
    { "action": "revline.create_lead", "params": {} },
    { "action": "revline.update_lead_stage", "params": { "stage": "BOOKED" } },
    { "action": "mailerlite.add_to_group", "params": { "group": "booked" } }
  ]
}`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Signup Completed &rarr; Welcome Flow</h3>
            <p className="text-sm text-zinc-400 mb-3">Add new signups to lead pipeline and email list</p>
            <CodeBlock language="json">{`{
  "trigger": "revline.signup-completed",
  "actions": [
    { "action": "revline.create_lead", "params": { "source": "signup" } },
    { "action": "revline.update_lead_stage", "params": { "stage": "PAID" } },
    { "action": "mailerlite.add_to_group", "params": { "group": "members" } }
  ]
}`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* Debugging */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Debugging Workflows</h2>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">View Execution History</h3>
            <p className="text-sm text-zinc-400">
              Click the clock icon on any workflow to see recent executions, including success/failure 
              status, timing, and any error messages. Failed executions can be retried.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Check Event Log</h3>
            <p className="text-sm text-zinc-400">
              The Events tab on the workspace detail page shows all events including workflow executions. 
              Filter by &quot;WORKFLOW&quot; system to see only workflow events.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Network Graph</h3>
            <p className="text-sm text-zinc-400">
              Switch to the graph view on the Workflows tab to see a visual representation of all 
              forms, integrations, and workflow connections. Workflow edges show validation status.
            </p>
          </div>
        </div>
        <WarningBox title="Actions Stop on Error">
          When an action fails, the workflow stops immediately. Remaining actions are skipped. 
          Check execution history to see which action failed and why.
        </WarningBox>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">For Developers</h2>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Files</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <div>
                <code className="text-white">app/_lib/workflow/engine.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Core execution engine &mdash; matches triggers, runs actions sequentially, handles errors.</p>
              </div>
              <div>
                <code className="text-white">app/_lib/workflow/executors/</code>
                <p className="text-xs text-zinc-500 mt-1">Per-adapter action executors (mailerlite.ts, resend.ts, revline.ts, abc-ignite.ts).</p>
              </div>
              <div>
                <code className="text-white">app/_lib/workflow/validation.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Validation rules that run before a workflow can be enabled.</p>
              </div>
              <div>
                <code className="text-white">app/_lib/workflow/registry.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Available triggers and actions registry, including dynamic form triggers.</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Patterns</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>- Actions execute sequentially; failure stops the chain</li>
              <li>- Workflow validation prevents enabling invalid configurations</li>
              <li>- Active workflows are locked from edits (must disable first)</li>
              <li>- Integrations used by active workflows cannot be deleted</li>
              <li>- Execution history includes correlation IDs for debugging</li>
              <li>- Failed executions can be retried via the UI</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionCard({ 
  name, 
  label, 
  description, 
  params 
}: { 
  name: string; 
  label: string; 
  description: string; 
  params: { key: string; description: string }[];
}) {
  return (
    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <code className="text-white text-sm">{name}</code>
          <span className="text-zinc-500 text-sm ml-2">&mdash; {label}</span>
        </div>
      </div>
      <p className="text-xs text-zinc-400 mt-1">{description}</p>
      {params.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-800">
          <div className="flex flex-wrap gap-2">
            {params.map((p) => (
              <span key={p.key} className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                {p.key}: <span className="text-zinc-500">{p.description}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
