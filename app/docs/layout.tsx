import type { Metadata } from 'next';
import { DocSidebar } from './_components/DocSidebar';

export const metadata: Metadata = {
  title: 'Documentation | RevLine',
  description: 'Technical documentation for RevLine - reliability-first revenue infrastructure.',
  robots: 'noindex, nofollow',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans antialiased">
      {/* Ambient gradient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] blur-[150px] bg-purple-900/15 rounded-full" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] blur-[120px] bg-blue-900/10 rounded-full" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] blur-[100px] bg-violet-900/10 rounded-full" />
      </div>

      {/* Layout */}
      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <DocSidebar />

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
