export function MomentsPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="fuwari-card-base p-6 md:p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-44">
        <div className="h-8 w-40 rounded-md bg-muted/30 animate-pulse" />
        <div className="mt-4 h-4 w-72 rounded-md bg-muted/20 animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="fuwari-card-base p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted/30 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded-md bg-muted/30 animate-pulse" />
              <div className="h-2 w-32 rounded-md bg-muted/20 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded-md bg-muted/20 animate-pulse" />
            <div className="h-3 w-5/6 rounded-md bg-muted/20 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-xl bg-muted/20 animate-pulse" />
            <div className="h-24 rounded-xl bg-muted/20 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
