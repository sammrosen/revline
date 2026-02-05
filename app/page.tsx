import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'RevLine | Reliability-first Revenue Infrastructure',
  description: 'Private orchestration and monitoring platform for revenue-critical workflows.',
  robots: 'noindex, nofollow',
};

// Icons as simple SVG components
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Integration-specific icons with brand colors
function MailerLiteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

function StripeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CalendlyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function AbcIgniteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function ManyChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

// Section badge component
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/50 rounded-full text-xs uppercase tracking-wider text-zinc-400 mb-6">
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans antialiased overflow-hidden">
      {/* Global ambient lighting */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] blur-[150px] bg-purple-900/20 rounded-full" />
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] blur-[120px] bg-blue-900/15 rounded-full" />
        <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] blur-[100px] bg-violet-900/10 rounded-full" />
      </div>

      {/* ============== HERO SECTION ============== */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Reliability-First{' '}
            <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
              Revenue Infrastructure
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            The plumbing that keeps your revenue workflows running. Orchestration and monitoring for the integrations that move leads, appointments, and payments.
          </p>
          
          <p className="text-lg text-zinc-500 leading-relaxed max-w-2xl mx-auto">
            When you connect multiple tools — forms, email, scheduling, payments, CRMs — you need infrastructure that doesn&apos;t break at 2am.
          </p>
        </div>
      </section>

      {/* ============== THE PROBLEM SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <SectionBadge>The Problem</SectionBadge>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Stop Being the{' '}
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Human Router
            </span>
          </h2>
          
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl">
            Most agencies cobble together automation tools and hope nothing breaks. You become the bottleneck — the human router between systems.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { text: 'Credentials scattered across .env files and password managers' },
              { text: 'No alerts when a client\'s integration fails silently' },
              { text: 'Debugging by checking logs across multiple systems' },
              { text: 'Zapier/Make.com per client or custom code for each' },
              { text: 'No way to pause a client without touching code or configs' },
              { text: 'No centralized audit trail when something goes wrong' },
            ].map((item, i) => (
              <div 
                key={i} 
                className="flex items-start gap-3 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                  <XIcon className="w-3.5 h-3.5 text-red-400" />
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== COMPARISON SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Without RevLine */}
            <div className="relative p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <XIcon className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold">Without RevLine</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Credentials in .env files or password managers',
                  'No alerts when integrations fail silently',
                  'Debug by checking logs across systems',
                  'Zapier/Make per client or custom code',
                  'No centralized audit trail',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-400">
                    <span className="text-red-400">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* With RevLine */}
            <div className="relative p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckIcon className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">With RevLine</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'All credentials encrypted in one dashboard',
                  '15-minute health checks with email alerts',
                  'Full event audit trail in one place',
                  'Configure integrations via UI, not code',
                  'Instant pause/unpause per workspace',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-400">
                    <span className="text-green-400">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============== FEATURES SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>Features</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Everything You Need for{' '}
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                Revenue Operations
              </span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: ShieldIcon,
                title: 'Encrypted Secrets',
                description: 'AES-256-GCM encryption with version-controlled key rotation. Secrets decrypted only at point-of-use.',
                color: 'green',
              },
              {
                icon: ActivityIcon,
                title: 'Health Monitoring',
                description: 'Automatic checks every 15 minutes with email and push alerts when integrations go unhealthy.',
                color: 'yellow',
              },
              {
                icon: ListIcon,
                title: 'Event Ledger',
                description: 'Append-only audit trail for every action. When something breaks, you know exactly what happened.',
                color: 'blue',
              },
              {
                icon: UsersIcon,
                title: 'Lead Tracking',
                description: 'Follow customers through the funnel: captured, booked, paid. Detect stuck leads automatically.',
                color: 'purple',
              },
              {
                icon: PauseIcon,
                title: 'Instant Controls',
                description: 'Pause any workspace with one click. Non-paying client? Block all their webhooks instantly.',
                color: 'orange',
              },
              {
                icon: LayersIcon,
                title: 'Multi-Workspace',
                description: 'Isolated data per client with a single dashboard. Role-based access for your team.',
                color: 'cyan',
              },
            ].map((feature, i) => {
              const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
                green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
                yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
                blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
                purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
                orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
                cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
              };
              const colors = colorClasses[feature.color];
              
              return (
                <div 
                  key={i}
                  className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== CONFIG & WORKFLOWS SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>How It Works</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Configure Once,{' '}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Automate Forever
              </span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Configuration */}
            <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-blue-400 text-xs uppercase tracking-wider">Step 01</p>
                  <h3 className="text-xl font-semibold">Configuration</h3>
                </div>
              </div>
              <p className="text-zinc-400 mb-6">
                Set up workspaces and connect integrations through the dashboard. No code required.
              </p>
              <ul className="space-y-3">
                {[
                  'Per-workspace integrations',
                  'Encrypted API credentials',
                  'Non-sensitive meta (group IDs, mappings)',
                  'Health status per integration',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center">
                      <CheckIcon className="w-3 h-3 text-blue-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Workflows */}
            <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <ZapIcon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-purple-400 text-xs uppercase tracking-wider">Step 02</p>
                  <h3 className="text-xl font-semibold">Workflows</h3>
                </div>
              </div>
              <p className="text-zinc-400 mb-6">
                Build trigger → action automations that run when events occur. Visual debugging included.
              </p>
              <ul className="space-y-3">
                {[
                  'Trigger to action automation',
                  'Filter conditions for precision',
                  'Sequential action execution',
                  'Full execution history',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center">
                      <CheckIcon className="w-3 h-3 text-purple-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>How It Works</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Capture at the{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Top
              </span>
              , Route{' '}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Everywhere
              </span>
            </h2>
            <p className="text-xl text-zinc-400 mt-6 max-w-2xl mx-auto">
              RevLine handles top-of-funnel intake—forms, email capture, phone routing—then automatically routes data to all your downstream systems.
            </p>
          </div>

          {/* Visual Flow Diagram - Converging/Diverging Routing */}
          <div className="mb-12 p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex flex-col items-center">
              
              {/* Inbound Sources with individual arrows */}
              <p className="text-xs text-zinc-500 text-center mb-4 uppercase tracking-wider">Inbound</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto w-full">
                {[
                  { label: 'Forms' },
                  { label: 'Phone Calls' },
                  { label: 'Emails' },
                  { label: 'Social Media' },
                ].map((source, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-center w-full">
                      <p className="text-amber-400 font-medium text-sm">{source.label}</p>
                    </div>
                    {/* Individual arrow from each source */}
                    <div className="flex flex-col items-center mt-2">
                      <div className="w-px h-6 bg-gradient-to-b from-amber-500/50 to-zinc-600" />
                      <div className="w-2 h-2 border-r border-b border-zinc-600 rotate-45 -mt-1" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Converging lines visual */}
              <div className="relative w-full max-w-2xl h-8 my-2">
                {/* SVG for converging lines on desktop */}
                <svg className="absolute inset-0 w-full h-full hidden md:block" preserveAspectRatio="none">
                  <line x1="12.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                  <line x1="37.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                  <line x1="62.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                  <line x1="87.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                </svg>
                {/* Single line for mobile */}
                <div className="md:hidden w-px h-full bg-zinc-600 mx-auto" />
              </div>

              {/* RevLine Hub - Center */}
              <div className="px-12 py-5 bg-purple-500/20 border-2 border-purple-500/40 rounded-xl relative z-10">
                <p className="text-purple-400 font-bold text-xl text-center">RevLine</p>
                <p className="text-purple-400/70 text-xs mt-1 text-center">Validate • Dedupe • Route</p>
              </div>

              {/* Diverging lines visual */}
              <div className="relative w-full max-w-2xl h-8 my-2">
                {/* SVG for diverging lines on desktop */}
                <svg className="absolute inset-0 w-full h-full hidden md:block" preserveAspectRatio="none">
                  <line x1="50%" y1="0" x2="12.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                  <line x1="50%" y1="0" x2="37.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                  <line x1="50%" y1="0" x2="62.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                  <line x1="50%" y1="0" x2="87.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                </svg>
                {/* Single line for mobile */}
                <div className="md:hidden w-px h-full bg-zinc-600 mx-auto" />
              </div>

              {/* Outcomes with individual arrows pointing in */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto w-full">
                {[
                  { label: 'Email Marketing' },
                  { label: 'Booking' },
                  { label: 'Payments' },
                  { label: 'CRM' },
                ].map((outcome, i) => (
                  <div key={i} className="flex flex-col items-center">
                    {/* Individual arrow to each outcome */}
                    <div className="flex flex-col items-center mb-2">
                      <div className="w-2 h-2 border-r border-b border-zinc-600 rotate-45" />
                      <div className="w-px h-6 bg-gradient-to-b from-zinc-600 to-green-500/50 -mt-1" />
                    </div>
                    <div className="px-4 py-2.5 bg-green-500/20 border border-green-500/30 rounded-lg text-center w-full">
                      <p className="text-green-400 font-medium text-sm">{outcome.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 text-center mt-4 uppercase tracking-wider">Outcomes</p>
            </div>
          </div>

          {/* Three Key Points Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: FunnelIcon,
                title: 'Build Forms in UI',
                description: 'Create custom forms per client—intake forms, waivers, contact forms—without code. Forms trigger workflows automatically.',
                color: 'amber',
              },
              {
                icon: GitBranchIcon,
                title: 'One Submission, Many Actions',
                description: 'A single form submission can create a lead, add to your CRM, subscribe to email marketing, and more—all automatically.',
                color: 'purple',
              },
              {
                icon: ZapIcon,
                title: 'Smart Routing',
                description: 'Route data to the right systems based on form type, client config, or conditional logic. No manual routing needed.',
                color: 'violet',
              },
            ].map((item, i) => {
              const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
                amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
                purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
                violet: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
              };
              const colors = colorClasses[item.color];
              
              return (
                <div 
                  key={i}
                  className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl"
                >
                  <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center mb-4`}>
                    <item.icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ============== UNDER THE HOOD SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>Under the Hood</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Anything Talking to{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Anything
              </span>
            </h2>
            <p className="text-xl text-zinc-400 mt-6 max-w-2xl mx-auto">
              Clean adapter pattern means adding new integrations without touching core logic. Triggers emit events, actions consume them.
            </p>
          </div>
          
          {/* Technical Flow - zooms into RevLine */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2 mb-16">
            {[
              { label: 'Webhook', color: 'zinc' },
              { label: 'Adapter', color: 'blue' },
              { label: 'Trigger', color: 'purple' },
              { label: 'Workflow Engine', color: 'violet' },
              { label: 'Action', color: 'green' },
              { label: 'External API', color: 'cyan' },
            ].map((step, i, arr) => (
              <div key={i} className="flex flex-col md:flex-row items-center gap-2">
                <div className={`px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm font-medium ${
                  step.color === 'blue' ? 'text-blue-400' :
                  step.color === 'purple' ? 'text-purple-400' :
                  step.color === 'violet' ? 'text-violet-400' :
                  step.color === 'green' ? 'text-green-400' :
                  step.color === 'cyan' ? 'text-cyan-400' :
                  'text-zinc-400'
                }`}>
                  {step.label}
                </div>
                {i < arr.length - 1 && (
                  <ArrowRightIcon className="w-4 h-4 text-zinc-600 rotate-90 md:rotate-0" />
                )}
              </div>
            ))}
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: GitBranchIcon,
                title: 'Clean Abstraction',
                description: 'Every integration goes through an adapter layer. Consistent error handling, logging, and health tracking.',
              },
              {
                icon: PlusIcon,
                title: 'Easy to Extend',
                description: 'Add a new integration by implementing a simple interface. No changes to the core workflow engine.',
              },
              {
                icon: ZapIcon,
                title: 'Event-Driven',
                description: 'Triggers emit events that the engine matches against workflows. Actions execute sequentially with full tracing.',
              },
            ].map((item, i) => (
              <div key={i} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== INTEGRATIONS SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>Integrations</SectionBadge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Connects to Your{' '}
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Revenue Stack
              </span>
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* MailerLite - Brand green #09C269 */}
            <div className="p-4 bg-zinc-900/50 border border-[#09C269]/30 rounded-xl text-center hover:bg-zinc-900 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#09C269]/20 flex items-center justify-center mx-auto mb-3">
                <MailerLiteIcon className="w-5 h-5 text-[#09C269]" />
              </div>
              <p className="font-medium text-sm text-white">MailerLite</p>
              <p className="text-zinc-500 text-xs mt-1">Email Marketing</p>
            </div>

            {/* Stripe - Brand purple #635BFF */}
            <div className="p-4 bg-zinc-900/50 border border-[#635BFF]/30 rounded-xl text-center hover:bg-zinc-900 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#635BFF]/20 flex items-center justify-center mx-auto mb-3">
                <StripeIcon className="w-5 h-5 text-[#635BFF]" />
              </div>
              <p className="font-medium text-sm text-white">Stripe</p>
              <p className="text-zinc-500 text-xs mt-1">Payments</p>
            </div>

            {/* Calendly - Brand blue #006BFF */}
            <div className="p-4 bg-zinc-900/50 border border-[#006BFF]/30 rounded-xl text-center hover:bg-zinc-900 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#006BFF]/20 flex items-center justify-center mx-auto mb-3">
                <CalendlyIcon className="w-5 h-5 text-[#006BFF]" />
              </div>
              <p className="font-medium text-sm text-white">Calendly</p>
              <p className="text-zinc-500 text-xs mt-1">Scheduling</p>
            </div>

            {/* ABC Ignite - Brand orange #FF6B00 */}
            <div className="p-4 bg-zinc-900/50 border border-[#FF6B00]/30 rounded-xl text-center hover:bg-zinc-900 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/20 flex items-center justify-center mx-auto mb-3">
                <AbcIgniteIcon className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <p className="font-medium text-sm text-white">ABC Ignite</p>
              <p className="text-zinc-500 text-xs mt-1">Gym Management</p>
            </div>

            {/* ManyChat - Brand blue #0084FF */}
            <div className="p-4 bg-zinc-900/50 border border-[#0084FF]/30 rounded-xl text-center hover:bg-zinc-900 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#0084FF]/20 flex items-center justify-center mx-auto mb-3">
                <ManyChatIcon className="w-5 h-5 text-[#0084FF]" />
              </div>
              <p className="font-medium text-sm text-white">ManyChat</p>
              <p className="text-zinc-500 text-xs mt-1">Instagram DMs</p>
            </div>

            {/* Extensible */}
            <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl text-center hover:bg-zinc-900 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                <PlusIcon className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="font-medium text-sm text-zinc-400">Extensible</p>
              <p className="text-zinc-500 text-xs mt-1">Add Your Own</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== SECURITY SECTION ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <SectionBadge>Security</SectionBadge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
            Built for{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
              Production
            </span>
          </h2>
          
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'AES-256-GCM Encryption',
              'Argon2id Password Hashing',
              'TOTP Two-Factor Auth',
              'Webhook Signature Verification',
              'Client Data Isolation',
            ].map((item, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full"
              >
                <LockIcon className="w-4 h-4 text-green-400" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== CONTACT / FOOTER ============== */}
      <section className="relative px-6 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-zinc-500 text-sm mb-2">Inquiries</p>
          <a 
            href="mailto:sam@samrosen.business"
            className="text-xl text-zinc-300 hover:text-white transition-colors duration-200"
          >
            sam@samrosen.business
          </a>
          
          <div className="mt-12">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors duration-200"
            >
              <LockIcon className="w-4 h-4" />
              Dashboard Login
            </Link>
          </div>
          
          <div className="mt-16 pt-8 border-t border-zinc-800">
            <p className="text-zinc-600 text-sm">
              RevLine — Reliability-first revenue infrastructure
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
