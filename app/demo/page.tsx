import EmailCapture from '@/app/_components/EmailCapture';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Demo | Sam Rosen Business Automation',
  description: 'Experience the automated customer journey system in action.',
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-50 font-sans flex items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center space-y-10">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            See the System in Action
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 font-light leading-relaxed">
            Enter your email to experience the automated flow.
          </p>
          <p className="text-base text-zinc-500">
            You'll see exactly how leads move from capture to nurture — automatically.
          </p>
        </div>

        <div className="pt-4">
          <EmailCapture 
            buttonText="Start Demo"
            placeholder="Enter your email"
            collectName={true}
            namePlaceholder="Your name"
            inline={false}
            className="max-w-md mx-auto"
            source="demo"
          />
        </div>

        <div className="pt-8">
          <a 
            href="/"
            className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

