export function NavigationPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="fuwari-card-base p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-nowrap gap-2 overflow-hidden md:flex-wrap md:justify-center py-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-20 rounded-xl bg-muted/30 animate-pulse shrink-0"
            />
          ))}
        </div>
        <div className="h-12 rounded-xl bg-muted/20 animate-pulse" />
      </div>

      <div className="fuwari-card-base p-6 md:p-8 flex flex-col gap-5 flex-1">
        <div className="h-6 w-32 rounded-md bg-muted/30 animate-pulse" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-full bg-muted/30 animate-pulse shrink-0"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
