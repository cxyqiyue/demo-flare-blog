import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { config } from "../../config";

export function HomePageSkeleton() {
  return (
    <div
      className="flare-home-posts w-full space-y-4"
      aria-busy="true"
      aria-label={m.page_loading_posts()}
    >
      <div className="flare-home-post-grid" aria-hidden="true">
        {Array.from({ length: config.home.postsPerPage }, (_, i) => (
          <div key={i} className="flare-surface overflow-hidden">
            <Skeleton className="h-28 w-full rounded-none" />
            <div className="space-y-4 p-5">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-center gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="size-11 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
