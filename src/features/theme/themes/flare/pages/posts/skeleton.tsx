import { Skeleton } from "@/components/ui/skeleton";
import { INITIAL_TAG_COUNT } from "./page";

export function PostsPageSkeleton() {
  return (
    <div className="w-full space-y-4 md:space-y-6">
      <section className="flare-surface p-5 md:p-7 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-5/6 max-w-xl" />
        <div className="flex flex-wrap gap-2 pt-1">
          {Array.from({ length: INITIAL_TAG_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </section>

      <section className="flare-surface overflow-hidden">
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
