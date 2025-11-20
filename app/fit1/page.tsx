export default function FIT1Page() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-linear-to-b from-zinc-900/50 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-linear-to-br from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
              Elite Training Meets Intelligent Programming
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 mb-8 leading-relaxed">
              Personalized coaching, data-driven programs, and a mobile app built for serious lifters who refuse to settle for generic plans.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* TODO: Replace href with Calendly link */}
              <a
                href="#"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-zinc-200 transition-all duration-200 shadow-lg shadow-zinc-950/50"
              >
                Book Your FIT1 Assessment
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-zinc-50 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-all duration-200 border border-zinc-700"
              >
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">
              Built for Serious Athletes
            </h2>
            <p className="text-xl text-zinc-400 text-center mb-12">
              This isn&apos;t for everyone. It&apos;s for people who take training seriously.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Experienced Lifters</h3>
                <p className="text-zinc-400">
                  You know the basics. Now you want programming that adapts to your goals, recovery, and progress.
                </p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Busy Professionals</h3>
                <p className="text-zinc-400">
                  Limited time, maximum efficiency. Get a plan that fits your schedule without compromising results.
                </p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Data-Driven Athletes</h3>
                <p className="text-zinc-400">
                  Track everything. Body composition, strength metrics, and progressive overload that actually matters.
                </p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Gym Members Seeking Structure</h3>
                <p className="text-zinc-400">
                  Tired of wandering through workouts? Get clear direction with accountability built in.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What They Get Section */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Progress
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              From your initial assessment to daily training, we&apos;ve built a complete system for sustainable strength gains.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="aspect-video bg-zinc-800/50 rounded-xl border border-zinc-700 flex items-center justify-center">
                <svg className="w-16 h-16 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">FIT1 In-Person Consultation</h3>
              <p className="text-zinc-400">
                Start with a comprehensive assessment: movement screen, body composition scan, goal-setting, and training history review. We build your baseline.
              </p>
            </div>

            <div className="space-y-4">
              <div className="aspect-video bg-zinc-800/50 rounded-xl border border-zinc-700 flex items-center justify-center">
                <svg className="w-16 h-16 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">Custom Program Design</h3>
              <p className="text-zinc-400">
                Get a periodized training plan tailored to your goals, schedule, and experience level. Updated as you progress and adapt.
              </p>
            </div>

            <div className="space-y-4">
              <div className="aspect-video bg-zinc-800/50 rounded-xl border border-zinc-700 flex items-center justify-center">
                <svg className="w-16 h-16 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">Mobile App Access</h3>
              <p className="text-zinc-400">
                Train with confidence using the companion app: video demos, rest timers, auto-progression, and direct messaging with your coach.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-xl p-8">
            <h3 className="text-xl font-bold mb-4">Plus: Ongoing Support</h3>
            <ul className="grid md:grid-cols-2 gap-4 text-zinc-400">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Bi-weekly check-ins and program adjustments</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Form review via video submission</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Nutrition guidance and macro recommendations</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Access to exercise library and educational content</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple Process, Serious Results
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              From first contact to hitting PRs, here&apos;s exactly how it works.
            </p>
          </div>

          <div className="space-y-12">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="shrink-0 w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-3">Book Your FIT1 Assessment</h3>
                <p className="text-lg text-zinc-400">
                  Schedule your initial consultation online. We&apos;ll meet in person for a 60-90 minute deep-dive into your training history, goals, and current capabilities. Includes body composition analysis and movement screening.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="shrink-0 w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-3">Receive Your Custom Program</h3>
                <p className="text-lg text-zinc-400">
                  Within 48 hours, you&apos;ll get access to your personalized training program in the mobile app. Includes exercise demos, intensity prescriptions, and a clear roadmap for the next 4-8 weeks.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="shrink-0 w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-3">Train with Precision</h3>
                <p className="text-lg text-zinc-400">
                  Follow your program using the app. Log your lifts, track progress, and get real-time feedback. Submit form checks when needed. Stay accountable through regular check-ins.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="shrink-0 w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-bold">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-3">Progress and Adapt</h3>
                <p className="text-lg text-zinc-400">
                  Every 2 weeks, we review your data, adjust your program, and keep you progressing. Plateau? We handle it. Life gets busy? We adapt. Your plan evolves with you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trusted by Athletes Who Demand Results
            </h2>
            <p className="text-xl text-zinc-400">
              Real progress from real lifters.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-zinc-300 mb-4">
                &quot;Added 75lbs to my deadlift in 12 weeks while staying injury-free. The programming is intelligent and the app makes everything seamless.&quot;
              </p>
              <div className="font-semibold">Marcus T.</div>
              <div className="text-sm text-zinc-500">Powerlifting, 3 years experience</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-zinc-300 mb-4">
                &quot;Finally got lean without losing strength. The body comp tracking kept me accountable and the program adjusted perfectly when work got hectic.&quot;
              </p>
              <div className="font-semibold">Sarah K.</div>
              <div className="text-sm text-zinc-500">Physique athlete, busy professional</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-zinc-300 mb-4">
                &quot;Best investment in my training. No more guessing, no more spinning my wheels. Just clear direction and consistent progress.&quot;
              </p>
              <div className="font-semibold">James P.</div>
              <div className="text-sm text-zinc-500">Competitive CrossFit athlete</div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">About Your Coach</h3>
            <p className="text-zinc-400 mb-4">
              Certified strength coach with 8+ years of experience programming for athletes from beginners to national-level competitors. Specialized in evidence-based training protocols, biomechanics, and long-term athlete development.
            </p>
            <p className="text-zinc-400">
              Built this system after seeing too many talented lifters stuck with cookie-cutter programs that ignored their individual needs. Training should be personal, data-driven, and continuously optimized.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-zinc-400">
              No hidden fees. No long-term contracts. Just serious coaching.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-8 md:p-12">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-bold mb-2">Complete Coaching Package</h3>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-5xl font-bold">$299</span>
                  <span className="text-2xl text-zinc-400">/month</span>
                </div>
                <p className="text-zinc-400">
                  Everything you need to train with purpose and progress consistently.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">FIT1 in-person assessment (initial only)</span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">Fully customized training program</span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">Mobile app access with all features</span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">Bi-weekly program adjustments</span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">Form review and technique coaching</span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">Direct messaging with your coach</span>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">Nutrition guidance and macro coaching</span>
                </div>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-8 text-center">
                <p className="text-sm text-zinc-400">
                  Cancel anytime. No long-term commitment required.
                </p>
              </div>

              {/* TODO: Replace href with checkout link */}
              <a
                href="#"
                className="block w-full py-4 text-center text-lg font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-zinc-200 transition-all duration-200"
              >
                Start Your Program
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-3">Do I need to train at a specific gym?</h3>
              <p className="text-zinc-400">
                No. Programs are designed based on the equipment you have access to. Whether you&apos;re at a commercial gym, home gym, or hotel facility, we&apos;ll work with what you&apos;ve got.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-3">How often do I communicate with my coach?</h3>
              <p className="text-zinc-400">
                Formal check-ins happen every 2 weeks, but you have direct messaging access for questions, form checks, or urgent adjustments. Most athletes message 2-3 times per week and get responses within 24 hours.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-3">What if I miss workouts or need to take time off?</h3>
              <p className="text-zinc-400">
                Life happens. The program adapts. Let us know if your schedule changes and we&apos;ll adjust your training accordingly. The goal is sustainable progress, not burnout.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-3">Is this for beginners or advanced lifters?</h3>
              <p className="text-zinc-400">
                This program is designed for lifters with at least 1-2 years of consistent training experience. If you&apos;re brand new to lifting, we recommend starting with a fundamentals program first.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-3">What equipment does the app work on?</h3>
              <p className="text-zinc-400">
                The mobile app is available on iOS and Android. It works offline, so you can train anywhere without worrying about gym WiFi.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold mb-3">Can I cancel or pause my membership?</h3>
              <p className="text-zinc-400">
                Yes. There&apos;s no long-term contract. Cancel anytime with 7 days notice. Need to pause for travel or injury? We can put your membership on hold for up to 2 months.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-linear-to-b from-zinc-900 to-zinc-950">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-32 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-linear-to-br from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
            Stop Guessing. Start Progressing.
          </h2>
          <p className="text-xl md:text-2xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Join lifters who train with purpose, track what matters, and build strength that lasts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* TODO: Replace href with Calendly link */}
            <a
              href="#"
              className="inline-flex items-center justify-center px-10 py-5 text-lg font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-zinc-200 transition-all duration-200 shadow-2xl shadow-zinc-950/50"
            >
              Book Your FIT1 Assessment
            </a>
          </div>
          <p className="mt-8 text-sm text-zinc-500">
            Questions? Email us at{" "}
            <a href="mailto:coach@example.com" className="text-zinc-400 hover:text-zinc-300 underline">
              coach@example.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-500 text-sm">
              © 2024 Elite Training Systems. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

