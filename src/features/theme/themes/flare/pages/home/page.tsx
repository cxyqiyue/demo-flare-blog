import { useMemo } from "react";
import { useViewCounts } from "@/features/pageview/queries";
import type { HomePageProps } from "@/features/theme/contract/pages";
import { Pagination } from "@/features/theme/themes/flare/components/pagination";
import { PostItem } from "@/features/theme/themes/flare/components/post-item";
import { m } from "@/paraglide/messages";

export function HomePage({
  posts,
  page,
  pageSize,
  total,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: HomePageProps) {
  const allSlugs = useMemo(() => posts.map((p) => p.slug), [posts]);
  const { data: viewCounts, isPending: isPendingViewCounts } =
    useViewCounts(allSlugs);

  return (
    <div className="flare-enter flare-home-posts flex w-full flex-col gap-4">
      {posts.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="sr-only">
            <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
              {m.home_latest_posts()}
            </h2>
            <span className="rounded-full bg-muted/60 px-2.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
              {total}
            </span>
          </div>

          <div className="flare-home-post-grid">
            {posts.map((post) => (
              <PostItem
                key={post.id}
                post={post}
                pinned={post.pinnedAt != null}
                views={viewCounts?.[post.slug]}
                isLoadingViews={isPendingViewCounts}
              />
            ))}
          </div>

          <div className="px-5 pb-5 pt-1 md:px-8">
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              onPageChange={onPageChange}
            />
          </div>
        </section>
      ) : (
        <section className="flare-surface p-12 text-center text-muted-foreground">
          {m.posts_no_posts?.() ?? ""}
        </section>
      )}
    </div>
  );
}
