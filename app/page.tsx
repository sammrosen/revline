import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RevLine | Reliability-first Revenue Operations',
  description: 'Private orchestration and monitoring platform for revenue-critical workflows.',
  robots: 'noindex, nofollow',
};

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans antialiased overflow-hidden">
      {/* Ambient lighting - neutral white/grey */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 blur-[150px] bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 blur-[100px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_50%)]" />
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-10">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            RevLine
          </h1>
          
          <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed">
            Reliability-first infrastructure for revenue operations.
          </p>
          
          <div className="space-y-6 text-lg text-zinc-400 leading-relaxed">
            <p>
              RevLine is a private orchestration and monitoring platform used to operate revenue-critical workflows across marketing, sales, and operations.
            </p>
            <p>
              It exists to ensure systems that move leads, appointments, data, and payments remain reliable once deployed into production — especially when multiple tools and handoffs are involved.
            </p>
          </div>
          
          <div className="pt-8">
            <p className="text-zinc-500 text-sm mb-2">Inquiries</p>
            <a 
              href="mailto:sam@samrosen.business"
              className="text-zinc-300 hover:text-white transition-colors duration-200"
            >
              sam@samrosen.business
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
