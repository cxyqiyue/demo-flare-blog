import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { PostsPageProps } from "@/features/theme/contract/pages";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const INITIAL_TAG_COUNT = 8;

export function PostsPage({
  posts,
  tags,
  selectedTag,
  onTagClick,
  categories = [],
  selectedCategory,
  onCategoryClick,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PostsPageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreTags = tags.length > INITIAL_TAG_COUNT;
  const visibleTags = isExpanded ? tags : tags.slice(0, INITIAL_TAG_COUNT);

  const years = useMemo(() => {
    const groups = new Map<string, typeof posts>();
    for (const post of posts) {
      const date = post.publishedAt ? new Date(post.publishedAt) : null;
      const year =
        date && !Number.isNaN(date.getTime())
          ? String(date.getUTCFullYear())
          : "—";
      const group = groups.get(year) ?? [];
      group.push(post);
      groups.set(year, group);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [posts]);

  return (
    <div className="flare-enter flex w-full flex-col gap-4">
      <section className="flare-surface overflow-hidden">
        <h1 className="sr-only">{m.nav_posts()}</h1>
        {
          <>
            <div
              className="flex flex-wrap items-center gap-2 px-5 pt-5 md:px-8"
              aria-label="分类"
            >
              <span className="mr-2 text-sm font-semibold">分类</span>
              <button
                type="button"
                onClick={() => onCategoryClick?.(undefined)}
                className="flare-chip"
                data-active={!selectedCategory}
                aria-pressed={!selectedCategory}
              >
                {m.posts_all()}
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => onCategoryClick?.(category.name)}
                  className="flare-chip"
                  data-active={selectedCategory === category.name}
                  aria-pressed={selectedCategory === category.name}
                >
                  {category.name}
                  <span className="text-xs tabular-nums opacity-70">
                    {category.postCount}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-5 py-5 md:px-8">
              <span className="mr-2 text-sm font-semibold">
                {m.tags_title()}
              </span>
              <button
                type="button"
                onClick={() => onTagClick(undefined)}
                className={cn("flare-chip")}
                data-active={!selectedTag}
                aria-pressed={!selectedTag}
              >
                {m.posts_all()}
              </button>

              {visibleTags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => onTagClick(tag.name)}
                  className="flare-chip"
                  data-active={selectedTag === tag.name}
                  aria-pressed={selectedTag === tag.name}
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
          </>
        }
        <div className="space-y-8 px-5 py-6 md:px-8">
          {posts.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">{m.posts_no_posts()}</p>
            </div>
          ) : (
            years.map(([year, entries]) => (
              <section key={year} aria-label={year}>
                <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold tabular-nums">
                  {year}
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {entries.length}
                  </span>
                </h2>
                <ol>
                  {entries.map((post) => (
                    <li
                      key={post.id}
                      className="relative border-b border-border/40 last:border-0"
                    >
                      <Link
                        to="/post/$slug"
                        params={{ slug: post.slug }}
                        className="group flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-muted/30 sm:gap-4"
                      >
                        <span className="flare-archive-lead" aria-hidden="true">
                          {Array.from(post.title.trim()).find((character) =>
                            /[\p{L}\p{N}]/u.test(character),
                          ) ?? ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-semibold leading-7 group-hover:text-primary">
                            {post.title}
                          </h3>
                          <div className="mt-1 flex min-w-0 items-baseline gap-2">
                            <time
                              className="shrink-0 text-xs tabular-nums text-muted-foreground"
                              dateTime={
                                post.publishedAt
                                  ? new Date(post.publishedAt).toISOString()
                                  : undefined
                              }
                            >
                              {post.publishedAt
                                ? new Date(post.publishedAt)
                                    .toISOString()
                                    .slice(5, 10)
                                    .replace("-", "/")
                                : "—"}
                            </time>
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {post.tags
                                ?.map((tag) => `#${tag.name}`)
                                .join(" ")}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-4 px-5 py-8">
          {isFetchingNextPage ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-1.5 w-1.5 animate-ping rounded-full bg-foreground/70" />
              <span className="text-xs uppercase tracking-[0.2em]">
                {m.posts_loading()}
              </span>
            </div>
          ) : hasNextPage ? (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              className="flare-chip"
            >
              {m.tags_expand()}
            </button>
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
