export function SectionSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/40">
        <div className="space-y-1.5">
          <div className="h-9 w-40 bg-muted rounded"></div>
          <div className="h-3 w-56 bg-muted/50 rounded"></div>
        </div>
        <div className="h-10 w-28 bg-muted rounded-sm"></div>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-[200px_1fr] gap-12 lg:gap-20 items-start">
        {/* Sidebar Skeleton */}
        <div className="hidden md:flex flex-col gap-1 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full bg-muted/50 rounded-md"></div>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 space-y-8 w-full">
          <div className="space-y-2 mb-8">
            <div className="h-6 w-32 bg-muted rounded"></div>
            <div className="h-4 w-64 bg-muted/50 rounded"></div>
          </div>

          <div className="space-y-12">
            <div className="rounded-md bg-muted/40 h-32 w-full"></div>

            <div className="space-y-8">
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="h-10 w-full bg-muted/30 rounded"></div>
                <div className="h-10 w-full bg-muted/30 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FuwariSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6">
        <div className="h-6 w-40 rounded-lg bg-(--fuwari-btn-regular-bg) mb-6"></div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-24 rounded-md bg-(--fuwari-btn-regular-bg)"></div>
              <div className="h-9 w-full rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6">
        <div className="h-6 w-48 rounded-lg bg-(--fuwari-btn-regular-bg) mb-6"></div>
        <div className="h-24 w-full rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
      </div>
      <div className="h-10 w-32 self-end rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
    </div>
  );
}
