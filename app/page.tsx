import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'RevLine | Reliability-first Revenue Infrastructure',
  description: 'Private orchestration and monitoring platform for revenue-critical workflows.',
  robots: 'noindex, nofollow',
};

/* ================================================================
   SVG ICON COMPONENTS
   ================================================================ */

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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MiniArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function MiniArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/* ================================================================
   SHARED LAYOUT COMPONENTS
   ================================================================ */

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/50 rounded-full text-xs uppercase tracking-wider text-zinc-400 mb-6">
      {children}
    </div>
  );
}

function PreviewPanel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden shadow-2xl shadow-black/50 ${className || ''}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
        <span className="text-xs text-zinc-400 ml-2 font-medium">{title}</span>
        {subtitle && <span className="text-xs text-zinc-600">{subtitle}</span>}
      </div>
      <div className="p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   INTEGRATION CONFIG (matches app/_lib/workflow/integration-config.ts)
   ================================================================ */

const INTEGRATIONS = {
  calendly:    { name: 'Calendly',    color: '#0069fe', logo: '/logos/calendly.png',    bgClass: 'bg-blue-500/20',    borderClass: 'border-blue-500/40',    textClass: 'text-blue-400' },
  stripe:      { name: 'Stripe',      color: '#5539fd', logo: '/logos/stripe.png',      bgClass: 'bg-violet-500/20',  borderClass: 'border-violet-500/40',  textClass: 'text-violet-400' },
  mailerlite:  { name: 'MailerLite',   color: '#19b575', logo: '/logos/mailerlite.png',  bgClass: 'bg-emerald-500/20', borderClass: 'border-emerald-500/40', textClass: 'text-emerald-400' },
  revline:     { name: 'RevLine',      color: '#ff6100', logo: '/logos/RevLine.png',     bgClass: 'bg-orange-500/20',  borderClass: 'border-orange-500/40',  textClass: 'text-orange-400' },
  manychat:    { name: 'ManyChat',     color: '#000000', logo: '/logos/manychat.png',    bgClass: 'bg-zinc-500/20',    borderClass: 'border-zinc-500/40',    textClass: 'text-zinc-300' },
  abc_ignite:  { name: 'ABC Ignite',   color: '#214377', logo: '/logos/abc-ignite.png',  bgClass: 'bg-blue-900/20',    borderClass: 'border-blue-900/40',    textClass: 'text-blue-300' },
  resend:      { name: 'Resend',       color: '#000000', logo: '/logos/resend.png',      bgClass: 'bg-zinc-500/20',    borderClass: 'border-zinc-500/40',    textClass: 'text-zinc-300' },
} as const;

type IntKey = keyof typeof INTEGRATIONS;

/* ================================================================
   STATIC GRAPH NODE COMPONENTS
   Exact match to dashboard FormNode, OperationNode, AsyncGapNode, IntegrationNode
   ================================================================ */

