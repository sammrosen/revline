import { TipBox, WarningBox, CodeBlock, SecretTable } from '../shared';

export function StripeTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-purple-400">Stripe</span> Integration
        </h2>
        <p className="text-zinc-300 mb-4">
          Stripe handles payment webhooks. When a customer completes a purchase, Stripe sends 
          a webhook that triggers workflows to update lead stages and add to groups.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">How It Works</h3>
          <ol className="text-sm text-zinc-400 space-y-1">
            <li>1. Customer clicks payment link and completes checkout</li>
            <li>2. Stripe sends <code className="text-white">checkout.session.completed</code> webhook</li>
            <li>3. RevLine validates signature and identifies client</li>
            <li>4. Matching workflows execute (update stage, add to groups, etc.)</li>
          </ol>
        </div>
      </section>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400 mb-3">Client needs to set up in Stripe:</p>
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <div>
                <span>Create Products and Payment Links</span>
                <p className="text-xs text-zinc-500 mt-1">Products → Add Product → Create Payment Link</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <div>
                <span>Add Webhook Endpoint</span>
                <p className="text-xs text-zinc-500 mt-1">Developers → Webhooks → Add Endpoint</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <div>
                <span>Copy Webhook Signing Secret</span>
                <p className="text-xs text-zinc-500 mt-1">Shown only once after creating endpoint!</p>
              </div>
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
            <CodeBlock>{`https://yourdomain.com/api/stripe-webhook?source=CLIENT_SLUG`}</CodeBlock>
            <p className="text-xs text-zinc-500 mt-2">
              Replace <code>CLIENT_SLUG</code> with the client&apos;s slug (e.g., <code>acme_fitness</code>)
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Events to Subscribe</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <code className="text-white">checkout.session.completed</code> — Required for payment tracking</li>
              <li>• <code className="text-white">customer.subscription.created</code> — Optional, for subscriptions</li>
              <li>• <code className="text-white">customer.subscription.deleted</code> — Optional, for cancellations</li>
            </ul>
          </div>
        </div>

        <WarningBox title="Important">
          The webhook signing secret (starts with <code>whsec_</code>) is shown only once when creating the endpoint. 
          Save it immediately!
        </WarningBox>
      </section>

      {/* Secrets */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Secrets</h2>
        <SecretTable
          secrets={[
            {
              name: 'Webhook Secret',
              placeholder: 'whsec_xxxxxxxxxxxxx',
              description: 'From Developers → Webhooks → Your endpoint → Signing secret',
              required: true,
            },
            {
              name: 'API Key',
              placeholder: 'sk_live_xxxxxxxxxxxxx',
              description: 'Optional: Stripe API key for additional API calls',
              required: false,
            },
          ]}
        />
        <TipBox>
          The API Key is only needed if you&apos;re using Stripe actions (none exist yet). For basic payment 
          tracking, only the Webhook Secret is required.
        </TipBox>
      </section>

      {/* Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Stripe configuration uses the <strong>structured editor</strong> to map products to identifiers 
          used in workflow filters.
        </p>

        <h3 className="font-medium text-zinc-300 mb-3">Products Configuration</h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <p className="text-sm text-zinc-400 mb-3">
            Map Stripe price IDs or product IDs to friendly names used in trigger filters:
          </p>
          <CodeBlock language="json" title="Stripe Meta (JSON)">{`{
  "products": {
    "price_xxxxx": {
      "id": "price_xxxxx",
      "name": "FIT1 Program",
      "program": "fit1"
    },
    "price_yyyyy": {
      "id": "price_yyyyy",
      "name": "Premium Coaching",
      "program": "premium"
    }
  }
}`}</CodeBlock>
        </div>

        <TipBox title="Using Metadata Instead">
          Alternatively, add <code>program</code> metadata directly to Payment Links in Stripe. 
          This is often simpler than maintaining the products map.
        </TipBox>
      </section>

      {/* Triggers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Triggers</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-purple-400">stripe.payment_succeeded</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Fires when a one-time payment completes</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Payload fields:</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <div><code className="text-white">email</code> — Customer email</div>
                <div><code className="text-white">name</code> — Customer name</div>
                <div><code className="text-white">amount</code> — Amount in cents</div>
                <div><code className="text-white">currency</code> — Currency code</div>
                <div><code className="text-white">product</code> — Product/program identifier</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-purple-400">stripe.subscription_created</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Fires when a new subscription starts</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Payload fields:</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <div><code className="text-white">email</code> — Customer email</div>
                <div><code className="text-white">amount</code> — Amount in cents</div>
                <div><code className="text-white">interval</code> — &quot;month&quot; or &quot;year&quot;</div>
                <div><code className="text-white">product</code> — Product identifier</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-purple-400">stripe.subscription_canceled</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Fires when a subscription is canceled</p>
          </div>
        </div>
      </section>

      {/* Multi-Product Setup */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Multi-Product Setup</h2>
        <p className="text-zinc-300 mb-4">
          For clients with multiple products, use trigger filters to route customers to different groups.
        </p>

        <h3 className="font-medium text-zinc-300 mb-3">Step 1: Add Metadata to Payment Links</h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. In Stripe, go to Payment Link settings</li>
            <li>2. Click &quot;Additional options&quot; → &quot;Add metadata&quot;</li>
            <li>3. Key: <code className="text-white">program</code></li>
            <li>4. Value: <code className="text-white">fit1</code> (or your product identifier)</li>
          </ol>
        </div>

        <h3 className="font-medium text-zinc-300 mb-3">Step 2: Create Filtered Workflows</h3>
        <CodeBlock language="json">{`Workflow: "FIT1 Purchase"
Trigger: stripe.payment_succeeded
Filter: { "product": "fit1" }
Actions:
  - revline.update_lead_stage → { "stage": "PAID" }
  - mailerlite.add_to_group → { "group": "fit1_customers" }

Workflow: "Premium Purchase"
Trigger: stripe.payment_succeeded
Filter: { "product": "premium" }
Actions:
  - revline.update_lead_stage → { "stage": "PAID" }
  - mailerlite.add_to_group → { "group": "premium_customers" }`}</CodeBlock>

        <TipBox title="Default Workflow">
          Create a workflow without a filter to catch all payments and add to a general &quot;customers&quot; group. 
          Product-specific workflows can add to additional groups.
        </TipBox>
      </section>

      {/* Testing */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Testing</h2>
        
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-2">Test Card Numbers</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Successful payment</span>
              <code className="text-white">4242 4242 4242 4242</code>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Declined</span>
              <code className="text-white">4000 0000 0000 0002</code>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Requires authentication</span>
              <code className="text-white">4000 0025 0000 3155</code>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3">Use any future expiry date and any 3-digit CVC</p>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Verify Webhook Delivery</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Complete a test purchase</li>
            <li>2. Go to Stripe → Developers → Webhooks → Your endpoint</li>
            <li>3. Check &quot;Recent deliveries&quot; - should show 200 response</li>
            <li>4. Check RevLine admin → Events for payment event</li>
            <li>5. Check MailerLite for subscriber in correct group</li>
          </ol>
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
                <td className="py-3 text-zinc-400">Webhook returns 401</td>
                <td className="py-3 text-zinc-400">Invalid signing secret</td>
                <td className="py-3 text-zinc-400">Re-copy secret from Stripe webhook settings</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Webhook returns 404</td>
                <td className="py-3 text-zinc-400">Wrong URL or missing source param</td>
                <td className="py-3 text-zinc-400">Check URL includes <code>?source=client_slug</code></td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Payment not tracked</td>
                <td className="py-3 text-zinc-400">No matching workflow</td>
                <td className="py-3 text-zinc-400">Create workflow with stripe.payment_succeeded trigger</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Wrong group</td>
                <td className="py-3 text-zinc-400">Filter not matching</td>
                <td className="py-3 text-zinc-400">Check product metadata matches filter</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
