import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cyclic Strength | Intelligent Training Platform',
  description: 'Design programs, log workouts, track progress, and get personalized coaching. The all-in-one strength training platform that adapts to you.',
};

// Make this configurable - you can change this URL
const SIGNUP_URL = process.env.NEXT_PUBLIC_CYCLIC_SIGNUP_URL || 'https://cyclicstrength.com';

export default function CyclicPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          {/* Badge */}
          <div className="inline-block px-4 py-2 border border-zinc-800 bg-zinc-950">
            <span className="text-sm text-zinc-400">Beta Access</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              Train Smarter.<br />Not Harder.
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Custom program design, intelligent workout logging, and an adaptive coaching engine that learns from your performance and recovery data.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <a
              href={SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-black bg-white hover:bg-zinc-100 transition-colors"
            >
              Start Free Trial
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="pt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>2 weeks free</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure & private</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Tired of Guessing?
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Most training apps are just digital notebooks. Cyclic Strength is an intelligent training partner.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 text-lg">
            <div className="space-y-4">
              <p className="text-zinc-400">Forgetting what you lifted last week</p>
              <p className="text-zinc-400">Not knowing if you&apos;re recovered enough</p>
              <p className="text-zinc-400">Training blind without real data</p>
            </div>
            <div className="space-y-4">
              <p className="text-zinc-400">Programs that don&apos;t adapt to you</p>
              <p className="text-zinc-400">No insight into what&apos;s actually working</p>
              <p className="text-zinc-400">Juggling spreadsheets and notes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Three Core Pillars
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Everything you need to train intelligently, all in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Custom Program Design */}
            <div className="p-8 border border-zinc-900 bg-zinc-950">
              <div className="mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Custom Program Design</h3>
              <p className="text-zinc-400 leading-relaxed">
                Build sophisticated training programs with multiple days, movements, sets, and targets. Organize by muscle groups, training phases, and your specific goals.
              </p>
            </div>

            {/* Performance & Recovery Tracking */}
            <div className="p-8 border border-zinc-900 bg-zinc-950">
              <div className="mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Performance & Recovery Tracking</h3>
              <p className="text-zinc-400 leading-relaxed">
                Track volume, intensity, and strength trends over time. Monitor recovery metrics, joint pain, muscle pump, and understand exactly what&apos;s driving your progress.
              </p>
            </div>

            {/* Adaptive Coaching Engine */}
            <div className="p-8 border border-zinc-900 bg-zinc-950">
              <div className="mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Adaptive Coaching Engine</h3>
              <p className="text-zinc-400 leading-relaxed">
                The more you train, the smarter it gets. Our algorithms learn from your performance data, recovery feedback, and training patterns to provide personalized recommendations that evolve with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Start training intelligently in minutes, not weeks.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="shrink-0 w-12 h-12 border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-lg">
                01
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Design Your Program or Start Training</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Create a custom training program with multiple days, movements, sets, and targets. Or simply start training and let the adaptive engine progress you automatically based on your performance.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="shrink-0 w-12 h-12 border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-lg">
                02
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Log Your Workouts</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Track every set with weight, reps, and RIR (Reps In Reserve). Provide feedback on recovery, joint pain, muscle pump, and difficulty level. The more data you log, the smarter the system becomes.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="shrink-0 w-12 h-12 border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-lg">
                03
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Track Your Progress</h3>
                <p className="text-zinc-400 leading-relaxed">
                  See your volume, intensity, and strength trends over time. Identify patterns, understand what&apos;s driving your progress, and spot potential issues before they become problems.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="shrink-0 w-12 h-12 border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-lg">
                04
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Get Smarter Coaching</h3>
                <p className="text-zinc-400 leading-relaxed">
                  As you train, the algorithms learn your patterns, recovery capacity, and what works best for you. Receive personalized recommendations that adapt based on your training data, recovery feedback, and performance trends.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-zinc-400">
              Start your free trial today.
            </p>
          </div>

          <div className="border border-zinc-900 bg-zinc-950 p-12">
            <div className="text-center mb-10">
              <div className="inline-block px-4 py-2 border border-zinc-800 bg-black mb-6">
                <span className="text-sm text-zinc-300">2 Weeks Free Trial</span>
              </div>
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="text-5xl md:text-6xl font-bold">$20</span>
                <span className="text-xl text-zinc-400">/month</span>
              </div>
              <p className="text-zinc-500">After your free trial</p>
            </div>

            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-white font-medium">Unlimited program design</p>
                  <p className="text-zinc-500 text-sm mt-1">Create as many custom programs as you want</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-white font-medium">Advanced performance tracking</p>
                  <p className="text-zinc-500 text-sm mt-1">Volume, intensity, strength trends, and recovery metrics</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-white font-medium">Adaptive coaching engine</p>
                  <p className="text-zinc-500 text-sm mt-1">Personalized recommendations that learn from your training</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-white mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-white font-medium">Cancel anytime</p>
                  <p className="text-zinc-500 text-sm mt-1">No long-term commitments or hidden fees</p>
                </div>
              </div>
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
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Ready to Train Smarter?
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Join beta access and start tracking your training with intelligence. 2 weeks free, then $20/month.
          </p>
          <div className="flex justify-center pt-4">
            <a
              href={SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-black bg-white hover:bg-zinc-100 transition-colors"
            >
              Start Free Trial
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-500 text-sm">
          <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
            Cyclic Strength
          </a>
          <p>
            Beta Access — Join early and help shape the future of training.
          </p>
        </div>
      </footer>
    </div>
  );
}