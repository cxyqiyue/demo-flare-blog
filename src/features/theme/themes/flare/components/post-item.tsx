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
      <article className="group border-b border-border/40 last:border-0">
        <Link
          to="/post/$slug"
          params={{ slug: post.slug }}
          className="block rounded-xl px-3 py-5 transition-colors duration-200 hover:bg-muted/35 md:px-4 md:py-6 -mx-1 md:-mx-2"
        >
          <div className="flex flex-col gap-2 md:gap-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
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
              {post.tags && post.tags.length > 0 ? (
                <>
                  <span className="text-border">·</span>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag.id} className="whitespace-nowrap">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
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
              className="flex items-start gap-2 text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors duration-200 group-hover:text-foreground/75 md:text-xl"
              style={{ viewTransitionName: `post-title-${post.slug}` }}
            >
              {pinned ? (
                <Pin
                  size={15}
                  className="mt-1.5 shrink-0 text-muted-foreground/60"
                  strokeWidth={1.75}
                />
              ) : null}
              <span className="line-clamp-2">{post.title}</span>
            </h3>

            {post.summary ? (
              <p className="mt-0.5 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-[15px] md:leading-7">
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
