import Link from 'next/link';
import { DocHero } from './_components';

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function DocsOverviewPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <DocHero
        badge="Overview"
        title="What is RevLine?"
        titleGradient="RevLine"
        description="A funnel builder, automator, and monitor that makes your existing tools work together — so leads don't fall through the cracks."
      />

      {/* Core Value */}
      <section>
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <p className="text-lg text-zinc-300 leading-relaxed">
            RevLine doesn&apos;t replace your email platform, payment processor, or booking system. 
            It <strong className="text-white">connects them</strong> — capturing leads from any source, 
            routing them through your funnel, and making sure every automation actually runs.
          </p>
        </div>
      </section>

      {/* The Flow Graphic */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
        
        <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <div className="flex flex-col items-center">
            
            {/* Inbound Sources */}
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Where leads come from</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
              {['Landing Pages', 'Instagram DMs', 'External Forms', 'Referrals'].map((source) => (
                <div key={source} className="flex flex-col items-center">
                  <div className="px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-center w-full">
                    <p className="text-amber-400 font-medium text-sm">{source}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Converging lines */}
            <div className="relative w-full max-w-2xl h-12 my-2">
              <svg className="absolute inset-0 w-full h-full hidden md:block" preserveAspectRatio="none">
                <line x1="12.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                <line x1="37.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                <line x1="62.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                <line x1="87.5%" y1="0" x2="50%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
              </svg>
              <div className="md:hidden w-px h-full bg-zinc-700 mx-auto" />
            </div>

            {/* RevLine Hub */}
            <div className="px-10 py-5 bg-purple-500/20 border-2 border-purple-500/40 rounded-xl relative z-10">
              <p className="text-purple-400 font-bold text-xl text-center">RevLine</p>
              <p className="text-purple-400/70 text-xs mt-1 text-center">Capture • Orchestrate • Monitor</p>
            </div>

            {/* Diverging lines */}
            <div className="relative w-full max-w-2xl h-12 my-2">
              <svg className="absolute inset-0 w-full h-full hidden md:block" preserveAspectRatio="none">
                <line x1="50%" y1="0" x2="12.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                <line x1="50%" y1="0" x2="37.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                <line x1="50%" y1="0" x2="62.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
                <line x1="50%" y1="0" x2="87.5%" y2="100%" stroke="rgb(82 82 91)" strokeWidth="1" />
              </svg>
              <div className="md:hidden w-px h-full bg-zinc-700 mx-auto" />
            </div>

            {/* Outcomes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
              {['Email Lists', 'Transactional Email', 'Lead Tracking', 'Booking Systems'].map((outcome) => (
                <div key={outcome} className="flex flex-col items-center">
                  <div className="px-4 py-2.5 bg-green-500/20 border border-green-500/30 rounded-lg text-center w-full">
                    <p className="text-green-400 font-medium text-sm">{outcome}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-4">Where leads go</p>
          </div>
        </div>
      </section>

      {/* Three Things RevLine Does */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Three Things RevLine Does</h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-4">
              <span className="text-amber-400 font-bold text-lg">1</span>
            </div>
            <h3 className="font-semibold text-lg mb-2">Capture</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Collect leads from landing pages, external forms, social media, and more. 
              One system for all your lead sources.
            </p>
          </div>
          
          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
              <span className="text-purple-400 font-bold text-lg">2</span>
            </div>
            <h3 className="font-semibold text-lg mb-2">Orchestrate</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Define what happens when events occur. Form submitted? Add to list, send email, update records — automatically.
            </p>
          </div>
          
          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4">
              <span className="text-green-400 font-bold text-lg">3</span>
            </div>
            <h3 className="font-semibold text-lg mb-2">Monitor</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Track every lead and every automation. See what&apos;s working, catch what&apos;s broken, before you lose customers.
            </p>
          </div>
        </div>
      </section>

      {/* Example Flows */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Example Automations</h2>
        
        <div className="space-y-4">
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <p className="text-sm text-zinc-500 mb-3">When someone enters their email...</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400">
                Add to email list
              </span>
              <span className="text-zinc-600">+</span>
              <span className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400">
                Send welcome email
              </span>
              <span className="text-zinc-600">+</span>
              <span className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400">
                Track as new lead
              </span>
            </div>
          </div>
          
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <p className="text-sm text-zinc-500 mb-3">When a payment succeeds...</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400">
                Move to paid list
              </span>
              <span className="text-zinc-600">+</span>
              <span className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400">
                Send receipt
              </span>
              <span className="text-zinc-600">+</span>
              <span className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400">
                Update lead stage
              </span>
            </div>
          </div>
          
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <p className="text-sm text-zinc-500 mb-3">When someone books a call...</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400">
                Add to booked list
              </span>
              <span className="text-zinc-600">+</span>
              <span className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400">
                Send confirmation
              </span>
              <span className="text-zinc-600">+</span>
              <span className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400">
                Update lead stage
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Key Concepts */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Key Concepts</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-semibold text-white mb-2">Workspaces</h3>
            <p className="text-sm text-zinc-400">
              Isolated environments for each business. Own integrations, workflows, and leads.
            </p>
          </div>
          
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-semibold text-white mb-2">Workflows</h3>
            <p className="text-sm text-zinc-400">
              Automations that run when events happen. &quot;When X, do Y and Z.&quot;
            </p>
          </div>
          
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-semibold text-white mb-2">Integrations</h3>
            <p className="text-sm text-zinc-400">
              Connections to your tools — email platforms, payment processors, booking systems.
            </p>
          </div>
          
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <h3 className="font-semibold text-white mb-2">Leads</h3>
            <p className="text-sm text-zinc-400">
              People in your funnel. Tracked through stages: captured → booked → paid.
            </p>
          </div>
        </div>
      </section>

      {/* Dive Deeper */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Learn More</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/docs/getting-started"
            className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-white group-hover:text-purple-400 transition-colors">Getting Started</p>
              <ArrowRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors" />
            </div>
            <p className="text-sm text-zinc-400">Set up your first workspace</p>
          </Link>
          
          <Link
            href="/docs/workflows"
            className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-white group-hover:text-purple-400 transition-colors">Workflows</p>
              <ArrowRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors" />
            </div>
            <p className="text-sm text-zinc-400">Build automations</p>
          </Link>
          
          <Link
            href="/docs/capture"
            className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-white group-hover:text-amber-400 transition-colors">Form Capture</p>
              <ArrowRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
            </div>
            <p className="text-sm text-zinc-400">Capture leads from any form</p>
          </Link>
          
          <Link
            href="/docs/integrations"
            className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors">Integrations</p>
              <ArrowRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
            </div>
            <p className="text-sm text-zinc-400">Connect your tools</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
