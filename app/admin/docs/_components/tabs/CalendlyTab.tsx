import { TipBox, WarningBox, CodeBlock, SecretTable } from '../shared';

export function CalendlyTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-cyan-400">Calendly</span> Integration
        </h2>
        <p className="text-zinc-300 mb-4">
          Calendly handles booking webhooks. When someone schedules or cancels a call, 
          Calendly sends a webhook that triggers workflows to update lead stages.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Common Use Cases</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Update lead stage to BOOKED when call is scheduled</li>
            <li>• Revert stage to CAPTURED if booking is canceled</li>
            <li>• Add booked leads to a specific MailerLite group</li>
            <li>• Track booking conversion in event log</li>
          </ul>
        </div>
      </section>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400 mb-3">Client needs to set up in Calendly:</p>
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <span>Create event types (e.g., &quot;30 Minute Discovery Call&quot;)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <span>Go to Integrations → Webhooks</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <span>Add webhook endpoint</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">4.</span>
              <span>Copy the signing key</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Webhook Setup */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Webhook Setup</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Webhook URL</h3>
            <CodeBlock>{`https://yourdomain.com/api/calendly-webhook`}</CodeBlock>
            <p className="text-xs text-zinc-500 mt-2">
              Note: Calendly identifies the client via the email domain, not a query parameter
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Events to Subscribe</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <code className="text-white">invitee.created</code> — Booking created</li>
              <li>• <code className="text-white">invitee.canceled</code> — Booking canceled</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Secrets */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Secrets</h2>
        <SecretTable
          secrets={[
            {
              name: 'Webhook Secret',
              placeholder: 'your_signing_key_from_calendly',
              description: 'From Integrations → Webhooks → Your endpoint',
              required: true,
            },
          ]}
        />
      </section>

      {/* Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Calendly configuration is optional. You can store scheduling URLs for reference.
        </p>

        <CodeBlock language="json" title="Calendly Meta (JSON)">{`{
  "schedulingUrls": {
    "discovery": "https://calendly.com/yourname/30min",
    "strategy": "https://calendly.com/yourname/60min"
  }
}`}</CodeBlock>

        <TipBox>
          The scheduling URLs are just for reference. They&apos;re not used by workflows - 
          Calendly webhooks work independently of what URLs you store here.
        </TipBox>
      </section>

      {/* Triggers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Triggers</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-purple-400">calendly.booking_created</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Fires when someone books a call</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Payload fields:</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <div><code className="text-white">email</code> — Invitee email</div>
                <div><code className="text-white">name</code> — Invitee name</div>
                <div><code className="text-white">eventType</code> — Name of the event type</div>
                <div><code className="text-white">startTime</code> — Scheduled time</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-purple-400">calendly.booking_canceled</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Fires when a booking is canceled</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Payload fields:</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <div><code className="text-white">email</code> — Invitee email</div>
                <div><code className="text-white">name</code> — Invitee name</div>
                <div><code className="text-white">reason</code> — Cancellation reason (if provided)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Common Patterns */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Common Patterns</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Update Stage on Booking</h3>
            <p className="text-sm text-zinc-400 mb-3">Mark leads as booked when they schedule a call</p>
            <CodeBlock language="json">{`Workflow: "Booking → Update Stage"
Trigger: calendly.booking_created
Actions:
  - revline.update_lead_stage → { "stage": "BOOKED" }`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Add to Booked Calls Group</h3>
            <p className="text-sm text-zinc-400 mb-3">Also add to a MailerLite group for booked leads</p>
            <CodeBlock language="json">{`Workflow: "Booking → Group"
Trigger: calendly.booking_created
Actions:
  - revline.update_lead_stage → { "stage": "BOOKED" }
  - mailerlite.add_to_group → { "group": "booked_calls" }`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Handle Cancellation</h3>
            <p className="text-sm text-zinc-400 mb-3">Revert stage if booking is canceled</p>
            <CodeBlock language="json">{`Workflow: "Cancellation → Revert Stage"
Trigger: calendly.booking_canceled
Actions:
  - revline.update_lead_stage → { "stage": "CAPTURED" }
  - mailerlite.remove_from_group → { "group": "booked_calls" }`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* UTM Tracking */}
      <section>
        <h2 className="text-xl font-semibold mb-4">UTM Tracking</h2>
        <p className="text-zinc-300 mb-4">
          Add UTM parameters to Calendly links to track where bookings come from.
        </p>
        <CodeBlock>{`https://calendly.com/yourname/30min?utm_source=CLIENT_SLUG`}</CodeBlock>
        <TipBox>
          When linking to Calendly from landing pages or emails, include <code>utm_source</code> 
          with the client slug. This helps identify which client the booking belongs to.
        </TipBox>
      </section>

      {/* Troubleshooting */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Issue</th>
                <th className="pb-2 font-medium">Cause</th>
                <th className="pb-2 font-medium">Fix</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Webhook returns 401</td>
                <td className="py-3 text-zinc-400">Invalid signing key</td>
                <td className="py-3 text-zinc-400">Re-copy key from Calendly webhook settings</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Booking not tracked</td>
                <td className="py-3 text-zinc-400">Client not identified</td>
                <td className="py-3 text-zinc-400">Check email domain matching or UTM params</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Stage not updating</td>
                <td className="py-3 text-zinc-400">No workflow configured</td>
                <td className="py-3 text-zinc-400">Create workflow with calendly.booking_created trigger</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
