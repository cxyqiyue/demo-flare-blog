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
    <div className="flare-enter flex w-full flex-col gap-4">
      <section className="flare-surface overflow-hidden">
        <header className="flex flex-col gap-2 px-5 pb-2 pt-6 md:flex-row md:items-end md:justify-between md:gap-6 md:px-8 md:pt-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.5rem]">
              {m.nav_posts()}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-[15px]">
              {siteConfig.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted/60 px-2.5 py-0.5 font-mono tabular-nums">
              {tags.length}
            </span>
            <span>{m.tags_title()}</span>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-5 py-5 md:px-8">
          <button
            onClick={() => onTagClick(undefined)}
            className={cn("flare-chip")}
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
              <span className="text-xs tabular-nums opacity-70">
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

        <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 min-[1200px]:grid-cols-2">
          {posts.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">{m.posts_no_posts()}</p>
            </div>
          ) : (
            posts.map((post) => <PostItem key={post.id} post={post} />)
          )}
        </div>

        <div
          ref={observerRef}
          className="flex flex-col items-center justify-center gap-4 px-5 py-8"
        >
          {isFetchingNextPage ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-1.5 w-1.5 animate-ping rounded-full bg-foreground/70" />
              <span className="text-xs uppercase tracking-[0.2em]">
                {m.posts_loading()}
              </span>
            </div>
          ) : hasNextPage ? (
            <div className="h-px w-24 bg-border/50" />
          ) : posts.length > 0 ? (
            <div className="flex items-center gap-4 text-muted-foreground/40">
              <span className="h-px w-12 bg-current" />
              <span className="text-sm text-muted-foreground/70">
                {m.posts_end()}
              </span>
              <span className="h-px w-12 bg-current" />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
