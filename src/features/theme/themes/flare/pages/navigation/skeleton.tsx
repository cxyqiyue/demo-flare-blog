export function NavigationPageSkeleton() {
  return (
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-5">
        <div className="space-y-3">
          <div className="h-8 w-40 bg-muted/40 rounded-md animate-pulse" />
          <div className="h-4 w-full max-w-2xl bg-muted/30 rounded-md animate-pulse" />
          <div className="h-4 w-5/6 max-w-xl bg-muted/30 rounded-md animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-md bg-muted/30 animate-pulse" />
          ))}
        </div>
        <div className="h-11 rounded-xl bg-muted/20 animate-pulse" />
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-5">
        <div className="h-6 w-32 bg-muted/40 rounded-md animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-11 w-36 rounded-lg bg-muted/25 animate-pulse" />
          ))}
        </div>
      </section>
    </div>
  );
}
