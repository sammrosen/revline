import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Rosen Systems',
  description: 'System infrastructure and automation for service-based businesses.',
  robots: 'index, follow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
};

/**
 * Layout for Rosen Systems site.
 */
export default function RosenSystemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
      {children}
    </div>
  );
}
