import { useRouteContext } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { INITIAL_TAG_COUNT } from "./page";

export function PostsPageSkeleton() {
  const { siteConfig } = useRouteContext({ from: "__root__" });

  return (
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-5/6 max-w-xl" />
        <div className="flex flex-wrap gap-2 pt-1">
          {Array.from({ length: INITIAL_TAG_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="px-2 md:px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-3 md:px-3 py-6 md:py-7 border-b border-border/30 last:border-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-3/4" />
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
