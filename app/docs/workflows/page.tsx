import { DocHero, CodeBlock, TipBox, WarningBox } from '../_components';

export default function WorkflowsPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <DocHero
        badge="Workflow Engine"
        title="Trigger-Action Automation"
        titleGradient="Automation"
        description="Build automations that connect events to actions. When something happens, do something — configured in the UI, executed reliably."
      />

      {/* How It Works */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">How Workflows Work</h2>
        <p className="text-zinc-400 mb-6">
          A workflow connects a <strong className="text-white">trigger</strong> (an event) to one or more <strong className="text-white">actions</strong> (operations). 
          When the trigger fires, actions execute sequentially.
        </p>
        
        {/* Flow diagram */}
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
            <div className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 font-medium">Trigger</p>
              <p className="text-amber-400/70 text-xs">stripe.payment_succeeded</p>
            </div>
            <span className="text-zinc-600">→</span>
            <div className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
              <p className="text-zinc-400 font-medium">Filter</p>
              <p className="text-zinc-500 text-xs">product = &quot;premium&quot;</p>
            </div>
            <span className="text-zinc-600">→</span>
            <div className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
              <p className="text-purple-400 font-medium">Action 1</p>
              <p className="text-purple-400/70 text-xs">Update lead stage</p>
            </div>
            <span className="text-zinc-600">→</span>
            <div className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
              <p className="text-green-400 font-medium">Action 2</p>
              <p className="text-green-400/70 text-xs">Add to email list</p>
            </div>
          </div>
        </div>
      </section>

      {/* Creating Workflows */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Creating a Workflow</h2>
        <p className="text-zinc-400 mb-4">
          From your workspace, go to the Workflows tab and click &quot;New Workflow&quot;.
        </p>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-medium">1</span>
              <p className="font-medium text-white">Choose a Trigger</p>
            </div>
            <p className="text-sm text-zinc-400 ml-9">
              Select which event should start the workflow. Example: <code className="text-white">stripe.payment_succeeded</code>
            </p>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-medium">2</span>
              <p className="font-medium text-white">Add Filter (Optional)</p>
            </div>
            <p className="text-sm text-zinc-400 ml-9">
              Only run for specific conditions. Example: <code className="text-white">{`{ "product": "premium" }`}</code>
            </p>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-medium">3</span>
              <p className="font-medium text-white">Add Actions</p>
            </div>
            <p className="text-sm text-zinc-400 ml-9">
              Add one or more actions to execute. Actions run in order. If one fails, the workflow stops.
            </p>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-medium">4</span>
              <p className="font-medium text-white">Enable</p>
            </div>
            <p className="text-sm text-zinc-400 ml-9">
              Workflows start disabled. Enable when ready. You can disable anytime without deleting.
            </p>
          </div>
        </div>
      </section>

      {/* Triggers Reference */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Triggers Reference</h2>
        <p className="text-zinc-400 mb-4">
          Available triggers by integration:
        </p>
        
        <div className="space-y-4">
          {/* Stripe */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#635BFF]"></span>
              Stripe
            </h3>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <code className="text-zinc-300">payment_succeeded</code>
                <span>Checkout completed</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <code className="text-zinc-300">subscription_created</code>
                <span>New subscription</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <code className="text-zinc-300">subscription_canceled</code>
                <span>Subscription canceled</span>
              </div>
            </div>
          </div>
          
          {/* Calendly */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#006BFF]"></span>
              Calendly
            </h3>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <code className="text-zinc-300">booking_created</code>
                <span>New booking</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <code className="text-zinc-300">booking_canceled</code>
                <span>Booking canceled</span>
              </div>
            </div>
          </div>
          
          {/* Capture */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Capture
            </h3>
            <div className="text-sm text-zinc-400">
              <p>Dynamic triggers based on your workspace&apos;s capture forms. Each form can have a custom trigger name.</p>
            </div>
          </div>
          
          {/* RevLine */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              RevLine
            </h3>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <code className="text-zinc-300">email_captured</code>
                <span>Email submitted via landing page</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions Reference */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Actions Reference</h2>
        <p className="text-zinc-400 mb-4">
          Available actions by integration:
        </p>
        
        <div className="space-y-4">
          {/* RevLine */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">RevLine</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">create_lead</code>
                <span>Create or update lead record</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">update_lead_stage</code>
                <span>Update funnel stage</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1">
                <code className="text-zinc-300">emit_event</code>
                <span>Log custom event</span>
              </div>
            </div>
          </div>
          
          {/* MailerLite */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">MailerLite</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">add_to_group</code>
                <span>Add subscriber to group</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">remove_from_group</code>
                <span>Remove from group</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1">
                <code className="text-zinc-300">add_tag</code>
                <span>Add tag to subscriber</span>
              </div>
            </div>
          </div>
          
          {/* Resend */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">Resend</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400 py-1">
                <code className="text-zinc-300">send_email</code>
                <span>Send transactional email</span>
              </div>
            </div>
          </div>
          
          {/* ABC Ignite */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">ABC Ignite</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">lookup_member</code>
                <span>Find member by barcode</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">check_availability</code>
                <span>Check employee availability</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800/50">
                <code className="text-zinc-300">enroll_member</code>
                <span>Book appointment/class</span>
              </div>
              <div className="flex justify-between text-zinc-400 py-1">
                <code className="text-zinc-300">unenroll_member</code>
                <span>Cancel booking</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Variable Interpolation */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Variable Interpolation</h2>
        <p className="text-zinc-400 mb-4">
          Use double-brace syntax to insert dynamic values into action parameters:
        </p>
        
        <CodeBlock title="Example: Send Email Action" language="json">
{`{
  "to": "{{lead.email}}",
  "subject": "Welcome, {{lead.firstName}}!",
  "body": "Thank you for your purchase of {{trigger.payload.product}}."
}`}
        </CodeBlock>
        
        <h3 className="text-lg font-semibold mt-8 mb-3">Available Variables</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Variable</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{lead.email}}`}</code></td>
                <td className="py-3 px-4">Lead&apos;s email address</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{lead.firstName}}`}</code></td>
                <td className="py-3 px-4">Lead&apos;s first name</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{lead.stage}}`}</code></td>
                <td className="py-3 px-4">Current funnel stage</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{lead.custom.fieldKey}}`}</code></td>
                <td className="py-3 px-4">Custom field value</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{workspace.name}}`}</code></td>
                <td className="py-3 px-4">Workspace name</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{trigger.adapter}}`}</code></td>
                <td className="py-3 px-4">Trigger adapter (e.g., stripe)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4"><code>{`{{trigger.payload.*}}`}</code></td>
                <td className="py-3 px-4">Any field from trigger payload</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <TipBox>
          Variables that don&apos;t exist or are undefined will be replaced with an empty string.
        </TipBox>
      </section>

      {/* Execution & Debugging */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Execution &amp; Debugging</h2>
        <p className="text-zinc-400 mb-4">
          Every workflow execution is logged with full details for debugging.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Execution States</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>RUNNING — Currently executing</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>COMPLETED — All actions succeeded</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>FAILED — An action failed</span>
              </li>
            </ul>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Execution Details</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li>• Trigger information and payload</li>
              <li>• Each action&apos;s result or error</li>
              <li>• Timing (started, completed)</li>
              <li>• Correlation ID for tracing</li>
            </ul>
          </div>
        </div>
        
        <WarningBox title="Failed Actions">
          When an action fails, the workflow stops immediately. Remaining actions are skipped. 
          Check the execution details to see the error message and fix the issue.
        </WarningBox>
      </section>

      {/* Idempotency */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Reliability Features</h2>
        
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <h3 className="font-medium text-white mb-2">Idempotent Execution</h3>
          <p className="text-sm text-zinc-400 mb-3">
            Each action is wrapped with idempotency protection. If a webhook is delivered twice 
            (common with Stripe/Calendly), the action won&apos;t execute twice.
          </p>
          <p className="text-sm text-zinc-500">
            Idempotency keys have a 24-hour TTL. After 24 hours, the same event would execute again.
          </p>
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/docs/integrations" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">Integrations →</p>
            <p className="text-sm text-zinc-400 mt-1">Learn about each integration&apos;s setup and capabilities</p>
          </a>
          <a href="/docs/security" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-green-400 transition-colors">Security →</p>
            <p className="text-sm text-zinc-400 mt-1">Understand encryption and data protection</p>
          </a>
        </div>
      </section>
    </div>
  );
}
