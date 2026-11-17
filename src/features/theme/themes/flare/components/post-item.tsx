import { ClientOnly, Link } from "@tanstack/react-router";
import { Eye, Pin, User } from "lucide-react";
import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostItem as PostItemType } from "@/features/posts/schema/posts.schema";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface PostItemProps {
  post: PostItemType;
  pinned?: boolean;
  views?: number;
  isLoadingViews?: boolean;
}

export const PostItem = memo(
  ({ post, pinned, views, isLoadingViews }: PostItemProps) => {
    return (
      <article className="flare-post-card flare-surface group relative overflow-hidden">
        <Link
          to="/post/$slug"
          params={{ slug: post.slug }}
          className="flex h-full flex-col"
        >
          <div className="flare-tile-lead" aria-hidden="true">
            {Array.from(post.title.trim()).find((character) =>
              /[\p{L}\p{N}]/u.test(character),
            ) ?? ""}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="order-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
              <time
                dateTime={post.publishedAt?.toISOString()}
                className="whitespace-nowrap tabular-nums"
              >
                <ClientOnly fallback="-">
                  {formatDate(post.publishedAt)}
                </ClientOnly>
              </time>
              {post.author ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <User size={12} />
                    {post.author}
                  </span>
                </>
              ) : null}
              <span>{m.read_time({ count: post.readTimeInMinutes })}</span>
              {isLoadingViews ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Eye size={12} />
                    <Skeleton className="h-3 w-10 rounded bg-muted-foreground/20" />
                  </span>
                </>
              ) : views !== undefined ? (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                    <Eye size={12} />
                    {m.post_views_count({ count: views })}
                  </span>
                </>
              ) : null}
            </div>

            <h3
              className="order-1 flex items-start gap-2 text-xl font-bold leading-relaxed text-foreground transition-colors duration-200 group-hover:text-primary md:text-2xl"
              style={{ viewTransitionName: `post-title-${post.slug}` }}
            >
              {pinned ? (
                <Pin
                  size={15}
                  className="mt-1.5 shrink-0 text-muted-foreground/60"
                  strokeWidth={1.75}
                />
              ) : null}
              <span className="line-clamp-3 break-words">{post.title}</span>
            </h3>

            {post.summary ? (
              <p className="order-2 line-clamp-3 text-[15px] leading-7 text-muted-foreground">
                {post.summary}
              </p>
            ) : null}
          </div>
        </Link>
      </article>
    );
  },
);

PostItem.displayName = "PostItem";
