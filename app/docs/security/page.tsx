import { DocHero, CodeBlock, TipBox, FeatureCard } from '../_components';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function SecurityPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <DocHero
        badge="Security"
        title="Built for Production"
        titleGradient="Production"
        description="RevLine is designed with security-first principles. Encrypted secrets, verified webhooks, and isolated data — the infrastructure you'd build yourself."
      />

      {/* Security Features */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Security Features</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard
            icon={LockIcon}
            title="AES-256-GCM Encryption"
            description="All secrets encrypted at rest with industry-standard AES-256-GCM. Keys versioned for rotation without downtime."
            color="green"
          />
          <FeatureCard
            icon={KeyIcon}
            title="Argon2id Password Hashing"
            description="Admin passwords hashed with Argon2id — the winner of the Password Hashing Competition. Resistant to GPU attacks."
            color="blue"
          />
          <FeatureCard
            icon={ShieldIcon}
            title="TOTP Two-Factor Auth"
            description="Optional 2FA with TOTP (Google Authenticator compatible). Recovery codes for account recovery."
            color="purple"
          />
          <FeatureCard
            icon={UsersIcon}
            title="Workspace Isolation"
            description="Complete data isolation between workspaces. Each workspace has its own leads, events, and encrypted credentials."
            color="cyan"
          />
        </div>
      </section>

      {/* Encryption */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Encryption at Rest</h2>
        <p className="text-zinc-400 mb-4">
          All sensitive credentials (API keys, webhook secrets) are encrypted before storage using AES-256-GCM.
        </p>
        
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl mb-6">
          <h3 className="font-medium text-white mb-4">How It Works</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <span className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xs font-medium shrink-0">1</span>
              <div>
                <p className="text-white font-medium">Key Derivation</p>
                <p className="text-sm text-zinc-400">Master key derived from <code>ENCRYPTION_KEY</code> environment variable</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xs font-medium shrink-0">2</span>
              <div>
                <p className="text-white font-medium">IV Generation</p>
                <p className="text-sm text-zinc-400">Random 12-byte initialization vector for each encryption</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xs font-medium shrink-0">3</span>
              <div>
                <p className="text-white font-medium">Encryption</p>
                <p className="text-sm text-zinc-400">AES-256-GCM encryption with authentication tag</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xs font-medium shrink-0">4</span>
              <div>
                <p className="text-white font-medium">Storage</p>
                <p className="text-sm text-zinc-400">Stored as <code>v1:iv:ciphertext</code> with version prefix for rotation</p>
              </div>
            </div>
          </div>
        </div>
        
        <CodeBlock title="Encrypted Secret Format" language="text">
{`v1:a1b2c3d4e5f6g7h8i9j0k1l2:m3n4o5p6q7r8s9t0u1v2w3x4y5z6...

├── Version prefix (v1)
├── Base64 IV (12 bytes)
└── Base64 ciphertext + auth tag`}
        </CodeBlock>
        
        <TipBox title="Key Rotation">
          The version prefix (<code>v1</code>) enables key rotation. New encryptions use the current key, 
          old data can be decrypted with previous keys and re-encrypted.
        </TipBox>
      </section>

      {/* Webhook Verification */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Webhook Signature Verification</h2>
        <p className="text-zinc-400 mb-4">
          All incoming webhooks are verified using provider-specific signature verification to prevent spoofing.
        </p>
        
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Provider</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Signature Header</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Algorithm</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4">Stripe</td>
                <td className="py-3 px-4"><code>Stripe-Signature</code></td>
                <td className="py-3 px-4">HMAC-SHA256 with timestamp</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4">Calendly</td>
                <td className="py-3 px-4"><code>Calendly-Webhook-Signature</code></td>
                <td className="py-3 px-4">HMAC-SHA256</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 px-4">Capture (Server)</td>
                <td className="py-3 px-4"><code>X-RevLine-Signature</code></td>
                <td className="py-3 px-4">HMAC-SHA256 with timestamp</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <h3 className="font-medium text-white mb-2">Verification Process</h3>
          <ol className="text-sm text-zinc-400 space-y-2">
            <li className="flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>Extract signature and timestamp from headers</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>Recompute expected signature using stored secret</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>Compare signatures using timing-safe comparison</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>Validate timestamp is within acceptable window (5 min)</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Data Isolation */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Workspace Data Isolation</h2>
        <p className="text-zinc-400 mb-4">
          Each workspace is completely isolated. Data never leaks between workspaces.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Isolated Per Workspace</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Leads and contact data</li>
              <li>• Event audit logs</li>
              <li>• Integration credentials</li>
              <li>• Workflows and executions</li>
              <li>• Capture forms and custom fields</li>
            </ul>
          </div>
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-2">Enforcement</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Foreign key constraints in database</li>
              <li>• Workspace ID required on all queries</li>
              <li>• API routes validate workspace access</li>
              <li>• Webhook routing by workspace slug</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Architecture Overview</h2>
        <p className="text-zinc-400 mb-6">
          RevLine follows a clean architecture with clear boundaries between layers.
        </p>
        
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <div className="space-y-4 text-sm">
            {/* API Layer */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 font-medium mb-1">API Layer</p>
              <p className="text-blue-200/70">Route handlers, authentication, request validation</p>
            </div>
            
            {/* Service Layer */}
            <div className="flex justify-center">
              <span className="text-zinc-600">↓</span>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-400 font-medium mb-1">Service Layer</p>
              <p className="text-purple-200/70">Business logic, capture service, workflow engine</p>
            </div>
            
            {/* Integration Layer */}
            <div className="flex justify-center">
              <span className="text-zinc-600">↓</span>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 font-medium mb-1">Integration Layer</p>
              <p className="text-amber-200/70">Adapters for external services (MailerLite, Stripe, etc.)</p>
            </div>
            
            {/* Data Layer */}
            <div className="flex justify-center">
              <span className="text-zinc-600">↓</span>
            </div>
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 font-medium mb-1">Data Layer</p>
              <p className="text-green-200/70">Prisma ORM, PostgreSQL, encrypted storage</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Checklist */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Security Checklist</h2>
        <p className="text-zinc-400 mb-4">
          Security measures implemented across the platform:
        </p>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">Authentication</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Argon2id password hashing
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                TOTP two-factor authentication
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Secure session management
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Recovery codes for 2FA
              </li>
            </ul>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">Data Protection</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                AES-256-GCM encryption at rest
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Key versioning for rotation
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Secrets never logged
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                HTTPS only
              </li>
            </ul>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">Input Validation</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Zod schema validation
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Payload size limits
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                HTML/script sanitization
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Sensitive field denylist
              </li>
            </ul>
          </div>
          
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-medium text-white mb-3">Rate Limiting</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                IP-based rate limiting
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Per-workspace limits
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Configurable per form
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <CheckIcon className="w-4 h-4 text-green-400" />
                Timestamp validation
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Back to Docs */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Learn More</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/docs/capture" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-amber-400 transition-colors">Capture System →</p>
            <p className="text-sm text-zinc-400 mt-1">See how capture security is implemented</p>
          </a>
          <a href="/docs/integrations" className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
            <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">Integrations →</p>
            <p className="text-sm text-zinc-400 mt-1">Webhook verification per integration</p>
          </a>
        </div>
      </section>
    </div>
  );
}
