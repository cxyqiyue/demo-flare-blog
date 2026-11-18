import { useQuery } from "@tanstack/react-query";
import { ClientOnly, Link } from "@tanstack/react-router";
import { ChevronRight, FolderOpen, Hash, Play } from "lucide-react";
import { categoriesQueryOptions } from "@/features/categories/queries";
import { publicMomentsPageQuery } from "@/features/moments/queries";
import { convertToPlainText } from "@/features/posts/utils/content";
import { tagsQueryOptions } from "@/features/tags/queries";
import { formatTimeAgo } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CollapsibleChips } from "../components/collapsible-chips";

export function IndexWidgets() {
  const categories = useQuery(categoriesQueryOptions);
  const tags = useQuery(tagsQueryOptions);
  return (
    <aside
      className="flare-index-widgets"
      aria-label={`${m.categories_title()}、${m.tags_title()}`}
    >
      <section className="flare-surface flare-index-card">
        <h2>
          <FolderOpen size={16} />
          {m.categories_title()}
        </h2>
        {categories.data?.length ? (
          <CollapsibleChips>
            {categories.data.map((category) => (
              <Link
                key={category.id}
                to="/posts"
                search={{ categoryName: category.name }}
                className="flare-chip"
              >
                {category.name}
                <span className="text-xs tabular-nums opacity-70">
                  {category.postCount}
                </span>
              </Link>
            ))}
          </CollapsibleChips>
        ) : (
          <span className="text-sm text-muted-foreground">
            {categories.isPending
              ? m.posts_loading()
              : categories.isError
                ? m.categories_load_failed()
                : m.categories_empty()}
          </span>
        )}
      </section>
      <section className="flare-surface flare-index-card">
        <h2>
          <Hash size={16} />
          {m.tags_title()}
        </h2>
        {tags.data?.length ? (
          <CollapsibleChips>
            {tags.data.map((tag) => (
              <Link
                key={tag.id}
                to="/posts"
                search={{ tagName: tag.name }}
                className="flare-chip"
              >
                {tag.name}
              </Link>
            ))}
          </CollapsibleChips>
        ) : (
          <span className="text-sm text-muted-foreground">
            {tags.isPending
              ? m.posts_loading()
              : tags.isError
                ? m.tags_load_failed()
                : m.tags_empty()}
          </span>
        )}
      </section>
    </aside>
  );
}

export function LatestMoments() {
  const query = useQuery(publicMomentsPageQuery({ offset: 0, limit: 3 }));
  return (
    <aside
      className="flare-surface @container px-4 py-3 sm:px-5"
      data-place="after"
      aria-label={m.flare_recent_moments()}
    >
      <h2 className="mb-1 text-base font-semibold">
        <Link
          to="/moments"
          className="inline-flex min-h-11 items-center gap-1 hover:text-primary"
        >
          {m.flare_recent_moments()}
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </h2>
      {query.data?.items.length ? (
        <ul className="grid gap-1 @lg:grid-cols-2 @3xl:grid-cols-3">
          {query.data.items.map((moment) => {
            const date = new Date(moment.createdAt);
            const dateLabel = date.toLocaleDateString(getLocale(), {
              timeZone: "UTC",
              dateStyle: "long",
            });
            const summary = moment.content
              ? convertToPlainText(moment.content).trim()
              : "";
            const thumbnail = moment.images[0];
            return (
              <li key={moment.id} className="min-w-0">
                <Link
                  to="/moments"
                  search={{ momentId: moment.id }}
                  hash={`moment-${moment.id}`}
                  className="flex min-h-17 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 @lg:flex-row-reverse"
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : moment.videoUrl ? (
                    <span
                      className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-primary"
                      aria-hidden="true"
                    >
                      <Play size={20} />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <time
                      className="block text-xs text-muted-foreground"
                      dateTime={date.toISOString()}
                      title={dateLabel}
                    >
                      <ClientOnly fallback={dateLabel}>
                        {formatTimeAgo(date)}
                      </ClientOnly>
                    </time>
                    <p className="line-clamp-2 wrap-anywhere text-sm leading-5">
                      {summary ||
                        (moment.videoUrl
                          ? m.moments_video()
                          : thumbnail
                            ? m.moments_image()
                            : m.moments_generic())}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {query.isPending ? m.posts_loading() : m.moments_empty()}
        </p>
      )}
    </aside>
  );
}
