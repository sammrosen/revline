import Link from 'next/link';

/**
 * 404 page for external sites.
 * Clean, minimal design without RevLine branding.
 */
export default function SiteNotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-6xl font-bold text-zinc-700">404</h1>
        <h2 className="text-2xl font-semibold">Page Not Found</h2>
        <p className="text-zinc-400 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link 
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
