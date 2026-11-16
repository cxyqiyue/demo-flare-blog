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
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-4">
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
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              !selectedTag
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {m.posts_all()}
          </button>

          {visibleTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onTagClick(tag.name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                selectedTag === tag.name
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <span>{tag.name}</span>
              <span className="text-xs opacity-70 tabular-nums">{tag.postCount}</span>
            </button>
          ))}

          {hasMoreTags && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center rounded-full border border-dashed border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {isExpanded
                ? m.tags_collapse()
                : `+${tags.length - INITIAL_TAG_COUNT}`}
            </button>
          )}
        </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
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

      {/* Load More Area */}
      <div
        ref={observerRef}
        className="py-16 flex flex-col items-center justify-center gap-6"
      >
        {isFetchingNextPage ? (
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500 fill-mode-both">
            <div className="w-1.5 h-1.5 bg-foreground animate-ping" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground uppercase">
              {m.posts_loading()}
            </span>
          </div>
        ) : hasNextPage ? (
          <div className="h-px w-24 bg-border/40"></div>
        ) : posts.length > 0 ? (
          <div className="flex items-center gap-4 text-muted-foreground/20">
            <span className="h-px w-12 bg-current" />
            <span className="text-lg font-serif italic">{m.posts_end()}</span>
            <span className="h-px w-12 bg-current" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
