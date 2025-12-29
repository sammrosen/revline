import { redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/app/_lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OnboardingGuidePage() {
  const adminId = await getAuthenticatedAdmin();
  if (!adminId) {
    redirect('/admin/login');
  }

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
              <li>• Slug for routing (lowercase, underscores OK - e.g., "acme_fitness")</li>
              <li>• Timezone <span className="text-red-400">*required</span> - IANA format (searchable in UI)</li>
            </ul>
            <p className="text-xs text-zinc-500 mt-3">
              💡 Timezone is used for health check business hours (4am-11pm client time) to avoid false "silent" alerts
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
              <p className="text-zinc-400">1. Create group: "Leads - [Client Name]"</p>
              <p className="text-zinc-400">2. Create group: "Customer - [Client Name]"</p>
              <p className="text-zinc-400">3. Get group IDs from URL (e.g., /groups/123456)</p>
              <p className="text-zinc-400">4. Generate API key (Settings → API)</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3">Stripe Setup</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• Webhook signing secret (starts with "whsec_")</li>
              <li>• Stripe API key (optional, for signature verification)</li>
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
              <li>2. Enter name: "Acme Fitness"</li>
              <li>3. Slug auto-generates: "acme_fitness" (edit if needed)</li>
              <li>4. Add timezone (optional)</li>
              <li>5. Click "Create Client"</li>
            </ol>
          </div>
        </section>

        {/* Step 3: Add Integrations */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">Step 3: Add Integrations</h2>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3 text-green-400">MailerLite Integration</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">Type:</p>
                <code className="text-white">MAILERLITE</code>
              </div>
              <div>
                <p className="text-zinc-400 mb-1">Secret (API Key):</p>
                <code className="text-white">mlsk_xxxxxxxxxxxxx</code>
                <p className="text-xs text-zinc-500 mt-1">🔒 Encrypted on save, never shown again</p>
              </div>
              <div>
                <p className="text-zinc-400 mb-1">Meta (JSON):</p>
                <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{
  "groupIds": {
    "lead": "123456",
    "customer": "789012"
  }
}`}
                </pre>
                <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Meta stores non-sensitive config only</strong> (group IDs, URLs, flags).
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    ⚠️ <strong>Never put API keys or secrets in meta</strong> - they go in the Secret field above.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-4">
            <h3 className="font-medium mb-3 text-purple-400">Stripe Integration</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">Type:</p>
                <code className="text-white">STRIPE</code>
              </div>
              <div>
                <p className="text-zinc-400 mb-1">Secret (Webhook Secret):</p>
                <code className="text-white">whsec_xxxxxxxxxxxxx</code>
                <p className="text-xs text-zinc-500 mt-1">🔒 Encrypted on save, never shown again</p>
              </div>
              <div>
                <p className="text-zinc-400 mb-1">Meta (JSON, optional):</p>
                <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{}`}
                </pre>
                <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Stripe webhook uses MailerLite groups</strong> (configured above).
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    You can leave meta empty or add optional product routing.
                  </p>
                  <p className="text-xs text-red-300 mt-1">
                    ⚠️ <strong>Do NOT put Stripe API keys in meta</strong> - they are not needed for webhooks.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3 text-cyan-400">Calendly Integration (Optional)</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">Type:</p>
                <code className="text-white">CALENDLY</code>
              </div>
              <div>
                <p className="text-zinc-400 mb-1">Secret (Webhook Signing Key):</p>
                <code className="text-white">your_signing_key_from_calendly</code>
                <p className="text-xs text-zinc-500 mt-1">🔒 Encrypted on save, never shown again</p>
              </div>
              <div>
                <p className="text-zinc-400 mb-1">Meta (JSON, optional):</p>
                <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{
  "schedulingUrls": {
    "discovery": "https://calendly.com/yourname/30min"
  },
  "addToBookedSegment": false
}`}
                </pre>
                <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Calendly requires webhook subscription setup</strong> via their API.
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    Store scheduling URLs and config flags in meta (optional). Webhook signing key must go in Secret field above.
                  </p>
                </div>
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
              <li>✓ Check MailerLite: Email appears in lead group</li>
              <li>✓ Check admin dashboard: Events logged</li>
              <li>✓ Check email: Welcome automation sends</li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="font-medium mb-3">Test Stripe Webhook</h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li>1. Use Stripe test card: <code className="text-white">4242 4242 4242 4242</code></li>
              <li>2. Complete test checkout</li>
              <li>3. Check Stripe Dashboard → Webhooks: Delivery shows success</li>
              <li>4. Check MailerLite: Customer appears in customer group</li>
              <li>5. Check admin dashboard: Payment + subscribe events logged</li>
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
              <li>• Subscribe endpoint: <code className="text-white">POST /api/subscribe</code> with <code className="text-white">source: "client_slug"</code></li>
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
              If client has multiple products (e.g., FIT1, Premium, Demo), use Stripe metadata for routing.
            </p>
            
            <h3 className="font-medium mb-2 text-sm">Setup:</h3>
            <ol className="space-y-2 text-sm text-zinc-400 mb-4">
              <li>1. Client adds metadata to Payment Links: <code className="text-white">program=fit1</code></li>
              <li>2. Create separate MailerLite groups per product</li>
              <li>3. Update integration meta:</li>
            </ol>
            
            <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 overflow-x-auto">
{`{
  "groupIds": {
    "lead": "123456",
    "customer": "789012",
    "customer_fit1": "345678",
    "customer_premium": "901234"
  }
}`}
            </pre>
            
            <p className="text-xs text-zinc-500 mt-3">
              System automatically routes based on metadata. No code changes needed.
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
                  <li>Webhook: <code className="text-white">/api/stripe-webhook</code></li>
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

