import { DocHero, CodeBlock, TipBox, WarningBox } from '../_components';

// Integration icons
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.5 6.5a2.5 2.5 0 0 1 0 5H5.5a2.5 2.5 0 0 1 0-5h1zm11 0a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 1 0-5h1z" />
      <path d="M18 8h2a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1h-2" />
      <path d="M6 8H4a1 1 0 0 0-1 1v0a1 1 0 0 0 1 1h2" />
      <path d="M8 9h8" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <DocHero
        badge="Integrations"
        title="Connect Your Revenue Stack"
        titleGradient="Revenue Stack"
        description="RevLine integrates with the tools that power your revenue operations. Each integration provides triggers, actions, or both."
      />

      {/* Integration Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Available Integrations</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'MailerLite', icon: MailIcon, color: '#09C269', desc: 'Email marketing', type: 'Actions' },
            { name: 'Stripe', icon: CreditCardIcon, color: '#635BFF', desc: 'Payments', type: 'Triggers' },
            { name: 'Calendly', icon: CalendarIcon, color: '#006BFF', desc: 'Scheduling', type: 'Triggers' },
            { name: 'ABC Ignite', icon: DumbbellIcon, color: '#FF6B00', desc: 'Gym management', type: 'Actions' },
            { name: 'Resend', icon: SendIcon, color: '#00D4FF', desc: 'Transactional email', type: 'Actions' },
            { name: 'ManyChat', icon: MessageIcon, color: '#0084FF', desc: 'Instagram DMs', type: 'Traffic' },
          ].map((integration) => (
            <a
              key={integration.name}
              href={`#${integration.name.toLowerCase().replace(' ', '-')}`}
              className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${integration.color}20`, border: `1px solid ${integration.color}40` }}
                >
                  <integration.icon className="w-5 h-5" style={{ color: integration.color }} />
                </div>
                <div>
                  <p className="font-medium text-white">{integration.name}</p>
                  <p className="text-xs text-zinc-500">{integration.desc}</p>
                </div>
              </div>
              <span 
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${integration.color}20`, color: integration.color }}
              >
                {integration.type}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* MailerLite */}
      <section id="mailerlite">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#09C269]/20 border border-[#09C269]/40 flex items-center justify-center">
            <MailIcon className="w-5 h-5 text-[#09C269]" />
          </div>
          <h2 className="text-2xl font-semibold">MailerLite</h2>
        </div>
        
        <p className="text-zinc-400 mb-4">
          Email marketing platform for managing subscribers and sending campaigns. 
          RevLine uses MailerLite to add subscribers to groups based on workflow triggers.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Required Credentials</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>API Key</strong> — From MailerLite Settings → API</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Configuration</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>Groups</strong> — Map group keys to MailerLite group IDs</li>
            </ul>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-3">Actions</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Action</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Parameters</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>add_to_group</code></td>
                <td className="py-3 px-4"><code>group</code></td>
                <td className="py-3 px-4">Add subscriber to group</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>remove_from_group</code></td>
                <td className="py-3 px-4"><code>group</code></td>
                <td className="py-3 px-4">Remove from group</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code>add_tag</code></td>
                <td className="py-3 px-4"><code>tag</code></td>
                <td className="py-3 px-4">Add tag to subscriber</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <CodeBlock title="Group Configuration Example" language="json">
{`{
  "groups": {
    "fit1": { "id": "123456789", "name": "FIT1 Program" },
    "newsletter": { "id": "987654321", "name": "Newsletter" }
  }
}`}
        </CodeBlock>
      </section>

      {/* Stripe */}
      <section id="stripe" className="pt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#635BFF]/20 border border-[#635BFF]/40 flex items-center justify-center">
            <CreditCardIcon className="w-5 h-5 text-[#635BFF]" />
          </div>
          <h2 className="text-2xl font-semibold">Stripe</h2>
        </div>
        
        <p className="text-zinc-400 mb-4">
          Payment processing platform. RevLine listens for Stripe webhooks to trigger workflows 
          when payments succeed or subscriptions change.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Required Credentials</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>Webhook Secret</strong> — From Stripe webhook settings (whsec_...)</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Webhook URL</h3>
            <code className="text-sm text-zinc-300">/api/stripe-webhook?source={'{slug}'}</code>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-3">Triggers</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Trigger</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Stripe Event</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>payment_succeeded</code></td>
                <td className="py-3 px-4">checkout.session.completed</td>
                <td className="py-3 px-4">One-time payment completed</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>subscription_created</code></td>
                <td className="py-3 px-4">customer.subscription.created</td>
                <td className="py-3 px-4">New subscription started</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code>subscription_canceled</code></td>
                <td className="py-3 px-4">customer.subscription.deleted</td>
                <td className="py-3 px-4">Subscription canceled</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <TipBox title="Product Metadata">
          Add a <code>revline_product</code> metadata key to your Stripe products to identify them in workflow filters.
        </TipBox>
      </section>

      {/* Calendly */}
      <section id="calendly" className="pt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#006BFF]/20 border border-[#006BFF]/40 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-[#006BFF]" />
          </div>
          <h2 className="text-2xl font-semibold">Calendly</h2>
        </div>
        
        <p className="text-zinc-400 mb-4">
          Scheduling platform for booking calls and appointments. RevLine triggers workflows 
          when bookings are created or canceled.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Required Credentials</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>Webhook Secret</strong> — Calendly signing key</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Webhook URL</h3>
            <code className="text-sm text-zinc-300">/api/calendly-webhook?source={'{slug}'}</code>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-3">Triggers</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Trigger</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>booking_created</code></td>
                <td className="py-3 px-4">Someone booked a call</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code>booking_canceled</code></td>
                <td className="py-3 px-4">Booking was canceled</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <TipBox>
          Use <code>utm_source={'{slug}'}</code> in your Calendly links to track which workspace the booking came from.
        </TipBox>
      </section>

      {/* ABC Ignite */}
      <section id="abc-ignite" className="pt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/40 flex items-center justify-center">
            <DumbbellIcon className="w-5 h-5 text-[#FF6B00]" />
          </div>
          <h2 className="text-2xl font-semibold">ABC Ignite</h2>
        </div>
        
        <p className="text-zinc-400 mb-4">
          Gym management system for fitness businesses. RevLine integrates with ABC Ignite 
          to look up members, check availability, and book appointments.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Required Credentials</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>App ID</strong> — ABC Ignite application ID</li>
              <li>• <strong>App Key</strong> — ABC Ignite application key</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Configuration</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>clubNumber</strong> — ABC Ignite club/location ID</li>
              <li>• <strong>eventTypes</strong> — Synced event type mappings</li>
            </ul>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-3">Actions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Action</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>lookup_member</code></td>
                <td className="py-3 px-4">Find member by barcode</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>check_availability</code></td>
                <td className="py-3 px-4">Check employee availability for event type</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>enroll_member</code></td>
                <td className="py-3 px-4">Book member into appointment or class</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>unenroll_member</code></td>
                <td className="py-3 px-4">Cancel member booking</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>add_to_waitlist</code></td>
                <td className="py-3 px-4">Add member to event waitlist</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code>remove_from_waitlist</code></td>
                <td className="py-3 px-4">Remove from waitlist</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Resend */}
      <section id="resend" className="pt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/40 flex items-center justify-center">
            <SendIcon className="w-5 h-5 text-[#00D4FF]" />
          </div>
          <h2 className="text-2xl font-semibold">Resend</h2>
        </div>
        
        <p className="text-zinc-400 mb-4">
          Transactional email service for sending individual emails. Use Resend to send 
          confirmation emails, notifications, and other triggered messages.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Required Credentials</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>API Key</strong> — From Resend dashboard</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Configuration</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• <strong>fromEmail</strong> — Verified sender address</li>
              <li>• <strong>fromName</strong> — Sender name (optional)</li>
              <li>• <strong>replyTo</strong> — Reply-to address (optional)</li>
            </ul>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-3">Actions</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Action</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Parameters</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr>
                <td className="py-3 px-4"><code>send_email</code></td>
                <td className="py-3 px-4"><code>to, subject, body</code></td>
                <td className="py-3 px-4">Send transactional email</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <TipBox>
          Use variable interpolation in email body: <code>{`{{lead.firstName}}`}</code>, <code>{`{{trigger.payload.product}}`}</code>
        </TipBox>
      </section>

      {/* ManyChat */}
      <section id="manychat" className="pt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#0084FF]/20 border border-[#0084FF]/40 flex items-center justify-center">
            <MessageIcon className="w-5 h-5 text-[#0084FF]" />
          </div>
          <h2 className="text-2xl font-semibold">ManyChat</h2>
        </div>
        
        <p className="text-zinc-400 mb-4">
          Instagram DM automation platform. ManyChat is primarily used as a traffic driver — 
          it sends users to RevLine landing pages where leads are captured.
        </p>
        
        <WarningBox title="Traffic Driver Only">
          ManyChat integration is for driving traffic to RevLine pages. There is no direct 
          backend integration — ManyChat handles Instagram DMs while RevLine captures the leads.
        </WarningBox>
        
        <h3 className="text-lg font-semibold mt-6 mb-3">How It Works</h3>
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <ol className="space-y-3 text-sm text-zinc-400">
            <li className="flex gap-3">
              <span className="text-purple-400 font-medium">1.</span>
              User comments keyword on Instagram post
            </li>
            <li className="flex gap-3">
              <span className="text-purple-400 font-medium">2.</span>
              ManyChat auto-DMs user with landing page link
            </li>
            <li className="flex gap-3">
              <span className="text-purple-400 font-medium">3.</span>
              User visits RevLine landing page
            </li>
            <li className="flex gap-3">
              <span className="text-purple-400 font-medium">4.</span>
              RevLine captures email and triggers workflows
            </li>
          </ol>
        </div>
        
        <TipBox title="ManyChat Pro Required">
          Instagram automation requires ManyChat Pro subscription ($15-25/month).
        </TipBox>
      </section>

      {/* Next Steps */}
      <section className="pt-8">
        <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/docs/workflows" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-purple-400 transition-colors">Workflows →</p>
            <p className="text-sm text-zinc-400 mt-1">Build automations using these integrations</p>
          </a>
          <a href="/docs/security" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-green-400 transition-colors">Security →</p>
            <p className="text-sm text-zinc-400 mt-1">Learn how credentials are protected</p>
          </a>
        </div>
      </section>
    </div>
  );
}
