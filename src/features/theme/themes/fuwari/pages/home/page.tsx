import { useMemo } from "react";
import { useViewCounts } from "@/features/pageview/queries";
import type { HomePageProps } from "@/features/theme/contract/pages";
import { Pagination } from "../../components/pagination";
import { PostCard } from "../../components/post-card";

export function HomePage({
  posts,
  page,
  pageSize,
  total,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: HomePageProps) {
  const delayOffset = 50;

  const allSlugs = useMemo(() => posts.map((p) => p.slug), [posts]);
  const { data: viewCounts, isPending: isPendingViewCounts } =
    useViewCounts(allSlugs);

  return (
    <div className="flex flex-col gap-4">
      {posts.length > 0 && (
        <div className="flex flex-col rounded-(--fuwari-radius-large) bg-(--fuwari-card-bg) py-1 md:py-0 md:bg-transparent md:gap-4">
          {posts.map((post, i) => (
            <div
              key={post.slug}
              className="fuwari-onload-animation"
              style={{
                animationDelay: `calc(var(--fuwari-content-delay) + ${i * delayOffset}ms)`,
              }}
            >
              <PostCard
                post={post}
                pinned={post.pinnedAt != null}
                views={viewCounts?.[post.slug]}
                isLoadingViews={isPendingViewCounts}
              />
              <div className="border-t border-dashed mx-6 border-black/10 dark:border-white/15 last:border-t-0 md:hidden" />
            </div>
          ))}
        </div>
      )}

      {posts.length > 0 && (
        <div className="fuwari-card-base fuwari-onload-animation px-5 py-4 md:px-6 md:py-5">
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
