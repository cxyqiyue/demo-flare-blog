import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PostsPageProps } from "@/features/theme/contract/pages";
import { PostItem } from "@/features/theme/themes/flare/components/post-item";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const INITIAL_TAG_COUNT = 8;

export function PostsPage({
  posts,
  tags,
  selectedTag,
  onTagClick,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PostsPageProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreTags = tags.length > INITIAL_TAG_COUNT;
  const visibleTags = isExpanded ? tags : tags.slice(0, INITIAL_TAG_COUNT);

  // Infinite scroll observer
  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "0px" },
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="w-full space-y-4 md:space-y-6 flare-enter">
      <section className="flare-surface p-5 md:p-7 space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {m.nav_posts()}
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
            {siteConfig.description}
          </p>
        </header>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{m.posts_tags_filter()}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onTagClick(undefined)}
              className={cn(
                "flare-chip",
              )}
              data-active={!selectedTag}
            >
              {m.posts_all()}
            </button>

            {visibleTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => onTagClick(tag.name)}
                className="flare-chip"
                data-active={selectedTag === tag.name}
              >
                <span>{tag.name}</span>
                <span className="text-xs opacity-70 tabular-nums">
                  {tag.postCount}
                </span>
              </button>
            ))}

            {hasMoreTags && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flare-chip border-dashed"
              >
                {isExpanded
                  ? m.tags_collapse()
                  : `+${tags.length - INITIAL_TAG_COUNT}`}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="flare-surface overflow-hidden">
        <div className="px-2 md:px-4">
          {posts.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">{m.posts_no_posts()}</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="px-3 md:px-3">
                <PostItem post={post} />
              </div>
            ))
          )}
        </div>
      </section>

      <div
        ref={observerRef}
        className="py-12 flex flex-col items-center justify-center gap-4"
      >
        {isFetchingNextPage ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-foreground/70 rounded-full animate-ping" />
            <span className="text-xs tracking-[0.2em] uppercase">
              {m.posts_loading()}
            </span>
          </div>
        ) : hasNextPage ? (
          <div className="h-px w-24 bg-border/50" />
        ) : posts.length > 0 ? (
          <div className="flex items-center gap-4 text-muted-foreground/40">
            <span className="h-px w-12 bg-current" />
            <span className="text-base font-serif italic">{m.posts_end()}</span>
            <span className="h-px w-12 bg-current" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
