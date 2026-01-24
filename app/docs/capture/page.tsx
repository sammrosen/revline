import { DocHero, CodeBlock, TipBox, WarningBox, FeatureCard } from '../_components';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export default function CapturePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <DocHero
        badge="Capture System"
        title="Universal Form Capture"
        titleGradient="Form Capture"
        description="Capture leads from any external form without blocking the user experience. Observational capture that routes data through RevLine for lead creation and workflow execution."
      />

      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
        <p className="text-zinc-400 mb-6">
          The capture system observes form submissions on external websites and sends mapped fields to RevLine. 
          It never blocks or modifies the original form flow — if capture fails, the user experience is unaffected.
        </p>
        
        {/* Flow diagram */}
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
            <div className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400">
              Client Website
            </div>
            <span className="text-zinc-600">→</span>
            <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400">
              capture.js
            </div>
            <span className="text-zinc-600">→</span>
            <div className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400">
              /api/v1/capture
            </div>
            <span className="text-zinc-600">→</span>
            <div className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
              Lead + Workflow
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Key Features</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <FeatureCard
            icon={ShieldIcon}
            title="Observational"
            description="Never blocks forms. Uses sendBeacon for non-blocking transmission. Silent failures."
            color="green"
          />
          <FeatureCard
            icon={ZapIcon}
            title="Workflow Trigger"
            description="Every capture triggers workflows automatically. Route data to any integration."
            color="purple"
          />
          <FeatureCard
            icon={LayersIcon}
            title="Custom Fields"
            description="Map form fields to lead data or custom fields. Extensible data model."
            color="blue"
          />
        </div>
      </section>

      {/* Browser Mode */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Browser Mode (Embed Script)</h2>
        <p className="text-zinc-400 mb-4">
          The simplest way to capture forms. Add a small JavaScript snippet to the client&apos;s website.
        </p>
        
        <CodeBlock title="Embed Code" language="html">
{`<script
  src="https://yourdomain.com/capture.js"
  data-form-id="abc123-def456-..."
  data-form-selector="#signup-form"
  data-fields="email_field:email,name:firstName,barcode:custom.barcode"
  async
></script>`}
        </CodeBlock>
        
        <h3 className="text-lg font-semibold mt-8 mb-3">Configuration Attributes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Attribute</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Required</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>data-form-id</code></td>
                <td className="py-3 px-4"><span className="text-green-400">Yes</span></td>
                <td className="py-3 px-4">The form ID from RevLine</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>data-form-selector</code></td>
                <td className="py-3 px-4"><span className="text-green-400">Yes</span></td>
                <td className="py-3 px-4">CSS selector for the form element</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>data-fields</code></td>
                <td className="py-3 px-4"><span className="text-green-400">Yes</span></td>
                <td className="py-3 px-4">Field mapping (source:target pairs)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold mt-8 mb-3">Field Mapping Format</h3>
        <p className="text-zinc-400 mb-4">
          Map form field names to RevLine targets using <code className="text-white">source:target</code> pairs separated by commas:
        </p>
        
        <CodeBlock language="text">
{`email_field:email       → Maps form's "email_field" to lead.email
full_name:firstName     → Maps to lead.firstName
phone_number:phone      → Maps to lead.phone
member_id:custom.barcode → Maps to custom field "barcode"`}
        </CodeBlock>
        
        <TipBox title="Custom Fields">
          To map to a custom field, use the <code>custom.</code> prefix. The custom field must be defined in the workspace first.
        </TipBox>
      </section>

      {/* Server Mode */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Server Mode (API)</h2>
        <p className="text-zinc-400 mb-4">
          For server-to-server integrations with HMAC authentication. More secure, supports higher rate limits.
        </p>
        
        <CodeBlock title="API Request" language="bash">
{`curl -X POST https://yourdomain.com/api/v1/capture/{formId} \\
  -H "Content-Type: application/json" \\
  -H "X-RevLine-Signature: {hmac_signature}" \\
  -H "X-RevLine-Timestamp: {unix_timestamp}" \\
  -d '{"email": "user@example.com", "firstName": "John"}'`}
        </CodeBlock>
        
        <h3 className="text-lg font-semibold mt-8 mb-3">HMAC Signature</h3>
        <p className="text-zinc-400 mb-4">
          Generate the signature using the form&apos;s signing secret:
        </p>
        
        <CodeBlock title="Signature Generation" language="javascript">
{`const crypto = require('crypto');

const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify(data);
const message = \`\${timestamp}.\${payload}\`;

const signature = crypto
  .createHmac('sha256', signingSecret)
  .update(message)
  .digest('hex');`}
        </CodeBlock>
        
        <WarningBox title="Timestamp Validation">
          Requests are rejected if the timestamp is more than 5 minutes old. This prevents replay attacks.
        </WarningBox>
      </section>

      {/* Security */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Security Features</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Browser Mode</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li>• Origin validation against allowedOrigins</li>
              <li>• IP-based rate limiting (default: 10/min)</li>
              <li>• Field allowlist filtering</li>
              <li>• Sensitive data denylist</li>
            </ul>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Server Mode</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li>• HMAC signature verification</li>
              <li>• Timestamp validation (5-min window)</li>
              <li>• Workspace rate limiting (100/min)</li>
              <li>• Proper error responses</li>
            </ul>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mt-8 mb-3">Denylist Protection</h3>
        <p className="text-zinc-400 mb-4">
          The capture system automatically blocks sensitive fields to prevent accidental data capture:
        </p>
        
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-400 font-medium mb-2">Blocked Field Names</p>
          <p className="text-sm text-red-200/80">
            password, ssn, social_security, credit_card, cvv, card_number, secret, token
          </p>
        </div>
      </section>

      {/* Custom Fields */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Custom Fields</h2>
        <p className="text-zinc-400 mb-4">
          Define custom fields in your workspace to capture additional data beyond the standard lead fields.
        </p>
        
        <h3 className="text-lg font-semibold mt-6 mb-3">Field Types</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Example</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>TEXT</code></td>
                <td className="py-3 px-4">Free-form text</td>
                <td className="py-3 px-4">Member ID, notes</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>NUMBER</code></td>
                <td className="py-3 px-4">Numeric values</td>
                <td className="py-3 px-4">Age, quantity</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>DATE</code></td>
                <td className="py-3 px-4">Date values</td>
                <td className="py-3 px-4">Start date, DOB</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Workflow Integration */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Workflow Integration</h2>
        <p className="text-zinc-400 mb-4">
          Every capture automatically triggers the workflow engine. The trigger name is configurable per form.
        </p>
        
        <CodeBlock title="Trigger Payload" language="json">
{`{
  "adapter": "capture",
  "operation": "form_captured",
  "payload": {
    "formId": "abc123...",
    "formName": "Signup Form",
    "email": "user@example.com",
    "firstName": "John",
    "leadId": "lead_xyz...",
    "isNewLead": true,
    "customFields": {
      "barcode": "12345678"
    }
  }
}`}
        </CodeBlock>
        
        <TipBox>
          Email is optional. If no email is provided, the capture still triggers workflows — useful for form submissions that don&apos;t collect email addresses.
        </TipBox>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/docs/workflows" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-purple-400 transition-colors">Workflows →</p>
            <p className="text-sm text-zinc-400 mt-1">Learn how to build automations triggered by captures</p>
          </a>
          <a href="/docs/integrations" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">Integrations →</p>
            <p className="text-sm text-zinc-400 mt-1">Connect captured data to external services</p>
          </a>
        </div>
      </section>
    </div>
  );
}
