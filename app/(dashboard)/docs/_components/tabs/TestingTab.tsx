import { TipBox, WarningBox, CodeBlock } from '../shared';

export function TestingTab() {
  return (
    <div className="space-y-8">
      {/* Health Checks */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Health Checks</h2>
        <p className="text-zinc-300 mb-4">
          Health checks verify that integrations are working correctly. They run automatically 
          every 15 minutes and can be triggered manually.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">What Gets Checked</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-green-400 mt-0.5">●</span>
              <div>
                <p className="font-medium text-white">MailerLite</p>
                <p className="text-sm text-zinc-400">API key valid, all configured groups exist</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-purple-400 mt-0.5">●</span>
              <div>
                <p className="font-medium text-white">Stripe</p>
                <p className="text-sm text-zinc-400">Webhook signature valid (tested on actual webhooks)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-cyan-400 mt-0.5">●</span>
              <div>
                <p className="font-medium text-white">Calendly</p>
                <p className="text-sm text-zinc-400">Webhook signature valid (tested on actual webhooks)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-orange-400 mt-0.5">●</span>
              <div>
                <p className="font-medium text-white">ABC Ignite</p>
                <p className="text-sm text-zinc-400">API credentials valid, club accessible</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Running Manual Health Check</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to the client detail page</li>
            <li>2. Click the <strong>&quot;Run Health Check&quot;</strong> button</li>
            <li>3. Wait for results (usually 5-10 seconds)</li>
            <li>4. Review any failures and fix configurations</li>
          </ol>
        </div>

        <TipBox title="Health Status Indicators">
          <span className="text-green-400">●</span> Green = Healthy &nbsp;
          <span className="text-yellow-400">●</span> Yellow = Warning &nbsp;
          <span className="text-red-400">●</span> Red = Failed
        </TipBox>
      </section>

      {/* Test Flows */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Test Flows</h2>
        
        {/* Email Capture Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">1. Email Capture</h3>
          <p className="text-sm text-zinc-400 mb-3">Test the email capture endpoint directly:</p>
          <CodeBlock title="curl command">{`curl -X POST https://yourdomain.com/api/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","source":"CLIENT_SLUG"}'`}</CodeBlock>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Verify:</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>✓ Response returns success</li>
              <li>✓ Event appears in admin dashboard</li>
              <li>✓ Subscriber added to MailerLite group (if workflow configured)</li>
              <li>✓ Lead created in Leads tab</li>
            </ul>
          </div>
        </div>

        {/* Stripe Payment Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">2. Stripe Payment</h3>
          <p className="text-sm text-zinc-400 mb-3">Use Stripe test mode:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Make sure Stripe is in <strong>Test Mode</strong></li>
            <li>2. Use test card: <code className="text-white">4242 4242 4242 4242</code></li>
            <li>3. Any future expiry, any CVC</li>
            <li>4. Complete checkout</li>
          </ol>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Verify:</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>✓ Stripe webhook delivery shows 200 response</li>
              <li>✓ Payment event appears in admin dashboard</li>
              <li>✓ Lead stage updated to PAID (if workflow configured)</li>
              <li>✓ Subscriber added to customers group in MailerLite</li>
            </ul>
          </div>
        </div>

        {/* Calendly Booking Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">3. Calendly Booking</h3>
          <p className="text-sm text-zinc-400 mb-3">Create a test booking:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to client&apos;s Calendly scheduling link</li>
            <li>2. Book a test appointment with test email</li>
            <li>3. Complete booking</li>
          </ol>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Verify:</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>✓ Booking event appears in admin dashboard</li>
              <li>✓ Lead stage updated to BOOKED (if workflow configured)</li>
            </ul>
          </div>
          <TipBox>
            Remember to cancel the test booking afterwards to not clutter the client&apos;s calendar.
          </TipBox>
        </div>

        {/* ABC Ignite Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">4. ABC Ignite</h3>
          <p className="text-sm text-zinc-400 mb-3">Test the API connection:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to ABC Ignite integration configuration</li>
            <li>2. Click &quot;Sync from ABC Ignite&quot;</li>
            <li>3. Should return list of event types</li>
          </ol>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">If sync succeeds, credentials and club number are valid.</p>
          </div>
        </div>
      </section>

      {/* Event Verification */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Event Verification</h2>
        <p className="text-zinc-300 mb-4">
          After testing, verify events are logged correctly in the admin dashboard.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Where to Check</h3>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3">
              <span className="text-zinc-500">•</span>
              <div>
                <strong>Events Tab</strong> (on client detail page)
                <p className="text-zinc-400">Shows all events for this client with timestamps and status</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">•</span>
              <div>
                <strong>Workflow Executions</strong> (clock icon on workflow)
                <p className="text-zinc-400">Shows each time the workflow ran, with action results</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">•</span>
              <div>
                <strong>Leads Tab</strong> (on client detail page)
                <p className="text-zinc-400">Shows all captured leads with stage and source</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Troubleshooting */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Common Issues</h2>
        
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Symptom</th>
                <th className="pb-2 font-medium">Possible Cause</th>
                <th className="pb-2 font-medium">Solution</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Email capture returns error</td>
                <td className="py-3 text-zinc-400">Client not found</td>
                <td className="py-3 text-zinc-400">Check <code>source</code> matches client slug</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Webhook not received</td>
                <td className="py-3 text-zinc-400">Wrong webhook URL</td>
                <td className="py-3 text-zinc-400">Verify URL in Stripe/Calendly settings</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Webhook returns 401</td>
                <td className="py-3 text-zinc-400">Invalid signing secret</td>
                <td className="py-3 text-zinc-400">Re-copy secret from webhook settings</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Event logged but workflow didn&apos;t run</td>
                <td className="py-3 text-zinc-400">No matching workflow</td>
                <td className="py-3 text-zinc-400">Create workflow with correct trigger</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Workflow ran but action failed</td>
                <td className="py-3 text-zinc-400">Integration misconfigured</td>
                <td className="py-3 text-zinc-400">Check execution history for error details</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Lead not added to MailerLite</td>
                <td className="py-3 text-zinc-400">Invalid group ID</td>
                <td className="py-3 text-zinc-400">Verify group ID in MailerLite config</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Stage not updating</td>
                <td className="py-3 text-zinc-400">Lead not created yet</td>
                <td className="py-3 text-zinc-400">Add <code>revline.create_lead</code> action first</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Debugging Workflows */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Debugging Workflows</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">1. Check Workflow is Enabled</h3>
            <p className="text-sm text-zinc-400">
              On the Workflows tab, make sure the workflow toggle is ON (green). 
              Disabled workflows won&apos;t run even if the trigger fires.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">2. Check Trigger Matches</h3>
            <p className="text-sm text-zinc-400">
              Verify the workflow trigger matches the event. For example, 
              <code className="text-white mx-1">stripe.payment_succeeded</code> 
              won&apos;t fire on subscription events.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">3. Check Filter (if any)</h3>
            <p className="text-sm text-zinc-400">
              If the workflow has a trigger filter, make sure the event payload matches. 
              For product filters, verify the Stripe metadata matches.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">4. Check Execution History</h3>
            <p className="text-sm text-zinc-400">
              Click the clock icon on the workflow to see recent executions. 
              Failed executions show error messages that explain what went wrong.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">5. Check Integration Config</h3>
            <p className="text-sm text-zinc-400">
              If an action fails, the integration might be misconfigured. 
              For MailerLite, verify group keys exist. 
              For ABC Ignite, verify event type IDs are valid.
            </p>
          </div>
        </div>

        <WarningBox title="Actions Stop on Error">
          When an action fails, remaining actions are skipped. Fix the failing action 
          to allow subsequent actions to run.
        </WarningBox>
      </section>

      {/* Pre-Launch Checklist */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Pre-Launch Checklist</h2>
        <p className="text-zinc-300 mb-4">
          Before going live with a new client, verify everything works:
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Health check passes for all integrations
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Test email capture works (appears in MailerLite)
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Test payment works (lead stage updates)
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Test booking works (if Calendly configured)
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              All workflows enabled
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Client execution NOT paused
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Production webhook URLs configured (not test)
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
