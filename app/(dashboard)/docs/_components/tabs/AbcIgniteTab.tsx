import { TipBox, WarningBox, CodeBlock, SecretTable } from '../shared';

export function AbcIgniteTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-orange-400">ABC Ignite</span> Integration
        </h2>
        <p className="text-zinc-300 mb-4">
          ABC Ignite is a gym management platform. This integration allows you to book members 
          into appointments and classes, check availability, and manage enrollments.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Common Use Cases</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Automatically book new leads into intro sessions</li>
            <li>• Check member session balances before booking</li>
            <li>• Enroll members in classes or appointments</li>
            <li>• Manage waitlists for full classes</li>
          </ul>
        </div>
      </section>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400 mb-3">Required from ABC Ignite:</p>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>App ID</strong> - API credential from ABC Ignite</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>App Key</strong> - API credential from ABC Ignite</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>Club Number</strong> - The gym/location identifier</span>
            </li>
          </ul>
          <p className="text-xs text-zinc-500 mt-3">
            Contact ABC Ignite support or the gym&apos;s IT admin to get API credentials.
          </p>
        </div>
      </section>

      {/* Secrets */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Secrets</h2>
        <SecretTable
          secrets={[
            {
              name: 'App ID',
              placeholder: 'your_app_id',
              description: 'app_id from ABC Ignite API credentials',
              required: true,
            },
            {
              name: 'App Key',
              placeholder: 'your_app_key',
              description: 'app_key from ABC Ignite API credentials',
              required: true,
            },
          ]}
        />
      </section>

      {/* Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <p className="text-zinc-400 text-sm mb-4">
          ABC Ignite configuration uses the <strong>structured editor</strong>. After entering 
          credentials and club number, you can sync event types from the ABC Ignite API.
        </p>

        <h3 className="font-medium text-zinc-300 mb-3">Setup Steps</h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <span>Add the integration with App ID and App Key secrets</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <span>Click &quot;Configure&quot; to open the structured editor</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <span>Enter the <strong>Club Number</strong> (required for all API calls)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">4.</span>
              <span>Click <strong>&quot;Sync from ABC Ignite&quot;</strong> to fetch event types</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">5.</span>
              <span>Select which event types to import</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">6.</span>
              <span>Optionally set a <strong>default event type</strong> for workflows</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">7.</span>
              <span>Save configuration</span>
            </li>
          </ol>
        </div>

        <h3 className="font-medium text-zinc-300 mb-3">Example Configuration</h3>
        <CodeBlock language="json" title="ABC Ignite Meta (JSON)">{`{
  "clubNumber": "12345",
  "eventTypes": {
    "intro_session": {
      "id": "67890",
      "name": "Intro Session",
      "category": "appointment"
    },
    "pt_session": {
      "id": "11111",
      "name": "Personal Training",
      "category": "appointment"
    },
    "group_class": {
      "id": "22222",
      "name": "Group Fitness",
      "category": "event"
    }
  },
  "defaultEventTypeId": "intro_session"
}`}</CodeBlock>

        <TipBox title="Event Types">
          Event types have a <strong>category</strong> (appointment or event). Appointments are 
          typically 1:1 sessions while events are group classes. The API handles both the same way.
        </TipBox>
      </section>

      {/* Workflow Actions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Workflow Actions</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-orange-400">abc_ignite.lookup_member</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Find a member by barcode and return their memberId</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Requires payload:</p>
              <div className="text-xs text-zinc-400">
                <code className="text-white">barcode</code> — Member&apos;s barcode/scan ID
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-orange-400">abc_ignite.check_availability</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Check employee availability for an event type</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <div><code className="text-white">employeeId</code> — Employee ID (optional)</div>
                <div><code className="text-white">eventTypeId</code> — Event type key (optional, uses default)</div>
                <div><code className="text-white">startDate</code> — Start date YYYY-MM-DD (optional)</div>
                <div><code className="text-white">endDate</code> — End date YYYY-MM-DD (optional)</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-orange-400">abc_ignite.check_session_balance</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Check if member has session credits for an event type</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-xs text-zinc-400">
                <code className="text-white">eventTypeId</code> — Event type key (optional, uses default)
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-orange-400">abc_ignite.enroll_member</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Book a member into a calendar event</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <div><code className="text-white">eventId</code> — ABC Ignite event ID <span className="text-red-400">*required</span></div>
                <div><code className="text-white">checkBalance</code> — Check session balance first (optional)</div>
                <div><code className="text-white">allowUnfunded</code> — Allow booking without credits (optional)</div>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-1">Example:</p>
              <CodeBlock language="json">{`{ "action": "abc_ignite.enroll_member", "params": { "eventId": "12345", "checkBalance": true } }`}</CodeBlock>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-orange-400">abc_ignite.unenroll_member</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Cancel a member booking from an event</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-xs text-zinc-400">
                <code className="text-white">eventId</code> — ABC Ignite event ID <span className="text-red-400">*required</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-orange-400">abc_ignite.add_to_waitlist</code> / 
              <code className="text-orange-400 ml-1">abc_ignite.remove_from_waitlist</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Manage waitlist for full events</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-xs text-zinc-400">
                <code className="text-white">eventId</code> — ABC Ignite event ID <span className="text-red-400">*required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Member Identification */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Member Identification</h2>
        <p className="text-zinc-300 mb-4">
          ABC Ignite actions need to identify the member. This can be done via:
        </p>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Field</th>
                <th className="pb-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 text-white">Member ID</td>
                <td className="py-2"><code>memberId</code></td>
                <td className="py-2 text-zinc-400">Direct ID if known</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 text-white">Barcode</td>
                <td className="py-2"><code>barcode</code></td>
                <td className="py-2 text-zinc-400">Lookup via abc_ignite.lookup_member</td>
              </tr>
            </tbody>
          </table>
        </div>
        <TipBox>
          Use <code>abc_ignite.lookup_member</code> first to convert a barcode to a memberId, 
          then use that memberId in subsequent actions.
        </TipBox>
      </section>

      {/* Common Patterns */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Common Patterns</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Auto-Book Intro Session on Email Capture</h3>
            <p className="text-sm text-zinc-400 mb-3">
              Book new leads into an intro session when they submit their email
            </p>
            <CodeBlock language="json">{`Workflow: "Email Capture → Intro Session"
Trigger: revline.email_captured
Actions:
  - revline.create_lead → {}
  - abc_ignite.enroll_member → { "eventId": "INTRO_EVENT_ID" }`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Check Balance Before Booking</h3>
            <p className="text-sm text-zinc-400 mb-3">
              Verify member has session credits before enrolling
            </p>
            <CodeBlock language="json">{`Workflow: "Booking with Balance Check"
Trigger: custom_trigger
Actions:
  - abc_ignite.check_session_balance → { "eventTypeId": "pt_session" }
  - abc_ignite.enroll_member → { "eventId": "EVENT_ID", "checkBalance": true }`}</CodeBlock>
          </div>
        </div>
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
                <td className="py-3 text-zinc-400">API error 401</td>
                <td className="py-3 text-zinc-400">Invalid credentials</td>
                <td className="py-3 text-zinc-400">Verify App ID and App Key</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Club not found</td>
                <td className="py-3 text-zinc-400">Wrong club number</td>
                <td className="py-3 text-zinc-400">Check club number in ABC Ignite</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Sync returns empty</td>
                <td className="py-3 text-zinc-400">No event types configured</td>
                <td className="py-3 text-zinc-400">Set up event types in ABC Ignite first</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Enrollment fails</td>
                <td className="py-3 text-zinc-400">Event full or member ineligible</td>
                <td className="py-3 text-zinc-400">Check event capacity and member status</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Member not found</td>
                <td className="py-3 text-zinc-400">Invalid barcode or memberId</td>
                <td className="py-3 text-zinc-400">Verify member exists in ABC Ignite</td>
              </tr>
            </tbody>
          </table>
        </div>
        <WarningBox title="Club Number Required">
          The club number is required for all ABC Ignite API calls. Make sure it&apos;s set in the 
          configuration before trying to sync or use any actions.
        </WarningBox>
      </section>

      {/* Booking System */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Booking System (Magic Link)</h2>
        <p className="text-zinc-300 mb-4">
          ABC Ignite is the first provider for RevLine&apos;s provider-agnostic booking system. 
          The <strong>ABC Appointment Booking</strong> form (<code>magic-link-booking</code>) uses 
          ABC Ignite for the full booking flow.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Booking Flow</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. User enters barcode &rarr; <code>abc_ignite.lookup_member</code></li>
            <li>2. System checks eligibility &rarr; <code>abc_ignite.check_eligibility</code></li>
            <li>3. User selects time slot &rarr; <code>abc_ignite.check_availability</code></li>
            <li>4. System sends magic link email &rarr; <code>resend.send_email</code></li>
            <li>5. User clicks magic link &rarr; re-verifies then <code>abc_ignite.enroll_member</code></li>
          </ol>
        </div>
        <TipBox>
          The booking system also supports <strong>sync endpoints</strong> for employees and event types. 
          Use the &quot;Sync from ABC Ignite&quot; button in the structured editor to pull event types, 
          or the testing panel to call <code>/api/v1/booking/employees</code> and <code>/api/v1/booking/availability</code>.
        </TipBox>
        <p className="text-sm text-zinc-400 mt-3">
          See the <strong>Forms &amp; Sites</strong> tab for full details on the baked-in operations and triggers.
        </p>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">For Developers</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Key Files</h3>
          <div className="space-y-2 text-sm text-zinc-400">
            <div>
              <code className="text-white">app/_lib/integrations/abc-ignite.adapter.ts</code>
              <p className="text-xs text-zinc-500 mt-1">ABC Ignite adapter &mdash; member lookup, availability, enrollment, waitlist.</p>
            </div>
            <div>
              <code className="text-white">app/_lib/booking/providers/abc-ignite.ts</code>
              <p className="text-xs text-zinc-500 mt-1">Booking provider implementation for the magic link flow.</p>
            </div>
            <div>
              <code className="text-white">app/_lib/workflow/executors/abc-ignite.ts</code>
              <p className="text-xs text-zinc-500 mt-1">Workflow executor for ABC Ignite actions.</p>
            </div>
            <div>
              <code className="text-white">app/api/v1/booking/</code>
              <p className="text-xs text-zinc-500 mt-1">Booking API routes (availability, eligibility, lookup, request, confirm).</p>
            </div>
          </div>
          <h3 className="font-medium text-white mb-2 mt-4">Key Patterns</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>- Magic link tokens are hashed before storage (never stored in plaintext)</li>
            <li>- Booking confirmation re-verifies eligibility before creating the booking</li>
            <li>- All booking endpoints return generic responses (no enumeration)</li>
            <li>- Timing is normalized on security-sensitive endpoints</li>
            <li>- Club number required in all API calls to ABC Ignite</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
