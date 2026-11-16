import { useRouteContext } from "@tanstack/react-router";
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
  const { siteConfig } = useRouteContext({ from: "__root__" });

  const allSlugs = useMemo(() => posts.map((p) => p.slug), [posts]);
  const { data: viewCounts, isPending: isPendingViewCounts } =
    useViewCounts(allSlugs);

  return (
    <div className="flex flex-col w-full space-y-4 md:space-y-6 flare-enter">
      <section className="flare-surface p-5 md:p-7 lg:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {m.home_greeting()} 👋
          </p>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            {m.home_intro_prefix()}{" "}
            <span className="text-foreground">{siteConfig.author}</span>
            {m.home_intro_separator()}
          </h2>
          {siteConfig.description ? (
            <p className="text-sm md:text-base text-muted-foreground leading-7 max-w-3xl">
              {siteConfig.description}
            </p>
          ) : null}
        </div>
      </section>

      {posts.length > 0 ? (
        <section className="flare-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-border/40 bg-background/20">
            <h2 className="text-base md:text-lg font-semibold text-foreground tracking-tight">
              {m.home_latest_posts()}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums rounded-full border border-border/50 px-2 py-0.5">
              {total}
            </span>
          </div>

          <div className="px-2 md:px-4">
            {posts.map((post) => (
              <div key={post.id} className="px-3 md:px-3">
                <PostItem
                  post={post}
                  pinned={post.pinnedAt != null}
                  views={viewCounts?.[post.slug]}
                  isLoadingViews={isPendingViewCounts}
                />
              </div>
            ))}
          </div>

          <div className="px-5 md:px-7 pb-5 pt-1">
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
        <section className="flare-surface p-10 text-center text-muted-foreground">
          {m.posts_no_posts?.() ?? ""}
        </section>
      )}
    </div>
  );
}
