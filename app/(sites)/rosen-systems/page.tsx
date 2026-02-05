/**
 * Rosen Systems LLC Landing Page
 */
export default function RosenSystemsPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Rosen Systems
        </h1>
        <p className="text-xl md:text-2xl text-zinc-400 leading-relaxed">
          System infrastructure and automation for service-based businesses.
        </p>
        <div className="pt-4">
          <a 
            href="mailto:sam@rosensystems.io"
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            sam@rosensystems.io
          </a>
        </div>
      </div>
    </main>
  );
}
