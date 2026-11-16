import { Skeleton } from "@/components/ui/skeleton";
import { INITIAL_TAG_COUNT } from "./page";

export function PostsPageSkeleton() {
  return (
    <div className="flex w-full flex-col">
      <section className="flare-surface overflow-hidden">
        <div className="space-y-4 px-5 pb-2 pt-6 md:px-8 md:pt-8">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-5/6 max-w-xl" />
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-5 md:px-8">
          {Array.from({ length: INITIAL_TAG_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="border-t border-border/50 px-2 md:px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-border/40 px-3 py-5 last:border-0 md:px-4 md:py-6"
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
