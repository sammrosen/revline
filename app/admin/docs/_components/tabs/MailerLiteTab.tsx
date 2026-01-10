import { TipBox, WarningBox, CodeBlock, SecretTable } from '../shared';

export function MailerLiteTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-green-400">MailerLite</span> Integration
        </h2>
        <p className="text-zinc-300 mb-4">
          MailerLite handles email list management. Use it to add subscribers to groups 
          based on their actions (email capture, payment, booking).
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Common Use Cases</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Add new leads to a &quot;Leads&quot; group on email capture</li>
            <li>• Move paying customers to a &quot;Customers&quot; group</li>
            <li>• Segment by product (FIT1 customers, Premium customers, etc.)</li>
            <li>• Tag subscribers for specific automations</li>
          </ul>
        </div>
      </section>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400 mb-3">Client needs to set up in MailerLite:</p>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <span>Create groups for each segment (e.g., &quot;Leads - ClientName&quot;, &quot;Customers - ClientName&quot;)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <span>Get Group IDs from URL: <code className="text-white">/groups/123456</code> → ID is <code className="text-white">123456</code></span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <span>Generate API key: Settings → API → Generate new token</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">4.</span>
              <span>Set up automations triggered by group membership (welcome emails, etc.)</span>
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
              placeholder: 'mlsk_xxxxxxxxxxxxx',
              description: 'Get from MailerLite → Settings → API',
              required: true,
            },
          ]}
        />
        <TipBox>
          The API key starts with <code>mlsk_</code>. Make sure to copy the full key including the prefix.
        </TipBox>
      </section>

      {/* Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <p className="text-zinc-400 text-sm mb-4">
          MailerLite configuration uses the <strong>structured editor</strong> for easy setup. 
          You define named groups that workflows can reference.
        </p>

        <h3 className="font-medium text-zinc-300 mb-3">Using the Structured Editor</h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">1.</span>
              <span>Click &quot;Configure&quot; on the MailerLite integration</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">2.</span>
              <span>Click &quot;+ Add Group&quot; to add a new group</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">3.</span>
              <span>Enter a <strong>key</strong> (e.g., &quot;leads&quot;) - this is what workflows reference</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">4.</span>
              <span>Enter the <strong>MailerLite Group ID</strong> (the number from the URL)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">5.</span>
              <span>Enter a <strong>display name</strong> for reference</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">6.</span>
              <span>Click &quot;Save Configuration&quot;</span>
            </li>
          </ol>
        </div>

        <h3 className="font-medium text-zinc-300 mb-3">Example Configuration</h3>
        <CodeBlock language="json" title="MailerLite Meta (JSON)">{`{
  "groups": {
    "leads": {
      "id": "123456789",
      "name": "Leads - Acme Fitness"
    },
    "customers": {
      "id": "987654321",
      "name": "Customers - Acme Fitness"
    },
    "fit1_customers": {
      "id": "456789123",
      "name": "FIT1 Customers - Acme"
    }
  }
}`}</CodeBlock>

        <TipBox title="Group Keys">
          The group <strong>key</strong> (e.g., &quot;leads&quot;, &quot;customers&quot;) is what you reference in 
          workflow actions. Use simple, descriptive names without spaces.
        </TipBox>
      </section>

      {/* Workflow Actions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Workflow Actions</h2>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-green-400">mailerlite.add_to_group</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Add a subscriber to a MailerLite group</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-sm">
                <code className="text-white">group</code>
                <span className="text-zinc-500"> — Key from your groups config (e.g., &quot;leads&quot;)</span>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-1">Example action:</p>
              <CodeBlock language="json">{`{ "action": "mailerlite.add_to_group", "params": { "group": "leads" } }`}</CodeBlock>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-green-400">mailerlite.remove_from_group</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Remove a subscriber from a MailerLite group</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-sm">
                <code className="text-white">group</code>
                <span className="text-zinc-500"> — Key from your groups config</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">
              <code className="text-green-400">mailerlite.add_tag</code>
            </h3>
            <p className="text-sm text-zinc-400 mb-3">Add a tag to a subscriber</p>
            <div className="bg-zinc-950 rounded p-3">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="text-sm">
                <code className="text-white">tag</code>
                <span className="text-zinc-500"> — Tag name to add (will be created if doesn&apos;t exist)</span>
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
            <h3 className="font-medium text-white mb-2">Basic Lead Capture</h3>
            <p className="text-sm text-zinc-400 mb-3">Add all email captures to a single leads group</p>
            <CodeBlock language="json">{`Groups: { "leads": { "id": "123456", "name": "Leads" } }

Workflow:
  Trigger: revline.email_captured
  Actions:
    1. mailerlite.add_to_group → { "group": "leads" }`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Product-Specific Customer Groups</h3>
            <p className="text-sm text-zinc-400 mb-3">Route customers to different groups based on what they bought</p>
            <CodeBlock language="json">{`Groups:
  "customers": { "id": "111", "name": "All Customers" }
  "fit1_customers": { "id": "222", "name": "FIT1 Customers" }
  "premium_customers": { "id": "333", "name": "Premium Customers" }

Workflow 1 (all payments):
  Trigger: stripe.payment_succeeded
  Actions: mailerlite.add_to_group → { "group": "customers" }

Workflow 2 (FIT1 only):
  Trigger: stripe.payment_succeeded
  Filter: { "product": "fit1" }
  Actions: mailerlite.add_to_group → { "group": "fit1_customers" }

Workflow 3 (Premium only):
  Trigger: stripe.payment_succeeded
  Filter: { "product": "premium" }
  Actions: mailerlite.add_to_group → { "group": "premium_customers" }`}</CodeBlock>
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
                <td className="py-3 text-zinc-400">Subscriber not added</td>
                <td className="py-3 text-zinc-400">Invalid group ID</td>
                <td className="py-3 text-zinc-400">Verify group ID matches MailerLite URL</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">API error 401</td>
                <td className="py-3 text-zinc-400">Invalid API key</td>
                <td className="py-3 text-zinc-400">Regenerate API key in MailerLite</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Workflow fails</td>
                <td className="py-3 text-zinc-400">Group key not in config</td>
                <td className="py-3 text-zinc-400">Add the group to MailerLite configuration</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">Health check fails</td>
                <td className="py-3 text-zinc-400">Group deleted in MailerLite</td>
                <td className="py-3 text-zinc-400">Update config with new group ID</td>
              </tr>
            </tbody>
          </table>
        </div>
        <WarningBox>
          Never put the API key in the meta/configuration field. It goes in the <strong>Secrets</strong> section 
          where it&apos;s encrypted.
        </WarningBox>
      </section>
    </div>
  );
}
