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
          run in sequence.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-purple-400">Trigger</span>
            <span>→</span>
            <span className="text-zinc-500">[Filter]</span>
            <span>→</span>
            <span className="text-green-400">Action 1</span>
            <span>→</span>
            <span className="text-green-400">Action 2</span>
            <span>→</span>
            <span className="text-green-400">...</span>
          </div>
        </div>
      </section>

      {/* Available Triggers */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Available Triggers</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Triggers are events that start a workflow. Each comes from an integration.
        </p>
        <div className="overflow-x-auto scrollbar-hide">
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
            description="Create or update a lead record in the database"
            params={[{ key: 'source', description: 'Lead source identifier (optional)' }]}
          />
          <ActionCard
            name="revline.update_lead_stage"
            label="Update Lead Stage"
            description="Update the stage of a lead"
            params={[{ key: 'stage', description: 'CAPTURED | BOOKED | PAID | DEAD' }]}
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
            description="Add subscriber to a MailerLite group"
            params={[{ key: 'group', description: 'Group key from config (e.g., "leads", "customers")' }]}
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
              <p className="font-medium text-white">Go to the client&apos;s Workflows tab</p>
              <p className="text-sm text-zinc-400">Navigate to the client detail page and click &quot;Workflows&quot;</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">2</span>
            <div>
              <p className="font-medium text-white">Click &quot;+ New Workflow&quot;</p>
              <p className="text-sm text-zinc-400">Opens the workflow editor</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">3</span>
            <div>
              <p className="font-medium text-white">Select a trigger</p>
              <p className="text-sm text-zinc-400">Choose what event should start this workflow</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">4</span>
            <div>
              <p className="font-medium text-white">Add actions</p>
              <p className="text-sm text-zinc-400">Add one or more actions with their parameters</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">5</span>
            <div>
              <p className="font-medium text-white">Save and enable</p>
              <p className="text-sm text-zinc-400">Workflow is now active and will run when trigger fires</p>
            </div>
          </li>
        </ol>
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
            <h3 className="font-medium text-white mb-2">Email Capture → MailerLite</h3>
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
            <h3 className="font-medium text-white mb-2">Payment → Update Stage + Customer Group</h3>
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
            <h3 className="font-medium text-white mb-2">Booking → Update Stage</h3>
            <p className="text-sm text-zinc-400 mb-3">Mark lead as booked when they schedule a call</p>
            <CodeBlock language="json">{`{
  "trigger": "calendly.booking_created",
  "actions": [
    { "action": "revline.update_lead_stage", "params": { "stage": "BOOKED" } }
  ]
}`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Email Capture → ABC Ignite Booking</h3>
            <p className="text-sm text-zinc-400 mb-3">Automatically book an intro appointment for new leads</p>
            <CodeBlock language="json">{`{
  "trigger": "revline.email_captured",
  "actions": [
    { "action": "revline.create_lead", "params": {} },
    { "action": "abc_ignite.enroll_member", "params": { "eventId": "intro_session" } }
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
              status, timing, and any error messages.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Check Event Log</h3>
            <p className="text-sm text-zinc-400">
              The Events tab on the client detail page shows all events including workflow executions. 
              Filter by &quot;WORKFLOW&quot; system to see only workflow events.
            </p>
          </div>
        </div>
        <WarningBox title="Actions Stop on Error">
          When an action fails, the workflow stops immediately. Remaining actions are skipped. 
          Check execution history to see which action failed and why.
        </WarningBox>
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
          <span className="text-zinc-500 text-sm ml-2">— {label}</span>
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
