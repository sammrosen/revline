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
            <div className="flex items-start gap-3">
              <span className="text-pink-400 mt-0.5">●</span>
              <div>
                <p className="font-medium text-white">Resend</p>
                <p className="text-sm text-zinc-400">API key valid, sender domain verified</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Running Manual Health Check</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to the workspace detail page</li>
            <li>2. Click the <strong>&quot;Run Health Check&quot;</strong> button (or use the Actions dropdown)</li>
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

      {/* Testing Panel */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Testing Panel</h2>
        <p className="text-zinc-300 mb-4">
          The <strong>Testing</strong> tab in the workspace detail page provides a built-in API testing 
          tool. You can test integration endpoints directly without leaving the dashboard.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">Features</h3>
          <ul className="text-sm text-zinc-400 space-y-2">
            <li>&bull; <strong>Multi-panel support</strong> &mdash; Run up to 3 test panels simultaneously</li>
            <li>&bull; <strong>Integration selector</strong> &mdash; Choose which integration to test</li>
            <li>&bull; <strong>Known endpoints</strong> &mdash; Pre-configured endpoints for each integration (availability, employees, etc.)</li>
            <li>&bull; <strong>Custom requests</strong> &mdash; Enter any endpoint, method, and JSON body</li>
            <li>&bull; <strong>Response viewer</strong> &mdash; Syntax-highlighted JSON with searchable results and match navigation</li>
            <li>&bull; <strong>Status and timing</strong> &mdash; Response status code and duration for each request</li>
          </ul>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Using the Testing Panel</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to workspace detail &rarr; <strong>Testing</strong> tab</li>
            <li>2. Click <strong>&quot;+ Add Panel&quot;</strong></li>
            <li>3. Select an integration (e.g., ABC Ignite)</li>
            <li>4. Choose a known endpoint (e.g., &quot;Get Availability&quot;) or enter a custom one</li>
            <li>5. Fill in parameters or JSON body</li>
            <li>6. Click <strong>&quot;Send&quot;</strong> and inspect the response</li>
          </ol>
        </div>

        <TipBox>
          The testing panel makes API requests through RevLine, using the workspace&apos;s configured 
          integration credentials. This lets you test the full request path including authentication.
        </TipBox>
      </section>

      {/* Test Flows */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Test Flows</h2>
        
        {/* Email Capture Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">1. Email Capture</h3>
          <p className="text-sm text-zinc-400 mb-3">Test the email capture endpoint directly:</p>
          <CodeBlock title="curl command">{`curl -X POST https://yourdomain.com/api/v1/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","source":"WORKSPACE_SLUG"}'`}</CodeBlock>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Verify:</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>&#10003; Response returns success</li>
              <li>&#10003; Event appears in workspace Events tab</li>
              <li>&#10003; Subscriber added to MailerLite group (if workflow configured)</li>
              <li>&#10003; Lead created in Leads tab</li>
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
              <li>&#10003; Stripe webhook delivery shows 200 response</li>
              <li>&#10003; Payment event appears in workspace Events tab</li>
              <li>&#10003; Lead stage updated to PAID (if workflow configured)</li>
              <li>&#10003; Subscriber added to customers group in MailerLite</li>
            </ul>
          </div>
        </div>

        {/* Calendly Booking Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">3. Calendly Booking</h3>
          <p className="text-sm text-zinc-400 mb-3">Create a test booking:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to workspace&apos;s Calendly scheduling link</li>
            <li>2. Book a test appointment with test email</li>
            <li>3. Complete booking</li>
          </ol>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Verify:</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>&#10003; Booking event appears in workspace Events tab</li>
              <li>&#10003; Lead stage updated to BOOKED (if workflow configured)</li>
            </ul>
          </div>
          <TipBox>
            Remember to cancel the test booking afterwards to not clutter the calendar.
          </TipBox>
        </div>

        {/* ABC Ignite Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
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

        {/* Booking Form Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">5. Booking Form (Magic Link)</h3>
          <p className="text-sm text-zinc-400 mb-3">Test the full booking flow:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Navigate to <code>/public/WORKSPACE_SLUG/book</code></li>
            <li>2. Enter a valid member barcode</li>
            <li>3. Select an available time slot</li>
            <li>4. Check email for magic link</li>
            <li>5. Click magic link to confirm booking</li>
          </ol>
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Verify:</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>&#10003; Magic link email arrives</li>
              <li>&#10003; Clicking link confirms booking (or adds to waitlist)</li>
              <li>&#10003; Events logged for each step (lookup, eligibility, booking)</li>
              <li>&#10003; Workflows triggered (if configured for booking-confirmed)</li>
            </ul>
          </div>
        </div>

        {/* Signup Form Test */}
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">6. Signup Form</h3>
          <p className="text-sm text-zinc-400 mb-3">Test the membership signup:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Navigate to <code>/public/WORKSPACE_SLUG/signup</code></li>
            <li>2. Complete all signup steps with test data</li>
            <li>3. Verify form submission events in the Events tab</li>
          </ol>
        </div>
      </section>

      {/* Custom Domain Testing */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Custom Domain Testing</h2>
        <p className="text-zinc-300 mb-4">
          If the workspace has a custom domain configured, test that routing works correctly.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Verify DNS TXT record is set (check in workspace Settings &rarr; Custom Domain)</li>
            <li>2. Click &quot;Verify&quot; to confirm domain ownership</li>
            <li>3. Ensure CNAME record points to RevLine server</li>
            <li>4. Visit the custom domain in a browser and confirm the page loads</li>
            <li>5. Test booking/signup forms on the custom domain</li>
          </ol>
        </div>
      </section>

      {/* Event Verification */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Event Verification</h2>
        <p className="text-zinc-300 mb-4">
          After testing, verify events are logged correctly in the workspace dashboard.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Where to Check</h3>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3">
              <span className="text-zinc-500">&bull;</span>
              <div>
                <strong>Events Tab</strong> (on workspace detail page)
                <p className="text-zinc-400">Shows all events with timestamps, system, event type, and status</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">&bull;</span>
              <div>
                <strong>Workflow Executions</strong> (clock icon on workflow)
                <p className="text-zinc-400">Shows each time the workflow ran, with action results</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">&bull;</span>
              <div>
                <strong>Leads Tab</strong> (on workspace detail page)
                <p className="text-zinc-400">Shows all captured leads with stage, source, and last activity</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">&bull;</span>
              <div>
                <strong>Network Graph</strong> (Workflows tab, graph view)
                <p className="text-zinc-400">Visual overview of forms, integrations, and workflow connections with health status</p>
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
                <td className="py-3 text-zinc-400">Workspace not found</td>
                <td className="py-3 text-zinc-400">Check <code>source</code> matches workspace slug</td>
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
                <td className="py-3 text-zinc-400">No matching workflow or workflow disabled</td>
                <td className="py-3 text-zinc-400">Create/enable workflow with correct trigger</td>
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
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Magic link not arriving</td>
                <td className="py-3 text-zinc-400">Resend not configured or domain not verified</td>
                <td className="py-3 text-zinc-400">Check Resend integration, verify sending domain</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Form trigger not available</td>
                <td className="py-3 text-zinc-400">Form not enabled on workspace</td>
                <td className="py-3 text-zinc-400">Enable the form in RevLine integration config</td>
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
              You can <strong>retry</strong> failed executions from this view.
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
          Before going live with a new workspace, verify everything works:
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
              Test booking form works (if enabled)
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Test signup form works (if enabled)
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              All workflows enabled and validated
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Workspace execution NOT paused
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Production webhook URLs configured (not test)
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="w-5 h-5 border border-zinc-700 rounded flex-shrink-0"></span>
              Custom domain verified (if applicable)
            </label>
          </div>
        </div>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">For Developers</h2>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Test Infrastructure</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <div>
                <code className="text-white">__tests__/unit/</code>
                <p className="text-xs text-zinc-500 mt-1">Unit tests for services, adapters, crypto, validation, etc.</p>
              </div>
              <div>
                <code className="text-white">__tests__/integration/</code>
                <p className="text-xs text-zinc-500 mt-1">Integration tests for capture flows and reliability.</p>
              </div>
              <div>
                <code className="text-white">vitest.config.ts</code>
                <p className="text-xs text-zinc-500 mt-1">Test runner configuration.</p>
              </div>
              <div>
                <code className="text-white">.github/workflows/ci.yml</code>
                <p className="text-xs text-zinc-500 mt-1">CI pipeline &mdash; runs tests, type checks, and linting on push.</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Running Tests Locally</h3>
            <CodeBlock>{`# Run all tests
npm test

# Run specific test file
npx vitest run __tests__/unit/workspace-gate.test.ts

# Run in watch mode
npx vitest --watch`}</CodeBlock>
          </div>
        </div>
      </section>
    </div>
  );
}
