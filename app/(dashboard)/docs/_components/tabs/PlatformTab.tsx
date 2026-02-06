import { TipBox, WarningBox, CodeBlock } from '../shared';

export function PlatformTab() {
  return (
    <div className="space-y-8">
      {/* Architecture Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-amber-400">Platform</span> Architecture
        </h2>
        <p className="text-zinc-300 mb-4">
          RevLine is built on five core principles that guide every design decision:
          <strong> agnostic, extensible, decoupled, secure, reliable</strong>. This tab covers 
          the architecture, patterns, and key files a developer needs to understand the codebase.
        </p>
        <div className="grid sm:grid-cols-5 gap-3">
          {[
            { label: 'Agnostic', desc: 'Provider-independent abstractions' },
            { label: 'Extensible', desc: 'Add integrations without rewiring' },
            { label: 'Decoupled', desc: 'Layers don\'t know about each other' },
            { label: 'Secure', desc: 'Encrypted secrets, timing-safe ops' },
            { label: 'Reliable', desc: 'Idempotent, deduplicated, transactional' },
          ].map((p) => (
            <div key={p.label} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-center">
              <p className="font-medium text-amber-400 text-sm">{p.label}</p>
              <p className="text-xs text-zinc-500 mt-1">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Request Flow */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Request Flow</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Every external integration follows the same layered pattern. Route handlers never call 
          external APIs directly.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm">
          <div className="flex flex-wrap items-center gap-2 text-zinc-400">
            <span className="text-purple-400">Route Handler</span>
            <span>&rarr;</span>
            <span className="text-blue-400">Service Layer</span>
            <span>&rarr;</span>
            <span className="text-green-400">Integration Adapter</span>
            <span>&rarr;</span>
            <span className="text-zinc-500">External API</span>
          </div>
        </div>
        <CodeBlock language="typescript" title="Example: Webhook Processing">{`// Route handler (app/api/v1/stripe-webhook/route.ts)
export async function POST(request: NextRequest) {
  const result = await processStripeWebhook(request);  // service layer
  return ApiResponse.success(result);
}

// Service layer calls adapter
const adapter = new StripeAdapter(integration);
const verified = await adapter.verifyWebhook(payload, signature);

// Adapter handles external API details
class StripeAdapter extends BaseIntegrationAdapter {
  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    // timing-safe signature verification
  }
}`}</CodeBlock>
      </section>

      {/* Two-Layer System */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Two-Layer System</h2>
        <p className="text-zinc-300 mb-4">
          RevLine has two distinct automation layers that work together. Understanding this 
          architecture is critical to understand.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-900 border border-amber-900/50 rounded-lg">
            <h3 className="font-medium text-amber-400 mb-2">Layer 1: Template-Declared Flows</h3>
            <p className="text-sm text-zinc-400 mb-3">
              Forms in the <code>FORM_REGISTRY</code> declare <strong>baked-in operations</strong> that 
              execute automatically when the form runs. These are hardcoded, not user-configurable.
            </p>
            <ul className="text-xs text-zinc-500 space-y-1">
              <li>- Defined in <code>app/_lib/forms/registry.ts</code></li>
              <li>- Operations have phases: <code>pre</code> and <code>trigger</code></li>
              <li>- Async gaps represent user actions (e.g., clicking a magic link)</li>
              <li>- Show as operation nodes on the network graph</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900 border border-blue-900/50 rounded-lg">
            <h3 className="font-medium text-blue-400 mb-2">Layer 2: User-Built Workflows</h3>
            <p className="text-sm text-zinc-400 mb-3">
              Workflows stored in the database, configured in the UI. Triggered by form events 
              or external webhook events. Fully user-configurable.
            </p>
            <ul className="text-xs text-zinc-500 space-y-1">
              <li>- Stored in <code>Workflow</code> table</li>
              <li>- Triggered via <code>revline</code> adapter or webhooks</li>
              <li>- Actions execute sequentially</li>
              <li>- Show as edges between integration nodes on the graph</li>
            </ul>
          </div>
        </div>

        <h3 className="font-medium text-zinc-300 mb-3">How They Connect</h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm">
          <div className="space-y-2 text-zinc-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-amber-400">[Form]</span>
              <span>&rarr;</span>
              <span className="text-zinc-300">[Pre-Ops]</span>
              <span>&rarr;</span>
              <span className="text-zinc-600">[Async Gap]</span>
              <span>&rarr;</span>
              <span className="text-zinc-300">[Trigger-Ops]</span>
              <span>&rarr;</span>
              <span className="text-orange-400">[RevLine Trigger]</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-4 border-l border-zinc-700">
              <span className="text-orange-400">[RevLine Trigger]</span>
              <span>&rarr;</span>
              <span className="text-blue-400">[Workflow]</span>
              <span>&rarr;</span>
              <span className="text-green-400">[Actions]</span>
              <span>&rarr;</span>
              <span className="text-zinc-500">[Integrations]</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          Form triggers (e.g., <code>booking-confirmed</code>) become workflow trigger operations 
          via the RevLine adapter. Layer 1 runs automatically; Layer 2 reacts to Layer 1 events.
        </p>
      </section>

      {/* Network Graph */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Network Graph</h2>
        <p className="text-zinc-300 mb-4">
          The network graph on the Workflows tab visualizes both layers in a single view. 
          It reads left-to-right across columns:
        </p>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Column</th>
                <th className="pb-2 font-medium">Node Type</th>
                <th className="pb-2 font-medium">What It Shows</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">0</td>
                <td className="py-3"><span className="text-purple-400">Form Nodes</span></td>
                <td className="py-3 text-zinc-400">Enabled forms (booking, signup) with operation and trigger counts</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">1</td>
                <td className="py-3"><span className="text-zinc-300">Operation Nodes (Pre)</span></td>
                <td className="py-3 text-zinc-400">Baked-in operations that run before the async gap</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">2</td>
                <td className="py-3"><span className="text-zinc-500">Async Gap</span></td>
                <td className="py-3 text-zinc-400">User action required (e.g., clicking magic link)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">3</td>
                <td className="py-3"><span className="text-zinc-300">Operation Nodes (Trigger)</span></td>
                <td className="py-3 text-zinc-400">Operations that run when the trigger fires</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 text-zinc-400">4+</td>
                <td className="py-3"><span className="text-green-400">Integration Nodes</span></td>
                <td className="py-3 text-zinc-400">Integrations used by workflows, with health status and usage counts</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm text-zinc-400 mt-4">
          <strong>Workflow edges</strong> connect integration nodes (trigger &rarr; action). Each edge 
          represents a workflow with validation status. The graph auto-layouts based on usage 
          patterns: trigger-only integrations on the left, action-only on the right, bidirectional 
          in the center.
        </p>
      </section>

      {/* Integration Adapter Pattern */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Integration Adapter Pattern</h2>
        <p className="text-zinc-400 text-sm mb-4">
          All integrations extend <code>BaseIntegrationAdapter</code>. This provides a consistent 
          interface for health checks, secrets management, and operation execution.
        </p>
        <CodeBlock language="typescript" title="Adding a New Integration">{`// 1. Create adapter: app/_lib/integrations/your-adapter.ts
export class YourAdapter extends BaseIntegrationAdapter {
  readonly type = IntegrationType.YOUR_TYPE;
  
  async verifyWebhook(payload: string, signature: string): Promise<boolean> { ... }
  async processEvent(event: YourEvent): Promise<ProcessResult> { ... }
}

// 2. Register in: app/_lib/integrations/config.ts
// 3. Add type to: prisma/schema.prisma (IntegrationType enum)
// 4. Create webhook route: app/api/v1/your-webhook/route.ts
// 5. Add workflow executor: app/_lib/workflow/executors/your-adapter.ts`}</CodeBlock>

        <TipBox title="Adding an Integration">
          Every integration must: extend the base class, store secrets encrypted (never in meta), 
          verify webhook signatures with timing-safe comparison, and implement health checks.
        </TipBox>
      </section>

      {/* Directory Structure */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Directory Structure</h2>
        <CodeBlock title="Key Directories">{`app/
├── _lib/                        # Core libraries (server-only)
│   ├── types/                   # Shared type definitions
│   ├── services/                # Business logic (capture, webhook)
│   ├── integrations/            # Adapter pattern for external APIs
│   │   ├── base.ts              # Abstract base class
│   │   ├── config.ts            # Integration metadata registry
│   │   ├── mailerlite.adapter.ts
│   │   ├── stripe.adapter.ts
│   │   ├── abc-ignite.adapter.ts
│   │   ├── revline.adapter.ts
│   │   └── resend.adapter.ts
│   ├── workflow/                # Workflow engine
│   │   ├── engine.ts            # Core execution engine
│   │   ├── executors/           # Per-adapter action executors
│   │   ├── validation.ts        # Workflow validation rules
│   │   └── registry.ts          # Available triggers/actions
│   ├── forms/                   # Form builder system
│   │   ├── registry.ts          # FORM_REGISTRY with baked-in ops
│   │   ├── components/          # Reusable field components
│   │   └── types.ts             # Form type definitions
│   ├── booking/                 # Booking system
│   │   ├── providers/           # Provider-agnostic booking
│   │   ├── magic-link.ts        # Magic link generation/verification
│   │   └── components/          # Booking UI components
│   ├── reliability/             # Reliability infrastructure
│   │   ├── idempotent-executor.ts
│   │   ├── resilient-client.ts
│   │   └── webhook-processor.ts
│   ├── sites/                   # Custom domain routing
│   ├── templates/               # Org-scoped template schemas
│   ├── domain/                  # Custom domain verification
│   ├── email/                   # Transactional email (Resend)
│   ├── middleware/              # Rate limiting, validation
│   ├── config/                  # Workspace config service
│   ├── auth.ts                  # Authentication (session-based)
│   ├── workspace-gate.ts        # Workspace lookup + execution gating
│   ├── organization-access.ts   # Org permission checks
│   ├── workspace-access.ts      # Workspace role checks
│   ├── crypto.ts                # Encryption utilities
│   ├── totp.ts                  # 2FA (TOTP + recovery codes)
│   ├── event-logger.ts          # Event emission
│   └── db.ts                    # Prisma client
├── (dashboard)/                 # Dashboard UI
├── (auth)/                      # Login, setup, 2FA
├── (sites)/                     # Custom domain site pages
├── api/v1/                      # All API routes (versioned)
├── public/[slug]/               # Public workspace pages (booking, signup)
└── book/[workspaceSlug]/        # Booking pages`}</CodeBlock>
      </section>

      {/* Key Files */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Key Files</h2>
        <p className="text-zinc-400 text-sm mb-4">
          These are the most important files to understand in the codebase:
        </p>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">File</th>
                <th className="pb-2 font-medium">Purpose</th>
                <th className="pb-2 font-medium">What to Know</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">proxy.ts</code></td>
                <td className="py-3 text-zinc-400">Request proxy (replaces middleware.ts in Next 16)</td>
                <td className="py-3 text-zinc-400">Auth checks, rate limits, security headers</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/auth.ts</code></td>
                <td className="py-3 text-zinc-400">Session management, login, 2FA</td>
                <td className="py-3 text-zinc-400">Session validation, TOTP verification</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/workspace-gate.ts</code></td>
                <td className="py-3 text-zinc-400">Workspace lookup and execution gating</td>
                <td className="py-3 text-zinc-400">Workspace isolation, paused workspace handling</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/integrations/base.ts</code></td>
                <td className="py-3 text-zinc-400">Base integration adapter</td>
                <td className="py-3 text-zinc-400">All adapters must extend this properly</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/workflow/engine.ts</code></td>
                <td className="py-3 text-zinc-400">Workflow execution engine</td>
                <td className="py-3 text-zinc-400">Action execution order, error handling, events</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/forms/registry.ts</code></td>
                <td className="py-3 text-zinc-400">Form definitions with baked-in operations</td>
                <td className="py-3 text-zinc-400">Operation phases, triggers, integration usage</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/reliability/</code></td>
                <td className="py-3 text-zinc-400">Idempotency, dedup, resilient client</td>
                <td className="py-3 text-zinc-400">Dedup keys, retry logic, transaction boundaries</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">_lib/crypto.ts</code></td>
                <td className="py-3 text-zinc-400">Encryption/decryption for secrets</td>
                <td className="py-3 text-zinc-400">Key versioning, no secrets in logs</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3"><code className="text-white text-xs">prisma/schema.prisma</code></td>
                <td className="py-3 text-zinc-400">Database schema</td>
                <td className="py-3 text-zinc-400">Relationships, indexes, JSON field validation</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Security Patterns */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Security Patterns</h2>
        <p className="text-zinc-400 text-sm mb-4">
          These patterns are enforced across the codebase:
        </p>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Timing-Safe Comparisons</h3>
            <p className="text-sm text-zinc-400 mb-3">
              All webhook signature verification must use <code>crypto.timingSafeEqual</code> to 
              prevent timing attacks. Regular <code>===</code> comparison leaks information about 
              how many bytes matched.
            </p>
            <CodeBlock language="typescript">{`// REQUIRED: timing-safe comparison
const expected = Buffer.from(expectedSig, 'hex');
const provided = Buffer.from(providedSig, 'hex');
if (expected.length !== provided.length || 
    !timingSafeEqual(expected, provided)) {
  return false;
}`}</CodeBlock>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Encrypted Secrets</h3>
            <p className="text-sm text-zinc-400">
              All integration secrets are encrypted at rest with key versioning. Secrets are 
              decrypted in memory only, never persisted in plaintext. Never log secrets, not even 
              partially. The <code>secrets</code> field on <code>WorkspaceIntegration</code> stores 
              an array of <code>{`{ name, encryptedValue, keyVersion }`}</code>.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Rate Limiting</h3>
            <p className="text-sm text-zinc-400">
              Public endpoints have per-IP rate limits. Auth endpoints are strict (5 req/5 min) to 
              prevent brute force. A global rate limit (100 req/min per IP) is enforced 
              in <code>proxy.ts</code> as a safety net.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Input Validation</h3>
            <p className="text-sm text-zinc-400">
              All external input is validated with Zod schemas. Route handlers 
              use <code>validateBody(request, Schema)</code> which returns typed, validated data or 
              an error response. Never trust user input directly.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Generic Error Responses</h3>
            <p className="text-sm text-zinc-400">
              Security-sensitive endpoints (login, booking requests) return the same response 
              regardless of whether the operation succeeded or failed. This prevents enumeration 
              attacks. Timing is also normalized to prevent timing-based inference.
            </p>
          </div>
        </div>
      </section>

      {/* Reliability Patterns */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Reliability Patterns</h2>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Idempotency Keys</h3>
            <p className="text-sm text-zinc-400">
              The <code>IdempotencyKey</code> model prevents duplicate action execution. Each action 
              generates a key from its workspace ID, action type, and parameters. If the key exists 
              and has completed, the cached result is returned instead of re-executing.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Webhook Deduplication</h3>
            <p className="text-sm text-zinc-400">
              The <code>WebhookEvent</code> model stores raw webhook payloads with a unique 
              constraint on <code>[workspaceId, provider, providerEventId]</code>. Duplicate 
              webhooks are detected before processing begins. Raw payloads are preserved for 
              debugging.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Database Transactions</h3>
            <p className="text-sm text-zinc-400">
              Multi-step operations use <code>withTransaction()</code> to ensure atomicity. If any 
              step fails, all changes are rolled back. Used when creating leads + updating stages + 
              emitting events together.
            </p>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Resilient Client</h3>
            <p className="text-sm text-zinc-400">
              External API calls use a resilient HTTP client with configurable timeouts (30s max). 
              Logging failures never break the main flow. Webhooks return 200 on partial failures 
              to prevent provider retries that could cause duplicate processing.
            </p>
          </div>
        </div>

        <WarningBox title="Webhook Handler Pattern">
          All webhook handlers follow this pattern: signature checked before processing, idempotency 
          key used for side effects, transactions wrap related DB operations, and the handler 
          returns 200 even on partial failure (to prevent retries).
        </WarningBox>
      </section>
    </div>
  );
}
