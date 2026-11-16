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
      <div className="group border-b border-border/35 last:border-0">
        <Link
          to="/post/$slug"
          params={{ slug: post.slug }}
          className="block py-5 md:py-6 transition-all duration-200 hover:bg-muted/20 -mx-2 px-2 md:-mx-3 md:px-3 rounded-2xl"
        >
          <div className="flex flex-col gap-2.5 md:gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs md:text-[13px] text-muted-foreground/70">
              <time
                dateTime={post.publishedAt?.toISOString()}
                className="whitespace-nowrap tabular-nums"
              >
                <ClientOnly fallback="-">{formatDate(post.publishedAt)}</ClientOnly>
              </time>
              {post.author ? (
                <>
                  <span className="opacity-30">/</span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <User size={12} />
                    {post.author}
                  </span>
                </>
              ) : null}
              {post.tags && post.tags.length > 0 ? (
                <>
                  <span className="opacity-30">/</span>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag.id}
                        className="whitespace-nowrap text-muted-foreground/70"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {isLoadingViews ? (
                <>
                  <span className="opacity-30">/</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Eye size={12} />
                    <Skeleton className="h-3 w-10 rounded bg-muted-foreground/20" />
                  </span>
                </>
              ) : views !== undefined ? (
                <>
                  <span className="opacity-30">/</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Eye size={12} />
                    {m.post_views_count({ count: views })}
                  </span>
                </>
              ) : null}
            </div>

            <h3
              className="text-xl md:text-2xl font-semibold text-foreground group-hover:text-foreground/80 transition-colors duration-300 flex items-start gap-2.5 leading-snug tracking-tight"
              style={{ viewTransitionName: `post-title-${post.slug}` }}
            >
              {pinned ? (
                <Pin
                  size={18}
                  className="mt-1 shrink-0 text-muted-foreground/55"
                  strokeWidth={1.75}
                />
              ) : null}
              <span className="line-clamp-2">{post.title}</span>
            </h3>

            {post.summary ? (
              <p className="text-muted-foreground leading-7 max-w-3xl line-clamp-2 text-sm md:text-[15px] mt-0.5">
                {post.summary}
              </p>
            ) : null}
          </div>
        </Link>
      </div>
    );
  },
);

PostItem.displayName = "PostItem";
