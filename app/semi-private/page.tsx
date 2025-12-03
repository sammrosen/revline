import BookingForm from './_components/BookingForm';

export default function SemiPrivatePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 lg:py-40">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                Start the New Year With a Training Plan That Actually Sticks.
              </h1>
              <p className="text-xl md:text-2xl text-zinc-400 mb-8 leading-relaxed">
                Small-group strength training at Sports West with structured programming, simple nutrition guidance, and real accountability.
              </p>
              <ul className="space-y-3 mb-8 text-zinc-300">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Semi-private sessions (up to 4 per session)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Block-based program for strength and fat loss</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Coaching, nutrition guardrails, and consistent check-ins</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Limited to 12 spots</span>
                </li>
              </ul>
              <a
                href="#booking-form"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-zinc-200 transition-all duration-200 shadow-lg shadow-zinc-950/50"
              >
                Book Your Planning Session
              </a>
            </div>
            <div className="hidden md:block">
              <div className="aspect-square bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center">
                <svg className="w-32 h-32 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why January Usually Fails */}
      <section className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why most January plans fall apart by February
              </h2>
              <p className="text-lg text-zinc-400 leading-relaxed">
                You start strong. Motivation is high. But by mid-February, life gets busy, motivation fades, and training becomes inconsistent. Sound familiar?
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-50 mb-1">No clear program to follow</h3>
                  <p className="text-zinc-400 text-sm">Random workouts instead of structured progression</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-50 mb-1">Too many decisions every time you walk into the gym</h3>
                  <p className="text-zinc-400 text-sm">Decision fatigue kills consistency</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-50 mb-1">Random workouts instead of progression</h3>
                  <p className="text-zinc-400 text-sm">No system to track and build on your progress</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-50 mb-1">No one noticing when you disappear</h3>
                  <p className="text-zinc-400 text-sm">Lack of accountability makes it easy to skip</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              A simple system that gives you structure, not chaos.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">Training That Builds Week to Week</h3>
              <p className="text-zinc-400">
                Block-based program with repeated patterns and progression baked in. Show up, follow the plan, get stronger.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">Nutrition That Supports Training (Without Being Miserable)</h3>
              <p className="text-zinc-400">
                Protein and calorie guardrails, hydration, simple rules. Not a crash diet—just what you need to fuel progress.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">Accountability Built In</h3>
              <p className="text-zinc-400">
                Set training days, small group, coach watching, people expect you. Structure without the intimidation.
              </p>
            </div>
          </div>
          <div className="text-center">
            <a
              href="#how-it-works"
              className="text-zinc-400 hover:text-zinc-300 underline transition-colors"
            >
              See how the program works →
            </a>
          </div>
        </div>
      </section>

      {/* Program Breakdown */}
      <section id="how-it-works" className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How the New Year Semi-Private Program Works
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                1
              </div>
              <h3 className="text-lg font-bold mb-2">Book Your Planning Session</h3>
              <p className="text-zinc-400 text-sm">
                1:1 sit-down at Sports West. We&apos;ll talk goals, schedule, walk through the block, and answer questions.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                2
              </div>
              <h3 className="text-lg font-bold mb-2">Join Your Group</h3>
              <p className="text-zinc-400 text-sm">
                Assigned to a small group (up to 4 per session) with set training days at the club.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                3
              </div>
              <h3 className="text-lg font-bold mb-2">Follow the Block</h3>
              <p className="text-zinc-400 text-sm">
                Show up, follow the program, progress each week. Progressions are personalized too. Simple nutrition guidance alongside your training.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                4
              </div>
              <h3 className="text-lg font-bold mb-2">Review + Decide Next Block</h3>
              <p className="text-zinc-400 text-sm">
                At the end of the block, quick check-in. You can roll into the next one or call it there.
              </p>
            </div>
          </div>
          <div className="text-center">
            <a
              href="#booking-form"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-zinc-200 transition-all duration-200 shadow-lg shadow-zinc-950/50"
            >
              Book Your Planning Session
            </a>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Is this for you?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-bold mb-4 text-green-400">This is for you if…</h3>
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You&apos;re tired of starting over every January</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You want to build strength and lose fat with a simple plan</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You prefer small groups over big classes</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>You&apos;re willing to commit to set training days</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4 text-red-400">This isn&apos;t for you if…</h3>
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>You want random &quot;workout of the day&quot; style training</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>You&apos;re looking for a pure bootcamp or cardio class</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>You can&apos;t commit to showing up at least 2x per week</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>You&apos;re not open to basic nutrition guidelines</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">Who&apos;s running this?</h3>
            <p className="text-zinc-400 leading-relaxed">
              Sam Rosen, Personal Trainer at Sports West. Data-driven programming, semi-private focus, and a commitment to helping you build strength and lose fat with a system that actually works.
            </p>
          </div>
        </div>
      </section>

      {/* Offer Snapshot */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-4 text-center">
              What You Get When You Sign Up
            </h2>
            <p className="text-center text-zinc-400 mb-8">
              Challenge sessions: Tuesday/Thursday/Saturday mornings
            </p>
            
            <div className="space-y-6 mb-8">
              <div className="border-b border-zinc-800 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">Custom Nutrition Guidance</h3>
                  <span className="text-zinc-500">$149</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Maintenance calorie calculation</li>
                  <li>• Personalized deficit/surplus selector</li>
                  <li>• Goal timeline generation</li>
                  <li>• Daily/per meal portioning system</li>
                </ul>
              </div>

              <div className="border-b border-zinc-800 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">Custom Grocery Lists</h3>
                  <span className="text-zinc-500">$79</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Pulls from stores you shop at</li>
                  <li>• Adjusts to your calorie target</li>
                  <li>• Updates as goals change</li>
                </ul>
              </div>

              <div className="border-b border-zinc-800 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">Local Restaurant Guide</h3>
                  <span className="text-zinc-500">$99</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Reads menus from local Reno restaurants</li>
                  <li>• Gives you the best options wherever you&apos;re eating</li>
                </ul>
              </div>

              <div className="border-b border-zinc-800 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">Customized Progressions</h3>
                  <span className="text-zinc-500">$199</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Performance trends</li>
                  <li>• Recovery built in</li>
                  <li>• Progression every week</li>
                  <li>• Accountability built in</li>
                </ul>
              </div>

              <div className="border-b border-zinc-800 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">Accountability</h3>
                  <span className="text-zinc-500">$150</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Progress review</li>
                  <li>• Session accountability</li>
                </ul>
              </div>

              <div className="border-b border-zinc-800 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">2x Workouts/Week with Trainer</h3>
                  <span className="text-zinc-500">$400</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Tuesday/Thursday/Saturday mornings</li>
                  <li>• $50 sessions, twice a week, 4 weeks</li>
                </ul>
              </div>

              <div className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-zinc-50">1 Year Access to Online Programming and Progressions</h3>
                  <span className="text-zinc-500">$600</span>
                </div>
                <ul className="space-y-1 text-zinc-400 text-sm ml-4">
                  <li>• Programs within the Cyclic Strength app</li>
                  <li>• Auto progression engine</li>
                  <li>• Metrics and history</li>
                  <li>• Blocked training from your phone</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-zinc-700 pt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-semibold text-zinc-400">Total Value</span>
                <span className="text-2xl font-bold text-zinc-500 line-through">$1,676</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-zinc-50">Your Price</span>
                <span className="text-4xl font-bold text-white">$400</span>
              </div>
            </div>

            <div className="text-center mt-8">
              <a
                href="#booking-form"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-zinc-950 bg-zinc-50 rounded-lg hover:bg-zinc-200 transition-all duration-200 shadow-lg shadow-zinc-950/50"
              >
                Book Your Planning Session
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Form */}
      <section id="booking-form" className="border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Book Your Planning Session</h2>
            <p className="text-zinc-400">
              Fill out the form below and I&apos;ll reach out within 24–48 hours to confirm your session time.
            </p>
          </div>
          <BookingForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">Do I have to be in great shape to join?</h3>
              <p className="text-zinc-400">
                No. This program is designed for people at various fitness levels. We&apos;ll assess where you&apos;re at in your planning session and adjust accordingly.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">What if I miss a session?</h3>
              <p className="text-zinc-400">
                Life happens. We understand. While consistency is key, occasional misses are fine. The structure helps you get back on track quickly.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">Is this okay if I have some lifting experience already?</h3>
              <p className="text-zinc-400">
                Absolutely. The program is designed to work whether you&apos;re newer to lifting or have some experience. We&apos;ll scale it to your level.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">Is nutrition included?</h3>
              <p className="text-zinc-400">
                Yes. You&apos;ll get simple nutrition guardrails—protein targets, calorie ranges, hydration—not a restrictive diet plan.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">How long is the program?</h3>
              <p className="text-zinc-400">
                This is a block-based program. Each block runs for a set period (typically 8–12 weeks). At the end, you can roll into the next block or take a break.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900/50 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-zinc-400 mb-2">Sports West Athletic Club</p>
            <p className="text-zinc-500 text-sm">[Address to be added]</p>
          </div>
          <div className="text-center mb-6">
            <p className="text-zinc-400">Sam Rosen, Personal Trainer</p>
          </div>
          <div className="text-center">
            <p className="text-zinc-500 text-sm">
              This program is run inside Sports West Athletic Club for members and approved non-members.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

