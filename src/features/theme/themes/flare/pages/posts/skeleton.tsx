import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";

export function PostsPageSkeleton() {
  return (
    <section
      className="flare-surface flare-archive space-y-5 p-4 sm:p-6 md:p-8"
      aria-busy="true"
      aria-label={m.page_loading_posts()}
    >
      <Skeleton className="h-8 w-24" />
      <div className="flare-archive-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex min-h-28 items-center gap-4 rounded-xl border border-border/60 p-4"
          >
            <Skeleton className="h-14 w-20 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
