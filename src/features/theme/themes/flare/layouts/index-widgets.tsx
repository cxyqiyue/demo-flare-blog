import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FolderOpen, Hash, MessageSquare } from "lucide-react";
import { categoriesQueryOptions } from "@/features/categories/queries";
import { publicMomentsPageQuery } from "@/features/moments/queries";
import { convertToPlainText } from "@/features/posts/utils/content";
import { tagsQueryOptions } from "@/features/tags/queries";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

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
        <div>
          {categories.data?.length ? (
            categories.data.map((category) => (
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
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {categories.isPending
                ? m.posts_loading()
                : categories.isError
                  ? m.categories_load_failed()
                  : m.categories_empty()}
            </span>
          )}
        </div>
      </section>
      <section className="flare-surface flare-index-card">
        <h2>
          <Hash size={16} />
          {m.tags_title()}
        </h2>
        <div>
          {tags.data?.length ? (
            tags.data.map((tag) => (
              <Link
                key={tag.id}
                to="/posts"
                search={{ tagName: tag.name }}
                className="flare-chip"
              >
                {tag.name}
              </Link>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {tags.isPending
                ? m.posts_loading()
                : tags.isError
                  ? m.tags_load_failed()
                  : m.tags_empty()}
            </span>
          )}
        </div>
      </section>
    </aside>
  );
}

export function LatestMoments() {
  const query = useQuery(publicMomentsPageQuery({ offset: 0, limit: 3 }));
  return (
    <aside
      className="flare-surface p-5 md:p-6"
      data-place="after"
      aria-label={m.moments_title()}
    >
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <MessageSquare size={16} />
        {m.moments_comment_aria_label()}
      </h2>
      <div className="divide-y divide-border/50">
        {query.data?.items.length ? (
          query.data.items.map((moment) => (
            <Link
              key={moment.id}
              to="/moments"
              search={{ momentId: moment.id }}
              hash={`moment-${moment.id}`}
              className="block space-y-2 py-3 first:pt-0 hover:text-primary"
            >
              <time
                className="text-xs text-muted-foreground"
                dateTime={new Date(moment.createdAt).toISOString()}
              >
                {new Date(moment.createdAt).toLocaleDateString(
                  getLocale() === "zh" ? "zh-CN" : "en-US",
                  {
                    timeZone: "UTC",
                  },
                )}
              </time>
              <p className="line-clamp-3 text-sm leading-7">
                {moment.content
                  ? convertToPlainText(moment.content)
                  : moment.videoUrl
                    ? m.moments_video()
                    : moment.images.length
                      ? m.moments_image()
                      : m.moments_generic()}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {query.isPending ? m.posts_loading() : m.moments_empty()}
          </p>
        )}
      </div>
      <Link to="/moments" className="mt-4 inline-block text-sm text-primary">
        {m.moments_view_all()}
      </Link>
    </aside>
  );
}
