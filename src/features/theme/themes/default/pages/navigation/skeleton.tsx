export function NavigationPageSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto pb-20 px-6 md:px-0">
      {/* Header */}
      <header className="py-12 md:py-16 space-y-6 text-center">
        <div className="h-10 w-48 bg-muted/40 rounded-md mx-auto animate-pulse" />
        <div className="h-4 w-72 max-w-full bg-muted/30 rounded-md mx-auto animate-pulse" />
      </header>

      {/* Search Area */}
      <div className="border border-border/40 bg-background/50 rounded-lg p-6 md:p-8 space-y-6">
        <div className="flex flex-nowrap gap-2 overflow-hidden md:flex-wrap md:justify-center">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-20 rounded-md bg-muted/30 animate-pulse shrink-0"
            />
          ))}
        </div>
        <div className="h-11 rounded-md bg-muted/20 animate-pulse" />
      </div>

      {/* Bookmarks */}
      <div className="mt-14">
        <div className="h-6 w-32 bg-muted/40 rounded-md animate-pulse" />
        <div className="mt-4 flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-full bg-muted/30 animate-pulse shrink-0"
            />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
