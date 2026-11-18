import { Link } from "@tanstack/react-router";
import { ArrowDown, X } from "lucide-react";
import { useMemo } from "react";
import type { PostsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { CollapsibleChips } from "../../components/collapsible-chips";

export function PostsPage({
  posts,
  selectedTag,
  selectedCategory,
  onTagClick,
  onCategoryClick,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PostsPageProps) {
  const years = useMemo(() => {
    const groups = new Map<string, typeof posts>();
    const sorted = [...posts].sort(
      (a, b) =>
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );
    for (const post of sorted) {
      const date = post.publishedAt;
      const year =
        date && !Number.isNaN(date.getTime())
          ? String(date.getUTCFullYear())
          : "—";
      const group = groups.get(year) ?? [];
      group.push(post);
      groups.set(year, group);
    }
    return [...groups.entries()];
  }, [posts]);

  return (
    <div className="flare-enter flare-archive flex w-full flex-col gap-4">
      <h1 className="sr-only">{m.nav_posts()}</h1>
      {selectedCategory || selectedTag ? (
        <div className="text-sm" aria-label={m.search_filter_current()}>
          <CollapsibleChips>
            {selectedCategory ? (
              <button
                type="button"
                className="flare-chip min-h-10"
                onClick={() => onCategoryClick?.(undefined)}
                aria-label={m.search_filter_clear_category({
                  name: selectedCategory,
                })}
              >
                {selectedCategory}
                <X size={14} />
              </button>
            ) : null}
            {selectedTag ? (
              <button
                type="button"
                className="flare-chip min-h-10"
                onClick={() => onTagClick(undefined)}
                aria-label={m.search_filter_clear_tag({ name: selectedTag })}
              >
                #{selectedTag}
                <X size={14} />
              </button>
            ) : null}
          </CollapsibleChips>
        </div>
      ) : null}
      <section className="flare-surface p-4 sm:p-6 md:p-8">
        {posts.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            {m.posts_no_posts()}
          </p>
        ) : (
          <div className="space-y-8">
            {years.map(([year, entries]) => (
              <section key={year} aria-label={year}>
                <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold tabular-nums">
                  {year}
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {entries.length}
                  </span>
                </h2>
                <ol className="flare-archive-grid">
                  {entries.map((post) => (
                    <li key={post.id} className="min-w-0">
                      <Link
                        to="/post/$slug"
                        params={{ slug: post.slug }}
                        className="group flex h-full min-h-28 items-center gap-3 rounded-xl border border-border/60 bg-(--flare-surface-soft) p-3 transition-colors hover:border-primary/40 hover:bg-primary/5 sm:gap-4 sm:p-4"
                      >
                        <span className="flare-archive-lead" aria-hidden="true">
                          {Array.from(post.title.trim()).find((character) =>
                            /[\p{L}\p{N}]/u.test(character),
                          ) ?? ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 break-words text-base font-semibold leading-7 transition-colors group-hover:text-primary">
                            {post.title}
                          </h3>
                          <time
                            className="mt-2 block text-sm tabular-nums text-muted-foreground"
                            dateTime={post.publishedAt?.toISOString()}
                          >
                            {post.publishedAt
                              ? post.publishedAt
                                  .toISOString()
                                  .slice(0, 10)
                                  .replaceAll("-", "/")
                              : "—"}
                          </time>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
        <div className="flex justify-center pt-6" aria-live="polite">
          {hasNextPage ? (
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
              className="flare-chip min-h-11 px-5 disabled:opacity-50"
            >
              <ArrowDown size={16} />
              {isFetchingNextPage ? m.posts_loading() : m.tags_expand()}
            </button>
          ) : posts.length > 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {m.posts_end()}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