/** FormNode — matches app/(dashboard)/…/network-graph/FormNode.tsx */
function StaticFormNode({ name, type, enabled, opCount, triggerCount }: {
  name: string; type: string; enabled: boolean; opCount: number; triggerCount: number;
}) {
  return (
    <div className={`relative px-3 py-2.5 rounded-lg border-2 min-w-[160px] max-w-[200px] shrink-0 ${
      enabled ? 'border-violet-600/50 bg-violet-950/30' : 'border-zinc-700 bg-zinc-800/50'
    }`}>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-violet-600/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/RevLine.png" alt="RevLine" className="w-4 h-4 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{name}</div>
          <div className="text-[10px] text-zinc-500">{type} form</div>
        </div>
        <div className={`w-2 h-2 rounded-full shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
      </div>
      {opCount > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center gap-1 text-[10px] text-zinc-400">
          <MiniArrowRight className="w-3 h-3" />
          <span>{opCount} operations</span>
        </div>
      )}
      {triggerCount > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400/80">
          <ZapIcon className="w-3 h-3" />
          <span>{triggerCount} trigger{triggerCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

/** OperationNode — matches app/(dashboard)/…/network-graph/OperationNode.tsx */
function StaticOperationNode({ adapter, label, conditional }: {
  adapter: IntKey; label: string; conditional?: boolean;
}) {
  const style = INTEGRATIONS[adapter];
  return (
    <div className="relative px-3 py-2.5 rounded-lg border-2 border-zinc-700 bg-zinc-800/80 min-w-[130px] max-w-[170px] shrink-0">
      {conditional && (
        <div className="absolute -top-2 -right-2">
          <ZapIcon className="w-4 h-4 text-amber-500" />
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: `${style.color}20` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={style.logo} alt={style.name} className="w-5 h-5 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{style.name}</div>
          <div className="text-[10px] text-zinc-400 truncate">{label}</div>
        </div>
      </div>
    </div>
  );
}

/** AsyncGapNode — matches app/(dashboard)/…/network-graph/AsyncGapNode.tsx */
function StaticAsyncGapNode({ label }: { label: string }) {
  return (
    <div className="relative px-2.5 py-2 rounded-lg border-2 border-dashed border-zinc-600 bg-zinc-900/50 min-w-[90px] max-w-[110px] shrink-0">
      <div className="flex items-center gap-3 text-zinc-500">
        <ClockIcon className="w-4 h-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-400">{label}</div>
          <div className="text-[10px] text-zinc-500">async</div>
        </div>
      </div>
    </div>
  );
}

/** IntegrationNode — matches app/(dashboard)/…/network-graph/IntegrationNode.tsx */
function StaticIntegrationNode({ adapter, triggerCount, actionCount, healthStatus }: {
  adapter: IntKey; triggerCount?: number; actionCount?: number; healthStatus?: 'GREEN' | 'YELLOW' | 'RED';
}) {
  const style = INTEGRATIONS[adapter];
  const status = healthStatus || 'GREEN';
  return (
    <div className={`relative px-3 py-2.5 rounded-lg border-2 min-w-[130px] max-w-[170px] shrink-0 ${
      status === 'RED' ? 'border-red-500/50 bg-red-500/5'
        : status === 'YELLOW' ? 'border-yellow-500/50 bg-yellow-500/5'
        : 'border-zinc-700 bg-zinc-800/80'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: `${style.color}20` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={style.logo} alt={style.name} className="w-5 h-5 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{style.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {(triggerCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                <MiniArrowRight className="w-3 h-3" />{triggerCount}
              </span>
            )}
            {(actionCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                <MiniArrowLeft className="w-3 h-3" />{actionCount}
              </span>
            )}
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          status === 'RED' ? 'bg-red-500' : status === 'YELLOW' ? 'bg-yellow-500' : 'bg-emerald-500'
        }`} />
      </div>
    </div>
  );
}

/* ================================================================
   GRAPH EDGE / TRAIL LINE COMPONENTS
   Grey dotted connectors matching the production network graph
   ================================================================ */

/** Horizontal grey dotted connector */
function EdgeDotted() {
  return (
    <svg className="w-8 h-4 shrink" viewBox="0 0 32 16" fill="none">
      <line x1="2" y1="8" x2="30" y2="8" stroke="#52525b" strokeWidth="2" strokeDasharray="3,5" strokeLinecap="round" />
    </svg>
  );
}

/** Violet dashed connector — trigger edge from form */
function EdgeViolet() {
  return (
    <svg className="w-8 h-4 shrink" viewBox="0 0 32 16" fill="none">
      <line x1="2" y1="8" x2="30" y2="8" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="3,5" strokeLinecap="round" />
    </svg>
  );
}

/** Vertical grey dotted connector — connecting stacked operations */
function EdgeVerticalDotted() {
  return (
    <svg className="w-4 h-5 mx-auto" viewBox="0 0 16 20" fill="none">
      <line x1="8" y1="2" x2="8" y2="18" stroke="#52525b" strokeWidth="2" strokeDasharray="3,5" strokeLinecap="round" />
    </svg>
  );
}

/* ================================================================
   PAGE
   ================================================================ */

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

      {/* ============== TOP NAV ============== */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-sm font-semibold text-zinc-400 tracking-wide">RevLine</span>
        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors duration-200"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2 bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-sm border border-white/[0.1] rounded-full text-sm text-zinc-200 hover:text-white transition-all duration-200"
          >
            Login
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* ============== HERO SECTION ============== */}
      <section className="relative px-6 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-6xl mx-auto">
          {/* Headline */}
          <div className="text-center mb-12 md:mb-16">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Reliability-First{' '}
              <span className="bg-linear-to-r from-purple-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
                Revenue Infrastructure
              </span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto mb-4">
              Orchestration and monitoring for the integrations that move leads, appointments, and payments. Two layers of automation in one platform.
            </p>
            <p className="text-base text-zinc-500 leading-relaxed max-w-2xl mx-auto">
              Forms with baked-in operations. Workflows you build in the UI. Extensible integration adapters. All workspace-isolated, encrypted, and observable.
            </p>
          </div>

          {/* Network Graph Preview — exact match to dashboard */}
          <PreviewPanel title="Network Graph" subtitle="acme_fitness">
            {/* Integration badges bar */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['calendly', 'mailerlite', 'resend', 'abc_ignite', 'revline'] as IntKey[]).map((key) => {
                const s = INTEGRATIONS[key];
                return (
                  <span key={key} className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded ${s.bgClass} ${s.textClass}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.logo} alt={s.name} className="w-3 h-3 object-contain" />
                    {key.toUpperCase().replace('_', ' ')}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500 mb-6">
              1 form, 2 workflows active &middot; <span className="text-emerald-400">All systems healthy</span>
            </p>

            {/* Graph canvas with dot grid background */}
            <div
              className="relative rounded-lg overflow-x-auto scrollbar-hide"
              style={{
                backgroundColor: '#09090b',
                backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              {/* Main flow — fixed width, scrolls on small screens */}
              <div className="flex items-center gap-2 p-4 md:p-6 min-w-[850px]">
                {/* Form node */}
                <StaticFormNode name="Booking Form" type="booking" enabled opCount={4} triggerCount={2} />

                <EdgeViolet />

                {/* Pre-trigger operations stack */}
                <div className="flex flex-col items-center shrink-0">
                  <StaticOperationNode adapter="abc_ignite" label="Find member by barcode" />
                  <EdgeVerticalDotted />
                  <StaticOperationNode adapter="abc_ignite" label="Verify booking eligibility" conditional />
                  <EdgeVerticalDotted />
                  <StaticOperationNode adapter="resend" label="Send magic link email" />
                </div>

                <EdgeDotted />

                {/* Async gap */}
                <StaticAsyncGapNode label="User action" />

                <EdgeDotted />

                {/* Trigger-phase operation */}
                <StaticOperationNode adapter="abc_ignite" label="Book appointment" />

                <EdgeDotted />

                {/* RevLine integration */}
                <StaticIntegrationNode adapter="revline" triggerCount={2} actionCount={1} />

                <EdgeDotted />

                {/* MailerLite integration */}
                <StaticIntegrationNode adapter="mailerlite" actionCount={2} />
              </div>
            </div>

          </PreviewPanel>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-xl mx-auto">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">7</p>
              <p className="text-xs text-zinc-500 mt-1">Current Integrations</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">15min</p>
              <p className="text-xs text-zinc-500 mt-1">Health Check Cycle</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-violet-400">2</p>
              <p className="text-xs text-zinc-500 mt-1">Automation Layers</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== THE PROBLEM SECTION ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <SectionBadge>The Problem</SectionBadge>
          
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Stop Being the{' '}
            <span className="bg-linear-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Human Router
            </span>
          </h2>
          
          <p className="text-lg text-zinc-400 mb-12 max-w-2xl">
            Most agencies cobble together automation tools and hope nothing breaks. You become the bottleneck &mdash; the human router between systems.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'Credentials scattered across .env files and password managers',
              'No alerts when a workspace\'s integration fails silently',
              'Debugging by checking logs across multiple systems',
              'Zapier/Make.com per workspace or custom code for each',
              'No way to pause a workspace without touching code or configs',
              'No centralized audit trail when something goes wrong',
            ].map((text, i) => (
              <div 
                key={i} 
                className="flex items-start gap-3 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl"
              >
                <div className="shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                  <XIcon className="w-3.5 h-3.5 text-red-400" />
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== CONFIGURE SECTION ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text */}
            <div>
              <SectionBadge>Configure</SectionBadge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                All Your Integrations,{' '}
                <span className="bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  One Dashboard
                </span>
              </h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Connect external services through the UI. Encrypted secrets, health monitoring, and structured configuration editors &mdash; all isolated per workspace.
              </p>
              <ul className="space-y-3">
                {[
                  'AES-256 encrypted API credentials with key rotation',
                  '15-minute automated health checks per integration',
                  'Structured editors for groups, products, and events',
                  'Organization-level permissions and workspace roles',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon className="w-3 h-3 text-blue-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Integration Dashboard Preview — matches dashboard integration cards */}
            <PreviewPanel title="Integrations" subtitle="acme_fitness">
              {/* Badge bar */}
              <div className="flex flex-wrap gap-2 mb-5">
                {(['mailerlite', 'stripe', 'abc_ignite', 'resend', 'revline'] as IntKey[]).map((key) => {
                  const s = INTEGRATIONS[key];
                  return (
                    <span key={key} className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded ${s.bgClass} ${s.textClass}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.logo} alt={s.name} className="w-3 h-3 object-contain" />
                      {key.toUpperCase().replace('_', ' ')}
                    </span>
                  );
                })}
              </div>

              {/* Integration cards — matches workspace-tabs.tsx card pattern */}
              <div className="space-y-3">
                {([
                  { adapter: 'mailerlite' as IntKey, health: 'GREEN' as const, lastSeen: '2m ago', workflows: 3 },
                  { adapter: 'stripe' as IntKey,     health: 'GREEN' as const, lastSeen: '14m ago', workflows: 2 },
                  { adapter: 'abc_ignite' as IntKey, health: 'GREEN' as const, lastSeen: '5m ago', workflows: 4 },
                ]).map((int) => {
                  const s = INTEGRATIONS[int.adapter];
                  const healthBg = int.health === 'GREEN' ? 'bg-green-500/20 text-green-400' : int.health === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
                  return (
                    <div key={int.adapter} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${s.color}20` }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.logo} alt={s.name} className="w-5 h-5 object-contain" />
                          </div>
                          <div>
                            <p className={`font-bold tracking-tight ${s.textClass}`}>{s.name}</p>
                            <p className="text-[10px] text-zinc-500">Last seen: {int.lastSeen}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${healthBg}`}>{int.health}</span>
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">{int.workflows} workflows</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PreviewPanel>
          </div>
        </div>
      </section>

      {/* ============== AUTOMATE SECTION ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Workflow Builder Preview */}
            <div className="order-2 lg:order-1">
              <PreviewPanel title="Workflows" subtitle="acme_fitness">
                {/* Workflow card 1 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-white">Post-Booking Automation</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">When booking is confirmed via magic link</p>
                    </div>
                    <div className="w-8 h-4 rounded-full bg-green-500/30 border border-green-500/50 relative">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-green-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded ${INTEGRATIONS.revline.bgClass} ${INTEGRATIONS.revline.textClass}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={INTEGRATIONS.revline.logo} alt="RevLine" className="w-3 h-3 object-contain" />
                      TRIGGER
                    </span>
                    <code className="text-[10px] text-zinc-400">revline.booking-confirmed</code>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-300 border border-zinc-700">create_lead</span>
                    <span className="text-zinc-600 text-[10px]">&rarr;</span>
                    <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-300 border border-zinc-700">update_stage</span>
                    <span className="text-zinc-600 text-[10px]">&rarr;</span>
                    <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-300 border border-zinc-700">add_to_group</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-3">12 executions &middot; Last run 3h ago</p>
                </div>

                {/* Workflow card 2 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-white">Payment &rarr; Customer Group</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Update stage and add to customers list</p>
                    </div>
                    <div className="w-8 h-4 rounded-full bg-green-500/30 border border-green-500/50 relative">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-green-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded ${INTEGRATIONS.stripe.bgClass} ${INTEGRATIONS.stripe.textClass}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={INTEGRATIONS.stripe.logo} alt="Stripe" className="w-3 h-3 object-contain" />
                      TRIGGER
                    </span>
                    <code className="text-[10px] text-zinc-400">stripe.payment_succeeded</code>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-300 border border-zinc-700">update_stage</span>
                    <span className="text-zinc-600 text-[10px]">&rarr;</span>
                    <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-300 border border-zinc-700">add_to_group</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-3">8 executions &middot; Last run 1d ago</p>
                </div>
              </PreviewPanel>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2">
              <SectionBadge>Automate</SectionBadge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Two Layers of{' '}
                <span className="bg-linear-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                  Automation
                </span>
              </h2>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                Forms declare baked-in operations that run automatically &mdash; member lookup, eligibility checks, magic link emails. Then workflows you build in the UI react to form events with custom actions.
              </p>
              <div className="space-y-4">
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                  <p className="text-sm font-medium text-amber-400 mb-1">Layer 1: Template Operations</p>
                  <p className="text-sm text-zinc-400">Baked into form definitions. Run automatically when forms execute. Not user-configurable.</p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                  <p className="text-sm font-medium text-blue-400 mb-1">Layer 2: User-Built Workflows</p>
                  <p className="text-sm text-zinc-400">Trigger &rarr; filter &rarr; actions. Configured in the UI. React to form events and external webhooks.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== MONITOR SECTION ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text */}
            <div>
              <SectionBadge>Monitor</SectionBadge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Full Audit Trail for{' '}
                <span className="bg-linear-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                  Every Action
                </span>
              </h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Every email capture, payment, booking, and workflow execution is logged. When something breaks, you know exactly what happened, when, and why.
              </p>
              <ul className="space-y-3">
                {[
                  'Append-only event ledger with timestamps',
                  'Per-system filtering (Stripe, Workflow, Backend, etc.)',
                  'Workflow execution history with retry support',
                  'Lead pipeline with customizable stages',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckIcon className="w-3 h-3 text-emerald-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Event Ledger Preview */}
            <PreviewPanel title="Events" subtitle="acme_fitness">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-[11px] min-w-[400px]">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium">System</th>
                      <th className="pb-2 font-medium">Event</th>
                      <th className="pb-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-400">
                    {[
                      { time: '2:14 PM', system: 'STRIPE',     sysColor: `${INTEGRATIONS.stripe.bgClass} ${INTEGRATIONS.stripe.textClass}`, event: 'payment_succeeded', ok: true },
                      { time: '2:14 PM', system: 'WORKFLOW',    sysColor: 'bg-zinc-700/50 text-zinc-300', event: 'execution_completed', ok: true },
                      { time: '2:14 PM', system: 'MAILERLITE',  sysColor: `${INTEGRATIONS.mailerlite.bgClass} ${INTEGRATIONS.mailerlite.textClass}`, event: 'subscribe_success', ok: true },
                      { time: '1:47 PM', system: 'BACKEND',     sysColor: 'bg-blue-500/20 text-blue-400', event: 'email_captured', ok: true },
                      { time: '1:47 PM', system: 'WORKFLOW',    sysColor: 'bg-zinc-700/50 text-zinc-300', event: 'execution_completed', ok: true },
                      { time: '12:30 PM', system: 'CRON',       sysColor: 'bg-amber-500/20 text-amber-400', event: 'health_check_passed', ok: true },
                      { time: '11:02 AM', system: 'RESEND',     sysColor: `${INTEGRATIONS.resend.bgClass} ${INTEGRATIONS.resend.textClass}`, event: 'magic_link_sent', ok: true },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/50">
                        <td className="py-2.5 text-zinc-500">{row.time}</td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.sysColor}`}>{row.system}</span>
                        </td>
                        <td className="py-2.5 text-zinc-300">{row.event}</td>
                        <td className="py-2.5 text-right">
                          <span className={`w-2 h-2 rounded-full inline-block ${row.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-600 mt-3">Showing 7 of 1,247 events</p>
            </PreviewPanel>
          </div>
        </div>
      </section>

      {/* ============== UNDER THE HOOD SECTION ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>Under the Hood</SectionBadge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Anything Talking to{' '}
              <span className="bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Anything
              </span>
            </h2>
            <p className="text-lg text-zinc-400 mt-6 max-w-2xl mx-auto">
              Clean adapter pattern means adding new integrations without touching core logic. Agnostic, extensible, decoupled.
            </p>
          </div>
          
          {/* Technical Flow */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2 mb-16">
            {[
              { label: 'Webhook', color: 'text-zinc-400' },
              { label: 'Adapter', color: 'text-blue-400' },
              { label: 'Trigger', color: 'text-purple-400' },
              { label: 'Workflow Engine', color: 'text-violet-400' },
              { label: 'Action', color: 'text-green-400' },
              { label: 'External API', color: 'text-cyan-400' },
            ].map((step, i, arr) => (
              <div key={i} className="flex flex-col md:flex-row items-center gap-2">
                <div className={`px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm font-medium ${step.color}`}>
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
                description: 'Add a new integration by implementing a single adapter interface. No changes to the core workflow engine.',
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
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionBadge>Integrations</SectionBadge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Connects to Your{' '}
              <span className="bg-linear-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Revenue Stack
              </span>
            </h2>
            <p className="text-lg text-zinc-400 mt-6 max-w-xl mx-auto">
              Currently supported adapters. New integrations are added by implementing a single interface.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {([
              { key: 'mailerlite' as IntKey, sub: 'Email Marketing' },
              { key: 'stripe' as IntKey,     sub: 'Payments' },
              { key: 'calendly' as IntKey,   sub: 'Scheduling' },
              { key: 'abc_ignite' as IntKey, sub: 'Gym Management' },
              { key: 'manychat' as IntKey,   sub: 'Instagram DMs' },
              { key: 'resend' as IntKey,     sub: 'Transactional Email' },
            ]).map((int) => {
              const s = INTEGRATIONS[int.key];
              return (
                <div key={int.key} className={`p-4 bg-zinc-900/50 border ${s.borderClass} rounded-xl text-center hover:bg-zinc-900 transition-colors`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 overflow-hidden" style={{ backgroundColor: `${s.color}20` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.logo} alt={s.name} className="w-6 h-6 object-contain" />
                  </div>
                  <p className={`font-medium text-sm ${s.textClass}`}>{s.name}</p>
                  <p className="text-zinc-500 text-xs mt-1">{int.sub}</p>
                </div>
              );
            })}
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

      {/* ============== SECURITY & RELIABILITY SECTION ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <SectionBadge>Security &amp; Reliability</SectionBadge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8">
            Built for{' '}
            <span className="bg-linear-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
              Production
            </span>
          </h2>
          
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: 'AES-256-GCM Encryption', type: 'security' },
              { label: 'Argon2id Password Hashing', type: 'security' },
              { label: 'TOTP Two-Factor Auth', type: 'security' },
              { label: 'Webhook Signature Verification', type: 'security' },
              { label: 'Workspace Data Isolation', type: 'security' },
              { label: 'Idempotent Processing', type: 'reliability' },
              { label: 'Webhook Deduplication', type: 'reliability' },
              { label: 'Rate Limiting', type: 'reliability' },
            ].map((item, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full"
              >
                {item.type === 'security' ? (
                  <LockIcon className="w-4 h-4 text-green-400" />
                ) : (
                  <ShieldIcon className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-sm text-zinc-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== CONTACT / FOOTER ============== */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-zinc-500 text-sm mb-2">Inquiries</p>
          <a 
            href="mailto:sam@samrosen.business"
            className="text-xl text-zinc-300 hover:text-white transition-colors duration-200"
          >
            sam@samrosen.business
          </a>
          
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <p className="text-zinc-600 text-sm">
              RevLine &mdash; Reliability-first revenue infrastructure
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
