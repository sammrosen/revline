import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OnboardingGuidePage() {
  // Middleware handles auth - if we reach here, user is authenticated

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin/clients"
          className="text-zinc-400 hover:text-white text-sm mb-4 inline-block"
        >
          ← Back to Clients
        </Link>

        <h1 className="text-3xl font-bold mb-2">Client Onboarding Guide</h1>
        <p className="text-zinc-400 mb-8">Time budget: &lt;2 hours per client</p>

        {/* Step 1: Collect Information */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Step 1: Collect Information</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3">Client Details</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• Business name (display name)</li>
              <li>• Slug for routing (lowercase, underscores OK - e.g., &quot;acme_fitness&quot;)</li>
              <li>• Timezone <span className="text-red-400">*required</span> - IANA format (searchable in UI)</li>
            </ul>
            <p className="text-xs text-zinc-500 mt-3">
              💡 Timezone is used for health check business hours (4am-11pm client time) to avoid false &quot;silent&quot; alerts
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3">MailerLite Setup</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• API Key (from Settings → API in MailerLite)</li>
              <li>• Lead Group ID (from Groups → copy ID from URL)</li>
              <li>• Customer Group ID (for paying customers)</li>
            </ul>
            <div className="mt-3 p-3 bg-zinc-950 rounded text-xs">
              <p className="text-zinc-500 mb-2">Ask client to:</p>
              <p className="text-zinc-400">1. Create group: &quot;Leads - [Client Name]&quot;</p>
              <p className="text-zinc-400">2. Create group: &quot;Customer - [Client Name]&quot;</p>
              <p className="text-zinc-400">3. Get group IDs from URL (e.g., /groups/123456)</p>
              <p className="text-zinc-400">4. Generate API key (Settings → API)</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3">Stripe Setup</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• Webhook signing secret (starts with &quot;whsec_&quot;)</li>
              <li>• Stripe API key (optional, for additional API calls)</li>
            </ul>
            <div className="mt-3 p-3 bg-zinc-950 rounded text-xs">
              <p className="text-zinc-500 mb-2">Ask client to:</p>
              <p className="text-zinc-400">1. Go to Developers → Webhooks → Add Endpoint</p>
              <p className="text-zinc-400">2. URL: https://yourdomain.com/api/stripe-webhook?source=client_slug</p>
              <p className="text-zinc-400">3. Event: checkout.session.completed</p>
              <p className="text-zinc-400">4. Copy webhook signing secret (shown once)</p>
            </div>
          </div>
        </section>

        {/* Step 2: Create Client */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Step 2: Create Client</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <ol className="space-y-3 text-sm text-zinc-300">
              <li>1. Go to <Link href="/admin/clients/new" className="text-white underline">Add Client page</Link></li>
              <li>2. Enter name: &quot;Acme Fitness&quot;</li>
              <li>3. Slug auto-generates: &quot;acme_fitness&quot; (edit if needed)</li>
              <li>4. Add timezone (optional)</li>
              <li>5. Click &quot;Create Client&quot;</li>
            </ol>
          </div>
        </section>

        {/* Step 3: Add Integrations */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Step 3: Add Integrations</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3 text-green-400">MailerLite Integration</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">Type:</p>
                <code className="text-white">MAILERLITE</code>
              </div>
              
              <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                <p className="text-zinc-400 mb-2 font-medium">Secrets:</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="pb-1">Name</th>
                      <th className="pb-1">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    <tr>
                      <td className="py-1"><code>API Key</code></td>
                      <td><code>mlsk_xxxxxxxxxxxxx</code></td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-zinc-500 mt-2">🔒 Secrets are encrypted on save, never shown again</p>
                <p className="text-xs text-zinc-500">💡 Click &quot;+ Add another secret&quot; if you need multiple keys</p>
              </div>
              
              <div>
                <p className="text-zinc-400 mb-2">Configuration (groups + routing):</p>
                <p className="text-xs text-zinc-500 mb-2">Use the structured editor or toggle to JSON mode:</p>
                <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{
  "groups": {
    "leads": { "id": "123456", "name": "Leads" },
    "customers": { "id": "789012", "name": "Customers" }
  },
  "routing": {
    "lead.captured": "leads",
    "lead.paid": "customers"
  }
}`}
                </pre>
                <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Groups</strong> define your MailerLite groups with friendly names.
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    💡 <strong>Routing</strong> maps RevLine actions to groups (e.g., email captures → leads group).
                  </p>
                </div>
              </div>
              
              <div className="p-2 bg-amber-950/30 border border-amber-900/50 rounded">
                <p className="text-xs text-amber-300">
                  <strong>Available actions:</strong>
                </p>
                <ul className="text-xs text-amber-300 mt-1 space-y-0.5">
                  <li>• <code>lead.captured</code> - Email submitted on landing page</li>
                  <li>• <code>lead.paid</code> - Stripe payment completed</li>
                  <li>• <code>lead.paid:fit1</code> - Payment for specific program (uses Stripe metadata)</li>
                  <li>• <code>lead.booked</code> - Calendly booking created</li>
                  <li>• <code>lead.canceled</code> - Calendly booking canceled</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3 text-purple-400">Stripe Integration</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">Type:</p>
                <code className="text-white">STRIPE</code>
              </div>
              
              <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                <p className="text-zinc-400 mb-2 font-medium">Secrets:</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="pb-1">Name</th>
                      <th className="pb-1">Value</th>
                      <th className="pb-1">Required</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    <tr>
                      <td className="py-1"><code>Webhook Secret</code></td>
                      <td><code>whsec_xxxxxxxxxxxxx</code></td>
                      <td className="text-green-400">Yes</td>
                    </tr>
                    <tr>
                      <td className="py-1"><code>API Key</code></td>
                      <td><code>sk_live_xxxxxxxxxxxxx</code></td>
                      <td className="text-zinc-500">Optional</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-zinc-500 mt-2">🔒 Secrets are encrypted on save, never shown again</p>
              </div>
              
              <div>
                <p className="text-zinc-400 mb-1">Meta (JSON, optional):</p>
                <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{}`}
                </pre>
                <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Stripe uses MailerLite routing</strong> for group assignment.
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    When a payment is received, the <code>lead.paid</code> action routes to your configured group.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3 text-cyan-400">Calendly Integration (Optional)</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">Type:</p>
                <code className="text-white">CALENDLY</code>
              </div>
              
              <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                <p className="text-zinc-400 mb-2 font-medium">Secrets:</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="pb-1">Name</th>
                      <th className="pb-1">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    <tr>
                      <td className="py-1"><code>Webhook Secret</code></td>
                      <td><code>your_signing_key</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div>
                <p className="text-zinc-400 mb-1">Meta (JSON, optional):</p>
                <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{
  "schedulingUrls": {
    "discovery": "https://calendly.com/yourname/30min"
  }
}`}
                </pre>
                <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Calendly bookings trigger <code>lead.booked</code></strong> action.
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    Configure routing in MailerLite integration to add booked leads to a group.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Managing Secrets */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Managing Secrets</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <p className="text-sm text-zinc-300 mb-4">
              After creating an integration, you can manage secrets separately:
            </p>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 rounded text-xs">Secrets (n)</span>
                <span className="text-zinc-400">→ Opens secret management modal</span>
              </div>
              
              <ul className="space-y-2 text-zinc-400 ml-4">
                <li>• <strong className="text-white">Add Secret</strong> - Add a new named secret to the integration</li>
                <li>• <strong className="text-white">Rotate</strong> - Update a secret&apos;s value (for key rotation)</li>
                <li>• <strong className="text-white">Delete</strong> - Remove a secret from the integration</li>
              </ul>
              
              <div className="p-2 bg-amber-950/30 border border-amber-900/50 rounded mt-4">
                <p className="text-xs text-amber-300">
                  ⚠️ <strong>Secret values are never displayed.</strong> When rotating, you must enter the new value - the old value cannot be retrieved.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4: Test */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Step 4: Test the Flow</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3">Test Email Capture</h3>
            <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`curl -X POST https://yourdomain.com/api/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","source":"client_slug"}'`}
            </pre>
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              <li>✓ Check MailerLite: Email appears in &quot;leads&quot; group (per routing)</li>
              <li>✓ Check admin dashboard: Events logged</li>
              <li>✓ Check email: Welcome automation sends</li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3">Run Health Check</h3>
            <p className="text-sm text-zinc-400 mb-3">
              From the client detail page, click <span className="text-white">Run Health Check</span> to verify:
            </p>
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>✓ MailerLite API connectivity</li>
              <li>✓ Group IDs exist in MailerLite</li>
              <li>✓ Routing configuration valid</li>
              <li>✓ Webhook endpoints accessible</li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3">Test Stripe Webhook</h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li>1. Use Stripe test card: <code className="text-white">4242 4242 4242 4242</code></li>
              <li>2. Complete test checkout</li>
              <li>3. Check Stripe Dashboard → Webhooks: Delivery shows success</li>
              <li>4. Check MailerLite: Customer appears in &quot;customers&quot; group (per routing)</li>
              <li>5. Check admin dashboard: Payment events logged</li>
            </ol>
          </div>
        </section>

        {/* Step 5: Handoff */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Step 5: Client Handoff</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3">Provide to Client</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• Webhook URL: <code className="text-white">https://yourdomain.com/api/stripe-webhook?source=client_slug</code></li>
              <li>• Subscribe endpoint: <code className="text-white">POST /api/subscribe</code> with <code className="text-white">source: &quot;client_slug&quot;</code></li>
              <li>• Confirmation that automations are live</li>
            </ul>
            <div className="mt-4 p-3 bg-zinc-950 rounded text-xs">
              <p className="text-zinc-500 mb-2">What clients can/cannot touch:</p>
              <p className="text-green-400">✓ Can edit: MailerLite groups, email sequences, Stripe products</p>
              <p className="text-red-400">✗ Cannot edit: Webhook URLs, API keys (you manage these)</p>
            </div>
          </div>
        </section>

        {/* Multi-Product Setup */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Advanced: Multiple Products</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <p className="text-sm text-zinc-300 mb-4">
              If client has multiple products (e.g., FIT1, Premium, Demo), use Stripe metadata + program-specific routing.
            </p>
            
            <h3 className="font-medium mb-2 text-sm">Setup:</h3>
            <ol className="space-y-2 text-sm text-zinc-400 mb-4">
              <li>1. Client adds metadata to Payment Links: <code className="text-white">program=fit1</code></li>
              <li>2. Create separate MailerLite groups per product</li>
              <li>3. Update MailerLite configuration:</li>
            </ol>
            
            <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{
  "groups": {
    "leads": { "id": "123456", "name": "All Leads" },
    "customers": { "id": "789012", "name": "All Customers" },
    "fit1_customers": { "id": "345678", "name": "FIT1 Customers" },
    "premium_customers": { "id": "901234", "name": "Premium Customers" }
  },
  "routing": {
    "lead.captured": "leads",
    "lead.paid": "customers",
    "lead.paid:fit1": "fit1_customers",
    "lead.paid:premium": "premium_customers"
  }
}`}
            </pre>
            
            <p className="text-xs text-zinc-500 mt-3">
              System automatically routes based on Stripe metadata. Program-specific routes take priority over default.
            </p>
          </div>
        </section>

        {/* Quick Reference */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Quick Reference</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-2 text-zinc-300">URLs</h3>
                <ul className="space-y-1 text-xs text-zinc-400">
                  <li>Subscribe: <code className="text-white">/api/subscribe</code></li>
                  <li>Stripe Webhook: <code className="text-white">/api/stripe-webhook</code></li>
                  <li>Calendly Webhook: <code className="text-white">/api/calendly-webhook</code></li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-zinc-300">Time Estimates</h3>
                <ul className="space-y-1 text-xs text-zinc-400">
                  <li>Collect info: ~15 min</li>
                  <li>Create + configure: ~30 min</li>
                  <li>Test + verify: ~20 min</li>
                  <li>Total: &lt;2 hours</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <h3 className="font-medium mb-2 text-zinc-300">Default Secret Names by Integration</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-green-400">MAILERLITE</span>
                  <ul className="text-zinc-400 mt-1">
                    <li>• API Key</li>
                  </ul>
                </div>
                <div>
                  <span className="text-purple-400">STRIPE</span>
                  <ul className="text-zinc-400 mt-1">
                    <li>• Webhook Secret</li>
                    <li>• API Key (optional)</li>
                  </ul>
                </div>
                <div>
                  <span className="text-cyan-400">CALENDLY</span>
                  <ul className="text-zinc-400 mt-1">
                    <li>• Webhook Secret</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-4">
          <Link
            href="/admin/clients/new"
            className="px-6 py-3 bg-white text-black rounded font-medium hover:bg-zinc-200 transition-colors"
          >
            Start Onboarding
          </Link>
          <Link
            href="/admin/clients"
            className="px-6 py-3 border border-zinc-700 text-white rounded hover:border-zinc-600 transition-colors"
          >
            Back to Clients
          </Link>
        </div>
      </div>
    </div>
  );
}
