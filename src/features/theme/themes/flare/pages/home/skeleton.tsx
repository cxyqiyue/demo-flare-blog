import { Skeleton } from "@/components/ui/skeleton";

export function HomePageSkeleton() {
  return (
    <div className="flex flex-col w-full space-y-4 md:space-y-6">
      <section className="flare-surface p-5 md:p-7 space-y-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-5/6 max-w-2xl" />
      </section>

      <section className="flare-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-border/40">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
        <div className="px-2 md:px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="px-3 md:px-3 py-5 md:py-6 border-b border-border/30 last:border-0"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-5/6 max-w-xl" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
