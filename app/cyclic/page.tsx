import type { Metadata } from 'next';

const SIGNUP_URL = 'https://cyclicstrength.com/signup';

export const metadata: Metadata = {
  title: 'Cyclic Strength | The Training System That Evolves With You',
  description:
    'Adaptive strength training that updates automatically from your real performance and recovery. Built for serious lifters, safe for beginners.',
};

const featureList = [
  {
    title: 'Training That Adjusts Automatically',
    body:
      'Every week is built from your real data — not generic templates. Your volume, intensity, and exercise selection evolve with your performance.',
  },
  {
    title: 'Intelligent Workout Logging',
    body:
      'Track effort, RPE, failure, session difficulty, joint stress, enjoyment — the engine uses all of it to decide what you should do next.',
  },
  {
    title: 'Beginner-Friendly, Advanced-Ready',
    body:
      'Beginners follow a clear structure without thinking. Serious lifters get adaptive programming that feels like having a coach in their pocket.',
  },
  {
    title: 'Recovery-Aware Programming',
    body:
      'Bad sleep? Rough week? Great stretch of training? Your plan adjusts automatically to keep you moving forward without burning out.',
  },
  {
    title: 'Long-Term, Continuous Progression',
    body: 'Stop restarting programs every 8–12 weeks. Your training adapts block to block, indefinitely.',
  },
];

const pricingBullets = [
  'Adaptive training engine',
  'Unlimited training blocks',
  'Full performance tracking',
  'Long-term progression logic',
  'Recovery-adjusted programming',
  'All feature updates',
  'No contracts',
  '14-day money-back guarantee',
];

export default function CyclicPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans antialiased overflow-hidden">
      {/* Ambient lighting + texture */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070910] via-[#020204] to-black" />
        <div className="absolute inset-0 blur-3xl bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.11),transparent_34%),radial-gradient(circle_at_80%_16%,rgba(59,130,246,0.09),transparent_30%),radial-gradient(circle_at_32%_80%,rgba(37,99,235,0.07),transparent_38%),radial-gradient(circle_at_70%_68%,rgba(37,99,235,0.06),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,232,240,0.035)_0,rgba(226,232,240,0.01)_34%,transparent_55%)] opacity-[0.26] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:140px_140px] opacity-[0.06]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:140px_140px] opacity-[0.06]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/8 via-white/0 to-transparent opacity-[0.18]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white/8 via-white/0 to-transparent opacity-[0.12]" />
      </div>

      <div className="relative">
        {/* Hero */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-10">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                The Training System That Evolves With You — Automatically.
              </h1>
              <p className="text-xl md:text-2xl text-zinc-300 max-w-3xl mx-auto leading-relaxed">
                Your workouts, progressions, and programming adapt every week based on your real performance and recovery. No more guesswork, no more templates — just continuous, intelligent progression.
              </p>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                Whether you're new to lifting or years into the game, Cyclic Strength builds the exact training you need next.
              </p>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                2-Week Free Trial • Cancel Anytime • Money-Back Guarantee
              </p>
            </div>

            <div className="aspect-video w-full max-w-3xl mx-auto border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-600 text-sm">
              Video placeholder — VSL goes here
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <a
                href={SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-black bg-white hover:bg-zinc-100 transition-colors"
              >
                Start Your Free Trial
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Subhead / Context */}
        <section className="py-20 px-6 border-t border-zinc-900">
          <div className="max-w-4xl mx-auto space-y-6 text-center">
            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed">
              Most fitness apps give you static workouts or generic progression rules. Cyclic Strength tracks how you actually train — your sets, reps, load, RPE, joint stress, enjoyment, and recovery — then updates your program automatically to keep you improving.
            </p>
            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed">
              If you’re starting from zero, you just follow the plan. If you’re advanced, the engine adapts with the precision of a real coach.
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="py-20 px-6 border-t border-zinc-900">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">What Cyclic Strength Does For You</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {featureList.map((item) => (
                <div key={item.title} className="p-8 border border-zinc-900 bg-zinc-950 space-y-3">
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-zinc-300 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <a
                href={SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-black bg-white hover:bg-zinc-100 transition-colors"
              >
                Start Your Free Trial
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-6 border-t border-zinc-900">
          <div className="max-w-3xl mx-auto border border-zinc-900 bg-zinc-950 p-10 md:p-12 space-y-8">
            <div className="space-y-3 text-center">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Train Smarter for $20/month (Beta)</h2>
              <p className="text-lg text-zinc-400">14-day free trial. Cancel anytime.</p>
            </div>

            <div className="space-y-4 text-zinc-200">
              {pricingBullets.map((line) => (
                <div key={line} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-white mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-zinc-300">{line}</p>
                </div>
              ))}
            </div>

            <a
              href={SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-8 py-4 bg-white text-black font-semibold hover:bg-zinc-100 transition-colors"
            >
              Start Your Free Trial
            </a>
          </div>
        </section>

        {/* Guarantee */}
        <section className="py-20 px-6 border-t border-zinc-900">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">14-Day “Train With It or Don’t Pay” Guarantee</h2>
            <p className="text-lg text-zinc-300 leading-relaxed">
              If Cyclic Strength doesn’t immediately simplify your training and give you a better path forward, email me and I’ll refund you. No forms. No hoops. No pressure.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 border-t border-zinc-900">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              The Training System That Evolves With You — Automatically.
            </h2>
            <p className="text-lg text-zinc-300">
              2-Week Free Trial • Cancel Anytime • $20/month after trial.
            </p>
            <div className="flex justify-center">
              <a
                href={SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-black bg-white hover:bg-zinc-100 transition-colors"
              >
                Start Your Free Trial
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-900 py-10 px-6">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
            <span className="text-zinc-400">Cyclic Strength</span>
            <div className="flex items-center gap-6">
              <a href="https://cyclicstrength.com/terms" className="hover:text-zinc-300 transition-colors">
                Terms
              </a>
              <a href="https://cyclicstrength.com/privacy" className="hover:text-zinc-300 transition-colors">
                Privacy
              </a>
              <a href="mailto:sam@cyclicstrength.com" className="hover:text-zinc-300 transition-colors">
                Contact: sam@cyclicstrength.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
