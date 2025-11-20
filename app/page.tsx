export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-50 font-sans">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 py-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_100%)]" />
        <div className="max-w-5xl mx-auto text-center space-y-12 relative z-10">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
            Stop running your<br />business manually.
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed font-light">
            A fully automated ManyChat + email + booking + payment + onboarding system that turns attention into revenue — without you touching a thing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {/* TODO: Replace /demo with actual demo page route */}
            <a
              href="/demo"
              className="group inline-flex items-center justify-center px-10 py-5 text-base font-medium text-black bg-white hover:bg-zinc-100 transition-all duration-300 shadow-lg shadow-white/10 hover:shadow-white/20"
            >
              Run the Live Demo
              <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            {/* TODO: Replace href with Calendly link */}
            <a
              href="#"
              className="inline-flex items-center justify-center px-10 py-5 text-base font-medium text-zinc-50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all duration-300"
            >
              Work With Me
            </a>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-32 px-6 border-t border-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold mb-20 text-center tracking-tight">
            What&apos;s Actually Burning You Out?
          </h2>
          <div className="grid md:grid-cols-2 gap-12 text-xl md:text-2xl">
            <div className="space-y-8">
              <p className="text-zinc-400 hover:text-zinc-300 transition-colors duration-300 cursor-default">DMing every lead manually</p>
              <p className="text-zinc-400 hover:text-zinc-300 transition-colors duration-300 cursor-default">Forgetting follow-ups</p>
              <p className="text-zinc-400 hover:text-zinc-300 transition-colors duration-300 cursor-default">Losing warm leads because you&apos;re busy</p>
            </div>
            <div className="space-y-8">
              <p className="text-zinc-400 hover:text-zinc-300 transition-colors duration-300 cursor-default">Constantly chasing payments</p>
              <p className="text-zinc-400 hover:text-zinc-300 transition-colors duration-300 cursor-default">Manually onboarding everyone</p>
              <p className="text-zinc-400 hover:text-zinc-300 transition-colors duration-300 cursor-default">Juggling 6 different platforms</p>
            </div>
          </div>
        </div>
      </section>

      {/* The System Section */}
      <section className="py-32 px-6 border-t border-zinc-900/50 bg-zinc-950/30">
        <div className="max-w-3xl mx-auto text-center mb-28">
          <p className="text-2xl md:text-3xl font-light leading-relaxed text-zinc-300">
            I build the backend of your business — using ManyChat, email automation, and a fully automated booking + payment + onboarding system.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="group space-y-5">
            <div className="w-14 h-14 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-white/5">
              <svg className="w-6 h-6 text-zinc-500 group-hover:text-zinc-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-50">ManyChat → Email List</h3>
            <p className="text-zinc-500 leading-relaxed text-base">
              Auto-reply to comments/DM. Capture warm leads. Move them into nurture automatically.
            </p>
          </div>

          <div className="group space-y-5">
            <div className="w-14 h-14 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-white/5">
              <svg className="w-6 h-6 text-zinc-500 group-hover:text-zinc-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-50">Email Automations</h3>
            <p className="text-zinc-500 leading-relaxed text-base">
              Warm-up sequences. Reminders. Lead-to-call flows.
            </p>
          </div>

          <div className="group space-y-5">
            <div className="w-14 h-14 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-white/5">
              <svg className="w-6 h-6 text-zinc-500 group-hover:text-zinc-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-50">Booking Automation</h3>
            <p className="text-zinc-500 leading-relaxed text-base">
              Calendar booking. Confirmations. Reminders. No manual back-and-forth.
            </p>
          </div>

          <div className="group space-y-5">
            <div className="w-14 h-14 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-white/5">
              <svg className="w-6 h-6 text-zinc-500 group-hover:text-zinc-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-50">Payment + Onboarding</h3>
            <p className="text-zinc-500 leading-relaxed text-base">
              Stripe checkout. Instant onboarding email. Zero manual work.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Visual Breakdown */}
      <section className="py-32 px-6 border-t border-zinc-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold mb-28 text-center tracking-tight">
            How It Works In Your Business
          </h2>

          <div className="space-y-16">
            <div className="group flex gap-8 items-start hover:translate-x-2 transition-transform duration-300">
              <div className="shrink-0 w-16 h-16 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 font-mono text-sm transition-all duration-300">
                01
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-zinc-50">They Engage</h3>
                <p className="text-zinc-500 text-lg leading-relaxed">
                  Someone comments or DMs. ManyChat triggers automatically.
                </p>
              </div>
            </div>

            <div className="group flex gap-8 items-start hover:translate-x-2 transition-transform duration-300">
              <div className="shrink-0 w-16 h-16 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 font-mono text-sm transition-all duration-300">
                02
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-zinc-50">They Join Your Email List</h3>
                <p className="text-zinc-500 text-lg leading-relaxed">
                  Lead captured. Moved into nurture sequence. Zero manual work.
                </p>
              </div>
            </div>

            <div className="group flex gap-8 items-start hover:translate-x-2 transition-transform duration-300">
              <div className="shrink-0 w-16 h-16 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 font-mono text-sm transition-all duration-300">
                03
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-zinc-50">They Book a Call Automatically</h3>
                <p className="text-zinc-500 text-lg leading-relaxed">
                  Email automation drives them to your calendar. They book. Confirmations sent.
                </p>
              </div>
            </div>

            <div className="group flex gap-8 items-start hover:translate-x-2 transition-transform duration-300">
              <div className="shrink-0 w-16 h-16 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 font-mono text-sm transition-all duration-300">
                04
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-zinc-50">They Pay Without You Chasing</h3>
                <p className="text-zinc-500 text-lg leading-relaxed">
                  Automated email with Stripe checkout. Payment happens. You&apos;re notified.
                </p>
              </div>
            </div>

            <div className="group flex gap-8 items-start hover:translate-x-2 transition-transform duration-300">
              <div className="shrink-0 w-16 h-16 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 font-mono text-sm transition-all duration-300">
                05
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-zinc-50">They&apos;re Onboarded Automatically</h3>
                <p className="text-zinc-500 text-lg leading-relaxed">
                  Instant onboarding email with all the info they need. Welcome sequence begins.
                </p>
              </div>
            </div>

            <div className="group flex gap-8 items-start hover:translate-x-2 transition-transform duration-300">
              <div className="shrink-0 w-16 h-16 border border-zinc-800 group-hover:border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 font-mono text-sm transition-all duration-300">
                06
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-3 text-zinc-50">You Deliver the Service</h3>
                <p className="text-zinc-500 text-lg leading-relaxed">
                  This is where you come in. Everything else? Already handled.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-40 px-6 border-t border-zinc-900/50 bg-zinc-950/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)]" />
        <div className="max-w-3xl mx-auto text-center space-y-10 relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
            Experience the System Yourself
          </h2>
          <p className="text-xl text-zinc-400 leading-relaxed font-light max-w-2xl mx-auto">
            Experience a 60–90 second simulation of the exact automation system I&apos;ll install in your business.
          </p>
          <div className="pt-6">
            {/* TODO: Replace /demo with actual demo page route */}
            <a
              href="/demo"
              className="group inline-flex items-center justify-center px-12 py-6 text-lg font-medium text-black bg-white hover:bg-zinc-100 transition-all duration-300 shadow-2xl shadow-white/10 hover:shadow-white/20"
            >
              Run The Live Demo
              <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
          <div className="pt-12 space-y-3 text-zinc-600 text-sm">
            <p>→ Book a fake call</p>
            <p>→ Get automated emails</p>
            <p>→ &quot;Buy&quot; through a $0 Stripe checkout</p>
            <p>→ Get a fully automated onboarding email</p>
            <p>→ See the whole system fire without me touching anything</p>
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section className="py-32 px-6 border-t border-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold mb-20 text-center tracking-tight">
            Client Wins
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="border border-zinc-900 hover:border-zinc-800 p-10 space-y-4 transition-all duration-300 hover:bg-zinc-950/50">
              <p className="text-zinc-600 text-sm uppercase tracking-wider">Coming soon</p>
              <div className="h-32"></div>
            </div>
            <div className="border border-zinc-900 hover:border-zinc-800 p-10 space-y-4 transition-all duration-300 hover:bg-zinc-950/50">
              <p className="text-zinc-600 text-sm uppercase tracking-wider">Coming soon</p>
              <div className="h-32"></div>
            </div>
            <div className="border border-zinc-900 hover:border-zinc-800 p-10 space-y-4 transition-all duration-300 hover:bg-zinc-950/50">
              <p className="text-zinc-600 text-sm uppercase tracking-wider">Coming soon</p>
              <div className="h-32"></div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-40 px-6 border-t border-zinc-900/50">
        <div className="max-w-2xl mx-auto text-center space-y-12">
          <p className="text-xl md:text-2xl leading-relaxed text-zinc-400 font-light">
            I build automation systems for small businesses so they can grow without drowning in admin.
          </p>
          <p className="text-xl md:text-2xl leading-relaxed text-zinc-400 font-light">
            My work integrates ManyChat, email automation, booking systems, Stripe, and onboarding flows into one seamless backend.
          </p>
          <p className="text-xl md:text-2xl leading-relaxed text-zinc-400 font-light">
            The goal is simple:
          </p>
          <div className="pt-4">
            <p className="text-3xl md:text-4xl font-bold leading-relaxed text-zinc-50">
              You sell and deliver.
            </p>
            <p className="text-3xl md:text-4xl font-bold leading-relaxed text-zinc-50">
              The system handles everything else.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-40 px-6 border-t border-zinc-900/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_100%)]" />
        <div className="max-w-4xl mx-auto text-center space-y-10 relative z-10">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            Ready to stop running<br />everything manually?
          </h2>
          <p className="text-xl md:text-2xl text-zinc-400 font-light max-w-2xl mx-auto">
            Your time should be spent on selling and delivering — not on admin.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            {/* TODO: Replace /demo with actual demo page route */}
            <a
              href="/demo"
              className="group inline-flex items-center justify-center px-10 py-5 text-base font-medium text-black bg-white hover:bg-zinc-100 transition-all duration-300 shadow-lg shadow-white/10 hover:shadow-white/20"
            >
              Run the Live Demo
              <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            {/* TODO: Replace href with Calendly link */}
            <a
              href="#"
              className="inline-flex items-center justify-center px-10 py-5 text-base font-medium text-zinc-50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all duration-300"
            >
              Work With Me
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900/50 py-20 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-600 text-sm">
          <p>© 2024 Sam Rosen. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-zinc-400 transition-colors duration-200">Privacy</a>
            <a href="#" className="hover:text-zinc-400 transition-colors duration-200">Terms</a>
            <a href="#" className="hover:text-zinc-400 transition-colors duration-200">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
