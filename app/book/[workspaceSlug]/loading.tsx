/**
 * Booking Page Loading Skeleton
 */

export default function BookingLoading() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header skeleton */}
      <header className="border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="h-7 w-48 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mt-2" />
        </div>
      </header>

      {/* Main content skeleton */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress bar skeleton */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-zinc-700 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Icon skeleton */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 animate-pulse" />
          <div className="h-8 w-64 mx-auto bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-5 w-48 mx-auto bg-zinc-800 rounded animate-pulse" />
        </div>

        {/* Form skeleton */}
        <div className="space-y-6">
          <div>
            <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-2" />
            <div className="h-12 w-full bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="h-14 w-full bg-zinc-800 rounded animate-pulse" />
        </div>
      </main>
    </div>
  );
}
