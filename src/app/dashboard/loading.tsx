export default function DashboardLoading() {
  return (
    <div className="text-white">
      {/* Header skeleton */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-16 bg-zinc-800 rounded-full animate-pulse" />
          <div className="h-5 w-44 bg-zinc-800 rounded-full animate-pulse" />
        </div>
        <div className="h-4 w-12 bg-zinc-800 rounded-full animate-pulse" />
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8">
        {/* "Signed in as" line */}
        <div className="h-3.5 w-64 bg-zinc-800 rounded-full animate-pulse mb-6" />

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5"
            >
              <div className="h-7 w-10 bg-zinc-800 rounded-full animate-pulse mb-2" />
              <div className="h-4 w-20 bg-zinc-800 rounded-full animate-pulse mb-1.5" />
              <div className="h-3 w-28 bg-zinc-800 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
